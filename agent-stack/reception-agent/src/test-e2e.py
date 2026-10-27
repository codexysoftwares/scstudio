"""
Testes end-to-end do agente Julia — fluxos reais multi-turno.

Cada teste verifica:
  - Fase da conversa após a mensagem (booking / confirm / payment / cancel)
  - Conteúdo da resposta (palavras obrigatórias / proibidas)

Uso:
  python src/test-e2e.py          # roda contra a VPS
  python src/test-e2e.py --local  # localhost:3005

Processo de deploy:
  1. Edita index.mjs
  2. python src/test-e2e.py  →  todos OK?
  3. python deploy_agent.py  →  só agora deploya
"""

import paramiko, json, time, sys, argparse, http.client
from datetime import datetime, timedelta

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

# ── config ───────────────────────────────────────────────────────────────────
HOST, USER, PWD = '80.241.218.217', 'root', 'Hachi1311'
AGENT_HOST      = '127.0.0.1'
AGENT_PORT      = 3005
SECRET          = 'scstudio-secret'
RUN_TAG         = datetime.now().strftime('%H%M%S')
PHONE_BASE      = f'5599E{RUN_TAG}'   # E = e2e, nunca colide com numeros reais

parser = argparse.ArgumentParser()
parser.add_argument('--local', action='store_true')
args = parser.parse_args()
USE_SSH = not args.local

# ── SSH ───────────────────────────────────────────────────────────────────────
ssh = None

def _make_ssh():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PWD, timeout=20)
    c.get_transport().set_keepalive(10)
    return c

def ensure_ssh():
    global ssh
    try:
        if ssh and ssh.get_transport() and ssh.get_transport().is_active():
            return
    except Exception:
        pass
    print('  [ssh] reconnecting...')
    try:
        ssh.close()
    except Exception:
        pass
    ssh = _make_ssh()

if USE_SSH:
    ssh = _make_ssh()

# ── cleanup ──────────────────────────────────────────────────────────────────
def cleanup_test_bookings():
    """Remove all bookings from test phone numbers (5599E prefix) before running."""
    if not USE_SSH:
        return
    ensure_ssh()
    sql = "DELETE FROM bookings WHERE customer_id IN (SELECT id FROM customers WHERE phone LIKE '5599E%')"
    cmd = f"docker exec scstudio-postgres psql -U scstudio -d scstudio -c \"{sql}\""
    _, stdout, _ = ssh.exec_command(cmd)
    result = stdout.read().decode('utf-8', errors='replace').strip()
    print(f'[cleanup] {result}')

cleanup_test_bookings()

# ── helpers ───────────────────────────────────────────────────────────────────
_msg_counter = {}

def _http(payload_str, _retry=True):
    headers = {'Content-Type': 'application/json',
               'x-webhook-secret': SECRET, 'Connection': 'close'}
    try:
        if USE_SSH:
            ensure_ssh()
            chan = ssh.get_transport().open_channel(
                'direct-tcpip', (AGENT_HOST, AGENT_PORT), ('127.0.0.1', 0))
            conn = http.client.HTTPConnection(AGENT_HOST, AGENT_PORT, timeout=60)
            conn.sock = chan
        else:
            conn = http.client.HTTPConnection(AGENT_HOST, AGENT_PORT, timeout=60)
        conn.request('POST', '/webhooks/evolution',
                     body=payload_str.encode('utf-8'), headers=headers)
        resp = conn.getresponse()
        raw = resp.read().decode('utf-8', errors='replace')
        conn.close()
        return raw
    except (EOFError, OSError) as e:
        if _retry and USE_SSH:
            print(f'  [ssh] _http dropped ({e}), reconnecting...')
            ensure_ssh()
            return _http(payload_str, _retry=False)
        raise

def send(phone, msg, push_name='Teste', delay=2.5):
    _msg_counter[phone] = _msg_counter.get(phone, 0) + 1
    payload = json.dumps({
        'event': 'messages.upsert', 'instance': 'studio-sc',
        'data': {
            'key': {'remoteJid': f'{phone}@s.whatsapp.net', 'fromMe': False,
                    'id': f'E{phone}{_msg_counter[phone]:04d}'},
            'message': {'conversation': msg},
            'messageType': 'conversation',
            'pushName': push_name,
        }
    })
    try:
        _http(payload)
    except Exception as e:
        print(f'    [send error] {e}')
    time.sleep(delay)

def get_logs(n=60, _retry=True):
    if not USE_SSH:
        return ''
    try:
        ensure_ssh()
        _, out, _ = ssh.exec_command(
            f'docker logs scstudio-reception-agent --tail {n} 2>&1')
        return out.read().decode('utf-8', errors='replace')
    except (EOFError, OSError) as e:
        if _retry:
            print(f'  [ssh] get_logs dropped ({e}), reconnecting...')
            ensure_ssh()
            return get_logs(n, _retry=False)
        raise

def last_phase_and_out(phone, logs):
    """Extrai a fase e a última resposta do agente para este phone nos logs."""
    short = phone  # logs usam phone sem @
    phase = None
    out   = None
    for line in reversed(logs.splitlines()):
        if phase is None and f'[phase] {short}' in line:
            parts = line.split('|')
            if len(parts) >= 2:
                phase = parts[0].split()[-1].strip()
        if out is None and f'[out→{short}]' in line:
            out = line.split(']', 1)[-1].strip() if ']' in line else line
        if phase and out:
            break
    return phase or '?', out or ''

# ── runner ────────────────────────────────────────────────────────────────────
passed = failed = 0
results = []

def step(phone, msg, expected_phase,
         must_contain=(), must_not_contain=(),
         push_name='Teste', delay=12.0, label=''):
    global passed, failed
    send(phone, msg, push_name=push_name, delay=delay)
    logs = get_logs(200)
    phase, out = last_phase_and_out(phone, logs)

    phase_ok   = (phase in expected_phase) if isinstance(expected_phase, list) else (phase == expected_phase)
    contain_ok = all(kw.lower() in out.lower() for kw in must_contain)
    exclude_ok = not any(kw.lower() in out.lower() for kw in must_not_contain)
    ok = phase_ok and contain_ok and exclude_ok

    if ok:
        passed += 1
        status = 'OK  '
    else:
        failed += 1
        status = 'FAIL'

    tag = f'[{label}] ' if label else ''
    print(f'  {status} phase={phase:<8} {tag}"{msg[:55]}"')
    if not phase_ok:
        print(f'         phase esperada: {expected_phase}')
    if not contain_ok:
        missing = [kw for kw in must_contain if kw.lower() not in out.lower()]
        print(f'         faltou na resposta: {missing}')
        print(f'         resposta: {out[:120]}')
    if not exclude_ok:
        found = [kw for kw in must_not_contain if kw.lower() in out.lower()]
        print(f'         proibido apareceu: {found}')
        print(f'         resposta: {out[:120]}')

    results.append({'label': label or msg[:40], 'ok': ok,
                    'phase': phase, 'out': out[:200]})
    return ok

def suite(name):
    print(f'\n{"="*65}\n  {name}\n{"-"*65}')

def p(phone_suffix):
    """Gera phone único para este run."""
    return f'{PHONE_BASE}{phone_suffix}'

# ── data helpers ─────────────────────────────────────────────────────────────
hoje    = datetime.now()
amanha  = (hoje + timedelta(days=1)).strftime('%d/%m')
proxima_sexta = hoje + timedelta(days=(4 - hoje.weekday()) % 7 or 7)
sexta_str = proxima_sexta.strftime('sexta-feira, dia %d de %B').replace(
    'January','janeiro').replace('February','fevereiro').replace('March','março')\
    .replace('April','abril').replace('May','maio').replace('June','junho')\
    .replace('July','julho').replace('August','agosto').replace('September','setembro')\
    .replace('October','outubro').replace('November','novembro').replace('December','dezembro')

# ═══════════════════════════════════════════════════════════════════════════════
# SUITE 1 — Saudação inicial
# ═══════════════════════════════════════════════════════════════════════════════
suite('SUITE 1 — Saudação inicial')
step(p('S01'), 'oi boa tarde', 'booking',
     must_not_contain=['Fica assim', 'Confirma'],
     push_name='Suellen Costa', label='saudacao simples')

step(p('S02'), 'Oi! Tudo bem? Preciso marcar horário', 'booking',
     must_not_contain=['Fica assim'],
     push_name='Kaike', label='saudacao + intenção')

# ═══════════════════════════════════════════════════════════════════════════════
# SUITE 2 — Fluxo completo pé e mão (happy path da Suellen)
# Usa "qualquer horário" para não depender de slot específico disponível
# ═══════════════════════════════════════════════════════════════════════════════
suite('SUITE 2 — Fluxo completo pé e mão (happy path)')
P2 = p('F01')
step(P2, 'Gostaria de fazer pé e mão amanhã, pode ser qualquer horário disponível', 'confirm',
     must_contain=['Confirma'],
     must_not_contain=['que ótimo que você quer confirmar'],
     push_name='Suellen Costa', label='oneshot pé e mão → confirm')

step(P2, 'confirmado', 'payment',
     must_contain=['PIX', '27.333.912'],
     must_not_contain=['que ótimo'],
     push_name='Suellen Costa', label='confirma → payment + PIX')

# ═══════════════════════════════════════════════════════════════════════════════
# SUITE 3 — Payment phase: sem interceptação, sem dupla mensagem
# ═══════════════════════════════════════════════════════════════════════════════
suite('SUITE 3 — Payment phase: perguntas NÃO desviam para info handler')
P3 = p('F02')
# Usa "depois de amanhã" para não esgotar slots de amanhã (Suite 9 usa amanhã)
step(P3, 'quero pé e mão depois de amanhã, pode ser qualquer horário', 'confirm',
     must_contain=['Confirma'], push_name='Suellen Costa', label='setup confirm')
step(P3, 'sim', 'payment',
     must_contain=['PIX'], push_name='Suellen Costa', label='setup payment')

# Bug histórico: dinheiro → interceptado pelo isInfo → 2 mensagens
step(P3, 'vou efetuar o pagamento em dinheiro na hora pode ser?', 'payment',
     must_contain=['PIX'],
     push_name='Suellen Costa', label='dinheiro em payment → 1 resposta só')

# Bug histórico: "tem horário pra mão" → caia no fallback burro
# Basta ficar na fase payment — a resposta exata varia (LLM parafraseia PIX/sinal)
step(P3, 'Será que tem horário pra mão também', 'payment',
     must_not_contain=['pode me mandar o comprovante por aqui'],
     push_name='Suellen Costa', label='outro serviço em payment → permanece na fase')

# ═══════════════════════════════════════════════════════════════════════════════
# SUITE 4 — Confirm phase: "com a Kelly" não pode ser ignorado
# ═══════════════════════════════════════════════════════════════════════════════
suite('SUITE 4 — Confirm phase: pedido de profissional específica')
P4 = p('F03')
step(P4, 'quero pé e mão amanhã, pode ser qualquer horário', 'confirm',
     must_contain=['Confirma'], push_name='Suellen Costa', label='setup confirm')

# Bug histórico: "com a Kelly" → ignorado, repetia o card sem responder
step(P4, 'Gostaria de fazer com a Kelly tem horário', ['confirm', 'booking'],
     must_not_contain=['que ótimo'],
     push_name='Suellen Costa', label='preferência de profissional detectada')

# ═══════════════════════════════════════════════════════════════════════════════
# SUITE 5 — Horário indisponível: NÃO pode fazer fuzzy silencioso
# ═══════════════════════════════════════════════════════════════════════════════
suite('SUITE 5 — Horário pedido indisponível: avisa, não fuzzy silencioso')
P5 = p('F04')
# Usa 00h — nunca disponível em salão
step(P5, 'quero pé e mão amanhã às 00h', 'booking',
     must_contain=['não está disponível'],
     must_not_contain=['Confirma'],
     push_name='Kaike', label='horário inexistente → avisa e lista slots')

# ═══════════════════════════════════════════════════════════════════════════════
# SUITE 6 — Info em booking phase: funciona normalmente
# ═══════════════════════════════════════════════════════════════════════════════
suite('SUITE 6 — Info em booking phase: respondida normalmente')
P6 = p('F05')
step(P6, 'quanto custa o banho de gel?', ['booking', 'closing'],
     must_contain=['banho de gel'],
     push_name='Kaike', label='preço de serviço')

step(p('F06'), 'quais serviços vocês fazem?', ['booking', 'closing'],
     must_contain=['Studio'],
     push_name='Kaike', label='lista de serviços')

# ═══════════════════════════════════════════════════════════════════════════════
# SUITE 7 — Info em payment phase: vai para o handler correto (não info handler)
# ═══════════════════════════════════════════════════════════════════════════════
suite('SUITE 7 — Info em payment phase: NÃO bypassa handler de payment')
P7 = p('F07')
step(P7, 'quero pé e mão depois de amanhã, pode ser qualquer horário', 'confirm',
     push_name='Kaike', label='setup')
step(P7, 'sim', 'payment',
     must_contain=['PIX'], push_name='Kaike', label='setup payment')

step(P7, 'quanto custa o pé?', 'payment',
     must_contain=['PIX'],
     push_name='Kaike', label='info sobre preço em payment → lembra PIX')

# ═══════════════════════════════════════════════════════════════════════════════
# SUITE 8 — Cancelamento sem agendamento prévio
# ═══════════════════════════════════════════════════════════════════════════════
suite('SUITE 8 — Cancelamento sem agendamento: informa e volta para idle')
P8 = p('F08')
step(P8, 'quero cancelar meu horário', 'booking',
     must_contain=['cancel'],  # aceita "cancelar" e "cancelamento"
     push_name='Kaike', label='cancel sem booking ativo → informa e fica em booking')

# ═══════════════════════════════════════════════════════════════════════════════
# SUITE 9 — Mudança de ideia no confirm: data diferente
# ═══════════════════════════════════════════════════════════════════════════════
suite('SUITE 9 — Mudança de data no confirm')
P9 = p('F09')
step(P9, 'quero pé e mão amanhã, pode ser qualquer horário', 'confirm',
     must_contain=['Confirma'], push_name='Kaike', label='setup confirm')
step(P9, 'na verdade quero para sábado', ['booking', 'confirm'],
     must_not_contain=['que ótimo que você quer confirmar'],
     push_name='Kaike', label='mudança de data no confirm → volta para booking')

# ═══════════════════════════════════════════════════════════════════════════════
# RESULTADO
# ═══════════════════════════════════════════════════════════════════════════════
total = passed + failed
pct   = 100 * passed // total if total else 0
print(f'\n{"="*65}')
print(f'RESULTADO: {passed} OK  {failed} FAIL  de {total}  ({pct}%)')

if failed:
    print('\nFalhas:')
    for r in results:
        if not r['ok']:
            print(f'  • {r["label"]}')
            print(f'    phase={r["phase"]}  out={r["out"][:100]}')

# Respostas completas para revisão humana
print(f'\n{"-"*65}')
print('RESPOSTAS DO AGENTE (revisão humana):')
if USE_SSH:
    logs = get_logs(200)
    for line in logs.splitlines():
        if '[out→' in line and 'E{}'.format(RUN_TAG) in line:
            print(' ', line[:140])

if ssh:
    ssh.close()

sys.exit(0 if failed == 0 else 1)
