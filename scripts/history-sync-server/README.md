# Chaeboxi History Sync Server

Small self-hosted sync service for cross-machine chat history sync.

## What it does

- `GET /health`: health check
- `GET /api/history-sync`: read current snapshot (token required)
- `PUT /api/history-sync`: compare-and-swap update with `baseRevision` (token required)
- `GET /api/sync/memory`: read current encrypted memory snapshot (token required)
- `PUT /api/sync/memory`: compare-and-swap update of the encrypted memory snapshot with `baseRevision` (token required)
- Conflict handling: if revision mismatches, returns `409` with current `snapshot`
- Storage: SQLite file via `@libsql/client`
  - `history_snapshot` table holds the chat history payload
  - `memory_snapshot` table holds the encrypted memory payload and its encryption metadata (`alg`, `kdf`, `salt`, `iv`) separately

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

## Proxmox LXC Alpine (OpenRC, no Docker)

Prerequisites inside the LXC: `node` (v20+) and `npm`.

```sh
apk add --no-cache nodejs npm
```

Inside your Alpine LXC:

```sh
cd scripts/history-sync-server
sudo SYNC_TOKEN='replace-with-strong-token' sh ./setup-openrc.sh
```

This creates an OpenRC service named `chatbox-history-sync`.

Useful commands:

```sh
sudo rc-service chatbox-history-sync status
sudo rc-service chatbox-history-sync restart
sudo tail -f /var/log/chatbox-history-sync.log
```

Optional overrides:

```sh
sudo SERVICE_NAME=chatbox-sync \
  PORT=8899 \
  DATA_DIR=/srv/chatbox-sync \
  SYNC_TOKEN='replace-with-strong-token' \
  sh ./setup-openrc.sh
```

## Proxmox LXC Debian/Ubuntu (systemd, no Docker)

Prerequisites inside the LXC: `node` (v20+), `npm`, and `bash`.

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

```bash
curl \
  -H "Authorization: Bearer replace-with-strong-token" \
  http://127.0.0.1:8788/api/sync/memory
```

## Memory Sync

Memory sync stores an **encrypted** snapshot of the app's memory (settings plus
global/agent memory banks) through the same self-hosted server. The server never
sees the plaintext memory: the client encrypts the snapshot with a passphrase
(PBKDF2-HMAC-SHA-256 + AES-GCM) before pushing it, and only stores the
ciphertext plus its encryption metadata.

- Endpoint: `GET`/`PUT /api/sync/memory`
- Transport auth: bearer token (same `SYNC_TOKEN` as history sync)
- `GET` returns the current `revision`, encrypted `payload`, and encryption
  metadata (`alg`, `kdf`, `salt`, `iv`); `payload` is `null` before the first push
- `PUT` accepts `{ baseRevision, payload, salt, iv, alg, kdf }` and is a
  compare-and-swap: a mismatched `baseRevision` returns `409` with the current
  `snapshot` so the client can merge and retry

> **Passphrase warning:** there is **no recovery** for the sync passphrase. If
> you lose it, the encrypted memory snapshot on the server cannot be decrypted
> and is unrecoverable. Choose a strong passphrase and store it somewhere safe.

## Chatbox app settings

**History sync** — in **Settings -> General -> Self-hosted History Sync**:

- Enable server sync
- Set endpoint: `http://<your-host>:8788`
- Set token: same `SYNC_TOKEN`
- Optional: enable auto sync + interval
- Use **Test Connection**, then **Sync Now**

**Memory sync** — in **Settings -> Memory -> Advanced -> Memory Sync**:

- Enable memory sync
- Set endpoint: `http://<your-host>:8788`
- Set token: same `SYNC_TOKEN`
- Set a **sync passphrase** (never saved; used only to encrypt/decrypt snapshots)
- Optional: enable background auto sync + interval (min 15s)
- Save sync settings, then use **Test Connection**, **Pull from Server**, **Push to Server**, or **Sync Now**

## Manual two-device verification

With one server running (`SYNC_TOKEN` set), verify memory sync end-to-end on two
devices or two app instances. Both must use the **same** server, token, and sync
passphrase.

1. **Device A — push:** Settings -> Memory -> Advanced -> Memory Sync. Enable
   memory sync, set endpoint + token, enter the sync passphrase, save, and add a
   test fact to the Global bank ("e.g. `prefer short answers`"). Press **Push to
   Server**.
2. **Device B — pull:** on the second device, configure the same endpoint, token,
   and passphrase, then press **Pull from Server**. The fact from Device A
   appears in its Global bank.
3. **Device B — edit + push:** edit or add a fact on Device B, then **Push to
   Server**.
4. **Device A — pull + merge:** press **Pull from Server** on Device A again.
   Device B's change is merged in; a `409` conflict on push is handled by
   re-pulling, merging, and re-pushing automatically.
5. **Tombstones:** delete a fact on Device A and **Push to Server**. On Device B,
   **Pull from Server** — the fact stays deleted (the delete is synced as a
   tombstone, not re-added by an older copy).
6. **Passphrase check:** pulling with a **wrong** passphrase fails to decrypt
   (remote state cannot be read); with the correct passphrase it succeeds.
