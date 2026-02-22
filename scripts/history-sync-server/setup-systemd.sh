#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="${SERVICE_NAME:-chatbox-history-sync}"
INSTALL_DIR="${INSTALL_DIR:-/opt/chatbox-history-sync}"
DATA_DIR="${DATA_DIR:-/var/lib/chatbox-history-sync}"
ENV_FILE="${ENV_FILE:-/etc/chatbox-history-sync.env}"
RUN_USER="${RUN_USER:-chatbox-sync}"
SYNC_HOST="${SYNC_HOST:-0.0.0.0}"
PORT="${PORT:-8788}"
SYNC_CORS_ORIGIN="${SYNC_CORS_ORIGIN:-*}"
SYNC_MAX_BODY_BYTES="${SYNC_MAX_BODY_BYTES:-20971520}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

fail() {
  echo "[history-sync-server] $*" >&2
  exit 1
}

if [[ "${EUID}" -ne 0 ]]; then
  fail "run this script as root (use sudo)"
fi

if ! command -v node >/dev/null 2>&1; then
  fail "node is required (v20+)"
fi

if ! command -v npm >/dev/null 2>&1; then
  fail "npm is required"
fi

NODE_MAJOR="$(node -p "Number(process.versions.node.split('.')[0])")"
if [[ "${NODE_MAJOR}" -lt 20 ]]; then
  fail "node v20+ is required, found: $(node -v)"
fi

TOKEN="${SYNC_TOKEN:-}"
if [[ -z "${TOKEN}" && -f "${ENV_FILE}" ]]; then
  TOKEN="$(sed -n 's/^SYNC_TOKEN=//p' "${ENV_FILE}" | tail -n 1)"
fi

if [[ -z "${TOKEN}" ]]; then
  if command -v openssl >/dev/null 2>&1; then
    TOKEN="$(openssl rand -hex 32)"
    echo "[history-sync-server] generated SYNC_TOKEN automatically"
  else
    fail "set SYNC_TOKEN first (example: SYNC_TOKEN='strong-token' sudo ./setup-systemd.sh)"
  fi
fi

NOLOGIN_BIN="$(command -v nologin || true)"
if [[ -z "${NOLOGIN_BIN}" ]]; then
  NOLOGIN_BIN="/usr/sbin/nologin"
fi

if ! id -u "${RUN_USER}" >/dev/null 2>&1; then
  useradd --system --user-group --home-dir "${DATA_DIR}" --create-home --shell "${NOLOGIN_BIN}" "${RUN_USER}"
fi

install -d -m 755 "${INSTALL_DIR}"
install -d -m 750 -o "${RUN_USER}" -g "${RUN_USER}" "${DATA_DIR}"

install -m 644 "${SCRIPT_DIR}/server.mjs" "${INSTALL_DIR}/server.mjs"
install -m 644 "${SCRIPT_DIR}/package.json" "${INSTALL_DIR}/package.json"

pushd "${INSTALL_DIR}" >/dev/null
npm install --omit=dev --no-audit --no-fund
popd >/dev/null

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

cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=Chatbox History Sync Server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${RUN_USER}
Group=${RUN_USER}
EnvironmentFile=${ENV_FILE}
WorkingDirectory=${INSTALL_DIR}
ExecStart=/usr/bin/env node ${INSTALL_DIR}/server.mjs
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now "${SERVICE_NAME}.service"

echo "[history-sync-server] installed and started"
echo "[history-sync-server] service: ${SERVICE_NAME}.service"
echo "[history-sync-server] env file: ${ENV_FILE}"
echo "[history-sync-server] db file: ${DATA_DIR}/history-sync.db"
echo "[history-sync-server] token: ${TOKEN}"
echo
echo "Quick checks:"
echo "  systemctl status ${SERVICE_NAME} --no-pager"
echo "  curl http://127.0.0.1:${PORT}/health"
