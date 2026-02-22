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
pnpm install
SYNC_TOKEN='replace-with-strong-token' pnpm start
```

## Run with Docker (recommended for Proxmox)

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
