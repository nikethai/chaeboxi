# OpenClaw Remote Access via Cloudflare Tunnel

Expose your local OpenClaw gateway to the internet securely using Cloudflare Tunnel and CF Access, then connect from Chaeboxi on any network.

**Architecture:**

```
Chaeboxi (Tauri app)
  └─ WSS → Cloudflare Edge (TLS termination + CF Access auth)
       └─ cloudflared (local daemon) → ws://127.0.0.1:18789 (OpenClaw gateway)
```

Chaeboxi's Tauri runtime uses a native Rust WebSocket client for the connection. This bypasses WebView CORS restrictions entirely and injects CF Access headers directly on the WebSocket upgrade request.

---

## 1. Prerequisites

| Requirement | Details |
|---|---|
| OpenClaw gateway | Installed and functional on the host machine |
| Cloudflare account | Free tier works. You need a domain with DNS managed by Cloudflare. |
| `cloudflared` CLI | [Install guide](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) |
| Chaeboxi | Desktop build (Tauri) — the native transport is required for CF Access header injection |

> **Note**: The web build of Chaeboxi cannot set custom headers on WebSocket upgrades due to browser restrictions. Use the Tauri desktop app for CF Access-protected gateways.

---

## 2. Start Your OpenClaw Gateway

```bash
openclaw gateway
```

Default listen address: `127.0.0.1:18789`

Verify it's running:

```bash
curl http://127.0.0.1:18789/health
```

You should get a JSON response with gateway status. Keep this terminal open (or run as a service).

---

## 3. Set Up Cloudflare Tunnel

### 3.1 Authenticate cloudflared

```bash
cloudflared tunnel login
```

This opens a browser to authorize `cloudflared` with your Cloudflare account. Select the domain you want to use.

### 3.2 Create the tunnel

```bash
cloudflared tunnel create openclaw-gateway
```

Note the **Tunnel ID** (UUID) printed in the output — you'll need it for the config.

### 3.3 Configure the tunnel

Create `~/.cloudflared/config.yml`:

```yaml
tunnel: <TUNNEL_ID>
credentials-file: /home/<user>/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: gateway.example.com
    service: http://localhost:18789
    originRequest:
      # WebSocket support is automatic for cloudflared,
      # but we explicitly disable chunked encoding for cleaner WS relay
      noTLSVerify: false
  - service: http_status:404
```

Replace `<TUNNEL_ID>` with your tunnel UUID and `<user>` with your system username.

> **Note**: Cloudflare Tunnel natively supports WebSocket connections. No special WebSocket configuration is needed — `cloudflared` upgrades connections transparently.

### 3.4 Route DNS

```bash
cloudflared tunnel route dns openclaw-gateway gateway.example.com
```

This creates a CNAME record pointing `gateway.example.com` to your tunnel.

### 3.5 Run the tunnel

```bash
cloudflared tunnel run openclaw-gateway
```

### 3.6 Verify

From any machine:

```bash
curl https://gateway.example.com/health
```

If CF Access is not yet configured, this should return the gateway health JSON. Once CF Access is enabled, unauthenticated requests will get a `403` or redirect to the Access login page — that's expected.

---

## 4. Secure with Cloudflare Access

### 4.1 Create an Access Application

1. Go to [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/) > **Access** > **Applications**
2. Click **Add an application** > **Self-hosted**
3. Configure:
   - **Application name**: `OpenClaw Gateway`
   - **Session duration**: 8 hours (matches Chaeboxi's max connection duration)
   - **Application domain**: `gateway.example.com`

### 4.2 Set Up an Access Policy

Add at least one policy to control who can reach the gateway:

**Option A: Email-based (for browser-initiated flows)**

| Field | Value |
|---|---|
| Policy name | `Allowed Users` |
| Action | Allow |
| Include rule | Emails — `you@example.com` |

**Option B: Service Token (for machine-to-machine — recommended for Chaeboxi)**

This is the better option for Chaeboxi since the Tauri client sends headers automatically without browser interaction.

1. Go to **Access** > **Service Auth** > **Service Tokens**
2. Click **Create Service Token**
3. Name it (e.g., `chaeboxi-desktop`)
4. Copy the **Client ID** and **Client Secret** — you won't see the secret again

Then add a policy to your Access application:

| Field | Value |
|---|---|
| Policy name | `Service Token` |
| Action | Service Auth |
| Include rule | Service Token — select the token you created |

> **Warning**: Store your Client Secret securely. If compromised, revoke and rotate the token immediately from the CF Zero Trust dashboard.

### 4.3 How It Works with Chaeboxi

When Chaeboxi connects to `wss://gateway.example.com`:

1. The Tauri Rust client sets `CF-Access-Client-Id` and `CF-Access-Client-Secret` as HTTP headers on the WebSocket upgrade request
2. Cloudflare Edge validates the service token
3. CF sets a `CF_Authorization` JWT cookie for the session
4. The WebSocket connection is established through the tunnel to your local gateway

The WebView-side JS preflight for CF Access is best-effort and may time out due to CORS — this is expected and harmless. The Rust native transport handles authentication independently.

---

## 5. Connect from Chaeboxi

### 5.1 Configure the Provider

Open **Settings** > **Provider** > **OpenClaw** and fill in:

| Field | Value |
|---|---|
| Gateway URL | `https://gateway.example.com` |
| Auth Token | Your OpenClaw shared secret |
| Cloudflare Client ID | *(from step 4.2, if using Service Token)* |
| Cloudflare Client Secret | *(from step 4.2, if using Service Token)* |

> **Important**: Enter `https://gateway.example.com`, not `wss://`. Chaeboxi's `normalizeGatewayUrl()` converts `https://` to `wss://` automatically. For remote hostnames, port 443 is used by default (no need to specify a port).

### 5.2 Test the Connection

1. Click **Test Connection**
2. **First connection from a new device**: expect a `PAIRING_REQUIRED` error — this is normal

### 5.3 Approve the Device

On the machine running the OpenClaw gateway:

```bash
openclaw devices approve
```

This lists pending devices. Approve the one matching your Chaeboxi client. Each device has a unique Ed25519 identity key generated and stored locally.

### 5.4 Confirm

Click **Test Connection** again. You should see:

- **Status**: Connected (Remote)
- Gateway info (version, capabilities)
- Security indicator: yellow shield (WSS to remote host)

> **Note**: A green shield is shown only for `localhost` connections. Yellow for `wss://` remote is correct and secure — it means TLS is active.

---

## 6. Security Best Practices

### Connection Security

- **Always use HTTPS/WSS** for remote connections. Chaeboxi shows a red alert banner for `ws://` (plaintext) to remote hosts. If you see it, switch to `https://` in the Gateway URL.
- **CF Access** adds a second authentication layer on top of OpenClaw's own token + device pairing.
- Gateway secrets (auth token, CF credentials) are **scrubbed from settings exports** — they won't leak if you share your config.

### Agent Capability Awareness

Chaeboxi color-codes agent capabilities in the UI:

| Color | Risk Level | Examples |
|---|---|---|
| Red | Dangerous | `shell`, `exec`, `system` |
| Yellow | Moderate | `tool_use`, `file_read` |
| Green | Safe | `vision`, `reasoning` |

Review capabilities before allowing agents to act on your behalf, especially over remote connections.

### Session Limits

- **Idle timeout**: 30 minutes — stale sessions auto-disconnect
- **Max connection duration**: 8 hours — long-running sessions are terminated

These are enforced gateway-side and protect against abandoned connections.

### Recommendations

- Use **CF Access Service Tokens** (machine-to-machine) over email-based auth for headless/desktop clients
- **Rotate service tokens** periodically from the CF Zero Trust dashboard
- Restrict your CF Access policy to the minimum necessary identities
- Run `openclaw devices list` periodically and revoke devices you no longer use

---

## 7. Troubleshooting

| Problem | Cause | Solution |
|---|---|---|
| "CF Access preflight timed out" | WebView CORS blocks the preflight fetch to Cloudflare | Not a real problem. The Tauri native Rust transport handles CF auth independently. This warning can be ignored. |
| Connection closes immediately (1006/1005) | WebSocket opens through CF Tunnel but closes before OpenClaw handshake completes. Usually a transient CF Tunnel relay issue. | Chaeboxi retries 3 times with exponential backoff automatically. If persistent, restart `cloudflared tunnel run`. Check `cloudflared` logs for upstream errors. |
| "pairing required" (`PAIRING_REQUIRED`) | The device's Ed25519 identity is not yet approved on the gateway. | On the gateway host, run `openclaw devices approve` and approve the pending device. Then retry the connection from Chaeboxi. |
| Red "Insecure Connection" alert | Gateway URL uses `ws://` or `http://` to a non-localhost host. | Change the Gateway URL to `https://gateway.example.com`. Chaeboxi converts to `wss://` automatically. |
| Works locally, fails remotely | CF Tunnel not running, DNS not routed, or CF Access policy blocking. | 1. Verify tunnel: `cloudflared tunnel info openclaw-gateway` 2. Verify DNS: `dig gateway.example.com` (should be a CNAME to `cfargotunnel.com`) 3. Check CF Access audit logs in Zero Trust dashboard 4. Verify tunnel config routes to `http://localhost:18789` |
| 403 Forbidden from Cloudflare | CF Access rejecting the request — missing or invalid service token. | Verify Client ID and Client Secret in Chaeboxi settings. Check the service token hasn't expired in CF Zero Trust > Service Auth. |
| Gateway health check passes but WS fails | Tunnel routes HTTP fine but WebSocket upgrade fails at CF edge. | Rare. Check `cloudflared` version is up to date (`cloudflared update`). Ensure no intermediate proxy is stripping `Upgrade` headers. |

### Viewing Tauri Debug Logs

Chaeboxi logs WebSocket connection events and errors to stderr. To see them:

**macOS/Linux** — run from terminal:

```bash
# macOS
/Applications/Chaeboxi.app/Contents/MacOS/Chaeboxi 2>&1 | grep -i "openclaw\|websocket\|ws::\|cf-access"

# Linux
./chaeboxi 2>&1 | grep -i "openclaw\|websocket\|ws::\|cf-access"
```

**Windows** — run from PowerShell:

```powershell
& "C:\Program Files\Chaeboxi\Chaeboxi.exe" 2>&1 | Select-String "openclaw|websocket|ws::|cf-access"
```

Look for:
- `ws::connect` — connection attempts
- `cf-access: preflight` — CF Access token validation (WebView side, may timeout — OK)
- `ws::handshake` — OpenClaw challenge/response flow
- `ws::error` — connection failures with error codes

---

## Quick Reference

```bash
# Start gateway
openclaw gateway

# Start tunnel
cloudflared tunnel run openclaw-gateway

# Check tunnel status
cloudflared tunnel info openclaw-gateway

# Approve a new device
openclaw devices approve

# List connected devices
openclaw devices list

# Health check through tunnel
curl https://gateway.example.com/health
```

**Chaeboxi Settings** (Settings > Provider > OpenClaw):

```
Gateway URL:              https://gateway.example.com
Auth Token:               <your-openclaw-secret>
Cloudflare Client ID:     <cf-service-token-id>        (optional)
Cloudflare Client Secret: <cf-service-token-secret>     (optional)
```
