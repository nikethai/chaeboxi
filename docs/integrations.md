# Integrations (Connected Accounts)

Product identity layer for third-party services. AI tools use the **right account** without pasting tokens into every MCP env field or into the model prompt.

## User guide

### Connect an account

1. Open **Settings → Integrations**
2. **Connect account** → choose service (Jira, Asana, Google Workspace, GitHub)
3. Choose **API token** or **OAuth (desktop)** when available
4. Fill non-secret config (site URL, scope pack, …)
5. Optional: **Test connection** (Jira), set **Default**
6. **Connect**

### Multi-account

- Add as many accounts per service as you need (Work / Personal / Client).
- Mark one **Default** per service — used when you do not pick a specific account.
- Remove an account to wipe its stored secret and MCP bindings that pointed at it.

### Chat tagging (`#`)

- Type `#` in the composer to open the connected-account picker (same chip language as `$skills` / `@agents`).
- Chips are **session-sticky** until you remove them; they also attach as `credentialIds` on that user message.
- The model only sees **labels and ids**, never tokens.

### MCP bindings

1. Configure an MCP server under **Settings → MCP** (command/args without secrets if possible).
2. Return to **Integrations → MCP server bindings**.
3. Link the server to a connected account.
4. On MCP start, Chaeboxi injects env/headers from the vault **at runtime** (vault wins over static env). Tokens are **not** written into saved MCP settings JSON.

### Secrets

| Platform | Backend |
|----------|---------|
| Desktop (Tauri) | OS keychain when available (`secrets:*` IPC); isolated storage fallback |
| Web / other | Isolated app storage keys (`integration-secret:*`) — **not** in Settings JSON |

Secrets are **never**:

- Written into `settings` / chat messages
- Injected into the LLM system prompt
- Included in normal export/backup of the integrations catalog (client secrets stripped)

### OAuth (desktop)

- No hosted Chaeboxi OAuth broker.
- Connectors that support OAuth use **your** OAuth app client id (Advanced / form field).
- Flow: open browser → authorize → paste full redirect URL → exchange code (PKCE when required).
- Refresh tokens are stored in the secret backend; `ensureFresh` refreshes before expiry with a per-account mutex.

## Architecture

```text
Settings UI → Integrations catalog (metadata + mcpBindings)
           → Secret backend (keychain / isolated)
           → Resolver (defaults / chips / session)
           → Context block (labels only)
           → MCP inject at start (env/headers)
```

### Key packages

| Path | Role |
|------|------|
| `src/shared/types/integrations.ts` | Schemas |
| `src/shared/integrations/` | Connectors, resolve, context, binding, ensureFresh, OAuth PKCE |
| `src/renderer/packages/integrations/` | Secret store, hash tokens, MCP inject, OAuth flow, Jira test |
| `src/renderer/stores/integrationsStore.ts` | Persist catalog + account CRUD + bindings |
| `src/renderer/routes/settings/integrations.tsx` | Settings page |
| `src/renderer/components/InputBox/CredentialPicker.tsx` | `#` picker |
| `src/renderer/packages/mcp/controller.ts` | Runtime inject on `startServer` |

### Product rules (resolver)

1. **0** accounts → `not_connected`
2. **1** active → auto-use
3. **2+** → explicit credential ids, else default, else `ambiguous_account`
4. Fail closed — never guess

### Context injection

System prompt block lists available accounts for the turn (message chips → session sticky → all active). Never includes tokens.

## Connectors

| Connector | Auth | Notes |
|-----------|------|--------|
| Jira | PAT + OAuth (client id) | Site URL + email for PAT |
| Asana | PAT + OAuth | Optional workspace GID |
| Google Workspace | OAuth | Scope packs: Mail / Drive / Calendar |
| GitHub | PAT + OAuth | High demand for coding agents |

### Golden path (Jira MCP example)

1. Connect Jira with site URL + email + API token; set Default if multi-site.
2. Add Jira MCP server (stdio) without hardcoding the token.
3. Bind that MCP server to the Jira account under Integrations.
4. Restart/enable the MCP server — env receives `JIRA_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, etc.

## Roadmap status

| Phase | Status |
|-------|--------|
| 1 Foundation (catalog, secrets, Jira PAT UI) | Done |
| 2 Chat chips / session sticky / context block | Done |
| 3 MCP / tool runtime inject | Done |
| 4 Desktop OAuth | Done (client-id required where providers demand it) |
| 5 Asana, Google Workspace, GitHub | Done |
| 6 Hardening (export audit, i18n polish) | Planned |
