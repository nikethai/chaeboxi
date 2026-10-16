# Plan: Connected Accounts (Integrations)

**Status:** Phases 1–5 implemented in codebase  
**Date:** 2026-08-10  
**Product stance:** Full product feature (not MVP cut). Ship a complete identity layer for AI tools: multi-account, secure storage, chat binding, tool runtime, OAuth + token auth, polished UX, docs. Sequence delivery in product phases; every phase is production-quality, not throwaway.

### Phase status
| Phase | Status |
|-------|--------|
| 1 Foundation (catalog, secrets, Jira PAT UI) | **Implemented** |
| 2 Chat chips / session sticky / context wire-up | **Implemented** |
| 3 MCP / tool runtime inject | **Implemented** |
| 4 Desktop OAuth | **Implemented** |
| 5 Expand connectors (Asana, GWS, GitHub) | **Implemented** |
| 6 Hardening | Planned |

---

## 1. Product vision

### Job to be done
> When I chat with AI about work, I want it to use the **right** Jira / Google / Asana account — without pasting tokens into MCP env or risking the wrong identity.

### Product name
| Surface | Name |
|---------|------|
| Settings nav | **Integrations** |
| User copy | Connected accounts |
| Code / packages | `integrations` + `vault` (secrets) |

### Success metrics (product)
| Metric | Target |
|--------|--------|
| Time to first successful tool call with correct account | Faster than “configure MCP env by hand” |
| Messages requiring manual credential chips | Low when defaults/session sticky work |
| Wrong-account incidents | Near zero (ambiguity fails closed) |
| Token leakage into prompts / logs / exports | Zero |
| Re-auth recovery | One click “Reconnect” |

### Non-goals (product scope boundary — not “later maybe never”)
- Hosted Chaeboxi OAuth broker / cloud credential sync  
- Replacing MCP with a proprietary connector marketplace  
- Full in-app clones of Jira/GWS/Asana UIs  
- Auto-using **every** vault account every turn  
- Putting SaaS tokens into LLM Provider settings  

### Goals (in product)
- Multi-account per service (work / personal / client)  
- Connect once; daily use is invisible  
- Optional per-chat / per-message account selection  
- Secrets never in the model context  
- Tools (MCP-first) actually use resolved credentials  
- OAuth where it is real product UX; PAT/API token always available  
- Desktop-first OAuth; web/mobile honest about capabilities  
- Audit-friendly: which account powered a tool call  

---

## 2. Product principles (UX law)

1. **0 accounts** for a needed service → guide to Connect; tools fail with a clear CTA.  
2. **1 active account** → auto-use; **never force a chip**.  
3. **2+ accounts** → **session default** (or global default per connector); chips override.  
4. **Ambiguous multi-account without default** → fail closed (“Pick an account”), do not guess.  
5. **Labels over secrets** in chat, context, logs.  
6. **Session sticky > per-message tags** for daily convenience.  
7. **Same chip language** as Skills / Agents (composer chips + picker).  
8. **Integrations ≠ Model Providers** — separate settings domain forever.

### Daily path (product story)
```text
1. Settings → Integrations → Connect Jira → label "Work Jira" → set Default
2. New chat inherits default (or user sets session accounts once)
3. User: "Create a ticket for this bug from the thread"
4. AI tools use Work Jira; UI can show "via Work Jira"
5. Exception: chip #personal-gmail when switching identity
```

---

## 3. Domain model

### Connectors (registry)
Built-in connector definitions (metadata only):

```ts
type ConnectorId =
  | 'jira'
  | 'asana'
  | 'google_workspace'
  | 'github'        // roadmap
  | 'slack'         // roadmap
  | string          // future custom

type ConnectorDefinition = {
  id: ConnectorId
  name: string
  description: string
  icon: string
  authMethods: Array<'oauth' | 'api_token'>
  /** Non-secret fields required (e.g. jira site URL) */
  configFields: ConfigField[]
  /** How secrets map into MCP / HTTP (env keys, header templates) */
  runtimeBinding: RuntimeBindingSpec
  oauth?: OAuthAppSpec          // when supported
  scopes?: string[]
  docsUrl?: string
}
```

### Accounts (user-owned)
```ts
type IntegrationAccount = {
  id: string                    // uuid
  connectorId: ConnectorId
  label: string                 // "Work Jira"
  accountHint?: string          // email, site host, workspace name
  authType: 'oauth' | 'api_token'
  status: 'active' | 'expired' | 'revoked' | 'needs_reauth' | 'disabled'
  isDefault?: boolean           // per connectorId: at most one default
  config: Record<string, string> // site URL, cloudId, workspaceId — non-secret
  scopes?: string[]
  createdAt: number
  updatedAt: number
  lastUsedAt?: number
  lastError?: string            // user-safe
}
```

### Secrets (separate store)
```ts
type IntegrationSecret = {
  accountId: string
  accessToken?: string
  refreshToken?: string
  expiresAt?: number
  tokenType?: string
  apiToken?: string
  extra?: Record<string, string>  // rare secret extras
}
```

### Message / session binding
```ts
// Message (user turn) — mirrors skillIds / mentionedAgentIds
credentialIds?: string[]

// Session settings
credentialIds?: string[]           // sticky for this chat
// Global defaults live on accounts (isDefault) + optional integrations settings
```

### Context injection (never secrets)
```text
Connected accounts available this turn:
- work-jira [jira] acme.atlassian.net (default)
- personal-gmail [google_workspace] me@gmail.com
Use tools only with these accounts. Prefer credential_id when calling tools.
If multiple accounts match and none is default, ask the user to pick.
```

---

## 4. Architecture

```text
┌──────────────────────────────────────────────────────────────┐
│ Settings → Integrations UI                                   │
│  list / add / edit / reconnect / revoke / set default        │
└────────────────────────────┬─────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────┐
│ Integration Catalog (metadata store)                         │
│  StorageKey.Integrations — accounts[], preferences           │
└────────────────────────────┬─────────────────────────────────┘
                             │ accountId
┌────────────────────────────▼─────────────────────────────────┐
│ Secret Backend (platform)                                    │
│  Desktop: OS keychain (Tauri)                                │
│  Web/Mobile: encrypted platform store + capability honesty   │
└────────────────────────────┬─────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────┐
│ Credential Resolver                                          │
│  resolve(connector, ctx) → account                           │
│  ensureFresh(accountId) → token (mutex, refresh, status)     │
└───────────────┬─────────────────────────────┬────────────────┘
                │                             │
                ▼                             ▼
     Composer + Session              Tool Runtime
     chips / # picker                MCP inject env|headers
     message.credentialIds           optional thin HTTP toolsets
     context block                   tool result: usedAccount label
```

### Layer placement (codebase)
| Concern | Location |
|---------|----------|
| Types / Zod | `src/shared/types/integrations.ts` |
| Connector registry | `src/shared/integrations/connectors/` |
| Resolver + refresh | `src/shared/integrations/` or `src/renderer/packages/integrations/` |
| Secret API | `src/renderer/platform/` + Tauri commands |
| Store | `StorageKey.Integrations` + secret keys via `StorageKeyGenerator.integrationSecret(id)` only if not keychain |
| Settings UI | `src/renderer/routes/settings/integrations.tsx` + components |
| Composer | `InputBox` chips + `#` token helpers (parallel to `$skills` / `@agents`) |
| Session | `SessionSettings` + message schema |
| MCP bind | `packages/mcp/controller.ts` (+ bootstrap) inject from resolver |
| Feature flag | `featureFlags.integrations` if platform-gated |

### DRY with existing patterns
| Existing | Reuse |
|----------|--------|
| `$skills` chips / `skillIds` | Credential chips / `credentialIds` |
| Provider OAuth PKCE (desktop local callback) | Connector OAuth (not LLM provider types) |
| MCP `env` / `headers` | Inject resolved secrets at start/call |
| Memory dock / settings surfaces CSS | Settings studio alignment |
| Hooks PreToolUse | Block logging secrets; optional credential allow |

---

## 5. UX surfaces (product-complete)

### 5.1 Settings → Integrations
- **Empty state:** value prop + “Connect an account”  
- **Account list:** grouped by connector; status pills (Active / Needs reconnect / Disabled)  
- **Add account:** connector picker → auth method (OAuth | API token) → config fields → label → test connection  
- **Account detail:** label, hint, default toggle, scopes, last used, Reconnect, Remove  
- **Security copy:** what is stored locally; secrets not exported by default  
- **MCP help:** “How AI tools use this account” short link to docs  

### 5.2 Composer
- Chips row: credential chips alongside skill/agent chips  
- Trigger: `#` mention picker (search label / connector / email) — **do not** steal bare `@`  
- Session strip optional: “Using: Work Jira · Personal Gmail” with edit  
- Sticky for session until removed (like skills)  

### 5.3 Session settings
- Connected accounts for this chat  
- Inherit global defaults vs custom set  

### 5.4 Tool / error UX
| Error | User message |
|-------|----------------|
| not_connected | Connect {service} in Integrations |
| ambiguous_account | Pick which {service} account to use |
| needs_reauth | Reconnect {label} |
| revoked / expired | Same + Reconnect CTA |
| tool failed auth | Show account label used + next step |

### 5.5 Tool call transparency (product polish)
- When a tool runs with an account, surface **label** in tool UI / status (not token).  
- Optional activity: lastUsedAt update.

---

## 6. Auth product strategy

| Method | Role in product |
|--------|-----------------|
| **API token / PAT** | Always supported; first-class form UX (not “advanced only”) |
| **OAuth (desktop PKCE)** | First-class for connectors that have a solid public-client story |
| **OAuth web/mobile** | Phase after desktop; deep link / redirect design required |
| **User-supplied OAuth client_id** | Advanced section for power users / OSS flexibility |
| **Hosted broker** | Out of product scope |

### Token lifecycle
- `ensureFresh` with skew (e.g. refresh 2–5 min before expiry)  
- Per-`accountId` mutex (no parallel refresh storms)  
- Failure → `needs_reauth` + UI  
- Revoke on user Remove (best-effort remote revoke when API exists; always wipe local secret)

---

## 7. Tool runtime strategy (MCP-first product)

### Binding model
Each connector defines how a resolved token maps to tool execution:

```ts
type RuntimeBindingSpec =
  | { kind: 'mcp_env'; envMap: Record<string, 'accessToken' | 'apiToken' | 'config:field'> }
  | { kind: 'mcp_headers'; headerMap: Record<string, string /* template */> }
  | { kind: 'http_client'; baseUrlFrom: 'config' | 'fixed' }
```

### Product rules
1. **v1 execution path:** MCP inject — user enables an MCP server; Integrations supplies secrets instead of manual env paste.  
2. Document **golden path** per connector (recommended MCP package + which account field maps where).  
3. Built-in thin toolsets only when MCP cannot deliver product-quality UX (later phase).  
4. Tools may accept optional `credential_id`; resolver fills from session/defaults when omitted.

### MCP UX bridge
- Settings → Integrations shows “Linked MCP servers” / “Use account for MCP” when relevant.  
- On MCP start: merge vault-resolved env/headers over static config (vault wins for bound keys).  
- Never write live tokens back into persisted MCP settings JSON if avoidable (inject at runtime).

---

## 8. Security & privacy (product requirements)

| Requirement | Implementation |
|-------------|----------------|
| Secrets ≠ metadata store | Keychain / dedicated secret API |
| Never in LLM prompts | Context = labels/ids/status only |
| Never in Sentry / analytics | Redact token-shaped fields |
| Export / backup | Metadata yes; secrets only via explicit dangerous export |
| Settings dump / debug | Scrub secrets |
| Hooks | PreToolUse: do not log Authorization headers / env with secrets |
| Least privilege | OAuth scopes minimal per connector |
| Local-first | No cloud upload of secrets |

Threat model (local desktop): malware with full user access can still read keychain if user unlocked — document honestly; still better than plaintext settings.

---

## 9. Connector roadmap (product catalog)

Ship connectors as **complete product verticals** (connect + resolve + bind + errors + docs), not registry stubs.

| Priority | Connector | Auth | Notes |
|----------|-----------|------|--------|
| **P0** | **Jira** | PAT + OAuth (Atlassian) when ready | Site URL config; multi-site multi-account |
| **P1** | **Asana** | PAT + OAuth | Workspace hint |
| **P1** | **Google Workspace** | OAuth-first (Gmail/Drive/Calendar scopes modular) | Desktop PKCE first; scope packs |
| **P2** | GitHub | PAT + OAuth | High demand for coding agents |
| **P2** | Slack | OAuth | Careful bot vs user token |
| **P3** | Linear, Notion, etc. | As demand | Same account model |

**P0 vertical must be end-to-end** before expanding catalog.

---

## 10. Delivery phases (product quality each phase)

Phases are **release slices**, not prototypes. Each phase is documented, tested, and UX-complete for its surface.

### Phase 1 — Foundation: catalog, secrets, Jira accounts
**Outcome:** User can add multiple Jira accounts (PAT), label them, set default, secrets stored correctly.

- Types + Zod + `StorageKey.Integrations`  
- Secret backend abstraction + desktop keychain path (web: secure-as-possible + UI caveat)  
- Connector registry: Jira definition + config fields  
- Settings → Integrations UI (list/add/edit/remove/default/status)  
- Test connection (Jira REST identity/myself)  
- Unit tests: schema, default uniqueness, secret isolation  

**Acceptance:** Two Jira accounts stored; default works; secrets not in `settings` blob; Remove wipes secret.

### Phase 2 — Chat binding product
**Outcome:** Session + chips control which accounts AI may use; context is correct.

- `credentialIds` on messages + session settings  
- Composer chips + `#` picker (search, multi-select, sticky)  
- Session “Using …” strip / session settings picker  
- Context injection helper (token-budgeted, metadata only)  
- Resolution rules unit tests (0 / 1 / 2+ / disabled / needs_reauth)  

**Acceptance:** Sticky session account + override chip; no secrets in built context string.

### Phase 3 — Runtime: resolver → MCP / tools
**Outcome:** AI tool calls actually authenticate as the selected account.

- `ensureFresh` + status transitions  
- MCP runtime inject from binding spec  
- Tool error mapping + reconnect CTA  
- Tool UI shows account label used  
- Integration tests (mocked Jira / MCP)  

**Acceptance:** Tagged/default account drives successful MCP/tool call; wrong account impossible without user choice when 2+ exist.

### Phase 4 — OAuth product (desktop) for P0/P1
**Outcome:** “Connect with Atlassian/Google” is first-class on desktop.

- Reuse local PKCE listener patterns  
- Account creation from OAuth profile (email hint, scopes)  
- Reconnect / revoke flows  
- Advanced: optional custom client_id  
- Web: clear “OAuth available on desktop” or limited flow only when solid  

**Acceptance:** OAuth connect + refresh + reauth without developer-console for standard desktop path (or documented advanced path only as secondary).

### Phase 5 — Expand catalog (Asana, GWS, …)
**Outcome:** Same UX for additional connectors; each ships complete vertical.

- Asana vertical  
- Google Workspace with **scope packs** (Mail / Drive / Calendar) as product choices, not one mega-scope dump  
- Golden MCP docs per connector  

### Phase 6 — Product hardening
- Export/import metadata  
- Audit log (optional, local): accountId, tool name, timestamp — no secrets  
- Risk-tier: destructive tools require explicit chip when multi-account  
- i18n strings  
- `docs/integrations.md` user + architecture  
- Telemetry only opt-in counters (connect success/fail), never tokens  

---

## 11. Key files to create / modify

### Create
- `src/shared/types/integrations.ts`  
- `src/shared/integrations/` — registry, resolve, refresh, context-block, binding  
- `src/renderer/packages/integrations/` — store actions, hooks  
- `src/renderer/routes/settings/integrations.tsx`  
- `src/renderer/components/settings/integrations/*`  
- `src/renderer/components/InputBox/*` credential chip/picker helpers  
- `src/renderer/packages/integrations/hash-tokens.ts` (`#` picker)  
- `docs/integrations.md`  
- Tests colocated `*.test.ts`  

### Modify
- `src/renderer/storage/StoreStorage.ts` — `StorageKey.Integrations` (+ immediate write)  
- `src/shared/types/session.ts` — `credentialIds`  
- `src/shared/types/settings.ts` — session credential fields  
- `src/renderer/routes/settings/route.tsx` — nav item Integrations  
- `src/renderer/components/InputBox/InputBox.tsx` — chips / picker / submit payload  
- `src/renderer/stores/session/*` — pass credentialIds into generation / context  
- `src/renderer/packages/mcp/controller.ts` — runtime inject  
- `src-tauri` — secret store + any OAuth if not fully reusable  
- `src/renderer/platform/*` — secret capability interface  
- Feature flags / platform capabilities as needed  

---

## 12. Testing strategy

| Layer | What |
|-------|------|
| Unit | resolve rules, default uniqueness, context redaction, token refresh skew, `#` token parse |
| Component | Integrations list empty/full; chip add/remove |
| Integration | ensureFresh mock; MCP env merge; message persistence of credentialIds |
| Manual QA | 2 Jira accounts; session sticky; chip override; reconnect; export scrub |
| Security check | grep prompts/logs for token patterns in tests |

---

## 13. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Scope becomes “build every SaaS” | One complete vertical (Jira) before catalog growth |
| OAuth app registration / ToS for OSS | PAT first-class; OAuth public client + advanced client_id; no hosted broker |
| MCP servers ignore inject contract | Golden-path docs + binding tests; show bind status in UI |
| Users confuse Integrations vs MCP vs Providers | Settings copy + empty states; MCP page cross-link |
| Web secret weaker than desktop | Capability banners; prefer PAT; delay web OAuth |
| Per-message tagging fatigue | Defaults + session sticky are the product; chips are override |
| Token in session JSON history | Never persist secrets on messages — only ids |

---

## 14. Documentation deliverables
- `docs/integrations.md` — user guide + architecture  
- In-app empty states and reconnect copy (EN first; i18n keys ready)  
- Per-connector golden path (Jira MCP mapping)  
- Update `AGENTS.md` / codebase summary when architecture lands  

---

## 15. Open decisions (defaults locked unless you override)

| Decision | Default in this plan |
|----------|----------------------|
| P0 connector | **Jira** |
| Auth v1 | **PAT first-class**; OAuth in Phase 4 |
| Platforms | **Desktop-complete**; web/mobile metadata + best-effort secrets |
| Tools | **MCP-first** inject |
| Chip trigger | **`#`** + chips (not `@`) |
| Cloud sync of secrets | **No** |
| Feature name | **Integrations / Connected accounts** |

---

## 16. Implementation order after approval

1. Phase 1 foundation (types, secrets, Jira UI)  
2. Phase 2 chat binding  
3. Phase 3 MCP/runtime  
4. Phase 4 OAuth desktop  
5. Phase 5–6 expand + harden  

No code until this plan is approved.

---

## Unresolved questions
1. Confirm P0 connector is **Jira** (vs Asana-first if that is your daily driver).  
2. Any must-have connector for first public release beyond Jira?  
3. Should Integrations be feature-flagged behind desktop-only initially?  
