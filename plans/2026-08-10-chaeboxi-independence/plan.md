# Plan: Legitimate Chaeboxi Independence from Chatbox Fork

**Status:** core implementation done (GitHub detach still manual)  
**Goal:** Detach Chaeboxi from the Chatbox GitHub fork network and operate as a legitimate, independently branded GPLv3 product — without rewriting history or relicensing.  
**Repo:** `nikethai/chaeboxi` (currently `isFork: true` of `chatboxai/chatbox`)  
**License:** GPLv3 (must keep)  
**Approach:** Hard product fork + soft legal continuity (recommended)

### User approval (2026-08-10)

| Decision | Choice |
|----------|--------|
| Domain / legal pages | **Wait** for chaeboxi domain; GitHub placeholders until then |
| Mobile | **In scope** for Phase 4 (IDs/store identity) |
| GitHub detach | **Stay on current repo** `nikethai/chaeboxi` (in-place detach) |
| Telemetry | **Disable** until Chaeboxi accounts exist |
| Chatbox AI code | **Stability-first:** keep internal stubs/enums for migration & cherry-picks; strip from UI + block network; no mass delete |

---

## Executive summary

Chaeboxi already diverges feature-wise (agents, memory, usage hub, UI polish, etc.) and partially rebrands the desktop app (`productName: Chaeboxi`, `identifier: com.chaeboxi`). It is **not** yet a legitimate independent product because:

1. GitHub still marks it as a fork of Chatbox  
2. `package.json` / README / FUNDING still identify Chatbox CE and original author  
3. Runtime still routes users and some services toward `chatboxai.app`  
4. Chatbox AI provider / paid-feature remnants remain in code paths  
5. GPLv3 attribution for the derivative work is not packaged as an explicit product NOTICE

**Legitimate outcome:** Chaeboxi owns brand, docs, updates, telemetry, and cloud coupling — while **honestly** remaining a GPLv3 derivative of Chatbox Community Edition.

**Non-goals:** proprietary relicense, history rewrite, clean-room rewrite, claiming “unrelated to Chatbox.”

---

## Locked decisions (approved)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| License | Keep **GPLv3** | Only legal option without full copyright assignment |
| Attribution | `NOTICE` + README “Based on Chatbox CE” | Honest GPL compliance |
| Git history | **Preserve full history** | Attribution + audit trail |
| GitHub | **In-place detach** on `nikethai/chaeboxi` | User: stay on current repo |
| Chatbox AI cloud | **Stability-first disable** — UI/network off; keep stubs/enums | Avoid regressions; easier upstream cherry-picks |
| Telemetry | **Disabled** until Chaeboxi Sentry/Plausible exist | No traffic to Chatbox analytics |
| Domain / legal pages | **GitHub placeholders** until chaeboxi domain | User waits for domain |
| Mobile | **In scope** (Phase 4) | User wants mobile covered |

**2026-08-15 homepage follow-up:** `plans/260815-1439-marketing-site-github-pages/` ships GitHub Pages (`https://nikethai.github.io/chaeboxi/`) as the interim homepage + legal URLs. Custom domain still later. This supersedes “wait for domain” for *public URL existence* only.
| Internal renames | **Phase 5 optional** | Not required for legitimacy |

---

## Architecture target

```text
┌──────────────────────────────────────────────────────────┐
│  Chaeboxi product surface                                 │
│  brand · About · updates · privacy/terms · telemetry      │
│  package identity · GitHub standalone                     │
└────────────────────────────┬─────────────────────────────┘
                             │ GPLv3 + NOTICE (derived from Chatbox CE)
                             ▼
┌──────────────────────────────────────────────────────────┐
│  Shared technical DNA (kept)                              │
│  Tauri 2 · React · providers · sessions · MCP · storage   │
└──────────────────────────────────────────────────────────┘
```

### Boundaries to own after completion

| Boundary | Owner |
|----------|--------|
| App name / icons / bundle ID | Chaeboxi |
| Update channel | Chaeboxi GitHub Releases (or domain) |
| Analytics / Sentry | Chaeboxi project or disabled |
| Paid/hosted AI upsell | None (user BYOK providers) |
| License text + NOTICE | Ship with every distribution |
| Upstream credit | Permanent, visible, accurate |

---

## Inventory (current coupling)

### A. Metadata / docs (Phase 1)

| Item | Current | Target |
|------|---------|--------|
| GitHub fork | `isFork: true` → parent `chatboxai/chatbox` | Detached / standalone |
| `package.json` name | `xyz.chatboxapp.ce` | `chaeboxi` (or `com.chaeboxi`) |
| `package.json` repository | `https://github.com/chatboxai/chatbox.git` | `https://github.com/nikethai/chaeboxi.git` |
| `package.json` author | `bennhuang` | Chaeboxi maintainers |
| `src-tauri/tauri.conf.json` | Already `Chaeboxi` / `com.chaeboxi` | Keep |
| `README.md`, `doc/README-CN.md` | Chatbox CE marketing + download badges | Chaeboxi product docs + attribution |
| `.github/FUNDING.yml` | `github: Bin-Huang` | Your funding or empty |
| `LICENSE` | GPLv3 | Keep as-is |

### B. Runtime external Chatbox endpoints (~32 files touch `chatboxai.app` / related)

High-priority product files:

- `src/renderer/routes/about.tsx` — update, privacy, terms, homepage, feedback, FAQs  
- `src/shared/request/chatboxai_pool.ts` — API origin pool  
- `src/renderer/packages/remote.ts` — remote Chatbox services  
- `src/shared/models/utils/openai-headers.ts` — `HTTP-Referer: https://chatboxai.app`  
- `src/shared/providers/definitions/models/openrouter.ts` — same referer  
- `vite.renderer.config.ts` — Plausible domain + Sentry project `chatbox`  
- `src/renderer/packages/initial_data.ts` — seed content referencing Chatbox  
- i18n locales (many) — product strings / links  

### C. Chatbox AI provider / paid features (Phase 3)

Already partially handled:

- `settingsStore.ts` → `stripChatboxPaidFeatures()` deletes `chatbox-ai` provider on load  
- `lastUsedModelStore.ts` clears chatbox-ai defaults  

Still present:

- `ModelProviderEnum.ChatboxAI` in `src/shared/types/provider.ts`  
- Provider registry / icons / settings UI paths  
- Migration defaults that fall back to ChatboxAI  
- Error types `ChatboxAIAPIError` used as generic API errors  
- Document parser type `'chatbox-ai'`  
- Session fields `chatboxAIFileUUID`, `chatboxAILinkUUID` (storage compat — keep keys)  

### D. Storage identity (careful)

| Key | Action |
|-----|--------|
| IndexedDB `chatbox-image-generation` | **Do not rename** without migration (data loss risk) |
| Storage keys / session fields with `chatbox*` | Keep for backward compat; document as legacy |
| App data directory (Tauri identifier) | Already `com.chaeboxi` — good |

---

## Phases overview

| Phase | Name | Priority | Depends | Effort | Parallelizable |
|-------|------|----------|---------|--------|----------------|
| 0 | Decisions & freeze | P0 | — | 0.5d | — |
| 1 | Legal + GitHub + metadata | P0 | 0 | 1–2d | No |
| 2 | Product surface de-Chatbox | P0 | 1 | 3–5d | Partial with 3 |
| 3 | Chatbox AI provider excision | P0 | 1 | 2–4d | Partial with 2 |
| 4 | Distribution independence | P1 | 2, 3 | 1–3d | After 2–3 |
| 5 | Internal hygiene (optional) | P2 | 2, 3 | weeks | Anytime later |
| 6 | Docs & verification gate | P1 | 2, 3, 4 | 1d | After core |

**Critical path:** 0 → 1 → (2 ∥ 3) → 4 → 6. Phase 5 never blocks ship.

---

## Phase 0 — Decisions & freeze

### Objective
Lock scope so implementation does not thrash on brand/legal choices.

### Steps
1. Confirm GPLv3 independent product model (not proprietary).  
2. Confirm Chatbox AI cloud is out of product.  
3. Confirm brand lock: name **Chaeboxi**, identifier `com.chaeboxi`, existing icon set (or schedule new icons).  
4. Freeze “no more Chatbox CE copy-paste” for new features.  
5. Snapshot current `git remote -v`, `gh repo view --json isFork,parent`, and inventory of `chatboxai.app` hits (baseline for acceptance greps).

### Success criteria
- [ ] Written decisions recorded in plan or issue  
- [ ] Baseline grep counts saved under `plans/.../reports/baseline-coupling.md` (when cooking)

---

## Phase 1 — Legal package, metadata, GitHub detach

### Objective
Make the repository **honest and independently identified** under GPLv3.

### Requirements
- Functional: repo no longer presents as Chatbox CE; metadata points to Chaeboxi  
- Legal: LICENSE preserved; NOTICE + README attribution present  
- Non-functional: history intact; no secret history rewrite  

### Related files

**Create**
- `NOTICE` — derivative attribution template  
- Optional: `docs/legal-attribution.md` (short maintainer note)

**Modify**
- `LICENSE` — keep content; ensure still present in repo root  
- `README.md` — full rewrite as Chaeboxi  
- `doc/README-CN.md` — mirror rewrite (or mark as secondary)  
- `package.json` — name, productName, description, repository, author, bugs/homepage if any  
- `.github/FUNDING.yml`  
- `.github/ISSUE_TEMPLATE/*`, `PULL_REQUEST_TEMPLATE.md` if they say Chatbox  
- `AGENTS.md` — community-edition wording → Chaeboxi independence note  

**GitHub ops (manual / `gh`)**
1. Prefer: Settings → leave fork network / detach fork (if available for account).  
2. Fallback:
   ```bash
   # create empty non-fork repo, then
   git remote set-url origin git@github.com:OWNER/chaeboxi.git
   git push --all origin
   git push --tags origin
   # optionally archive/delete old forked repo after DNS/links updated
   ```
3. Verify: `gh repo view --json isFork,parent` → not a fork (or parent null).

### NOTICE content (template)

```text
Chaeboxi
Copyright (c) <YEAR> <MAINTAINERS>

This product includes software derived from Chatbox Community Edition
(https://github.com/chatboxai/chatbox), licensed under the GNU GPL v3.
Upstream authors retain copyright in their contributions.

Chaeboxi modifications are also licensed under the GNU GPL v3.
See LICENSE for the full license text.
```

### README must include
1. Chaeboxi name + one-line pitch  
2. Your install/release links (not chatboxai.app)  
3. Feature list reflecting **current** Chaeboxi  
4. **Attribution** section (Chatbox CE + GPLv3)  
5. Build/dev commands (can reuse AGENTS.md summary)  
6. Link to LICENSE  

### Success criteria
- [ ] `LICENSE` unchanged GPLv3  
- [ ] `NOTICE` present and accurate  
- [ ] README has zero Chatbox download badges / App Store links for Chatbox  
- [ ] `package.json` repository/author/name are Chaeboxi  
- [ ] GitHub not forked-from chatbox (or documented standalone fallback complete)  
- [ ] FUNDING does not solicit for upstream author by default  

### Risks
| Risk | Mitigation |
|------|------------|
| Detach loses PR/issue continuity | Detach in place preferred over recreate |
| README rewrite loses useful install docs | Port only still-true build steps from AGENTS.md |
| Accidental LICENSE edit | Diff-only allowlist: do not reformat LICENSE body |

---

## Phase 2 — Product surface de-Chatbox

### Objective
Shipped UI and telemetry no longer present Chaeboxi as Chatbox or funnel users to Chatbox’s product.

### Requirements
- Functional: About/settings links are Chaeboxi’s (or neutral GitHub)  
- Functional: no auto-update / marketing redirects to chatboxai.app  
- Non-functional: build still works web + desktop  

### Related files (priority order)

**Modify**
1. `src/renderer/routes/about.tsx`  
   - Replace check_update, privacy, terms, homepage, feedback, changelog, FAQ links  
   - Replace Chinese hard-coded Chatbox sales copy  
2. `vite.renderer.config.ts`  
   - Plausible domain → Chaeboxi or remove plugin  
   - Sentry `project: 'chatbox'` → Chaeboxi project or disable without token  
3. `src/shared/models/utils/openai-headers.ts`  
4. `src/shared/providers/definitions/models/openrouter.ts`  
   - `HTTP-Referer` / app title → Chaeboxi site or GitHub URL  
5. `src/renderer/packages/initial_data.ts` — strip Chatbox marketing seed content  
6. `src/renderer/variables.ts` — any public URLs  
7. `src/renderer/setup/protect.ts` — if Chatbox-specific  
8. i18n: at minimum `en` + `zh-Hans`; then bulk for other locales  
   - Product name strings  
   - Links containing chatboxai.app  
9. `src/renderer/components/Artifact.tsx`, `HtmlWorkspaceView.tsx` — if hard-coded upstream URLs  

**Config surface**
- Introduce a small constants module e.g. `src/shared/product.ts`:

```ts
export const PRODUCT = {
  name: 'Chaeboxi',
  homepage: 'https://github.com/nikethai/chaeboxi',
  privacyUrl: 'https://github.com/nikethai/chaeboxi#privacy', // or real page
  termsUrl: 'https://github.com/nikethai/chaeboxi#terms',
  releasesUrl: 'https://github.com/nikethai/chaeboxi/releases',
  feedbackUrl: 'https://github.com/nikethai/chaeboxi/issues',
  openRouterReferer: 'https://github.com/nikethai/chaeboxi',
} as const
```

Single source of truth avoids re-scatter.

### Success criteria
- [ ] Grep shipped sources for `chatboxai.app` in `src/` + `vite.renderer.config.ts` → **0** (except comments in NOTICE-linked docs outside bundle if any)  
- [ ] About page: only Chaeboxi/GitHub destinations  
- [ ] OpenRouter / provider headers do not claim chatboxai.app  
- [ ] Desktop build opens About without dead Chatbox CTAs  

### Risks
| Risk | Mitigation |
|------|------------|
| Missing privacy/terms pages | Temporary GitHub sections; mark TODO for real legal pages |
| Breaking OpenRouter ranking | Use real Chaeboxi homepage once available |
| i18n drift across 15 locales | Scripted replace + en/zh review; others follow |

---

## Phase 3 — Chatbox AI provider & remote service excision

### Objective
No product path depends on Chatbox’s hosted AI, license, or document-parser cloud.

### Strategy (KISS)

**Do not** rename every `ChatboxAIAPIError` symbol in one PR (high churn).  
**Do** ensure runtime cannot select or call Chatbox AI cloud.

### Implementation steps

1. **Registry**  
   - Remove or gate `chatbox-ai` from provider definitions / `providers/definitions/index.ts`  
   - Keep enum value `ChatboxAI = 'chatbox-ai'` for migration mapping only if needed  

2. **Settings**  
   - Keep/strengthen `stripChatboxPaidFeatures()`  
   - Ensure UI never lists Chatbox AI (`ProviderIcon`, settings routes, favorited models)  

3. **Defaults & migration**  
   - `migration.ts` / `chatStore` defaults: fallback provider → OpenAI / first configured / empty — **never** ChatboxAI  
   - `lastUsedModelStore` already clears chatbox-ai; add tests  

4. **Remote package**  
   - `src/renderer/packages/remote.ts` + `chatboxai_pool.ts`:  
     - Prefer delete dead code paths  
     - Or hard-stub that throws “unsupported in Chaeboxi” if still referenced  
   - Audit callers of remote file parse / license check / premium endpoints  

5. **Document parser**  
   - Settings type allows `'chatbox-ai'` for compat; map to `'local'` or `'none'` on load (already partially done)  
   - UI: remove Chatbox AI parser option  

6. **Errors**  
   - Keep class name short-term OR alias `ChatboxAIAPIError` → `ProviderAPIError` with re-export (optional Phase 5)  
   - User-facing strings must not say “Chatbox AI” for generic failures  

7. **Tests**  
   - Unit: settings strip still works  
   - Unit: default model never chatbox-ai for new sessions  
   - Integration smoke: start with empty providers list  

### Related files (representative)
- `src/renderer/stores/settingsStore.ts`  
- `src/renderer/stores/migration.ts`  
- `src/renderer/stores/lastUsedModelStore.ts`  
- `src/renderer/stores/chatStore.ts`  
- `src/shared/request/chatboxai_pool.ts`  
- `src/renderer/packages/remote.ts`  
- `src/shared/types/provider.ts`  
- `src/shared/providers/definitions/**`  
- `src/renderer/components/icons/ProviderIcon.tsx`  
- `src/renderer/routes/settings/provider/$providerId.tsx`  
- `src/renderer/components/settings/DocumentParserSettings.tsx`  

### Success criteria
- [ ] New install cannot select Chatbox AI  
- [ ] Existing settings with chatbox-ai migrate/strip cleanly  
- [ ] No network calls to `api.chatboxai.app` / pool hosts on app start or chat send (with only BYOK providers)  
- [ ] Focused tests pass  

### Risks
| Risk | Mitigation |
|------|------------|
| Hidden remote imports | `rg` for `chatboxai_pool|isChatboxAPI|chatbox-ai` after changes |
| Migration breaks old sessions | Keep enum/storage keys; only change defaults + strip |
| Image generation paths | Audit `imageGenerationActions` for Chatbox-only paint |

---

## Phase 4 — Distribution independence

### Objective
Releases and update story belong to Chaeboxi only.

### Steps
1. Confirm CI (if any) publishes to `nikethai/chaeboxi` releases — not upstream.  
2. About “Check update” → GitHub Releases URL or Tauri updater pointing at your endpoints.  
3. Code signing / notarization under your team identity (ops checklist).  
4. Capacitor / mobile app IDs if shipping mobile: ensure not `xyz.chatboxapp.*`.  
5. Remove any remaining download badges pointing at Chatbox stores.  

### Related files
- `src/renderer/routes/about.tsx` (update CTA)  
- `src-tauri/tauri.conf.json` (updater plugins if present)  
- `package.json` scripts `release:web`  
- Mobile configs under `ios/` / `android/` if present  

### Success criteria
- [ ] Update path never hits chatboxai.app  
- [ ] Release artifacts named/branded Chaeboxi  
- [ ] Bundle identifier remains `com.chaeboxi` (desktop)  

### Risks
| Risk | Mitigation |
|------|------------|
| Users on old fork builds | Document one-time migration note in README |
| Updater config missing | Ship manual “Releases” link first (YAGNI) |

---

## Phase 5 — Internal hygiene (optional, non-blocking)

### Objective
Reduce “still a CE fork” signal for maintainers; **not** required for legitimacy.

### Candidates (order by ROI)
1. Env: `CHATBOX_BUILD_PLATFORM` → `CHAEBOXI_BUILD_PLATFORM` (update all scripts + vite defines)  
2. Rename error class / modules for clarity (`ChatboxAIAPIError` → `ProviderAPIError`)  
3. Tailwind tokens `bg-chatbox-*` → semantic tokens  
4. IndexedDB rename with migration (only if needed)  
5. Grep cleanup of comments/docs  

### Success criteria
- [ ] Maintainer grep for product “Chatbox” is mostly NOTICE/history  
- [ ] No user-visible regressions  

---

## Phase 6 — Docs & verification gate

### Objective
Prove legitimacy with measurable checks before calling independence “done.”

### Docs to update (project `docs/` + root)
- `AGENTS.md` — independence + GPL note; remove “CE strips paid features” as sole identity  
- `docs/design-guidelines.md` if brand tokens  
- Optional: `docs/project-overview-pdr.md` if you maintain PDR set (currently incomplete vs CLAUDE template)  
- Changelog entry: “Chaeboxi independence / rebrand / detach from Chatbox fork network”

### Verification checklist (must all pass)

```bash
# 1. Fork status
gh repo view --json isFork,parent,url,licenseInfo

# 2. No product traffic hosts in source (allowlist NOTICE/docs only)
rg -n 'chatboxai\.app|api\.chatboxapp' src vite.renderer.config.ts package.json \
  || true  # expect no matches in these paths

# 3. Package identity
node -e "const p=require('./package.json'); \
  if(/chatboxai\\/chatbox/.test(p.repository?.url||'')) process.exit(1)"

# 4. Quality gates
pnpm check
pnpm test
pnpm lint

# 5. Smoke
pnpm dev:web   # About page + settings providers list
```

### Acceptance criteria (definition of done)
- [ ] GitHub: not a fork of chatbox (or standalone repo with no parent)  
- [ ] LICENSE GPLv3 + NOTICE attribution present  
- [ ] README is Chaeboxi with honest origin credit  
- [ ] No user-facing Chatbox AI cloud product  
- [ ] No About/update/privacy/terms pointing at chatboxai.app  
- [ ] package metadata is Chaeboxi  
- [ ] `pnpm check` + `pnpm test` green  
- [ ] Manual smoke: About + provider list + one chat with BYOK provider  

---

## Implementation strategy & PR slicing

Prefer **small stacked PRs** over one mega-PR:

| PR | Contents |
|----|----------|
| PR1 | NOTICE + LICENSE untouched + README + package.json + AGENTS + FUNDING |
| PR2 | `product.ts` constants + About + headers + vite telemetry |
| PR3 | Chatbox AI provider/remote excision + tests |
| PR4 | i18n bulk link/name pass |
| PR5 | GitHub detach (ops) + release/update links finalize |
| PR6 (optional) | Internal renames |

**GitHub detach** can happen after PR1 so the independent story is already true in content.

---

## Risk register (whole program)

| ID | Risk | Severity | Mitigation |
|----|------|----------|------------|
| R1 | Relicense temptation | Critical | Plan forbids; keep GPLv3 |
| R2 | Trademark / brand confusion | High | Full rebrand; no Chatbox store assets |
| R3 | Residual API calls to Chatbox | High | Phase 3 + network grep + smoke |
| R4 | User data loss from storage rename | High | Never rename DB keys without migration |
| R5 | Incomplete i18n | Medium | en/zh first; others scripted |
| R6 | Detach ops mistakes | Medium | Prefer in-place detach; backup remotes |
| R7 | Over-scoping renames | Medium | Phase 5 optional; ship without it |

---

## What we are NOT doing

- Clean-room rewrite  
- Claiming non-derivative status  
- Proprietary relicense of the client  
- History rewrite to erase Bin-Huang et al.  
- Keeping Chatbox download badges “for traffic”  
- Renaming every internal `chatbox` string before ship  

---

## Effort estimate

| Phase | Calendar (1 engineer) |
|-------|------------------------|
| 0 | 0.5 day |
| 1 | 1–2 days |
| 2 | 3–5 days |
| 3 | 2–4 days |
| 4 | 1–3 days |
| 5 | optional / ongoing |
| 6 | 1 day |
| **Core (0–4 + 6)** | **~1.5–2.5 weeks** |

---

## Execution order (when cooking)

```text
Phase 0 decisions
    → Phase 1 legal/metadata (PR1)
    → GitHub detach (ops)
    → Phase 2 surface (PR2)  ∥  Phase 3 provider (PR3)
    → Phase 4 distribution (PR5)
    → Phase 6 verify + docs
    → Phase 5 later if desired
```

---

## Next actions for human approval

1. Accept or override locked decisions table.  
2. Answer open questions: domain readiness, mobile scope, detach in place vs new repo.  
3. On approval: implement via stacked PRs starting at Phase 1.  
4. Optional before cook: legal 30-minute review of NOTICE + privacy placeholders if commercial distribution planned.

---

## Open questions

1. **Domain:** Ship with GitHub-only legal URLs now, or wait for chaeboxi domain?  
2. **Mobile:** In scope for Phase 4, or desktop/web only for v1 independence?  
3. **Detach method:** In-place detach on `nikethai/chaeboxi` (recommended) vs new org/repo?  
4. **Telemetry:** Own Sentry/Plausible now, or disable entirely until accounts exist?  
5. **Chatbox AI:** Hard remove code paths vs keep dead stubs for easier upstream cherry-picks?

---

## References (repo facts used)

- GitHub: `nikethai/chaeboxi` fork of `chatboxai/chatbox`, license GPL-3.0  
- Tauri already: `productName: Chaeboxi`, `identifier: com.chaeboxi`  
- package still: `xyz.chatboxapp.ce`, repository chatboxai/chatbox  
- `stripChatboxPaidFeatures` already removes chatbox-ai on settings load  
- ~32 files reference `chatboxai.app` / related hosts; hundreds of internal “chatbox” string hits  
- Origin: `git@github.com:nikethai/chaeboxi.git`
