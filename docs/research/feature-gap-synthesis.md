# Chaeboxi Feature Gap Synthesis (v2 — Evidence-Based)
## Open WebUI + Jan AI → Actionable Feature Roadmap

> **Context**: Solo developer, 32GB MI50 GPU (local inference via Ollama already covered), targeting personal use only. Excludes multi-user, enterprise, local model management features.
>
> **Methodology**:
> [A] **Code-verified Chaeboxi facts** (validated from this repo via grep/read).
> [B] **External competitor comparisons** (dated snapshots from Open WebUI v0.8.12 / Jan v0.7.9; may drift).
> Previous v1 had 3 false "missing" claims caught by Codex review.
>
> **Platform scope note**: In this repo, MCP has split scope: MCP UI/configuration surfaces are desktop-gated via `featureFlags.mcp`, but MCP runtime bootstrap/client paths include non-Tauri HTTP/SSE transport and can run cross-platform when server configs are preconfigured. Knowledge Base UI/configuration remains desktop-gated via `featureFlags.knowledgeBase`.

---

## What Chaeboxi Already Has ([A] Code-Verified)

| Capability | Status | Evidence |
|-----------|--------|----------|
| 16 built-in providers (local + cloud) | ✅ | `src/shared/providers/index.ts` imports 16 provider definitions; local defaults include Ollama/LM Studio (`127.0.0.1`) |
| MCP support | ⚠️ Partial (desktop-gated UI/config + preconfigured cross-platform runtime path) | `featureFlags.mcp` gates MCP UI/routes, but startup imports `mcp_bootstrap` unconditionally and MCP controller has non-Tauri HTTP/SSE transport branch |
| Web search | ✅ Built-in | `src/renderer/packages/web-search/` |
| Knowledge Base / RAG | ⚠️ Desktop-only in-memory chunked text search scaffold (not SQLite/vector index) | `featureFlags.knowledgeBase` is desktop-only; backend path in `src-tauri/src/main.rs` uses `KnowledgeBaseState` `HashMap` + `chunk_text` + `score_search_text` |
| Reasoning/thinking display | ✅ Just improved | Shimmer, Markdown, grouped blocks (our recent work) |
| Session threads | ✅ Mature | `SessionThread` type in `types/session.ts` |
| i18n (14 languages) | ✅ | `src/renderer/i18n/locales/` |
| Multi-platform | ✅ Desktop/Web/Mobile | Tauri + Capacitor |
| Vercel AI SDK v6 | ✅ | `package.json` |
| Token estimation | ✅ Built-in | `src/renderer/packages/token-estimation/` |
| **Copilots (basic personas)** | ✅ EXISTS | `src/renderer/routes/copilots.tsx` — CRUD + star + avatar URL + system prompt. Persisted via Jotai atomWithStorage. Sessions link via `copilotId` field. Remote copilots from Chatbox community. |
| **Artifact-related rendering** | ⚠️ Partial | Mermaid/SVG rendering is active in `Markdown.tsx`; `MessageArtifact` HTML/CSS/JS extraction exists in `Artifact.tsx` but appears unwired in `components/chat/Message.tsx` |
| **Font size setting** | ✅ EXISTS | `settings.fontSize` (Zod, default 14) in `types/settings.ts`, slider UI in `routes/settings/general.tsx` |
| **Theme (Dark/Light)** | ✅ EXISTS | `Theme` enum in `types/settings.ts`, theme picker in settings |
| **Session copy/clone** | ✅ EXISTS | `copyAndSwitchSession` in `sessionActions.ts`, copy button in `SessionItem.tsx` |
| **Message forking** | ✅ EXISTS | Full fork system in `stores/session/forks.ts` — create/switch/delete/expand forks |
| **Drag-and-drop session reorder** | ✅ EXISTS | `@dnd-kit/core` in `SessionList.tsx` |
| **Resizable sidebar** | ✅ EXISTS | `src/renderer/Sidebar.tsx` drag handle + live width update; persisted `sidebarWidth` in `src/renderer/stores/uiStore.ts` |
| **Session starring** | ✅ EXISTS | `starred` field in `SessionSchema` |

---

## Corrected Feature Gaps (Only REAL Missing Features)

### 🔴 TIER 1 — High Impact, Genuinely Missing

#### 1. Cross-Conversation Memory
**Source**: Open WebUI | **Effort**: 0.5 day (MCP path) or 3-5 days (native built-in) | **Verified status**: Native memory is missing; MCP-provided memory exists via `basic-memory` registry entry. MCP setup UI is desktop-gated, while runtime HTTP/SSE MCP path can run cross-platform when preconfigured.

The model remembers facts/preferences across sessions without re-explaining.

| Aspect | Detail |
|--------|--------|
| **What** | Persistent user preferences, facts, and context that survive across conversations |
| **Current path in Chaeboxi** | MCP registry includes `basic-memory` (optional server install/config), enabling persistent memory without native DB/UI work (desktop has built-in setup UI; non-desktop requires preconfigured MCP server config) |
| **What's still missing natively** | Built-in memory schema, first-party memory UI, and automatic memory injection/approval flow |
| **How (Open WebUI)** | 5 built-in tools: `add_memory`, `search_memories`, `replace_memory_content`, `delete_memory`, `list_memories` |
| **Model autonomy** | Capable models (GPT-4, Claude, etc.) proactively decide what to remember |
| **User control** | Manual add/edit/delete via Settings > Personalization > Memory |

**Priority update (solo-user context)**: Use MCP `basic-memory` first; defer native memory unless you need zero-setup UX and first-party controls.

**If pursuing native implementation (with Codex review fixes)**:
- SQLite table: `memories(id, content, source_session_id, created_by, scope, approval_status, created_at, updated_at, deleted_at, tags)`
- **Provenance tracking**: Every memory records which session and what interaction created it
- **Scope boundaries**: memories scoped to assistant/provider/global to prevent cross-contamination
- **User-confirmed writes**: Model proposes memory → user confirms before persisting (default). Power users can enable auto-persist per scope
- **Soft-delete with tombstones**: `deleted_at` field for undo/audit trail instead of hard deletes
- System prompt injection: prepend relevant memories (semantic search via existing embeddings)
- Settings UI: view/edit/delete/restore stored memories with source session links
- **No global auto-inject**: memories only injected when relevant (semantic similarity threshold)

---

#### 2. Copilot Enhancement (NOT net-new — upgrade existing)
**Source**: Jan + Open WebUI | **Effort**: 1-2 days | **Verified**: Copilots exist but are basic.

**What exists** (`CopilotDetail` type):
```typescript
// Current fields in src/shared/types.ts:74
{ id, name, picUrl?, prompt, demoQuestion?, demoAnswer?, starred?, usedCount, shared? }
```

**What's missing vs Jan/Open WebUI**:
| Gap | Jan Has | Open WebUI Has | Chaeboxi Has |
|-----|---------|----------------|-------------|
| Per-persona model parameters (temp, top_p, etc.) | ✅ | ✅ | ❌ |
| Template variables (`{{CURRENT_DATE}}`, etc.) | ✅ | ✅ | ❌ |
| Emoji avatar (not just URL) | ✅ emoji picker | ❌ | ⚠️ URL only |
| Attachable knowledge bases | ❌ | ✅ | ❌ |
| Default copilot per session group | ✅ per-project | ❌ | ❌ |

**Implementation**: Extend `CopilotDetail` type with optional `modelSettings` (temperature, topP, maxTokens), `templateVariables` support in prompt rendering, and emoji avatar field alongside URL.

---

#### 3. Chat Folders / Session Organization
**Source**: Jan ("Projects") + Open WebUI ("Chat Folders") | **Effort**: 2-3 days | **Verified missing**: No folder/group/tag fields in `SessionSchema`. Session list is flat (sorted by drag order + starred). `IconArchive` in sidebar is just "Clear Conversation List", not true archiving.

**What exists**: Flat sortable list with starring and drag reorder.
**What's missing**: Folders, tags, true archive (hide-but-keep).
**Verification note**: Pin-like behavior already exists via `starred` in `src/shared/types/session.ts`, star/unstar toggle in `src/renderer/components/session/SessionItem.tsx`, and pinned-first ordering in `src/renderer/utils/session-utils.ts` (`sortSessions`).

**Implementation approach**:
- New type: `Folder { id, name, emoji, defaultCopilotId?, order }`
- Add optional `folderId` and `tags` fields to `SessionSchema`
- Sidebar: collapsible folder groups within existing `SessionList.tsx` DnD context
- True archive: `archived` boolean on session (hidden from main list, accessible via archive view)
- Tag system: session tags for cross-folder search (leverages existing `SearchDialog`)

---

#### 4. Artifact Enhancement (NOT net-new — upgrade existing)
**Source**: Open WebUI | **Effort**: 2-3 days | **Verified**: Rendering exists, but paths are split and partially wired.

**What exists (live rendering path)**:
- Mermaid code fences render via `MessageMermaid` in `Markdown.tsx`
- SVG code blocks/inline SVG render via `SVGPreview` in `Markdown.tsx`
- HTML code blocks can be previewed via code-block action in `Markdown.tsx` (`onClickArtifact`)

**Wiring caveat**:
- `MessageArtifact`/`generateHtml` multi-block extraction path exists in `Artifact.tsx`, but `Message.tsx` currently only imports it and computes `needArtifact`/`previewArtifact`; no render usage found.

**What's missing vs Open WebUI**:
| Gap | Open WebUI Has | Chaeboxi Has |
|-----|----------------|-------------|
| SVG rendering | ✅ Pan + zoom | ✅ Via Markdown (`SVGPreview`) |
| Mermaid rendering | ✅ | ✅ Via Markdown (`MessageMermaid`) |
| Conversation-context HTML/CSS/JS assembly | ✅ | ⚠️ Extraction logic exists, but `MessageArtifact` appears unwired in `Message.tsx` |
| Version tracking (edit history) | ✅ Numbered versions | ❌ Only latest |
| Persistent artifact storage | ✅ Key-value API | ❌ Ephemeral |
| Self-hosted iframe origin | N/A (server-side) | ❌ Uses external `chatboxai.app` |
| Artifact-level workflow integration | ✅ Unified | ⚠️ Split between Markdown preview and `Artifact.tsx` path |

**Implementation**: Wire `MessageArtifact` path into `Message.tsx` (or remove dead path), add artifact versioning/storage metadata, and consider self-hosted iframe origin for offline support.

---

#### 5. Tool Approval UI (MCP Security)
**Source**: Jan | **Effort**: 1-2 days | **Verified missing**: grep for `approv|confirm.*tool|tool.*confirm` returned 0 matches. No tool consent mechanism exists.

**Implementation approach (with Codex review fixes — NO global auto-approve)**:
- Modal component: tool name, description, full parameters preview
- **Scoped approvals only** (no global bypass):
  - "Allow once" → single invocation
  - "Always allow this tool in this session" → per-tool + per-session scope
  - "Deny" → block with optional reason
- **Risk-tier system**: classify tools by capability
  - 🟢 Low risk (search, read): allow-once default, rememberable
  - 🟡 Medium risk (web fetch, file read): always show modal
  - 🔴 High risk (code execution, file write): hard-confirm every time, never auto-approve
- **Audit log**: persist all approval decisions with timestamps for review
- **Expiry/TTL**: "always allow" approvals expire when session ends (not persisted across sessions)
- Zustand store: `toolApprovals` map keyed by `sessionId:toolName`
- Nice-modal integration for the approval dialog

---

### 🟡 TIER 2 — Medium Impact, Quick Wins

#### 6. Token Speed Indicator
**Source**: Jan | **Effort**: 0.5-1 day | **Verified missing**: grep for `token.*speed|tokens.*sec` found only unrelated context-tokens code.

```
Implementation:
- Track Date.now() at first chunk and increment counter per chunk
- Calculate rolling average tokens/sec
- Display in message footer during streaming
- Persist final speed in message metadata
```

---

#### 7. Prompt Presets with Template Variables
**Source**: Open WebUI | **Effort**: 1-2 days | **Verified**: no matches found in chat/routes for `/` preset-picker or template-variable patterns (`rg -ni "startsWith\\('/'\\)|prompt.*picker|preset.*picker|\\{\\{CURRENT_DATE\\}\\}|\\{\\{CURRENT_TIME\\}\\}|\\{\\{CLIPBOARD\\}\\}|templateVariables" src/renderer/components src/renderer/routes --glob '!**/*.test.*'` → exit 1).

```
Features:
- '/' prefix in chat input triggers preset picker (fuzzy search)
- Template variables: {{CLIPBOARD}}, {{CURRENT_DATE}}, {{CURRENT_TIME}}
- CRUD management in settings
- Reuse existing copilot prompt infrastructure
```

---

#### 8. Text Select Quick Actions
**Source**: Open WebUI | **Effort**: 1 day | **Verified missing**: `getSelection` found in `InputBox.tsx` (input selection), not for assistant message text selection actions.

```
Actions on text selection in assistant messages:
- "Explain this" → sends selected text as follow-up
- "Translate" → translate selected text
- "Copy" → copy to clipboard
- Floating toolbar anchored to selection position
```

---

#### 9. Message Queue (Compose While Generating)
**Source**: Open WebUI | **Effort**: 1-2 days | **Verified**: `UpdateQueue` exists but is for session storage writes, not for user message queuing during generation.

```
What: User can type and send new messages while AI is still generating
How: Queue messages in chat store, auto-send when generation completes
Why: Stops the "wait for it to finish" UX friction
```

---

### 🟢 TIER 3 — Nice-to-Have

| # | Feature | Source | Effort | Status | Notes |
|---|---------|--------|--------|--------|-------|
| 10 | Accent color picker | Jan + OWebUI | 0.5 day | ❌ Missing | `react-colorful` + CSS variable theming |
| 11 | ~~Font size setting~~ | ~~Jan~~ | — | ✅ EXISTS | `settings.fontSize`, slider in general settings |
| 12 | Code execution (Pyodide) | Open WebUI | 2-3 days (native UX) | ⚠️ MCP-optional (desktop UI/config; preconfigured runtime path cross-platform) | `pydantic-run-python` (Pyodide) registry entry exists; MCP tools are wired into chat via `mcpController.getAvailableTools()` |
| 13 | RLHF annotations | Open WebUI | 1 day | ❌ Missing | 👍/👎 + feedback text on messages |
| 14 | Agent mode toggle | Jan | 1 day | ❌ Missing | Per-thread autonomous tool-calling switch |
| 15 | Context overflow dialog | Jan | 1 day | ❌ Missing | Ask before expanding context vs truncating |
| 16 | Multiple models in one chat | Open WebUI | 2-3 days | ❌ Missing | Compare responses side-by-side |
| 17 | ~~Chat cloning~~ | ~~Open WebUI~~ | — | ✅ EXISTS | `copyAndSwitchSession` in SessionItem |
| 18 | Deep Research prompt template | Jan | 0.5 day | ❌ Missing | Pre-built research copilot with search instructions |
| 19 | Custom backgrounds | Open WebUI | 0.5 day | ❌ Missing | Theme personalization |

---

## Corrected Feature Comparison Matrix

Evidence classes: Chaeboxi column uses [A] code-verified repo facts; Open WebUI/Jan columns are [B] dated external comparisons.

| Feature | Chaeboxi | Open WebUI | Jan |
|---------|----------|------------|-----|
| **Cross-conversation memory** | ⚠️ MCP-optional (`basic-memory`): desktop UI/config + preconfigured cross-platform runtime path; no native built-in | ✅ Autonomous + manual | ❌ |
| **Custom assistants/personas** | ⚠️ Rich basics (name/prompt/avatar/demo/share/star/usage + `copilotId` linkage), missing per-copilot params/templates/KB | ✅ Skills + params | ✅ Full (params+templates) |
| **Chat folders/projects** | ❌ No folders/tags/archive views (starring + drag reorder exist) | ✅ Folders + tags | ✅ Projects |
| **Artifacts rendering** | ⚠️ Mermaid+SVG via Markdown; HTML preview exists; `MessageArtifact` multi-block wiring appears inactive; no versioning | ✅ HTML/SVG/D3 + versions | ❌ |
| **Tool approval UI** | ❌ Missing | ❌ | ✅ Allow/deny/always |
| **Token speed indicator** | ❌ Missing | ❌ | ✅ Gauge + history |
| **Prompt presets (/ command)** | ❌ Missing | ✅ Variables support | ❌ |
| **Text select quick actions** | ❌ Missing | ✅ Floating buttons | ❌ |
| **Message queue** | ❌ Missing | ✅ Compose while gen | ❌ |
| **Code execution (Python)** | ⚠️ MCP-optional (`pydantic-run-python`/Pyodide): desktop UI/config + preconfigured cross-platform runtime path; no native built-in runner | ✅ Built-in (Pyodide) | ❌ |
| **Thinking/reasoning display** | ✅ Implemented | ✅ Good | ⚠️ Basic |
| **Web search** | ✅ Direct | ✅ 15+ providers | ⚠️ MCP-delegated |
| **MCP support** | ⚠️ Partial: desktop-gated config UI + cross-platform runtime HTTP/SSE path when preconfigured (native RMCP path on desktop) | ⚠️ Basic | ✅ Native RMCP |
| **RAG/knowledge base** | ⚠️ Desktop-only in-memory chunked lexical search scaffold (HashMap + `score_search_text`), no native vector index | ✅ Advanced (9 vector DBs) | ✅ |
| **Multi-platform** | ✅ Desktop + web + mobile | ⚠️ Web only | ✅ Desktop + mobile |
| **Provider count** | ✅ 16 built-in (local + cloud) | ✅ Flexible (OpenAI compat) | ⚠️ ~7 direct |
| **i18n** | ✅ 14 langs | ✅ Multiple | ⚠️ 2 langs |
| **Font size setting** | ✅ | ✅ | ✅ |
| **Session clone/copy** | ✅ | ✅ | ❌ |
| **Message forking** | ✅ Full system | ✅ | ❌ |
| **Session starring** | ✅ | ✅ Pinning | ✅ |
| **Drag-and-drop reorder** | ✅ | ✅ | ❌ |

---

## Revised Implementation Order

Based on impact-to-effort ratio, corrected for already-existing features:

```
Sprint 1 (Week 1): Quick Wins
├── Token speed indicator (0.5 day) — genuinely missing
├── Accent color picker (0.5 day) — genuinely missing
└── Copilot enhancement: add modelSettings + template vars (1 day) — extend existing

Sprint 2 (Week 2): Organization
├── Chat folders / session grouping (2-3 days) — genuinely missing
└── Prompt presets with '/' command (1-2 days) — genuinely missing

Sprint 3 (Week 3): Intelligence
└── Context overflow dialog (1 day)

Sprint 4 (Week 4): Security + UX
├── Tool approval UI (1-2 days) — genuinely missing
│   (with risk tiers, scoped approvals, audit log, NO global bypass)
├── Text select quick actions (1 day)
└── Message queue (1-2 days)

Sprint 5 (Week 5+): Enhancements
├── Native cross-conversation memory (3-5 days, optional)
│   (MCP `basic-memory` already available; desktop has setup UI, non-desktop can use preconfigured runtime path)
├── Native code execution UX (optional 2-3 days)
│   (MCP `pydantic-run-python` / Pyodide path already available; desktop has setup UI, non-desktop can use preconfigured runtime path)
├── Artifact enhancement: wire `MessageArtifact` path + versioning + local-first iframe option (2-3 days)
├── RLHF annotations (1 day)
├── Agent mode toggle (1 day)
└── Deep Research copilot preset (0.5 day) — just a copilot template
```

**Total estimated: ~4-5 weeks core roadmap + optional 3-5 days (native memory) + optional 2-3 days (native code execution UX)**

---

## What NOT To Build (And Why)

| Feature | Why Skip |
|---------|---------|
| Local inference (llama.cpp) | Already have 32GB MI50 + Ollama — same result, no Rust work |
| Model hub / catalog | Ollama handles model management |
| Local API server | Ollama already serves at localhost:11434 |
| Channels (collaborative chat) | Solo user — no audience |
| Voice/video calls | Niche, high complexity |
| Analytics dashboard | Solo user — limited value |
| Multi-user management | Solo user |
| SCIM/LDAP/SSO | Solo user |
| Pipeline framework | MCP covers extensibility |
| Font size setting | Already exists (`settings.fontSize` + UI slider) |
| Resizable sidebar | Already exists (`Sidebar.tsx` drag handle + persisted `sidebarWidth`) |
| Chat cloning | Already exists (`copyAndSwitchSession`) |
| Basic copilots | Already exists (CRUD + star + avatars + prompts) |
| Baseline artifact preview | Already exists (Markdown Mermaid/SVG + HTML preview modal); avoid rebuilding from scratch |
| Message forking | Already exists (full fork system with create/switch/delete) |

---

## Corrections From v1

| v1 Claim | Reality | Impact |
|----------|---------|--------|
| "Custom Assistants ❌ Missing" | ✅ Copilots system exists with full CRUD, starring, avatar, prompts, remote community copilots | Would have rebuilt existing feature (2-3 days wasted) |
| "Artifacts ❌ Missing" | ⚠️ Rendering exists (Markdown Mermaid/SVG + HTML preview); `MessageArtifact` extraction path exists but appears partially wired | Would have rebuilt existing pieces while missing wiring gaps |
| "Font size ❌ Missing" | ✅ `settings.fontSize` with slider UI in general settings | Would have added duplicate setting |
| "Chat cloning ❌ Missing" | ✅ `copyAndSwitchSession` with copy button on every session | Would have added duplicate feature |
| "Resizable sidebar ❌ Missing" | ✅ Sidebar drag-resize is implemented and persisted (`Sidebar.tsx` + `uiStore.ts`) | Would have rebuilt existing feature |
| "Pinning ❌ Missing" | ✅ Session starring already provides pin-like behavior; `sortSessions()` places starred sessions first | Would have duplicated existing behavior |
| "Custom assistants = name+prompt only" | ⚠️ Understated; copilots already include avatar/demo/share/star/usage fields plus session linkage via `copilotId` | Would have mis-prioritized copilot roadmap scope |
| "Artifacts = HTML only / SVG missing" | ⚠️ Mermaid/SVG already render via `Markdown.tsx`; multi-block `MessageArtifact` path exists but appears unwired in `Message.tsx` | Mixed false-missing/false-existing artifact assessment |
| "16+ cloud providers" | ⚠️ Codebase shows 16 built-in providers total, including local endpoints (Ollama/LM Studio on `127.0.0.1`) | Cloud-only framing overstated scope |
| "Knowledge base = SQLite + embeddings" | ⚠️ Active backend path is in-memory `KnowledgeBaseState` + chunked lexical scoring (`score_search_text`), with model config fields but no native vector index | Would have overstated production maturity |
| "Code execution (Pyodide) ❌ Missing" | ⚠️ Partial availability already exists via MCP registry (`pydantic-run-python`) and tool wiring in chat (`mcpController.getAvailableTools()`) | Would have mis-scored an MCP-available capability as absent |
| "MCP/KB workaround available everywhere" | ⚠️ Mixed scope: MCP runtime path exists cross-platform when preconfigured, but MCP UI/config and KB UI/config are desktop-gated via `featureFlags` | Would overstate web/mobile capability coverage or understate MCP runtime reach |
| "Cross-conversation memory ❌ Missing (absolute)" | ⚠️ Native memory is missing, but MCP `basic-memory` registry path already exists | Gap was overstated; native work is now optional/deferred for solo use |
| "MCP tool approval: global auto-approve toggle" | Security anti-pattern — collapses trust boundary for prompt injection | Would have shipped a vulnerability |
| "Memory: simple schema" | Underspecified — no provenance, no scope, no rollback | Would have shipped poisoning-vulnerable memory |

---

## Verification Appendix (Audit Trail)

Verification limits (scoring guardrails):

- `✅` means first-party/native capability in Chaeboxi’s default product path.
- `⚠️ MCP-optional` means capability is available through optional MCP server setup, not as native first-party UX.
- MCP has split scope in this doc: UI/configuration is desktop-gated, but runtime HTTP/SSE MCP client path exists cross-platform when preconfigured.
- Knowledge Base remains desktop-gated in current product UI/configuration path.
- `❌` means neither native nor MCP-optional path was found.

Exact commands used (per-claim, case-insensitive):

```bash
## Corrected non-gap claims
rg -ni "starred: z.boolean\(\)\.optional\(\)|copilotId: z.string\(\)\.optional\(\)" src/shared/types/session.ts
rg -ni "unstar|\{ \.\.\.s, starred: !s\?\.starred \}|IconStarFilled" src/renderer/components/session/SessionItem.tsx
rg -ni "sortSessions|const pinned|if \(sess\.starred\)|return pinned\.concat\(reversed\)" src/renderer/utils/session-utils.ts
rg -ni "interface CopilotDetail|picUrl\?|prompt: string|demoQuestion\?|demoAnswer\?|starred\?|usedCount|shared\?" src/shared/types.ts
rg -ni "copilotId: z.string\(\)\.optional\(\)" src/shared/types/session.ts
rg -ni "handleResizeStart|onMouseDown=\{handleResizeStart\}|sidebarWidth|setSidebarWidth" src/renderer/Sidebar.tsx src/renderer/stores/uiStore.ts
rg -ni "^import './definitions/" src/shared/providers/index.ts
rg -ni "apiHost: 'http://127\\.0\\.0\\.1:11434'|apiHost: 'http://127\\.0\\.0\\.1:1234'" src/shared/providers/definitions/ollama.ts src/shared/providers/definitions/lmstudio.ts
rg -ni "mcp: platform.type === 'desktop'|knowledgeBase: platform.type === 'desktop'" src/renderer/utils/feature-flags.ts
rg -ni "featureFlags\\.mcp|featureFlags\\.knowledgeBase" src/renderer/routes/settings/route.tsx
rg -ni "featureFlags\\.mcp|featureFlags\\.knowledgeBase" src/renderer/components/InputBox/InputBox.tsx
rg -ni "import\\('./setup/mcp_bootstrap'\\)" src/renderer/index.tsx
rg -ni "isTauriRuntime\\(\\)|transportConfig.type === 'http'|StreamableHTTPClientTransport|type: 'sse'" src/renderer/packages/mcp/controller.ts

## Missing-feature claims
rg -ni "name: 'basic-memory'|args: \['basic-memory', 'mcp'\]" src/renderer/components/settings/mcp/registries.ts
rg -ni "add_memory|search_memories|replace_memory_content|delete_memory|list_memories|memories\(" src src-tauri
rg -ni "struct knowledgebasestate|hashmap<i64, knowledgebaserecord>|file_chunks|fn score_search_text|\"kb:search\"|chunk_text|embedding_model|rerank_model|vision_model" src-tauri/src/main.rs
rg -ni "sqlite|rusqlite|vector|faiss|hnsw" src-tauri/src/main.rs
rg -ni "modelSettings|templateVariables|defaultCopilotId|knowledgeBaseId|copilot.*knowledge|knowledge.*copilot" src/shared/types.ts src/renderer/routes/copilots.tsx
rg -ni "\bfolderId\b|\barchived\b|\btags\b" src/shared/types/session.ts src/renderer/components/session src/renderer/stores/session --glob '!**/*.test.*'
rg -ni "MessageMermaid|SVGPreview|language === 'mermaid'|language === 'svg'|startsWith\\('<svg'\\)" src/renderer/components/Markdown.tsx
rg -ni "MessageArtifact|needArtifact|previewArtifact|isContainRenderableCode" src/renderer/components/chat/Message.tsx
rg -ni "generateHtml|CODE_BLOCK_LANGUAGES|RENDERABLE_CODE_LANGUAGES|artifact-preview|iframe|reload|fullscreen" src/renderer/components/Artifact.tsx
rg -ni "artifactVersions|versionHistory|\bd3\b|\bthree\b|pan.?zoom|zoom" src/renderer/components/Artifact.tsx
rg -ni "approv|confirm.*tool|tool.*confirm|toolApprovals" src/renderer src-tauri
rg -ni "token.?speed|tokens?/sec|speed.*token" src/renderer src/shared --glob '!**/*.test.*'
rg -ni "startsWith\('/'\)|prompt.*picker|preset.*picker|\{\{CURRENT_DATE\}\}|\{\{CURRENT_TIME\}\}|\{\{CLIPBOARD\}\}|templateVariables" src/renderer/components src/renderer/routes --glob '!**/*.test.*'
rg -ni "getSelection|selectionchange" src/renderer/components src/renderer/routes
rg -ni "selectionToolbar|quickAction|onTextSelection|textSelectionAction|selectionAction" src/renderer/components src/renderer/routes --glob '!**/*.test.*'
rg -ni "UpdateQueue|sessionListUpdateQueue|sessionUpdateQueues" src/renderer/stores/chatStore.ts src/renderer/stores/updateQueue.ts
rg -ni "messageQueue|queuedMessage|enqueueMessage" src/renderer/stores src/renderer/components --glob '!**/*.test.*'
rg -ni "accentColor|setAccent|react-colorful" src/renderer src/shared --glob '!**/*.test.*'
rg -ni "pydantic-run-python|pyodide|mcp-run-python" src/renderer/components/settings/mcp/registries.ts
rg -ni "mcpController\.getAvailableTools\(\)" src/renderer/packages/model-calls/stream-text.ts
rg -ni "thumbs.?up|thumbs.?down|messageFeedback|messageAnnotation|\bRLHF\b" src/renderer src/shared --glob '!**/*.test.*'
rg -ni "agentMode|agent mode|autonomous tool" src/renderer src/shared --glob '!src/renderer/i18n/locales/**' --glob '!**/*.test.*'
rg -ni "context overflow|expand context|truncate context|overflow dialog" src/renderer src/shared --glob '!**/*.test.*'
rg -ni "selectedModels|model comparison|compare responses|multi-model.*chat" src/renderer src/shared --glob '!src/renderer/i18n/locales/**' --glob '!**/*.test.*'
rg -ni "Deep Research|deep research|research copilot" src/renderer/routes/copilots.tsx src/renderer/components src/renderer/stores src/shared/types.ts --glob '!**/*.test.*'
rg -ni "custom background|wallpaper|setBackground|background.*custom" src/renderer src/shared --glob '!**/*.test.*'
```

Matched files and lines (high-signal subset):

- `src/shared/types/session.ts`: 255 (`starred`), 257 (`copilotId`)
- `src/renderer/components/session/SessionItem.tsx`: 60, 61, 67 (`star/unstar` actions)
- `src/renderer/utils/session-utils.ts`: 29, 31, 37, 38, 43 (`sortSessions` pinned-first behavior)
- `src/shared/types.ts`: 74, 77-83 (`CopilotDetail` capability fields)
- `src/shared/providers/index.ts`: 5-20 (16 built-in provider definition imports)
- `src/shared/providers/definitions/ollama.ts`: 10 (`http://127.0.0.1:11434`)
- `src/shared/providers/definitions/lmstudio.ts`: 10 (`http://127.0.0.1:1234`)
- `src/renderer/utils/feature-flags.ts`: 4-5 (`mcp`/`knowledgeBase` are desktop-only)
- `src/renderer/routes/settings/route.tsx`: 42-59 (MCP/Knowledge Base settings items gated by flags)
- `src/renderer/components/InputBox/InputBox.tsx`: 1035-1056 (`MCPMenu` gated), 1058-1070 (`KnowledgeBaseMenu` gated)
- `src/renderer/index.tsx`: 72-74 (`import('./setup/mcp_bootstrap')` runs at startup, not behind desktop-only flag)
- `src/renderer/packages/mcp/controller.ts`: 52-54 (Tauri branch), 77-103 (non-Tauri HTTP + SSE fallback branch)
- `src/renderer/Sidebar.tsx`: 39, 43, 70, 77, 79, 89, 103, 119, 244
- `src/renderer/stores/uiStore.ts`: 46, 198, 199, 209
- `src/renderer/components/Markdown.tsx`: 171-172 (Mermaid render), 186-190 (SVG render path)
- `src/renderer/components/chat/Message.tsx`: 46, 99, 234, 238 (`MessageArtifact` imported / artifact flags computed but no render usage found)
- `src/renderer/components/Artifact.tsx`: 16-20 (`html/js/css` code languages), 63 (`generateHtml`), 210+ (`generateHtml` implementation)
- `src-tauri/src/main.rs`: 59-64 (`embedding_model`/`rerank_model`/`vision_model` fields), 88-92 (`KnowledgeBaseState` HashMaps), 313-354 (`chunk_text` + `score_search_text`), 1256-1258 (chunk ingestion), 1285-1333 (`kb:search` lexical scoring loop)
- `src/renderer/components/settings/mcp/registries.ts`: 485, 486, 493
- `src/renderer/components/settings/mcp/registries.ts`: 374-389 (`pydantic-run-python`, Pyodide-based MCP server)
- `src/renderer/packages/model-calls/stream-text.ts`: 289 (`...mcpController.getAvailableTools()`)
- Native memory grep (`add_memory|search_memories|replace_memory_content|delete_memory|list_memories|memories\(`) returned no matches in `src` / `src-tauri` (exit code 1)
- Missing-feature grep commands above returned exit code 1 for "no match" claims and positive hits where noted (e.g., `UpdateQueue`, `Artifact.tsx`, `basic-memory`, star/pin evidence)

---

*Generated: 2026-04-03 (v2) | Verified against codebase | Sources: Open WebUI docs (v0.8.12), Jan AI GitHub (v0.7.9), live MiniMax search*
*Previous v1 had 3 false gap claims + 2 security design issues caught by Codex adversarial review*
