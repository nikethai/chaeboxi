#!/bin/sh
set -eu

SERVICE_NAME="${SERVICE_NAME:-chatbox-history-sync}"
INSTALL_DIR="${INSTALL_DIR:-/opt/chatbox-history-sync}"
DATA_DIR="${DATA_DIR:-/var/lib/chatbox-history-sync}"
ENV_FILE="${ENV_FILE:-/etc/chatbox-history-sync.env}"
RUN_USER="${RUN_USER:-chatbox-sync}"
SYNC_HOST="${SYNC_HOST:-0.0.0.0}"
PORT="${PORT:-8788}"
SYNC_CORS_ORIGIN="${SYNC_CORS_ORIGIN:-*}"
SYNC_MAX_BODY_BYTES="${SYNC_MAX_BODY_BYTES:-20971520}"

SCRIPT_DIR="$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)"
INIT_FILE="/etc/init.d/${SERVICE_NAME}"
LOG_OUT="/var/log/${SERVICE_NAME}.log"
LOG_ERR="/var/log/${SERVICE_NAME}.err.log"

fail() {
  echo "[history-sync-server] $*" >&2
  exit 1
}

if [ "$(id -u)" -ne 0 ]; then
  fail "run this script as root (use sudo)"
fi

if ! command -v node >/dev/null 2>&1; then
  fail "node is required (v20+)"
fi

if ! command -v npm >/dev/null 2>&1; then
  fail "npm is required"
fi

if ! command -v rc-service >/dev/null 2>&1 || ! command -v rc-update >/dev/null 2>&1; then
  fail "OpenRC tools not found (install/use this script on Alpine with OpenRC)"
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [ "${NODE_MAJOR}" -lt 20 ]; then
  fail "node v20+ is required, found: $(node -v)"
fi

TOKEN="${SYNC_TOKEN:-}"
if [ -z "${TOKEN}" ] && [ -f "${ENV_FILE}" ]; then
  TOKEN="$(sed -n 's/^SYNC_TOKEN=//p' "${ENV_FILE}" | tail -n 1)"
fi

if [ -z "${TOKEN}" ]; then
  if command -v openssl >/dev/null 2>&1; then
    TOKEN="$(openssl rand -hex 32)"
    echo "[history-sync-server] generated SYNC_TOKEN automatically"
  elif command -v od >/dev/null 2>&1; then
    TOKEN="$(od -An -N 32 -tx1 /dev/urandom | tr -d ' \n')"
    echo "[history-sync-server] generated SYNC_TOKEN automatically"
  else
    fail "set SYNC_TOKEN first (example: SYNC_TOKEN='strong-token' sh ./setup-openrc.sh)"
  fi
fi

NOLOGIN_BIN="/sbin/nologin"
if [ ! -x "${NOLOGIN_BIN}" ]; then
  NOLOGIN_BIN="/bin/false"
fi

if ! id -u "${RUN_USER}" >/dev/null 2>&1; then
  addgroup -S "${RUN_USER}" >/dev/null 2>&1 || true
  adduser -S -D -H -h "${DATA_DIR}" -s "${NOLOGIN_BIN}" -G "${RUN_USER}" "${RUN_USER}"
fi

mkdir -p "${INSTALL_DIR}" "${DATA_DIR}"
chmod 755 "${INSTALL_DIR}"
chown "${RUN_USER}:${RUN_USER}" "${DATA_DIR}"
chmod 750 "${DATA_DIR}"

cp "${SCRIPT_DIR}/server.mjs" "${INSTALL_DIR}/server.mjs"
cp "${SCRIPT_DIR}/package.json" "${INSTALL_DIR}/package.json"

(
  cd "${INSTALL_DIR}"
  npm install --omit=dev --no-audit --no-fund
)

cat > "${ENV_FILE}" <<EOF
SYNC_TOKEN=${TOKEN}
PORT=${PORT}
SYNC_HOST=${SYNC_HOST}
SYNC_DB_PATH=${DATA_DIR}/history-sync.db
SYNC_CORS_ORIGIN=${SYNC_CORS_ORIGIN}
SYNC_MAX_BODY_BYTES=${SYNC_MAX_BODY_BYTES}
EOF

chown root:"${RUN_USER}" "${ENV_FILE}"
chmod 640 "${ENV_FILE}"

cat > "${INSTALL_DIR}/run.sh" <<EOF
#!/bin/sh
set -eu

if [ -f "${ENV_FILE}" ]; then
  set -a
  . "${ENV_FILE}"
  set +a
fi

exec /usr/bin/env node "${INSTALL_DIR}/server.mjs"
EOF

chmod 755 "${INSTALL_DIR}/run.sh"
chown "${RUN_USER}:${RUN_USER}" "${INSTALL_DIR}/run.sh"

cat > "${INIT_FILE}" <<EOF
#!/sbin/openrc-run
name="Chatbox History Sync Server"
description="Self-hosted history sync server for Chatbox"

command="${INSTALL_DIR}/run.sh"
command_user="${RUN_USER}:${RUN_USER}"
command_background=true
pidfile="/run/\${RC_SVCNAME}.pid"
output_log="${LOG_OUT}"
error_log="${LOG_ERR}"

depend() {
  need net
}

start_pre() {
  checkpath --file --owner \${command_user} --mode 0640 \${output_log}
  checkpath --file --owner \${command_user} --mode 0640 \${error_log}
}
EOF

chmod 755 "${INIT_FILE}"

rc-update add "${SERVICE_NAME}" default >/dev/null 2>&1 || true
rc-service "${SERVICE_NAME}" restart >/dev/null 2>&1 || rc-service "${SERVICE_NAME}" start

echo "[history-sync-server] installed and started (OpenRC)"
echo "[history-sync-server] service: ${SERVICE_NAME}"
echo "[history-sync-server] init script: ${INIT_FILE}"
echo "[history-sync-server] env file: ${ENV_FILE}"
echo "[history-sync-server] db file: ${DATA_DIR}/history-sync.db"
echo "[history-sync-server] token: ${TOKEN}"
echo
echo "Quick checks:"
echo "  rc-service ${SERVICE_NAME} status"
echo "  tail -f ${LOG_OUT}"
echo "  curl http://127.0.0.1:${PORT}/health"
