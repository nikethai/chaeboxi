# Chatbox History Sync Server

Small self-hosted sync service for cross-machine chat history sync.

## What it does

- `GET /health`: health check
- `GET /api/history-sync`: read current snapshot (token required)
- `PUT /api/history-sync`: compare-and-swap update with `baseRevision` (token required)
- Conflict handling: if revision mismatches, returns `409` with current `snapshot`
- Storage: SQLite file via `@libsql/client`

## Environment variables

- `SYNC_TOKEN` (required): shared secret used by clients
- `PORT` (optional, default `8788`)
- `SYNC_HOST` (optional, default `0.0.0.0`)
- `SYNC_DB_PATH` (optional, default `./data/history-sync.db`)
- `SYNC_CORS_ORIGIN` (optional, default `*`)
- `SYNC_MAX_BODY_BYTES` (optional, default `20971520`, 20 MB)

## Run directly

```bash
cd scripts/history-sync-server
npm install
SYNC_TOKEN='replace-with-strong-token' npm start
```

## Proxmox LXC (no Docker, systemd service)

Prerequisites inside the LXC: `node` (v20+) and `npm`.

Inside your LXC, copy this folder and run:

```bash
cd scripts/history-sync-server
sudo SYNC_TOKEN='replace-with-strong-token' bash ./setup-systemd.sh
```

This installs the server to `/opt/chatbox-history-sync`, stores data in
`/var/lib/chatbox-history-sync/history-sync.db`, and creates the service
`chatbox-history-sync.service`.

Useful commands:

```bash
sudo systemctl status chatbox-history-sync --no-pager
sudo journalctl -u chatbox-history-sync -f
sudo systemctl restart chatbox-history-sync
```

Optional overrides:

```bash
sudo SERVICE_NAME=chatbox-sync \
  PORT=8899 \
  DATA_DIR=/srv/chatbox-sync \
  SYNC_TOKEN='replace-with-strong-token' \
  bash ./setup-systemd.sh
```

## Docker (optional)

```bash
cd scripts/history-sync-server
# edit docker-compose.yml and set SYNC_TOKEN first
docker compose up -d --build
```

## Quick check

```bash
curl http://127.0.0.1:8788/health
```

```bash
curl \
  -H "Authorization: Bearer replace-with-strong-token" \
  http://127.0.0.1:8788/api/history-sync
```

## Chatbox app settings

In **Settings -> General -> Self-hosted History Sync**:

- Enable server sync
- Set endpoint: `http://<your-host>:8788`
- Set token: same `SYNC_TOKEN`
- Optional: enable auto sync + interval
- Use **Test Connection**, then **Sync Now**
