import paramiko, tarfile, os, sys, io, subprocess

PROJECT_DIR = r'c:\Users\KV\Documents\scstudio'
REMOTE_HOST = '80.241.218.217'
REMOTE_USER = 'root'
REMOTE_PASS = os.environ.get('SCSTUDIO_VPS_PASS') or os.environ.get('SCSTUDIO_DEPLOY_PASS')
REMOTE_DIR  = '/opt/scstudio'

INCREMENTAL = (os.environ.get('SCSTUDIO_DEPLOY_INCREMENTAL', '1').strip() != '0')

EXCLUDE_NAMES = {
    '.git', 'node_modules', '.next', '.env', 'scstudio_backup.dump',
    'uploads.zip', 'tsconfig.tsbuildinfo', '.codex-dev.log',
    '.codex-dev.err.log', '.v0', 'scstudio-deploy.tgz',
    'scstudio-agent-deploy.tgz', 'scstudio-app-deploy.tgz',
    'scstudio-release-vps.tgz',
}

def should_exclude(rel):
    rel_fwd = rel.replace('\\', '/')
    parts = rel_fwd.split('/')
    # Check top-level name or exact match
    if parts[0] in EXCLUDE_NAMES:
        return True
    if rel_fwd.endswith('.log') or rel_fwd.endswith('.err.log'):
        return True
    # exclude uploads subfolder
    if parts[:2] == ['public', 'uploads']:
        return True
    return False

def collect_incremental_files():
    try:
        result = subprocess.run(
            ['git', 'status', '--porcelain'],
            cwd=PROJECT_DIR,
            capture_output=True,
            text=True,
            check=True,
        )
    except Exception:
        return None

    files = []
    for line in result.stdout.splitlines():
        if not line.strip():
            continue
        # XY <path> OR XY <old> -> <new>
        raw = line[3:].strip()
        if ' -> ' in raw:
            raw = raw.split(' -> ', 1)[1].strip()
        rel = raw.replace('\\', '/')
        if not should_exclude(rel):
            files.append(rel)
    return sorted(set(files))

print("Building archive...")
buf = io.BytesIO()
with tarfile.open(fileobj=buf, mode='w:gz') as tar:
    incremental_files = collect_incremental_files() if INCREMENTAL else None
    if incremental_files:
        print(f"Incremental mode: {len(incremental_files)} file(s)")
        for rel in incremental_files:
            fpath = os.path.join(PROJECT_DIR, rel.replace('/', os.sep))
            if os.path.isfile(fpath):
                tar.add(fpath, arcname=rel)
    else:
        if INCREMENTAL:
            print("Incremental mode requested but no files detected; doing full archive.")
        for root, dirs, files in os.walk(PROJECT_DIR):
            rel_root = os.path.relpath(root, PROJECT_DIR)
            dirs[:] = [
                d for d in dirs
                if not should_exclude(os.path.join(rel_root, d).lstrip('.\\').lstrip('./'))
            ]
            for fname in files:
                fpath = os.path.join(root, fname)
                rel = os.path.relpath(fpath, PROJECT_DIR)
                if not should_exclude(rel):
                    tar.add(fpath, arcname=rel.replace('\\', '/'))

archive_size = buf.tell()
print(f"Archive ready: {archive_size / 1024 / 1024:.1f} MB")
buf.seek(0)

print("Connecting to VPS...")
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
if not REMOTE_PASS:
    raise SystemExit("Missing VPS password. Set SCSTUDIO_VPS_PASS environment variable.")
client.connect(REMOTE_HOST, username=REMOTE_USER, password=REMOTE_PASS, timeout=30)

print("Uploading via SFTP...")
sftp = client.open_sftp()
remote_tmp = '/tmp/scstudio-update.tgz'
try:
    sftp.remove(remote_tmp)
except FileNotFoundError:
    pass
sftp.putfo(buf, remote_tmp)
sftp.close()
print("Upload done.")

cmds = [
    f'tar xzf {remote_tmp} --exclude=.env --exclude="public/uploads" -C {REMOTE_DIR}',
    f'rm {remote_tmp}',
    f'ls {REMOTE_DIR}/db/init/',
    f'cd {REMOTE_DIR} && docker compose up -d --build',
]

for cmd in cmds:
    print(f"\n$ {cmd}")
    _, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode('utf-8', errors='replace').strip()
    err = stderr.read().decode('utf-8', errors='replace').strip()
    if out:
        # Windows console pode não suportar alguns caracteres (ex.: "▲" do Next).
        # Só garantimos que imprime algo sem quebrar o deploy.
        try:
            sys.stdout.buffer.write((out + "\n").encode("utf-8", errors="replace"))
        except Exception:
            sys.stdout.write(out.encode("utf-8", errors="replace").decode("utf-8", errors="replace") + "\n")
    if err:
        safe = f"[err] {err}"
        try:
            sys.stdout.buffer.write((safe + "\n").encode("utf-8", errors="replace"))
        except Exception:
            sys.stdout.write(safe.encode("utf-8", errors="replace").decode("utf-8", errors="replace") + "\n")

client.close()
print("\nTransfer complete.")
