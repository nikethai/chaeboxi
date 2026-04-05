# Upstream v1.20.0 Backport Process (Chaeboxi)

Date: 2026-04-05
Repo: `/Users/nikethai/Documents/Project/Personal/chaeboxi`
Branch: `main`

## 1. Goal
Backport the applicable parts of upstream Chatbox release `v1.20.0` into Chaeboxi community edition, then verify build/test safety.

## 2. Scope Rules Used
- Keep community-edition constraints intact (no paid/pro feature restoration).
- Implement only changes compatible with current Chaeboxi architecture.
- Skip upstream items tied to missing subsystems in this fork.

## 3. Implemented Changes

### A. UI and bootstrap alignment
1. `src/renderer/components/chat/SummaryMessage.tsx`
- Added `msg-block` class to summary content wrapper for global font-size inheritance.

2. `src/renderer/setup/mcp_bootstrap.ts`
- Replaced `platform.getSettings()` bootstrap path with `initSettingsStore()`.

3. `src/renderer/setup/sentry_init.ts`
- Replaced `platform.getSettings()` with `initSettingsStore()`.
- Added `try/catch` with `console.error` fallback to avoid startup breakage when settings init fails.

4. `vite.renderer.config.ts`
- Added `replacePlausibleDomain()` plugin.
- Enabled plugin for web builds to replace
  - `data-domain="app.chatboxai.app"` -> `data-domain="web.chatboxai.app"`.

### B. Gemini image model backports
5. `src/renderer/components/ImageModelSelect.tsx`
- Added image model IDs:
  - `gemini-3.1-flash-image-preview`
  - `gemini-3.1-flash-image`
- Added fallback display names (`Nano Banana 2`).
- Added fallback resolution from provider defaults when user/provider model list lacks newly added IDs.

6. `src/renderer/routes/image-creator/-components/constants.ts`
- Added same Gemini 3.1 IDs to image model allowlists.
- Added fallback names.
- Added ratio support cases for both new IDs.

7. `src/shared/providers/definitions/gemini.ts`
- Added default model entry: `gemini-3.1-flash-image-preview`.

8. `src/shared/providers/definitions/models/gemini.ts`
9. `src/shared/providers/definitions/models/custom-gemini.ts`
- Expanded `GEMINI_IMAGE_MODELS` to include both Gemini 3.1 image IDs.
- Replaced hardcoded conditions with `GEMINI_IMAGE_MODELS.includes(...)`.

### C. OpenAI Responses adapter enhancements
10. `src/shared/providers/definitions/models/openai-responses.ts`
- Added optional options:
  - `customFetch`
  - `listModelsFallback`
  - `skipRemoteModelList`
  - `forceStatelessResponses`
- `getCallSettings(options)` now passes `providerOptions.openai` and can enforce `store: false`.
- `getProvider()` now uses `fetchFunction || this.options.customFetch`.
- `getChatModel()` uses `customFetch` when provided; otherwise proxy fetch.
- `listModels()` now supports:
  - skip remote list + direct fallback
  - fallback-on-error path with warning.

## 4. Verification Performed

### Commands run
- `pnpm exec vitest run --config vitest.config.ts src/shared/providers/definitions/models/openai.test.ts --reporter=verbose`
- `pnpm exec vitest run --config vitest.config.ts src/shared/providers/registry.test.ts src/shared/models/index.test.ts src/shared/utils/llm_utils.test.ts`
- `pnpm build:renderer`

### Results
- Targeted provider/shared tests: **pass** (47 tests).
- `openai.test.ts`: suite is present but skipped in this repo (expected behavior for current setup).
- Renderer production build: **pass**.

## 5. Known Repository Noise (Not Introduced by This Backport)
- Global `biome lint` / `pnpm lint` fails due non-UTF8 generated files in:
  - `src-tauri/target/release/build/.../tauri-codegen-assets/*`
- Global `pnpm test -- <file>` can trigger unrelated suite failures in current repo test environment (e.g. `navigator is not defined` in node-only contexts).

## 6. Working Tree Notes
- Pre-existing unrelated modified file: `src-tauri/Cargo.lock`.
- Pre-existing untracked folder: `.claude/`.
- Backport edits are limited to the 10 source/config files listed above.

## 7. Next Action
Proceed to commit only the intended backport files (exclude unrelated dirty files), then open PR/change summary.

## 8. Phase 2 Implementation (Minimal Expansion)

### A. Added new built-in OpenAI-compatible providers
1. `src/shared/types/provider.ts`
- Added enum IDs:
  - `minimax`
  - `minimax-cn`
  - `moonshot`
  - `qwen`

2. `src/shared/providers/definitions/minimax.ts`
- Added MiniMax Global and MiniMax CN provider definitions.
- Configured default API hosts and model lists.

3. `src/shared/providers/definitions/moonshot.ts`
- Added Moonshot provider definition with OpenAI-compatible adapter.

4. `src/shared/providers/definitions/qwen.ts`
- Added Qwen provider definition with OpenAI-compatible adapter.

5. `src/shared/providers/index.ts`
- Registered `qwen`, `minimax`, and `moonshot` definitions for runtime registry load.

6. `src/shared/models/index.ts`
- Added provider display name mapping entries.
- Added provider menu entries for all four new providers.

### B. Settings and UI cleanup alignment
7. `src/renderer/routes/settings/provider/$providerId.tsx`
- Consolidated repeated conditions into:
  - `isNoApiKeyProvider`
  - `isBuiltinOpenAICompatible`
  - `showBuiltinApiHostSection`
- Kept Azure/OpenAIResponses/Claude/Gemini/custom-provider behaviors intact while allowing new built-in OpenAI-compatible providers to use standard API Host UI.

8. `src/renderer/components/chat/Message.tsx`
- Removed deprecated token-count tip rendering branch (`showTokenCount` path in message tips).

9. `src/renderer/stores/uiStore.ts`
- Added `sidebarMode: 'chat' | 'task'` state and `setSidebarMode` action for compatibility with upstream sidebar-mode usage.

### C. Phase 2 test coverage additions
10. `src/renderer/utils/provider-config.test.ts`
- Added parse coverage for built-in `ModelProviderEnum.Qwen`.

11. `src/shared/models/index.test.ts`
- Added `getModel()` coverage asserting `ModelProviderEnum.MiniMax` resolves to OpenAI-compatible model class.

## 9. Phase 2 Verification

### Commands run
- `pnpm exec vitest run --config vitest.config.ts src/renderer/utils/provider-config.test.ts src/shared/providers/registry.test.ts src/shared/models/index.test.ts`
- `pnpm build:renderer`

### Results
- Targeted tests: **pass** (34 tests).
- Renderer production build: **pass**.
- Existing build warnings (circular chunk warnings / large chunk warnings) remain pre-existing and non-blocking for this backport scope.
