"""
Teste massivo de serviços — SC Studio
Cobre todos os 20 serviços + combinações + perfis variados de clientes.

Uso:
  python src/test-services-full.py           # contra VPS
  python src/test-services-full.py --local   # localhost:3005
"""

import paramiko, json, time, sys, argparse, http.client
from datetime import datetime, timedelta

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

HOST, USER, PWD = '80.241.218.217', 'root', 'Hachi1311'
AGENT_HOST      = '127.0.0.1'
AGENT_PORT      = 3005
SECRET          = 'scstudio-secret'
RUN_TAG         = datetime.now().strftime('%H%M%S')
PHONE_BASE      = f'5599M{RUN_TAG}'  # M = massivo

parser = argparse.ArgumentParser()
parser.add_argument('--local', action='store_true')
args = parser.parse_args()
USE_SSH = not args.local

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

def cleanup_test_bookings():
    if not USE_SSH: return
    ensure_ssh()
    sql = "DELETE FROM bookings WHERE customer_id IN (SELECT id FROM customers WHERE phone LIKE '5599M%')"
    cmd = f"docker exec scstudio-postgres psql -U scstudio -d scstudio -c \"{sql}\""
    _, stdout, _ = ssh.exec_command(cmd)
    print(f'[cleanup] {stdout.read().decode("utf-8", errors="replace").strip()}')

cleanup_test_bookings()

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

def send(phone, msg, push_name='Teste', delay=15.0):
    _msg_counter[phone] = _msg_counter.get(phone, 0) + 1
    payload = json.dumps({
        'event': 'messages.upsert', 'instance': 'studio-sc',
        'data': {
            'key': {'remoteJid': f'{phone}@s.whatsapp.net', 'fromMe': False,
                    'id': f'M{phone}{_msg_counter[phone]:04d}'},
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

def get_logs(n=600, _retry=True):
    if not USE_SSH: return ''
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
    short = phone
    phase, out = None, None
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

passed = failed = 0
results = []

def step(phone, msg, expected_phase,
         must_contain=(), must_not_contain=(),
         push_name='Cliente', delay=15.0, label=''):
    global passed, failed
    send(phone, msg, push_name=push_name, delay=delay)
    logs = get_logs(600)
    phase, out = last_phase_and_out(phone, logs)

    phase_ok   = (phase in expected_phase) if isinstance(expected_phase, list) else (phase == expected_phase)
    contain_ok = all(kw.lower() in out.lower() for kw in must_contain)
    exclude_ok = not any(kw.lower() in out.lower() for kw in must_not_contain)
    ok = phase_ok and contain_ok and exclude_ok

    if ok: passed += 1; status = 'OK  '
    else:  failed += 1; status = 'FAIL'

    tag = f'[{label}] ' if label else ''
    print(f'  {status} phase={phase:<8} {tag}"{msg[:60]}"')
    if not phase_ok:
        print(f'         phase esperada={expected_phase}')
    if not contain_ok:
        missing = [kw for kw in must_contain if kw.lower() not in out.lower()]
        print(f'         faltou={missing}')
        print(f'         resposta: {out[:120]}')
    if not exclude_ok:
        found = [kw for kw in must_not_contain if kw.lower() in out.lower()]
        print(f'         proibido={found}')
        print(f'         resposta: {out[:120]}')

    results.append({'label': label or msg[:40], 'ok': ok, 'phase': phase, 'out': out[:200]})
    return ok

def suite(name):
    print(f'\n{"="*70}\n  {name}\n{"-"*70}')

def p(suffix):
    return f'{PHONE_BASE}{suffix}'

# ── Datas dinâmicas ────────────────────────────────────────────────────────────
hoje         = datetime.now()
amanha       = (hoje + timedelta(days=1)).strftime('%d/%m')
dep_amanha   = (hoje + timedelta(days=2)).strftime('%d/%m')
em3dias      = (hoje + timedelta(days=3)).strftime('%d/%m')
em4dias      = (hoje + timedelta(days=4)).strftime('%d/%m')

# ═══════════════════════════════════════════════════════════════════════════════
# SUITE A — Serviços de unhas: reconhecimento individual (1 mensagem completa)
# Objetivo: agente identifica o serviço e chega em confirm (ou pede mais info)
# ═══════════════════════════════════════════════════════════════════════════════
suite('SUITE A — Serviços de unhas: reconhecimento individual')

step(p('A01'), f'quero fazer alongamento nas unhas amanhã, pode ser qualquer horário',
     ['confirm', 'booking'], must_contain=['alongamento'],
     push_name='Ana Paula', label='Alongamento')

step(p('A02'), f'oi quero banho de gel amanhã qualquer horario por favor',
     ['confirm', 'booking'], must_contain=['gel'],
     push_name='Beatriz', label='Banho de gel')

step(p('A03'), f'minha unha quebrou, preciso de colocação de unha quebrada amanhã',
     ['confirm', 'booking'], must_contain=['quebra'],
     push_name='Carolina', label='Colocação de unha quebrada')

step(p('A04'), f'quero decoração nas unhas, tem horário amanhã?',
     ['confirm', 'booking'], must_contain=['decora'],
     push_name='Daniela', label='Decoração')

step(p('A05'), f'só esmaltação da mão amanhã qualquer horário',
     ['confirm', 'booking'], must_contain=['esmaltar', 'esmaltar', 'mão', 'esmalta'],
     push_name='Elaine', label='Esmaltação mão')

step(p('A06'), f'quero esmaltação só no pé amanhã pode qualquer horário',
     ['confirm', 'booking'],
     push_name='Fernanda', label='Esmaltação pé')

step(p('A07'), f'esmaltação em gel nas unhas amanhã, qualquer horário disponível',
     ['confirm', 'booking'], must_contain=['gel'],
     push_name='Gabriela', label='Esmaltação em gel')

step(p('A08'), f'quero fazer francesa definitiva, tem horário amanhã?',
     ['confirm', 'booking'], must_contain=['francesa'],
     push_name='Heloisa', label='Francesa definitiva')

step(p('A09'), f'preciso de manutencao das minhas unh amanha qualquer hora',
     ['confirm', 'booking'], must_contain=['manutenção', 'manut'],
     push_name='Isabela', label='Manutenção (typo)')

step(p('A10'), f'quero manutenção junto com a mão amanhã, qualquer horário',
     ['confirm', 'booking'], must_contain=['manutenção', 'manut'],
     must_not_contain=['pé e mão'],
     push_name='Juliana', label='Manutenção + mão')

step(p('A11'), f'só manicure amanhã pls, qualquer horário',
     ['confirm', 'booking'], must_contain=['mão', 'manicure', 'mão'],
     push_name='Karla', label='Mão (manicure)')

step(p('A12'), f'só pedicure amanhã pode ser qualquer hora',
     ['confirm', 'booking'], must_contain=['pé', 'pedicure', 'pé'],
     push_name='Larissa', label='Pé (pedicure)')

step(p('A13'), f'pé e mão amanhã qualquer horário disponível',
     'confirm', must_contain=['Confirma'],
     push_name='Mariana', label='Pé e Mão (bundle)')

step(p('A14'), f'preciso repor uma unha quebrada amanhã',
     ['confirm', 'booking'], must_contain=['quebra', 'repos'],
     push_name='Natalia', label='Reposição de unha quebrada')

# ═══════════════════════════════════════════════════════════════════════════════
# SUITE B — Cílios e bem-estar
# ═══════════════════════════════════════════════════════════════════════════════
suite('SUITE B — Cílios e bem-estar')

step(p('B01'), f'quero fazer cílio brasileiro amanhã qualquer horário',
     ['confirm', 'booking'], must_contain=['cílio', 'cilios', 'cilio', 'brasileir'],
     push_name='Olivia', label='Cílios Brasileiro')

step(p('B02'), f'designer de sobrancelha amanhã tem horário?',
     ['confirm', 'booking'], must_contain=['designer', 'sobrancelh', 'design'],
     push_name='Patricia', label='Designer comum')

step(p('B03'), f'design de sobrancelha com henna amanhã, qualquer horário',
     ['confirm', 'booking'], must_contain=['henna', 'design'],
     push_name='Queila', label='Design com henna')

step(p('B04'), f'manutenção dos meus cílios amanhã por favor',
     ['confirm', 'booking'], must_contain=['cílio', 'cilio', 'manutenção', 'manut'],
     push_name='Renata', label='Manutenção de cílios')

step(p('B05'), f'quero remover meu alongamento amanhã tem como?',
     ['confirm', 'booking'], must_contain=['remoção', 'remov', 'alongamento'],
     push_name='Sabrina', label='Remoção de alongamento')

step(p('B06'), f'spa dos pés amanhã, qualquer horário disponível',
     ['confirm', 'booking'], must_contain=['spa'],
     push_name='Tatiana', label='Spa dos pés')

# ═══════════════════════════════════════════════════════════════════════════════
# SUITE C — Combinações e variações de fala
# ═══════════════════════════════════════════════════════════════════════════════
suite('SUITE C — Combinações e variações de fala')

# Manutenção + Pé (NÃO deve confundir com "mão")
step(p('C01'), f'quero manutenção e pé amanhã pode ser qualquer horário',
     ['confirm', 'booking'],
     must_not_contain=['pé e mão', 'Pé e Mão'],
     push_name='Ursula', label='Manutenção + Pé (não confunde com pé e mão)')

# Pé e mão escrito de formas diferentes
step(p('C02'), f'manicure e pedicure junto amanha qual o primeiro horario',
     ['confirm', 'booking'], must_contain=['Confirma', 'pé', 'mão'],
     push_name='Vanessa', label='Pé e mão via "manicure e pedicure"')

# Serviço dito de forma abreviada/informal
step(p('C03'), f'gel nas unhas amanha. pode ser cedo',
     ['confirm', 'booking'], must_contain=['gel'],
     push_name='Wanda', label='Gel (abreviado, hora "cedo")')

step(p('C04'), f'quero fazer o cilios e tbm a sobrancelha em seguida pode ser?',
     ['confirm', 'booking'],
     push_name='Xuxa', label='Cílios + sobrancelha (dois serviços)')

# ═══════════════════════════════════════════════════════════════════════════════
# SUITE D — Perfil: cliente "analfabeta funcional" (typos, sem pontuação)
# ═══════════════════════════════════════════════════════════════════════════════
suite('SUITE D — Perfil: Analfabeta funcional')
PD = p('D01')

step(PD, 'oi td bem quero faze unh la',
     'booking', must_not_contain=['Confirma'],
     push_name='Rosinha', delay=15.0, label='saudação informal s/ serviço')

step(PD, f'acho q eh manutencao sim, pode ser amanha la qualquer horario',
     ['confirm', 'booking'], must_contain=['manutenção', 'manut'],
     push_name='Rosinha', delay=15.0, label='serviço com typo + data relativa')

step(PD, 'confirma ai',
     'payment', must_contain=['PIX'],
     push_name='Rosinha', delay=15.0, label='confirma gíria → payment + PIX')

# ═══════════════════════════════════════════════════════════════════════════════
# SUITE E — Perfil: cliente decidida e precisa
# ═══════════════════════════════════════════════════════════════════════════════
suite('SUITE E — Perfil: Decidida e precisa')

step(p('E01'),
     f'Boa tarde! Gostaria de agendar um Alongamento para amanhã às 10h, com qualquer profissional disponível.',
     ['confirm', 'booking'], must_contain=['alongamento'],
     push_name='Adriana Mendes', label='Decidida: tudo em uma mensagem')

# ═══════════════════════════════════════════════════════════════════════════════
# SUITE F — Perfil: indecisa (muda data, profissional e serviço)
# ═══════════════════════════════════════════════════════════════════════════════
suite('SUITE F — Perfil: Indecisa (muda data → profissional → serviço)')
PF = p('F01')

step(PF, f'oi quero fazer banho de gel amanhã qualquer horário',
     ['confirm', 'booking'], must_contain=['gel'],
     push_name='Camila', delay=15.0, label='pede banho de gel amanhã')

step(PF, f'na verdade prefiro depois de amanhã, tem horário?',
     ['confirm', 'booking'],
     push_name='Camila', delay=15.0, label='muda data → depois de amanhã')

step(PF, f'tem como fazer com a Kelly?',
     ['confirm', 'booking'],
     push_name='Camila', delay=15.0, label='pede profissional específica')

step(PF, f'sabe que mudei de ideia, quero fazer alongamento no lugar do gel',
     ['confirm', 'booking'], must_contain=['alongamento'],
     push_name='Camila', delay=15.0, label='muda serviço: gel → alongamento')

step(PF, f'pode confirmar esse horário',
     ['confirm', 'payment'], must_contain=['Confirma', 'PIX'],
     push_name='Camila', delay=15.0, label='confirma após várias mudanças')

# ═══════════════════════════════════════════════════════════════════════════════
# SUITE G — Perfil: curiosa (tira dúvidas antes de agendar)
# ═══════════════════════════════════════════════════════════════════════════════
suite('SUITE G — Perfil: Curiosa (pergunta antes de agendar)')
PG = p('G01')

step(PG, 'quanto custa o banho de gel?',
     ['booking', 'closing'], must_contain=['90', 'gel'],
     push_name='Debora', delay=15.0, label='pergunta preço')

step(PG, 'e quanto tempo demora?',
     ['booking', 'closing'],
     push_name='Debora', delay=15.0, label='pergunta duração (em closing)')

step(PG, 'quem faz o banho de gel aí?',
     ['booking', 'closing'],
     push_name='Debora', delay=15.0, label='pergunta profissional')

step(PG, f'então quero marcar banho de gel amanhã qualquer horário',
     ['confirm', 'booking'], must_contain=['gel'],
     push_name='Debora', delay=15.0, label='decide agendar após tirar dúvidas')

# ═══════════════════════════════════════════════════════════════════════════════
# SUITE H — Informações: preços, profissionais, pagamento, localização
# ═══════════════════════════════════════════════════════════════════════════════
suite('SUITE H — Informações variadas (sem agendar)')

step(p('H01'), 'quais serviços vocês oferecem?',
     ['booking', 'closing'], must_contain=['Studio', 'SC Studio'],
     push_name='Eduarda', label='lista todos os serviços')

step(p('H02'), 'vocês aceitam cartão de crédito?',
     ['booking', 'closing'],
     push_name='Flavia', label='forma de pagamento')

step(p('H03'), 'qual o horário de funcionamento de vocês?',
     ['booking', 'closing'],
     push_name='Giovana', label='horário de funcionamento')

step(p('H04'), 'onde vocês ficam?',
     ['booking', 'closing'],
     push_name='Helena', label='endereço / localização')

step(p('H05'), 'vocês têm instagram?',
     ['booking', 'closing'],
     push_name='Ingrid', label='instagram / contato')

step(p('H06'), 'o alongamento é de fibra de vidro ou gel?',
     ['booking', 'closing'], must_contain=['alongamento'],
     push_name='Jessica', label='dúvida técnica sobre serviço')

step(p('H07'), 'quanto tempo dura o banho de gel?',
     ['booking', 'closing'],
     push_name='Karina', label='duração do serviço')

# ═══════════════════════════════════════════════════════════════════════════════
# SUITE I — Fluxo confirm: mudança de data e de profissional
# ═══════════════════════════════════════════════════════════════════════════════
suite('SUITE I — Mudanças no confirm phase')
PI = p('I01')

step(PI, f'quero pé e mão amanhã qualquer horário',
     'confirm', must_contain=['Confirma'],
     push_name='Leticia', delay=15.0, label='setup: pé e mão amanhã → confirm')

step(PI, 'na verdade quero no dia seguinte, depois de amanhã',
     ['booking', 'confirm'],
     must_not_contain=['que ótimo que você quer confirmar'],
     push_name='Leticia', delay=15.0, label='muda data no confirm')

step(PI, 'esse horário tá ótimo, confirma',
     ['confirm', 'payment'], must_contain=['Confirma', 'PIX'],
     push_name='Leticia', delay=15.0, label='confirma na nova data')

# ═══════════════════════════════════════════════════════════════════════════════
# SUITE J — Pagamento: dinheiro, cancelamento no payment, comprovante
# ═══════════════════════════════════════════════════════════════════════════════
suite('SUITE J — Cenários de pagamento')
PJ1 = p('J01')

step(PJ1, f'quero banho de gel amanhã qualquer horário',
     ['confirm', 'booking'], must_contain=['gel'],
     push_name='Monica', delay=15.0, label='setup booking')

step(PJ1, 'confirma',
     'payment', must_contain=['PIX'],
     push_name='Monica', delay=15.0, label='confirm → payment com PIX')

step(PJ1, 'posso pagar em dinheiro na hora?',
     'payment', must_contain=['PIX'],
     push_name='Monica', delay=15.0, label='dinheiro em payment → mantém PIX')

step(PJ1, 'obrigada, vou fazer o pix agora',
     'payment',
     push_name='Monica', delay=15.0, label='farewell em payment → não reseta')

# Cancelamento no payment
PJ2 = p('J02')
step(PJ2, f'quero manicure amanhã qualquer horário',
     ['confirm', 'booking'], must_contain=['mão', 'manicure', 'mão'],
     push_name='Nadia', delay=15.0, label='setup booking mão')

step(PJ2, 'confirma',
     'payment', must_contain=['PIX'],
     push_name='Nadia', delay=15.0, label='confirm → payment')

step(PJ2, 'nao vou conseguir pagar, cancela por favor',
     ['booking', 'closing'],
     push_name='Nadia', delay=15.0, label='cancela no payment')

# ═══════════════════════════════════════════════════════════════════════════════
# SUITE K — Finalização de conversa (closing phase)
# ═══════════════════════════════════════════════════════════════════════════════
suite('SUITE K — Finalização de conversa')

PK1 = p('K01')
step(PK1, 'quanto custa a francesa definitiva?',
     ['booking', 'closing'], must_contain=['francesa', '20'],
     push_name='Olivia', delay=15.0, label='info → closing')

step(PK1, 'obrigada, era só isso!',
     ['booking', 'closing'],
     must_not_contain=['PIX', 'confirma'],
     push_name='Olivia', delay=15.0, label='despedida → reseta')

step(PK1, 'oi boa tarde, quero marcar',
     'booking',
     push_name='Olivia', delay=15.0, label='nova conversa após reset: começa do zero')

# ═══════════════════════════════════════════════════════════════════════════════
# RESULTADO
# ═══════════════════════════════════════════════════════════════════════════════
total = passed + failed
pct   = 100 * passed // total if total else 0
print(f'\n{"="*70}')
print(f'RESULTADO: {passed} OK  {failed} FAIL  de {total}  ({pct}%)')

if failed:
    print('\nFalhas:')
    for r in results:
        if not r['ok']:
            print(f'  • {r["label"]}')
            print(f'    phase={r["phase"]}  out={r["out"][:120]}')

print(f'\n{"-"*70}')
print('RESPOSTAS DO AGENTE:')
if USE_SSH:
    logs = get_logs(600)
    for line in logs.splitlines():
        if '[out→' in line and f'M{RUN_TAG}' in line:
            print(' ', line[:140])

if ssh:
    ssh.close()

sys.exit(0 if failed == 0 else 1)
