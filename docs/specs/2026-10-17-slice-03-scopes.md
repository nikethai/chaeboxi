---
type: plan
status: draft
description: "Slice 3 of the redesign: projects become scopes, with Everywhere, client scopes, a scope page, the scope pill in the composer and moving chats between scopes"
generated: { by: claude/opus-5.5, at: 2026-10-17T19:00:00+07:00 }
---
# Slice 3: Scopes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The existing Project becomes the Scope of the redesign: the sidebar lists Everywhere and the user's scopes, each scope has a page (Overview · Knowledge · Sources · Files · Chats · Settings), client scopes choose what they read from Everywhere, and every chat can be put in a scope from the composer, by ⌘N on a scope page, or by dragging it onto a scope.

**Architecture:** `Scope` is `Project` plus `kind` and `readsEverywhere`, stored under the existing `myProjects` key, which becomes the canonical list (the `myFolders` copy stays a derived compatibility write). Everywhere is never stored; it is synthesised from `EVERYWHERE_SCOPE_ID` and holds no chats. Sessions keep `projectId`/`folderId`; one function, `moveSessionToScope`, is the only writer of a chat's scope. The scope page is a new route `/scope/$scopeId`; Knowledge and Sources ship as named placeholders that slices 4 and 7 replace.

**Tech Stack:** React 18, TanStack Router (file routes), Jotai `atomWithStorage`, Zod 4 (`zod@^4.0.17`), Mantine 7, Lucide icons, `dg-*` classes from `src/renderer/static/dango-components.css`, Vitest 4 (+ jsdom, Testing Library), postcss for CSS tests.

**Spec:** `docs/specs/2026-10-17-redesign-roadmap.md` (Shared types, slice 3), `docs/specs/2026-10-16-ux-flows.md` (flow 5, flow 6 step 2, flow 25, "Gaps closed on 2026-10-17", "Knowledge after approval"), `docs/specs/2026-10-16-redesign-brief.md` (Surfaces: Scope; Decision 2), `docs/adr/0013-everywhere-layer.md`, `docs/adr/0002-project-scoped-knowledge.md`, `design/dango/README.md`. Screens EV1, EV2, FS1, EM1, Scope.

## Global Constraints

- Shared names exactly as the roadmap gives them, in `src/shared/types/scope.ts`: `EVERYWHERE_SCOPE_ID = 'everywhere'`, `ScopeKind`, `ScopeSchema = ProjectSchema.extend({ kind: z.enum(['project','client']).default('project'), readsEverywhere: z.object({ facts: z.boolean(), documents: z.boolean() }).optional() })`, `Scope`, `everywhereDefaults(kind)` (project: `{ facts: true, documents: true }`; client: `{ facts: true, documents: false }`). This plan adds `readsEverywhereFor(scope)` to the same file.
- Code identifiers that stay (renaming would churn storage, IPC or Rust): `Project`, `Folder`, `ProjectSchema`, `FolderSchema`, session fields `projectId` and `folderId` (still dual-written by `dualWriteProjectIds`), storage keys `myProjects` / `myFolders`, the folder `src/renderer/projects/`, `useProjectWorkspace`, `ProjectContextPanel`, `ProjectExplorerTree`, `SourceControlView`, `FolderItem`, every `platform.*Project*` method, and `src-tauri/src/workspace/` (bindings are keyed by project id, which a scope keeps; no Rust change). New code is named for scopes (`useScopes`, `ScopePage`, `ScopePill`, `moveSessionToScope`).
- User-facing word is "scope". Copy is sentence case, buttons name the action, no emoji (README › Voice and copy). Every string in this plan is exact; add each new key to `src/renderer/i18n/locales/en/translation.json` as `"key": "key"`.
- Colour, type and radius only from `--dango-*` and `dg-*` (`dg-scope` is the composer pill, `dg-chip` the plain "client" chip, `dg-switch` the switches, `dg-insp__tabs` the tab strip, `dg-btn`/`dg-btn--primary`/`dg-btn--danger` buttons). New icons are Lucide at 16 px, stroke 1.8; Everywhere uses `Globe`.
- Everywhere: listed first, cannot be renamed or deleted, holds no chats, never a value of `session.projectId`.
- Storage follows `.claude/skills/dango-storage-migration`: `myProjects`/`myFolders` live in IndexedDB on desktop (not `needStoreInFile`), debounced writes; the migration bumps `CurrentVersion` in `src/renderer/stores/migration.ts` from 17 to 18. If slice 2 merges first with its own step, renumber this step to the next free index; the step itself is version-agnostic.
- Needs slice 1 (merged) and slice 1b: `Sheet` (`src/renderer/components/ui/Sheet.tsx`), `pushUndo` (`src/renderer/packages/undo/`), the `/new` route (`src/renderer/routes/new.tsx`, `search: { scopeId?, prefill? }`) and `startNewChat({ scopeId?, prefill? })` (`src/renderer/lib/startNewChat.ts`). Every new chat in a scope goes through `startNewChat`; `/` is not a new-chat page (it redirects to `/new` until slice 5 makes it Review). Runs beside slice 2: the default-agent picker uses `useMyCopilots` / `useRemoteCopilots` from `@/hooks/useCopilots`; if slice 2 has renamed them by execution time, use its names.
- Out of this slice: knowledge lists and counts (slice 4; it replaces `ScopeKnowledgeTab`, the Everywhere lists and `useScopeKnowledgeCount`, and adds the "proposals move with the chat" call inside `moveSessionToScope`); "since you last looked", open items and Review filters (slices 5 and 11's flow); Sources body, connecting a source and dropping a folder on a scope (slice 7, replaces `ScopeSourcesTab`); thinking open/closed by scope kind and the full chat menu CM1 (slice 6); Quick Chat's last-used scope (slice 8); rail and phone layouts (slice 9); Gmail and Asana routing (slice 10).

## Review Focus

1. **A chat moved from scope A to B keeps answering from A.** Today a drop writes only `folderId`, and `getEffectiveProjectId` prefers the stale `projectId`. Every move goes through `moveSessionToScope`, which writes both (Task 4 test `writes projectId and folderId together`).
2. **A chat dropped on Everywhere, or Everywhere picked in the pill.** It is refused and the chat stays where it was (Task 4 test `refuses Everywhere`; Task 10 test `never offers Everywhere`).
3. **A client scope edited through an old Folder path turns back into a project.** `folderToProject` drops unknown fields, so a rename or reorder would strip `kind` and `readsEverywhere` and the client would start reading personal documents (Task 2 test `folder updates keep kind and readsEverywhere`).
4. **A project switched to client keeps reading Everywhere documents.** Changing `kind` resets `readsEverywhere` to the new kind's defaults (Task 2 test `kind change resets readsEverywhere`; Task 7 test shows Documents off afterwards).
5. **A deleted scope in a link** (`/new?scopeId=<gone>`, `/scope/<gone>`). The new chat starts with no scope and the page says the scope no longer exists (Task 10 test `drops an unknown scope id`; Task 6 test `unknown scope`).

---

### Task 1: Scope type

**Files:**
- Create: `src/shared/types/scope.ts`, `src/shared/types/scope.test.ts`
- Modify: `src/shared/types.ts:280-284` (add `export * from './types/scope'`)

**Interfaces:**
- Produces: the roadmap names above, plus `readsEverywhereFor(scope: Pick<Scope, 'kind' | 'readsEverywhere'>): { facts: boolean; documents: boolean }` (stored value, else `everywhereDefaults(kind)`) and `isEverywhere(id: string | undefined): boolean`.

- [ ] **Step 1: Write the failing tests** in `scope.test.ts`:
  - `old project payloads parse as project scopes`: `ScopeSchema.parse({ id: 'a', name: 'Alpha', order: 0 })` has `kind === 'project'` and `readsEverywhere === undefined`; `defaultAgentId` and `emoji` survive.
  - `everywhereDefaults`: project → `{ facts: true, documents: true }`; client → `{ facts: true, documents: false }`.
  - `readsEverywhereFor`: `{ kind: 'client' }` → client defaults; `{ kind: 'client', readsEverywhere: { facts: false, documents: true } }` → that value.
  - `isEverywhere('everywhere')` true; `isEverywhere(undefined)` and `isEverywhere('Everywhere')` false.
- [ ] **Step 2: Run** `pnpm test -- src/shared/types/scope.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement** `scope.ts`, importing `ProjectSchema` from `./session`.
- [ ] **Step 4: Run** the test, then `pnpm check`. Expected: PASS, no new type errors.
- [ ] **Step 5: Commit**: `feat(scopes): Scope type, Everywhere id and defaults`.

### Task 2: Scope store and `useScopes`

**Files:**
- Create: `src/renderer/projects/scope-store.ts`, `src/renderer/projects/scope-store.test.ts`, `src/renderer/hooks/useScopes.ts`
- Modify: `src/renderer/hooks/useFolders.ts` (whole file: `myProjectsAtom` becomes `atomWithStorage<Scope[]>`; `useFolders` becomes an adapter over `useScopes`), `src/renderer/hooks/useProjects.ts` (delegate to `useScopes`)

**Interfaces:**
- Consumes: Task 1; `projectToFolder` from `@/projects/project-migration`.
- Produces (pure, in `scope-store.ts`):
  ```ts
  export function parseScopes(raw: unknown): Scope[] // ScopeSchema.safeParse per entry; drops non-objects, entries without id/name, and id === EVERYWHERE_SCOPE_ID; sorted by order, then name
  export function createScope(scopes: Scope[], input: { name: string; kind: ScopeKind; id?: string; defaultAgentId?: string }): Scope // order = max + 1
  export function patchScope(scopes: Scope[], id: string, patch: Partial<Omit<Scope, 'id'>>): Scope[]
  export function applyFolderUpdate(scope: Scope, update: Partial<Folder> | ((folder: Folder) => Folder)): Scope
  export function validateScopeName(name: string): 'empty' | 'reserved' | null // trimmed; 'everywhere' in any case is reserved
  ```
  `patchScope`: when `patch.kind` differs from the current kind and `patch` has no `readsEverywhere`, the result has `readsEverywhere: undefined`.
- Produces (hook): `useScopes(): { scopes: Scope[]; getScope(id?: string): Scope | undefined; addScope(input: { name: string; kind: ScopeKind }): Scope; updateScope(id: string, patch: Partial<Omit<Scope, 'id'>>): void; removeScope(id: string): void; putScope(scope: Scope): void }` (`putScope` upserts by id; Task 7's undo uses it). Every write sets `myProjectsAtom` to the full `Scope[]` and `myFoldersAtom` to `scopes.map(projectToFolder)`. `useFolders()` keeps its return shape (`folders`, `addFolder`, `updateFolder`, `removeFolder`) but reads `scopes.map(projectToFolder)` and writes through `applyFolderUpdate` / `addScope({ name, kind: 'project' })`.

- [ ] **Step 1: Write the failing tests** in `scope-store.test.ts`:
  - `parseScopes defaults kind and drops a stored Everywhere`: input `[{ id: 'b', name: 'Beta', order: 1 }, { id: 'everywhere', name: 'X', order: 0 }, null, { id: 'a', name: 'Alpha', order: 0, kind: 'client' }]` → ids `['a', 'b']`, kinds `['client', 'project']`.
  - `kind change resets readsEverywhere`: a project with `readsEverywhere: { facts: true, documents: true }` patched with `{ kind: 'client' }` → `readsEverywhere` undefined and `readsEverywhereFor` gives documents false; patched with `{ name: 'New' }` → `readsEverywhere` kept.
  - `folder updates keep kind and readsEverywhere`: `applyFolderUpdate(clientScope, { name: 'Acme' })` and `applyFolderUpdate(clientScope, (f) => ({ ...f, order: 5 }))` both keep `kind: 'client'` and the stored `readsEverywhere`.
  - `validateScopeName`: `'  '` → `'empty'`; `'Everywhere'`, `' everywhere '` → `'reserved'`; `'Acme Co'` → null.
  - `createScope` puts the new scope after the highest `order`.
- [ ] **Step 2: Run** `pnpm test -- src/renderer/projects/scope-store.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `scope-store.ts`, `useScopes.ts`, and the two adapters. `useScopes` derives `scopes` with `useMemo(() => parseScopes(raw), [raw])`.
- [ ] **Step 4: Run** `pnpm test -- src/renderer/projects src/renderer/components/session` and `pnpm check`. Expected: PASS; existing project tests unchanged.
- [ ] **Step 5: Commit**: `feat(scopes): scope store with myProjects as the canonical list`.

### Task 3: Storage migration 17 → 18

**Files:**
- Create: `src/renderer/projects/scope-migration.ts`, `src/renderer/projects/scope-migration.test.ts`
- Modify: `src/renderer/stores/migration.ts:57` (`CurrentVersion = 18`), `:200-218` (append `migrate_17_to_18` at index 17), after `:882` (the step, importing like `migrate_16_to_17`); `src/renderer/stores/migration.test.ts` (every `JSON.stringify(17)` used as the current version, first at `:431`, becomes 18)

**Interfaces:**
- Consumes: `parseScopes` (Task 2), `folderToProject`/`projectToFolder`, `MigrateStore` shape from `project-migration.ts`.
- Produces: `runScopeMigration(store: MigrateStore): Promise<{ renamedEverywhere: boolean }>` (`MigrateStore` from `project-migration.ts`):
  1. Read `myProjects`; if empty, build from `myFolders` with `folderToProject`.
  2. If an entry has id `everywhere`, give it a new uuid and rewrite every `chat-sessions-list` entry and every `session:{id}` document whose `projectId` or `folderId` is `everywhere` to the new id (destination written before the list is rewritten).
  3. Write `myProjects` as `parseScopes(...)` output with `kind` written explicitly, then `myFolders` as `projectToFolder` of the same list.
  Idempotent: a second run writes identical data.

- [ ] **Step 1: Write the failing tests** (in-memory store as in `project-migration.test.ts`):
  - `writes kind on every stored project`: `myProjects: [{ id: 'a', name: 'A', order: 0 }]` → stored `[{ ..., kind: 'project' }]`; `myFolders` has no `kind` key.
  - `builds scopes from folders when myProjects is empty`.
  - `re-ids a project called everywhere and moves its chats`: project id `everywhere`, list `[{ id: 's1', projectId: 'everywhere', folderId: 'everywhere' }]`, doc `session:s1` likewise → no stored id `everywhere`; `s1` in list and doc carry the new id; returns `{ renamedEverywhere: true }`.
  - `keeps client kind and readsEverywhere`.
  - `running twice changes nothing` (deep-equal snapshots after run 1 and run 2).
- [ ] **Step 2: Run** `pnpm test -- src/renderer/projects/scope-migration.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `runScopeMigration` and `migrate_17_to_18` (log `migrate_17_to_18, scopes written`; return `false`, no relaunch).
- [ ] **Step 4: Run** `pnpm test -- src/renderer/projects src/renderer/stores/migration.test.ts`, `pnpm check`, `pnpm lint`. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(scopes): migrate stored projects to scopes`.

### Task 4: One writer for a chat's scope

**Files:**
- Create: `src/renderer/projects/scope-sessions.ts`, `src/renderer/projects/scope-sessions.test.ts`
- Modify: `src/renderer/components/session/session-list-helpers.ts` (add `groupSessionsByScope`), its test file; `src/renderer/components/session/SessionList.tsx:259-288` (grouping), `:544-614` (`onDragEnd`), `:662-676` (`handleDeleteFolder`); `src/renderer/components/session/SessionItem.tsx:56-62,110-170,283-298` (move dialog)

**Interfaces:**
- Consumes: `updateSession` from `@/stores/chatStore`, `getEffectiveProjectId` from `@/projects/project-context`, `isEverywhere`.
- Produces:
  ```ts
  export async function moveSessionToScope(sessionId: string, scopeId: string | undefined): Promise<boolean> // false (no write) for Everywhere; else updateSession(sessionId, { projectId: scopeId, folderId: scopeId }) and true
  export async function unassignScopeSessions(scopeId: string, sessions: SessionMeta[]): Promise<number>
  export function groupSessionsByScope(scopes: Scope[], sessions: SessionMeta[]): { groups: Array<{ scope: Scope; sessions: SessionMeta[] }>; unscoped: SessionMeta[] } // by getEffectiveProjectId; unknown ids and 'everywhere' go to unscoped; groups keep scope order
  ```

- [ ] **Step 1: Write the failing tests** (`@/stores/chatStore` mocked):
  - `writes projectId and folderId together`: `moveSessionToScope('s1', 'b')` calls `updateSession('s1', { projectId: 'b', folderId: 'b' })`; `moveSessionToScope('s1', undefined)` calls it with both `undefined`.
  - `refuses Everywhere`: `moveSessionToScope('s1', 'everywhere')` resolves `false`, no call.
  - `unassignScopeSessions` moves only sessions whose effective id is the scope, including one with only a legacy `folderId`, and returns the count.
  - `groupSessionsByScope`: a session with `projectId: 'a', folderId: 'b'` lands under `a`; `projectId: 'gone'` and `projectId: 'everywhere'` land in `unscoped`.
- [ ] **Step 2: Run** `pnpm test -- src/renderer/projects/scope-sessions.test.ts src/renderer/components/session/session-list-helpers.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement**, then replace every `updateSession(…, { folderId: … })` in `SessionList.tsx` and `SessionItem.tsx` with `moveSessionToScope`; `SessionItem` reads the current scope with `getEffectiveProjectId(session)`; its menu row and dialog become "Move to scope" with field label "Scope" and option "None".
- [ ] **Step 4: Run** the tests and `pnpm check`. Expected: PASS.
- [ ] **Step 5: Commit**: `fix(scopes): moving a chat updates its scope everywhere it is read`.

### Task 5: Scopes in the sidebar

**Files:**
- Create: `src/renderer/components/scope/EverywhereRow.tsx`, `src/renderer/components/scope/NewScopeSheet.tsx`, `src/renderer/components/scope/ScopeRows.test.tsx`, `src/renderer/components/scope/index.ts`
- Modify: `src/renderer/components/session/SessionList.tsx:314-384` (section rows), `:789-834` (folder row render), `:852-871` (delete the Edit Project modal and its state at `:222-235`, `:678-688`), `:690-701` (`handleCreateChatInFolder` → navigate, see Task 10); `src/renderer/components/session/FolderItem.tsx:21-92`; `src/renderer/Sidebar.tsx:160-170,541-619` (new scope dialog); `src/renderer/components/project/ProjectMenu.tsx:58-66`

**Interfaces:**
- Consumes: `useScopes`, `groupSessionsByScope`, `validateScopeName`.
- Produces: `EverywhereRow({ active }: { active: boolean }): JSX.Element` (a `Link` to `/scope/everywhere`, Lucide `Globe`, label "Everywhere", no count, no menu, not droppable). `FolderItemProps` gains `kind: ScopeKind`, `active: boolean`, `onOpen(): void`, `onOpenSettings(): void`; loses `onRename`, `onSetDefaultCopilot`.

Rows and copy: section label "Scopes" (key `scopes`), trailing button aria-label and tooltip "New scope". Rows in order: `EverywhereRow`, then each scope (`FolderItem` inside `FolderDroppable`) with its nested chats. A client scope shows `<span className="dg-chip">client</span>` after the name. Clicking the name calls `onOpen` (navigate to `/scope/$scopeId`); the chevron alone toggles the nested chats. Active row (pathname `/scope/<id>`) gets `studio-rail-row-active`. Menu: "New chat", "Scope settings" (navigate with `search: { tab: 'settings' }`), the folder actions, "Delete scope"; trigger aria-label "Scope options". Empty card: "No scopes yet" / "A scope keeps the chats, knowledge and sources of one project or client together." / button "New scope". Coaching row: "{{count}} chats are not in a scope. Drag one onto a scope to file it." "Delete scope" opens `DeleteScopeSheet` (Task 7) instead of the old double-click confirm.

New scope sheet (`NewScopeSheet` in `src/renderer/components/scope/NewScopeSheet.tsx`, a 1b `Sheet` replacing the `AdaptiveModal` at `Sidebar.tsx:541-619`; first focus on the Name field via `data-autofocus`): title "New scope"; field "Name", placeholder "Acme Co, Dango app…"; `SegmentedControl` labelled "Is this a project or a client?" with "Project" (default) and "Client"; caption under it "Client scopes don't read your Everywhere documents unless you turn that on."; button "Create", disabled while `validateScopeName` is `'empty'`; on `'reserved'` the field error is "Everywhere is built in. Pick another name." On create, navigate to the new scope's page.

- [ ] **Step 1: Write the failing tests** in `ScopeRows.test.tsx` (jsdom, `MantineProvider`, router `Link` and `useNavigate` mocked):
  - `EverywhereRow` renders a link named "Everywhere" to `/scope/everywhere`, contains an `svg`, and no button named "Scope options".
  - `FolderItem` with `kind: 'client'` shows text "client" inside an element with class `dg-chip`; with `kind: 'project'` no `dg-chip`.
  - Clicking the scope name calls `onOpen` and not `onToggle`; clicking the chevron calls `onToggle` only.
  - The menu has "New chat", "Scope settings", "Delete scope" and no "Rename Project" or "Set Default Copilot".
  - `NewScopeSheet`: "Create" is disabled with an empty name; "Everywhere" shows "Everywhere is built in. Pick another name."; Name "Acme Co" with "Client" calls `onCreate({ name: 'Acme Co', kind: 'client' })`.
- [ ] **Step 2: Run** `pnpm test -- src/renderer/components/scope/ScopeRows.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** the rows, copy and dialog listed above.
- [ ] **Step 4: Run** `pnpm test`, `pnpm check`, `pnpm lint`. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(scopes): Scopes section with Everywhere and client chips`.

### Task 6: Scope page shell, Overview, Chats and EM1

**Files:**
- Create: `src/renderer/routes/scope/$scopeId.tsx`; in `src/renderer/components/scope/`: `ScopePage.tsx`, `ScopeOverview.tsx`, `ScopeChatsTab.tsx`, `ScopeKnowledgeTab.tsx`, `ScopeSourcesTab.tsx`, `ScopeEmpty.tsx`, `useScopeKnowledgeCount.ts`, `ScopePage.test.tsx`
- Modify (generated): `src/renderer/routeTree.gen.ts`

**Interfaces:**
- Consumes: `useScopes`, `useSessionList`, `groupSessionsByScope`, `formatRailRelativeTime`, and nothing from later tasks: the route passes `settings={null}`, `files={null}`, `folderBound={false}` and renders `ScopePageView` for every id; Tasks 7, 8 and 9 each wire their piece into the route.
- Produces:
  ```ts
  export type ScopeTab = 'overview' | 'knowledge' | 'sources' | 'files' | 'chats' | 'settings'
  export function ScopePageView(props: { scope: Scope | undefined; chats: SessionMeta[]; knowledgeCount: number; tab: ScopeTab; folderBound: boolean; onTabChange(tab: ScopeTab): void; onNewChat(): void; onOpenChat(id: string): void; settings: ReactNode; files: ReactNode }): JSX.Element
  export function useScopeKnowledgeCount(scopeId: string): number // returns 0; slice 4 replaces the body with the count of approved items from listKnowledge(scopeId)
  export function ScopeKnowledgeTab(props: { scope: Scope }): JSX.Element // placeholder, slice 4 owns the body
  export function ScopeSourcesTab(props: { scope: Scope }): JSX.Element // placeholder, slice 7 owns the body
  ```
  Route: `createFileRoute('/scope/$scopeId')` with `validateSearch` `z.object({ tab: z.enum(['overview', 'knowledge', 'sources', 'files', 'chats', 'settings']).catch('overview') })`. The Everywhere branch arrives in Task 9.

Layout and copy: inside `Page` with the scope name as title. Header: name, "client" `dg-chip` for client scopes, primary `dg-btn dg-btn--primary` "New chat". Tab strip `role="tablist"` with class `dg-insp__tabs`, tabs in order "Overview", "Knowledge", "Sources", "Files" (only when `folderBound`), "Chats", "Settings".
- Overview: section "Recent chats" (the 5 newest, name and relative time, link "All chats" → Chats tab) and section "Knowledge" with "No knowledge yet" when the count is 0, else "{{count}} approved items", and link "Open knowledge".
- EM1 replaces Overview when `knowledgeCount === 0 && chats.length === 0`: heading "Nothing known about {{name}} yet", body "Dango learns from the chats you have here and the sources you connect. Knowledge you approve shows up on this page.", primary "Start a chat" (`onNewChat`), secondary "Add a source" (→ Sources tab).
- Knowledge placeholder: "Facts, decisions and preferences you approve for {{name}} will appear here, each with its sources and history."
- Sources placeholder: "Folders, Gmail, Asana and documents connected to {{name}} will appear here. Dango reads only the sources you connect."
- Chats: every chat in the scope, newest first; empty: "No chats in {{name}} yet." with "New chat".
- Unknown scope: "This scope no longer exists." with button "Start a new chat" (`startNewChat({})`).

- [ ] **Step 1: Write the failing tests** in `ScopePage.test.tsx` (jsdom, `t` returns the key with `{{name}}`/`{{count}}` interpolated):
  - `tabs in order`: tab names are `Overview, Knowledge, Sources, Chats, Settings` with `folderBound: false` and `Overview, Knowledge, Sources, Files, Chats, Settings` with `true`; the selected tab has `aria-selected="true"`; clicking "Chats" calls `onTabChange('chats')`.
  - `empty scope shows EM1`: no chats, count 0 → "Nothing known about Acme Co yet"; "Start a chat" calls `onNewChat`; with one chat, "Recent chats" shows it and EM1 is absent.
  - `placeholders name what will appear`: tab `knowledge` shows the Knowledge sentence for "Acme Co"; tab `sources` the Sources sentence.
  - `client chip`: a client scope's header has "client" in a `dg-chip`.
  - `unknown scope`: `scope: undefined` → "This scope no longer exists." and a button "Start a new chat"; no tablist.
- [ ] **Step 2: Run** `pnpm test -- src/renderer/components/scope/ScopePage.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** the components and the route; regenerate the route tree with `pnpm build:renderer` and commit `routeTree.gen.ts`.
- [ ] **Step 4: Run** `pnpm test`, `pnpm check`. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(scopes): scope page with overview, chats and an empty state`.

### Task 7: Scope Settings tab (EV2)

**Files:**
- Create: `src/renderer/components/scope/ScopeSettingsTab.tsx`, `src/renderer/components/scope/DeleteScopeSheet.tsx`, `src/renderer/components/scope/ScopeSettingsTab.test.tsx`, `src/renderer/projects/scope-delete.ts`, `src/renderer/projects/scope-delete.test.ts`
- Modify: `src/renderer/routes/scope/$scopeId.tsx` (pass `settings`)

**Interfaces:**
- Consumes: `readsEverywhereFor`, `validateScopeName`, `useScopes().updateScope` (which runs `patchScope`), `unassignScopeSessions`, `moveSessionToScope`, 1b's `Sheet` and `pushUndo`.
- Produces: `DeleteScopeSheet(props: { scope: Scope; opened: boolean; onClose(): void; onConfirm(): void }): JSX.Element` (also used by the sidebar menu, Task 5); `deleteScopeWithUndo(scope: Scope, sessions: SessionMeta[], deps: { removeScope(id: string): void; putScope(scope: Scope): void }): Promise<void>` (unassigns the scope's chats, removes the scope, then `pushUndo({ message: t('Deleted {{name}}'), undo })` where `undo` puts the same scope back, same id and order, and moves exactly those chats back).
- Produces: `ScopeSettingsTab(props: { scope: Scope; agentOptions: Array<{ value: string; label: string }>; onChange(patch: Partial<Omit<Scope, 'id'>>): void; onDelete(): void }): JSX.Element`.

Content, top to bottom: "Name" field (saves on blur and Enter; reserved name shows "Everywhere is built in. Pick another name." and does not save); "Is this a project or a client?" with "Project" / "Client"; "Default agent" select, first option "None". Section heading "What this scope reads from Everywhere", three rows, each a label, a caption and a `button.dg-switch` with `role="switch"`:
- "Preferences" / "How you like answers. Always on." / checked and disabled.
- "Facts" / "Things that are true in every scope."
- "Documents" / "Files connected to Everywhere."
Then the note "When this scope and Everywhere disagree, this scope wins here." Last, `dg-btn dg-btn--danger` "Delete scope", which opens `DeleteScopeSheet`: title "Delete {{name}}?", body "Its chats move to Recents. You can undo for 5 seconds.", actions "Delete scope" (danger, calls `onDelete`) and "Cancel". The route's `onDelete` runs `deleteScopeWithUndo`, then `startNewChat({})`.

- [ ] **Step 1: Write the failing tests**:
  - `client defaults`: client scope without `readsEverywhere` → Preferences `aria-checked="true"` and disabled, Facts `true`, Documents `false`.
  - `toggling documents stores both switches`: click Documents → `onChange({ readsEverywhere: { facts: true, documents: true } })`.
  - `project defaults`: project scope → Facts and Documents both `true`.
  - `kind change`: click "Client" on a project → `onChange({ kind: 'client' })`; re-rendered with the `patchScope` result, Documents is `false`.
  - `precedence note` text present.
  - `reserved name`: typing "everywhere" and blurring shows the error and calls no `onChange`.
  - `delete asks first`: clicking "Delete scope" opens the sheet and does not call `onDelete`; the sheet's "Delete scope" does; "Cancel" closes it.
  - `scope-delete.test.ts` (`pushUndo` and `@/stores/chatStore` mocked): `deleteScopeWithUndo` calls `removeScope('a')` after moving its two chats to no scope, and calls `pushUndo` once with message "Deleted Acme Co"; running the captured `undo` calls `putScope` with the original scope (kind and `readsEverywhere` intact) and moves both chats back to `a`, and no other chat.
- [ ] **Step 2: Run** `pnpm test -- src/renderer/components/scope/ScopeSettingsTab.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement**; wire `agentOptions` in the route from `useMyCopilots` + `useRemoteCopilots`, deduplicated by id, each `{ value: id, label: name }`.
- [ ] **Step 4: Run** the test, `pnpm check`. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(scopes): scope settings with what it reads from Everywhere`.

### Task 8: Files tab for folder scopes (FS1)

**Files:**
- Create: `src/renderer/components/scope/ScopeFilesTab.tsx`, `src/renderer/components/scope/ScopeFilesTab.test.tsx`
- Modify: `src/renderer/routes/scope/$scopeId.tsx` (`useProjectWorkspace({ projectId: scopeId })`, pass `folderBound` and `files`), `src/renderer/components/project/ProjectContextPanel.tsx:158-160,177` (kicker and tab label "Project Files" → "Files")

**Interfaces:**
- Consumes: `ProjectExplorerTree`, `SourceControlView`, `platform.listWorkspaceChildren`, `platform.relinkProject`, `platformCapabilities.supportsProjectWorkspace`.
- Produces: `shouldShowFilesTab(descriptor: WorkspaceDescriptor | null, supportsProjectWorkspace: boolean): boolean` (true only on desktop with a descriptor whose status is `ready`, `missing`, `permission-denied` or `relink-required`) and `ScopeFilesTab(props: { scopeId: string; descriptor: WorkspaceDescriptor; onDescriptorChange(d: WorkspaceDescriptor | null): void }): JSX.Element`.

Content: the folder name (last segment of `displayPath`, full path as `title`), `SourceControlView` for the branch and changes, then the tree from `ProjectExplorerTree` (browse only: `onAttach` is a no-op, `attachedPaths` empty). When status is not `ready`: "Dango can't open this folder." with button "Relink folder".

- [ ] **Step 1: Write the failing tests** (platform mocked):
  - `shouldShowFilesTab`: `null` → false; ready descriptor with `false` → false; `ready`, `missing`, `relink-required` with `true` → true; `chat-only` → false.
  - Ready descriptor with `displayPath: '/Users/n/dango'` shows "dango", renders the mocked `SourceControlView` with the descriptor's `capabilityId`, and lists the entries returned by `listWorkspaceChildren`.
  - `missing` descriptor shows "Dango can't open this folder." and "Relink folder" calls `platform.relinkProject('p1')`.
- [ ] **Step 2: Run** `pnpm test -- src/renderer/components/scope/ScopeFilesTab.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** and wire it into the route.
- [ ] **Step 4: Run** `pnpm test`, `pnpm check`. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(scopes): Files tab with tree and branch for folder scopes`.

### Task 9: Everywhere page (EV1)

**Files:**
- Create: `src/renderer/components/scope/EverywherePage.tsx`, `src/renderer/components/scope/EverywherePage.test.tsx`
- Modify: `src/renderer/routes/scope/$scopeId.tsx` (render `EverywherePage` when `scopeId === EVERYWHERE_SCOPE_ID`)

**Interfaces:**
- Produces: `EverywherePage(): JSX.Element` with three section slots slice 4 fills: `data-section="preferences" | "facts" | "documents"`.

Content: title "Everywhere"; line "Read by every scope. A scope's own knowledge wins inside that scope." Sections:
- "Preferences": one fixed row "Never send email" with caption "Built in" and no actions.
- "Facts": "Facts you apply to all scopes will appear here."
- "Documents": "Documents connected to Everywhere will appear here. Client scopes read them only when you turn that on."
No tabs, no New chat, no rename, no delete.

- [ ] **Step 1: Write the failing tests**: the title and line render; the three sections exist in order; the "Never send email" row contains no button; no element named "New chat", "Delete scope" or role `tablist`.
- [ ] **Step 2: Run** `pnpm test -- src/renderer/components/scope/EverywherePage.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run** the test. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(scopes): Everywhere page shell`.

### Task 10: Scope pill and new chat in a scope

**Files:**
- Create: `src/renderer/components/InputBox/ScopePill.tsx`, `src/renderer/components/InputBox/ScopePill.test.tsx`, `src/renderer/projects/scope-navigation.ts`, `src/renderer/projects/scope-navigation.test.ts`
- Modify: `src/renderer/components/InputBox/InputBox.tsx:188-224` (props), `:3103-3198` (render `<ScopePill` after `<ComposerToolsMenu`, inside the left group); `src/renderer/routes/new.tsx` (1b's new-chat page: apply `search.scopeId`, create with the scope); `src/renderer/routes/session/$sessionId.tsx` (pass `scopeId` / `onScopeChange` to `InputBox`); `src/renderer/hooks/useShortcut.tsx:56-64` (the ⌘N branch, as 1b leaves it); `src/renderer/components/session/SessionList.tsx:690-701`; `src/renderer/static/globals.css` (one rule); `src/renderer/theme/themeMapping.test.ts`

**Interfaces:**
- Consumes: `useScopes`, `moveSessionToScope`, `getEffectiveProjectId`, 1b's `startNewChat` and `/new` route.
- Produces:
  ```ts
  export function ScopePill(props: { scopes: Scope[]; value: string | undefined; onChange(scopeId: string | undefined): void }): JSX.Element
  export function scopeIdFromPath(pathname: string): string | undefined // '/scope/<id>' (not everywhere) → id
  export function resolveDraftScopeId(scopeId: string | undefined, scopes: Scope[]): string | undefined // undefined unless a stored scope has that id
  ```
  `InputBoxProps` gains `scopeId?: string` and `onScopeChange?(scopeId: string | undefined): void`; the pill renders only when `onScopeChange` is given.

Pill: `button.dg-scope.composer-scope-pill` with the scope name, or "No scope" when none; aria-label "Scope: {{name}}" or "Scope: None". Mantine `Menu`: first item "None", then each scope (never Everywhere), client scopes with a `dg-chip` "client". New CSS rule `.composer-scope-pill { max-width: 160px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }`.

Wiring: the `/new` page reads `search.scopeId` through `resolveDraftScopeId`, keeps it in the draft session as `projectId`, preselects the scope's `defaultAgentId` when no agent is chosen, and passes `projectId` and `folderId` to `createSessionStore`. The session route passes `getEffectiveProjectId(currentSession)` and `(id) => void moveSessionToScope(currentSessionId, id)`. ⌘N calls `startNewChat({ scopeId: scopeIdFromPath(pathname) })`; the sidebar row's "New chat", the scope page's "New chat" and EM1's "Start a chat" call `startNewChat({ scopeId })` instead of creating an empty session.

- [ ] **Step 1: Write the failing tests**:
  - `ScopePill.test.tsx`: with `value: undefined` the button is named "Scope: None" and reads "No scope"; opening lists "None", "Acme Co", "Dango app" (`never offers Everywhere`: no "Everywhere" item even if a scope list entry has that id); "Acme Co" (client) has a `dg-chip` "client"; choosing "None" calls `onChange(undefined)`; choosing "Dango app" calls `onChange('d')`; the button has class `dg-scope`.
  - `scope-navigation.test.ts`: `scopeIdFromPath('/scope/abc')` → `'abc'`; `'/scope/everywhere'`, `'/session/x'`, `'/new'` → undefined. `drops an unknown scope id`: `resolveDraftScopeId('gone', scopes)` and `resolveDraftScopeId('everywhere', scopes)` → undefined; a stored id → that id.
  - `themeMapping.test.ts` additions: by source, in `InputBox.tsx` the index of `<ScopePill` is greater than that of `<ComposerToolsMenu` and smaller than that of `<TeamModeSelect`; `.composer-scope-pill` in `globals.css` declares `max-width: 160px` and `text-overflow: ellipsis`.
- [ ] **Step 2: Run** `pnpm test -- src/renderer/components/InputBox/ScopePill.test.tsx src/renderer/projects/scope-navigation.test.ts src/renderer/theme/themeMapping.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** and wire as described.
- [ ] **Step 4: Run** `pnpm test`, `pnpm check`, `pnpm lint`. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(scopes): scope pill in the composer and new chat in a scope`.

### Task 11: Look at it, then record it

**Files:**
- Modify: `src/renderer/i18n/locales/en/translation.json` (every new key), `docs/log.md` (one line under the finishing day), this plan (status `stable` only when the maintainer accepts)

- [ ] **Step 1:** Run `pnpm dev:web` and check, light and dark: the sidebar with Everywhere first, one project and one client scope; a new scope (EM1); a scope with chats (Overview, Chats); Settings for a client scope (EV2); Everywhere (EV1); a new chat from a scope page (`/new?scopeId=…`) showing the pill on that scope; deleting a scope, then Undo within 5 s (scope and its chats come back); dragging a chat from one scope to another, then reloading (the chat stays moved). On desktop (`pnpm dev`), a scope with a bound folder shows Files with its branch (FS1). Compare with canvas screens EV1, EV2, FS1, EM1 and Scope.
- [ ] **Step 2:** Fix what the screenshots show; a pattern fix gets a scan test line. Commit `fix(scopes): …`.
- [ ] **Step 3:** Search the renderer for remaining user-facing "Project" strings in the sidebar, chat menu and composer (`rg "t\('[^']*Project" src/renderer/components/session src/renderer/Sidebar.tsx src/renderer/components/InputBox`); change any left to "scope" wording, except folder-binding rows ("Open Folder", "Relink folder", "Unbind folder").
- [ ] **Step 4:** Run `pnpm test`, `pnpm check`, `pnpm lint`. Expected: all pass, tsc error count equal to `main`'s.
- [ ] **Step 5:** Add the log line, then commit `docs: log the scopes slice`.
