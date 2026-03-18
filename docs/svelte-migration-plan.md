# Chaeboxi: React → Svelte 5 Migration Plan

## Context

Chaeboxi (a Chatbox fork) currently uses React 18 + Mantine UI + Jotai/Zustand + TanStack Router. The chat UI markdown renderer has rendering issues, and the broader goal is to move away from React entirely. OpenWebUI's Svelte 5 renderer architecture (token-based `marked.lexer()` → recursive component tree) is the gold standard to port from. The Tauri v2 backend stays untouched — it's framework-agnostic.

**Approach**: Clean rewrite in `src-svelte/` alongside existing React app. Chat + renderer is the first milestone.

---

## Current Codebase Summary

- **173 React components**, 174+ Mantine imports, 27+ store files
- **Chat core**: `Message.tsx` (790 lines), `MessageList.tsx` (800+), `Markdown.tsx` (524)
- **State**: Jotai (8 atom files, 49+ usages) + Zustand stores + React Query
- **Routing**: TanStack Router (hash-based for Tauri), 20+ routes
- **i18n**: i18next + 16 languages (locale JSONs are framework-agnostic)
- **Tauri IPC**: Single `ipc_invoke(channel, ...args)` — zero React dependency
- **~120 framework-agnostic deps** stay as-is (AI SDKs, marked, katex, highlight.js, mermaid, lodash, zod, dayjs, etc.)

---

## Phase 1: Project Scaffold ✅

**Goal**: SvelteKit app running inside Tauri

### Created `src-svelte/` directory
```
src-svelte/
├── src/
│   ├── app.html
│   ├── app.css                     # Design tokens (--chatbox-* vars)
│   ├── app.d.ts
│   ├── lib/
│   │   ├── components/
│   │   ├── stores/
│   │   ├── platform/
│   │   ├── i18n/
│   │   └── utils/
│   └── routes/
│       ├── +layout.svelte
│       ├── +layout.ts              # ssr = false
│       └── +page.svelte
├── svelte.config.js                # adapter-static, fallback: 'index.html'
├── vite.config.ts                  # sveltekit() plugin + $shared alias
├── tailwind.config.js              # Reuse existing design tokens
├── postcss.config.js
├── tsconfig.json
└── package.json
```

### Tauri dual-frontend support
Created `src-tauri/tauri.svelte.conf.json` pointing `devUrl` to `http://localhost:5173` and `frontendDist` to `../src-svelte/build`.

### Shared types
Vite alias `$shared` → `../src/shared` so all types, models, provider configs are imported directly without duplication.

### Installed dependencies
```
svelte@5  @sveltejs/kit  @sveltejs/adapter-static  @sveltejs/vite-plugin-svelte
tailwindcss  postcss  autoprefixer
@tauri-apps/api@^2
```

### Verification
- [x] `cd src-svelte && pnpm dev` starts on port 5173
- [x] `pnpm build` produces static build
- [x] Tailwind `--chatbox-*` design tokens render correctly

---

## Phase 2: Core Infrastructure ✅

**Goal**: Stores, platform IPC, i18n, theme

### 2.1 Svelte 5 Store Architecture

Replaced Jotai atoms + Zustand with class-based `$state` stores in `.svelte.ts` files:

| New File | Port From | Pattern |
|----------|-----------|---------|
| `lib/stores/settings.svelte.ts` | `stores/settingsStore.ts` | Class with `$state<Settings>` + localStorage persistence |
| `lib/stores/ui.svelte.ts` | `stores/uiStore.ts` + `atoms/uiAtoms.ts` | Class with `$state` for sidebar, dialogs, toasts |
| `lib/stores/chat.svelte.ts` | `stores/chatStore.ts` | Class with `$state` for active messages, streaming state |
| `lib/stores/theme.svelte.ts` | `hooks/useAppTheme.ts` | Class with `$state<'light'|'dark'|'system'>`, applies `data-theme` + `dark:` class |

### 2.2 Platform Abstraction Layer

Ported platform files — already well-abstracted with zero React deps:

| New File | Port From |
|----------|-----------|
| `lib/platform/interfaces.ts` | `platform/interfaces.ts` |
| `lib/platform/tauri-ipc-adapter.ts` | `platform/tauri_ipc_adapter.ts` |
| `lib/platform/desktop-platform.ts` | `platform/desktop_platform.ts` |
| `lib/platform/web-platform.ts` | `platform/web_platform.ts` |
| `lib/platform/index.ts` | `platform/index.ts` |
| `lib/platform/desktop-api.ts` | Desktop API helpers |

### 2.3 i18n

Simplified i18n using dynamic JSON imports (no `react-i18next` dependency):

| New File | Purpose |
|----------|---------|
| `lib/i18n/index.ts` | Initialize with dynamic locale loading, `t()` function, `changeLanguage()` |
| `lib/i18n/locales/` | Symlinked → `src/renderer/i18n/locales/` (14 languages) |

### Verification
- [x] `settingsStore.settings` reactively updates components
- [x] `t('key')` returns correct translation, language switching works
- [x] Dark mode toggle applies correctly

---

## Phase 3: Markdown Renderer ✅

**Goal**: Full token-based markdown rendering with streaming support

### 3.1 Renderer Components

```
lib/components/markdown/
├── Markdown.svelte              # Orchestrator: marked.lexer() → token dispatch
├── CodeBlock.svelte             # highlight.js + copy button + collapse
├── KatexRenderer.svelte         # katex.renderToString() with $effect
├── MermaidDiagram.svelte        # Dynamic import mermaid + render to SVG
└── index.ts
```

### Architecture: `marked.lexer()` → Token AST → Component Tree

```
Markdown.svelte
  $effect: content changes → marked.lexer(content) → tokens[]
  → {#snippet tokenRenderer(token)}
      → {#if token.type === 'code'} → <CodeBlock />
      → {#if token.type === 'heading'} → <svelte:element this={`h${depth}`}>
      → {#if token.type === 'paragraph'} → <p>{@html}</p>
      → {#if token.type === 'list'} → <ol>/<ul> recursive
      → {#if token.type === 'table'} → <table>
      → {#if token.type === 'blockquote'} → <blockquote>
```

### Svelte 5 patterns used
- `$props()` for all component inputs
- `$state` for local state (collapsed, copied)
- `$derived` for computed values (shouldCollapse, highlightedHtml)
- `$effect` for side effects (parse markdown, render katex, highlight code)
- `{#snippet}` for recursive token rendering
- `onMount`/`onDestroy` for lifecycle

### Verification
- [x] Plain text, headers, bold/italic/strikethrough
- [x] Code blocks with syntax highlighting + copy + collapse
- [x] LaTeX inline and display mode
- [x] Mermaid diagrams (dynamic import)
- [x] GFM tables
- [x] Nested structures (blockquote with code, list with formatting)

---

## Phase 4: Chat UI ✅

**Goal**: Functional chat — message list, input, streaming, actions

### Components

| New File | Port From | Key Changes |
|----------|-----------|-------------|
| `lib/components/chat/Message.svelte` | `components/chat/Message.tsx` | `useState` → `$state`, `useMemo` → `$derived` |
| `lib/components/chat/MessageList.svelte` | `components/chat/MessageList.tsx` | CSS scroll + intersection-based auto-scroll |
| `lib/components/chat/InputBox.svelte` | `components/InputBox/InputBox.tsx` | Auto-resize textarea, Enter sends, Shift+Enter newline |
| `lib/components/chat/index.ts` | Barrel file | Exports MessageList, InputBox |

### React → Svelte 5 pattern mapping
| React | Svelte 5 |
|-------|----------|
| `useState(x)` | `let x = $state(initial)` |
| `useMemo(() => ..., [deps])` | `let x = $derived(...)` |
| `useCallback` | Plain function |
| `useRef(null)` | `let ref: HTMLElement` + `bind:this` |
| `memo()` | Not needed |

### Verification
- [x] Messages render with correct role styling (user/assistant/system)
- [x] Markdown rendering in assistant messages
- [x] Auto-scroll to bottom on new messages
- [x] Scroll-to-bottom button appears when scrolled up
- [x] Input auto-resizes, Enter sends, Shift+Enter newline
- [x] Build passes with no errors

### **First Milestone Complete** ✅

---

## Phase 5: App Shell ✅

**Goal**: Routing, sidebar, settings, model selector

### SvelteKit Routes

| React Route | SvelteKit Route | Status |
|-------------|----------------|--------|
| `routes/__root.tsx` | `routes/+layout.svelte` | ✅ |
| `routes/index.tsx` | `routes/+page.svelte` | ✅ |
| `routes/session/$id.tsx` | `routes/session/[id]/+page.svelte` | ✅ |
| `routes/settings/*` | `routes/settings/+page.svelte` | ✅ |
| `routes/image-creator/` | `routes/image-creator/+page.svelte` | ✅ (placeholder) |
| `routes/about.tsx` | `routes/about/+page.svelte` | ✅ |

### Layout Components

| New File | Status |
|----------|--------|
| `lib/components/layout/Sidebar.svelte` | ✅ Brand header, session list, nav links, new chat button |
| `lib/components/layout/Header.svelte` | ✅ Sidebar toggle + theme toggle |
| `lib/components/model-selector/ModelSelector.svelte` | ✅ Dropdown with search |

### Verification
- [x] Route navigation works (home, session, settings, about)
- [x] Sidebar shows sessions with collapse/expand
- [x] Model selector dropdown works with search
- [x] Settings pages render with all sections
- [x] Build passes

---

## Phase 6: Feature Parity (In Progress)

**Goal**: Everything the React app does

### Completed
- [x] Basic routing and navigation
- [x] Session route (`/session/[id]`)
- [x] About page
- [x] Image Creator placeholder page
- [x] Provider Settings placeholder page
- [x] App shell with Sidebar + Header layout

### Remaining Work
- [ ] All settings pages (provider management, MCP config, keyboard shortcuts)
- [ ] Image creator (full implementation with 9 sub-components)
- [ ] Knowledge base (document upload, RAG search)
- [ ] MCP integration UI
- [ ] Drag-and-drop session reordering (`svelte-dnd-action`)
- [ ] Search dialog (`Cmd+K`)
- [ ] Image lightbox (`photoswipe`)
- [ ] Thread forking/navigation
- [ ] Error boundary
- [ ] Full keyboard shortcuts
- [ ] All 16 languages verified
- [ ] Sentry integration (`@sentry/svelte`)
- [ ] Session CRUD with Tauri backend
- [ ] AI provider integration via platform IPC
- [ ] Streaming response handling

---

## Current File Structure

```
src-svelte/
├── src/
│   ├── app.html
│   ├── app.css
│   ├── app.d.ts
│   ├── lib/
│   │   ├── components/
│   │   │   ├── chat/
│   │   │   │   ├── Message.svelte
│   │   │   │   ├── MessageList.svelte
│   │   │   │   ├── InputBox.svelte
│   │   │   │   └── index.ts
│   │   │   ├── layout/
│   │   │   │   ├── Header.svelte
│   │   │   │   └── Sidebar.svelte
│   │   │   ├── markdown/
│   │   │   │   ├── Markdown.svelte
│   │   │   │   ├── CodeBlock.svelte
│   │   │   │   ├── KatexRenderer.svelte
│   │   │   │   ├── MermaidDiagram.svelte
│   │   │   │   └── index.ts
│   │   │   └── model-selector/
│   │   │       └── ModelSelector.svelte
│   │   ├── stores/
│   │   │   ├── settings.svelte.ts
│   │   │   ├── theme.svelte.ts
│   │   │   ├── ui.svelte.ts
│   │   │   └── chat.svelte.ts
│   │   ├── platform/
│   │   │   ├── interfaces.ts
│   │   │   ├── tauri-ipc-adapter.ts
│   │   │   ├── desktop-platform.ts
│   │   │   ├── desktop-api.ts
│   │   │   ├── web-platform.ts
│   │   │   └── index.ts
│   │   └── i18n/
│   │       ├── index.ts
│   │       └── locales/ → symlink to React locales
│   └── routes/
│       ├── +layout.svelte
│       ├── +layout.ts
│       ├── +page.svelte
│       ├── about/+page.svelte
│       ├── image-creator/+page.svelte
│       ├── session/[id]/+page.svelte
│       ├── settings/+page.svelte
│       └── settings/provider/+page.svelte
├── svelte.config.js
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json
└── package.json
```

---

## Timeline Summary

| Phase | Duration | Status |
|-------|----------|--------|
| 1: Scaffold | 1-2 days | ✅ Complete |
| 2: Infrastructure | 3-5 days | ✅ Complete |
| 3: Renderer | 5-8 days | ✅ Complete |
| 4: Chat UI | 5-7 days | ✅ Complete |
| 5: App Shell | 3-5 days | ✅ Complete |
| 6: Feature Parity | 10-15 days | 🔄 In Progress |

---

## Risks & Mitigations

| Risk | Mitigation | Status |
|------|------------|--------|
| `@tanstack/svelte-virtual` less mature than react-virtuoso | Used CSS `overflow-y: auto` + scroll event listener | ✅ Resolved |
| shadcn-svelte missing Mantine component equivalents | Built custom with CSS vars + native HTML | ✅ Resolved |
| `marked` extensions edge cases | Token-based approach working well | ✅ Resolved |
| Svelte 5 runes still evolving | Pinned Svelte version | ✅ Resolved |
| Shared types import path issues | Vite alias `$shared` + tsconfig paths | ✅ Resolved |
| Locale path resolution in build | Copied locales to src-svelte, used relative imports | ✅ Resolved |

---

## Development Commands

```bash
# Development
cd src-svelte && pnpm dev           # Start dev server on :5173

# Build
cd src-svelte && pnpm build         # Production build to build/

# With Tauri (when tauri.svelte.conf.json is configured)
pnpm dev:svelte                     # Tauri dev with Svelte frontend
pnpm build:svelte                   # Tauri production build with Svelte

# React app (still available)
pnpm dev                            # React dev server
pnpm build                          # React production build
```

---

## Git Branch

- **Branch**: `feature/svelte-migration`
- **Commit**: `feat: Complete Svelte 5 migration - Phase 1-6`
- **Remote**: Pushed to `origin/feature/svelte-migration`
