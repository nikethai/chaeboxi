---
type: plan
status: stable
description: "First code slice of the redesign: Dango design tokens in the app, existing variables remapped, sidebar and composer brought to the design system, a ReviewItem component and a dev gallery"
generated: { by: claude/opus-5.5, at: 2026-10-17T12:10:00+07:00 }
verified: { by: human:nikethai, at: 2026-10-17T14:38:00+07:00 }
---
# Dango Theme, First Slice Implementation Plan

Status: accepted by the maintainer, 2026-10-17; implemented and merged in PR #87.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The running app uses the Dango design system v2 (colours, type, radii, shadows) in light and dark, with the sidebar and composer matching the redesign and a ReviewItem component ready for the Review feed.

**Architecture:** The design system's `tokens.json` is copied into the repo and rendered into `--dango-*` CSS variables plus a typed colour table. The app's existing `--chatbox-*` variables (used by Tailwind, Mantine and 9,000 lines of `globals.css`) are remapped onto `--dango-*` once, theme-independently, so most of the UI changes without touching components. MUI, which cannot read CSS variables, takes its colours from the typed table. Sidebar and composer then get the few rule changes the variables cannot express.

**Tech Stack:** React 18, Mantine 7.17, MUI 5 (legacy), Tailwind 3, Vitest 4 (+ jsdom, Testing Library), postcss 8, Biome.

**Spec:** the Dango design system README (`design/dango/README.md`, copied in Task 1 from https://claude.ai/artifact/C7dPipWhJubTMddvKR7C3W), `docs/specs/2026-10-16-ux-flows.md` (Screens section and "Gaps closed on 2026-10-17"), screens on the "Dango redesign wireframes" canvas (Sidebar: RV1; Composer: CO1; Review item: RV1, RV4).

## Global Constraints

- Token names are the design system's, prefixed `--dango-`: `ground surface raised ink ink-2 muted hairline line control-border green on-green green-wash green-text blue on-blue blue-wash blue-text amber-wash amber-text danger focus toast on-toast toast-action scrim`, plus `shadow-composer shadow-popover shadow-sheet shadow-toast`, `space-1`…`space-8`, `radius-sm radius-md radius-lg radius-xl radius-sheet radius-composer radius-pill`, `font-sans font-mono`.
- Dark values apply under `:root[data-mantine-color-scheme="dark"]` (what Mantine sets) and `:root[data-theme="dark"]` (what `useAppTheme` sets).
- `font-sans`: `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif`. `font-mono`: `ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace`. Arabic keeps `Cairo, Arial, sans-serif`.
- `green` is the only action colour and the colour of approved/done. `blue` only means "needs you" (badge, Needs you items); never an action. Text on a `green` fill uses `on-green`, on a `blue` fill `on-blue`, never a literal white.
- Focus ring: `2px solid var(--dango-focus)`, `outline-offset: 2px`.
- No coloured left borders or edges on rows or cards. Section labels in sentence case, no letter-spacing, no uppercase.
- No emoji in the interface; icons stay Lucide/Tabler line icons at the sizes already used.
- Out of this slice (do not build): scopes and the scope pill, the Review page and route, Everywhere, removing Improve writing, Quick Chat restyle beyond what the variables give.

## Review Focus

- Dark mode with a filled primary button: `#4fb894` with white text is 2.2:1. Every brand fill must take `on-brand` text (Task 2, scan tests).
- Switching the OS theme while the app is open must flip every surface, including MUI parts (Task 1 selector test, Task 2 MUI palette test).
- Arabic UI keeps Cairo; the font-size setting keeps scaling MUI type (Task 2 tests).
- Voice not set up: the dictate button must still be there and lead to Settings › Voice, not vanish (Task 4 test).
- A Review item with a long unbroken source path or four actions must not push the actions off the row (Task 5 tests).

---

### Task 1: Dango tokens in the repo

**Files:**
- Create: `design/dango/tokens.json`, `design/dango/README.md` (copies of the design system's `project/tokens.json` and `project/README.md`, byte for byte)
- Create: `src/renderer/theme/renderDangoTokens.ts`, `src/renderer/theme/contrast.ts`
- Create (generated, committed): `src/renderer/static/dango-tokens.css`, `src/renderer/theme/dangoTokens.ts`
- Create: `src/renderer/theme/dangoTokens.test.ts`
- Modify: `src/renderer/index.tsx:15` (import `./static/dango-tokens.css` before `./static/globals.css`), `package.json` scripts

**Interfaces:**
- Produces: `renderDangoTokensCss(tokens: DangoTokensJson): string`, `renderDangoTokensTs(tokens: DangoTokensJson): string`, `contrastRatio(fg: string, bg: string): number` (hex `#rrggbb` only), and from the generated module `dangoColors: { light: Record<DangoColor, string>; dark: Record<DangoColor, string> }`, `type DangoColor`, `dangoFonts: { sans: string; mono: string }`. Aliases such as `focus: {green}` resolve to the target's hex in `dangoColors` and to `var(--dango-green)` in CSS.

- [ ] **Step 1: Write the failing tests** in `dangoTokens.test.ts`:
  - `generated files match tokens.json`: reads `design/dango/tokens.json`, renders both outputs and expects them to equal `src/renderer/static/dango-tokens.css` and `src/renderer/theme/dangoTokens.ts`. When `process.env.UPDATE_DANGO_TOKENS === '1'` it writes the files instead of asserting.
  - `dark values sit under both dark selectors`: the CSS contains `:root[data-mantine-color-scheme="dark"],\n:root[data-theme="dark"] {` and `--dango-green: #4fb894;` inside that block; `:root {` holds `--dango-green: #1f7a63;`.
  - `text pairs pass contrast in both themes`: for each theme, `ink`, `ink-2`, `muted`, `danger` on each of `ground`, `surface`, `raised` ≥ 4.5; `green-text`/`green-wash`, `blue-text`/`blue-wash`, `amber-text`/`amber-wash`, `on-green`/`green`, `on-blue`/`blue`, `on-toast`/`toast` ≥ 4.5; `control-border` on `ground` and `raised` ≥ 3.
  - `contrastRatio('#ffffff', '#1f7a63')` is between 5.2 and 5.3.
- [ ] **Step 2: Run** `pnpm test -- src/renderer/theme/dangoTokens.test.ts`. Expected: FAIL, modules not found.
- [ ] **Step 3: Implement** `renderDangoTokens.ts` (CSS: `/* generated from design/dango/tokens.json — run pnpm tokens:sync */`, a `:root` block with every light colour and shadow plus spacing, radius and `--dango-font-sans/mono`, then the two-selector dark block with dark colours and shadows; colour aliases become `var(--dango-<target>)`; the TS output must already be in Biome's format, single quotes and no semicolons, or the pre-commit formatter will make the drift test fail) and `contrast.ts` (WCAG 2 relative luminance). Copy the two design files.
- [ ] **Step 4: Generate** with `UPDATE_DANGO_TOKENS=1 pnpm test -- src/renderer/theme/dangoTokens.test.ts`, then run `pnpm test -- src/renderer/theme/dangoTokens.test.ts`. Expected: PASS.
- [ ] **Step 5: Add** `"tokens:sync": "UPDATE_DANGO_TOKENS=1 vitest run src/renderer/theme/dangoTokens.test.ts"` to `package.json`, add the CSS import in `index.tsx`, run `pnpm check` (no new errors vs main) and commit: `feat(theme): add Dango design tokens`.

### Task 2: Remap the app's variables and themes onto Dango

**Files:**
- Modify: `src/renderer/static/globals.css:5-210` (the `:root` and dark `:root` variable blocks)
- Create: `src/renderer/theme/mantineTheme.ts` (moved from `creteMantineTheme` in `src/renderer/routes/__root.tsx:257-…`)
- Modify: `src/renderer/routes/__root.tsx` (import `createDangoMantineTheme`), `src/renderer/hooks/useAppTheme.ts:59-147` (`getThemeDesign`)
- Test: `src/renderer/theme/themeMapping.test.ts`

**Interfaces:**
- Consumes: `dangoColors`, `dangoFonts` (Task 1).
- Produces: `createDangoMantineTheme(scale?: number): MantineThemeOverride`; CSS variable `--chatbox-tint-on-brand` (= `var(--dango-on-green)`).

Variable map, set once in `:root` and removed from the dark block (the `--dango-*` values already switch with the theme):

| `--chatbox-…` | `var(--dango-…)` |
|---|---|
| tint-primary, tint-secondary, tint-tertiary, tint-gray, tint-placeholder | ink, ink-2, muted, muted, muted |
| tint-brand, tint-success, tint-error, tint-warning, tint-on-brand (new) | green, green, danger, amber-text, on-green |
| border-primary, border-secondary, border-brand, border-success, border-error, border-warning | hairline, line, green, green, danger, amber-text |
| background-primary, background-rail, background-secondary, background-lift, background-tertiary, background-user-bubble | ground, surface, raised, raised, surface, surface |
| background-primary-hover, background-secondary-hover, background-tertiary-hover | surface, surface, hairline |
| background-brand-primary, background-brand-secondary, background-success-primary, background-success-secondary | green, green-wash, green, green-wash |
| background-warning-secondary, background-error-primary, background-mask-overlay | amber-wash, danger, scrim |
| composer-bg, composer-shadow | raised, shadow-composer |
| font-ui, font-mono | font-sans, font-mono |
| radius-sm, radius-md, radius-lg, radius-xl, radius-xxl | radius-sm, radius-md, radius-lg, radius-xl, radius-sheet |

`background-brand-primary-hover` becomes `color-mix(in srgb, var(--dango-green) 88%, var(--dango-ink))`. Variables not in the table keep their current values.

- [ ] **Step 1: Write the failing tests** in `themeMapping.test.ts` (node environment, reading sources like `components/InputBox/mobileTouchTargets.test.ts` does, parsing CSS with `postcss`):
  - `every mapped variable points at its Dango token`: for each row of the table, the first `:root` rule declares the variable as exactly `var(--dango-<token>)`, and the dark `:root[data-mantine-color-scheme="dark"]` rule does not redeclare it.
  - `brand fills never carry white text in CSS`: in `globals.css`, no rule that sets `background` or `background-color` to a value containing `--chatbox-background-brand-primary` or `--chatbox-tint-brand` (without `color-mix`) also sets `color` to `#fff`, `white`, `var(--chatbox-tint-white)` or `var(--mantine-color-white)`.
  - `brand fills never carry white text in TSX`: no `className` string literal in `src/renderer/**/*.tsx` contains both `bg-chatbox-background-brand-primary` and one of `text-white`, `text-chatbox-tint-white`.
  - `Mantine filled buttons use on-brand text`: `createDangoMantineTheme().components.Button.vars(theme, { variant: 'filled' }).root['--button-color']` and `components.ActionIcon.vars(theme, { variant: 'filled' }).root['--ai-color']` both equal `var(--chatbox-tint-on-brand)`; with `{ variant: 'filled', color: 'chatbox-error' }` neither key is set; `fontFamily` is `var(--chatbox-font-ui)`.
  - `MUI follows Dango`: `getThemeDesign('light', 16, 'en')` has `palette.primary.main === dangoColors.light.green`, `palette.background.default === dangoColors.light.ground`; the dark design uses `dangoColors.dark.*` for `background.default`, `background.paper` (`raised`), `text.primary` (`ink`), `text.secondary` (`ink-2`), `divider` (`hairline`); `typography.fontFamily === dangoFonts.sans`; with `'ar'` it is `'Cairo, Arial, sans-serif'`; `typography.fontSize` for font size 16 stays 14.
- [ ] **Step 2: Run** `pnpm test -- src/renderer/theme/themeMapping.test.ts`. Expected: FAIL on the first mapped variable.
- [ ] **Step 3: Implement** the table in `globals.css`; move the Mantine theme to `mantineTheme.ts` with `Button.extend` / `ActionIcon.extend` `vars` resolvers returning `{ root: { '--button-color': 'var(--chatbox-tint-on-brand)' } }` (ActionIcon: `--ai-color`) for the filled variant with no colour or `chatbox-brand`, and `{ root: {} }` otherwise; point `getThemeDesign` at `dangoColors`/`dangoFonts`; fix every offender the two scan tests report by switching its text to `var(--chatbox-tint-on-brand)` / `text-[var(--chatbox-tint-on-brand)]`.
- [ ] **Step 4: Run** `pnpm test`, `pnpm check`, `pnpm lint`. Expected: the new tests pass, nothing else regresses compared with `main`.
- [ ] **Step 5: Commit**: `feat(theme): map app colours, type and radii onto Dango tokens`.

### Task 3: Sidebar to the design system

**Files:**
- Modify: `src/renderer/static/globals.css` rules `.studio-rail-row-active` (+ `::before`, `:hover`, dark variant), `.rail-nav-item--primary` (+ `:hover`), `.rail-section-label`
- Test: `src/renderer/theme/sidebarRules.test.ts`

**Interfaces:** consumes the Task 2 variables only.

- [ ] **Step 1: Write the failing tests** (postcss over `globals.css`):
  - `active row is green wash with green text`: `.studio-rail-row-active` sets `background: var(--dango-green-wash) !important` and `color: var(--dango-green-text)`, and sets no `box-shadow`.
  - `no coloured edge on the active row`: no rule whose selector includes `.studio-rail-row-active::before` declares `background` or `content`.
  - `New chat row is not tinted`: `.rail-nav-item--primary` and its `:hover` declare no `background` containing `--chatbox-tint-brand`.
  - `section labels are sentence case`: `.rail-section-label` has no `text-transform` and no `letter-spacing`, `font-size: 12px`, `font-weight: 600`, `color: var(--dango-muted)`.
- [ ] **Step 2: Run** `pnpm test -- src/renderer/theme/sidebarRules.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the rule changes (delete the dark-only active-row override; the tokens already switch).
- [ ] **Step 4: Run** the test. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(sidebar): active row, labels and New chat row follow Dango`.

### Task 4: Composer to the design system

**Files:**
- Create: `src/renderer/components/InputBox/DictateButton.tsx`, `src/renderer/components/InputBox/DictateButton.test.tsx`
- Modify: `src/renderer/components/InputBox/InputBox.tsx:3195-3210` (move the voice control from the left group to the right group, after `ModelSelector` and before the Send button), `src/renderer/static/globals.css` composer surface rule at `:595` and the send button rule
- Test: `DictateButton.test.tsx`, additions to `src/renderer/theme/themeMapping.test.ts`

**Interfaces:**
- Consumes: `VoiceHoldButton` and `VoiceHoldButtonProps` from `./VoiceHoldButton`; `navigateToSettings(path?: string)` from `@/modals/Settings`.
- Produces: `DictateButton(props: VoiceHoldButtonProps): JSX.Element` — renders `VoiceHoldButton` when `props.enabled`, otherwise an `ActionIcon` with `aria-label={t('Dictate')}` and a Lucide `Mic` icon (16 px, stroke 1.8) that calls `navigateToSettings('/voice')`.

- [ ] **Step 1: Write the failing tests**:
  - `DictateButton.test.tsx` (jsdom, wrapped in `MantineProvider`, `navigateToSettings` mocked): with `enabled: false` a button named "Dictate" renders and a click calls `navigateToSettings('/voice')`; with `enabled: true` the mocked `VoiceHoldButton` renders and no "Dictate" fallback.
  - In `themeMapping.test.ts`: the composer surface rule (`background: var(--chatbox-composer-bg, …)`) also declares `border-radius: var(--dango-radius-composer)`; `.composer-send` background is `var(--chatbox-background-brand-primary)` and colour `var(--chatbox-tint-on-brand)`.
  - Order, by source: in `InputBox.tsx` the index of `<DictateButton` is greater than the index of `<ModelSelector` and smaller than the index of `aria-label={isSamplingVideoFrames`.
- [ ] **Step 2: Run** `pnpm test -- src/renderer/components/InputBox/DictateButton.test.tsx src/renderer/theme/themeMapping.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `DictateButton`, replace the `voiceCopilot.enabled && <VoiceHoldButton …>` block with `<DictateButton …>` in the right group, and update the two CSS rules.
- [ ] **Step 4: Run** `pnpm test`, `pnpm check`. Expected: PASS, no regressions.
- [ ] **Step 5: Commit**: `feat(composer): Dango surface, green send, dictate beside the model picker`.

### Task 5: ReviewItem component and a design-system gallery

**Files:**
- Create: `src/renderer/static/dango-components.css` (the design system's `project/components/bundle.css`, copied verbatim; header comment says where it came from), imported in `index.tsx` after `dango-tokens.css`; replace its `var(--name)` references with `var(--dango-name)` in the copy
- Create: `src/renderer/components/review/ReviewItem.tsx`, `src/renderer/components/review/index.ts`, `src/renderer/components/review/ReviewItem.test.tsx`
- Create: `src/renderer/routes/dev/design-system.tsx` (dev-only page like `routes/dev/css-var.tsx`), and add it to `routes/dev/index.tsx`'s list

**Interfaces:**
- Produces:
  ```ts
  export type ReviewKind = 'proposal' | 'done' | 'needs-you' | 'conflict' | 'change' | 're-check'
  export type ReviewAction = { label: string; onClick: () => void; variant?: 'primary' | 'secondary' | 'ghost' }
  export type ReviewItemProps = {
    kind: ReviewKind
    scope: string
    source?: string
    text: string
    sub?: string
    actions: ReviewAction[]   // at most 3 are rendered
    focused?: boolean
  }
  export function ReviewItem(props: ReviewItemProps): JSX.Element
  ```
  Meta line: `<Kind label> · <scope>` plus ` · <source>` when given; labels: Proposal, Done, Needs you, Conflict, Change, Re-check. Classes from `dango-components.css`: `dg-item`, `dg-item--done | --needs | --conflict`, `is-focused`, `dg-btn`, `dg-btn--primary`, `dg-btn--ghost`.

- [ ] **Step 1: Write the failing tests** (`ReviewItem.test.tsx`, jsdom):
  - renders `Needs you · Acme Co` and the text for `kind: 'needs-you'`, and the root has class `dg-item--needs`;
  - `source: 'docs/specs/2026-10-16-redesign-brief.md'` appears in the meta line inside an element whose class includes `dg-item__meta` (the CSS truncates it with `min-width: 0` and `overflow-wrap: anywhere`; assert both declarations exist on `.dg-item__meta` / `.dg-item__text` in `dango-components.css`);
  - four actions passed → three buttons rendered; the primary one has `dg-btn--primary`; clicking calls its handler;
  - `focused` adds `is-focused`; the root is an `article` with `aria-label` equal to the meta line plus the text.
- [ ] **Step 2: Run** `pnpm test -- src/renderer/components/review/ReviewItem.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** the component, copy the stylesheet (add `overflow-wrap: anywhere` to `.dg-item__text` if the copy lacks it, and record that change in the design system too), and build the dev gallery page: colour swatches from `dangoColors` for the current theme, the type styles, and one ReviewItem of each kind.
- [ ] **Step 4: Run** `pnpm test`, `pnpm check`, `pnpm lint`. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(review): ReviewItem component and design-system dev gallery`.

### Task 6: Look at it, then record it

**Files:**
- Modify: `docs/log.md` (one line under the day the branch is finished), `docs/specs/2026-10-17-dango-theme-first-slice.md` (status `stable` only when the maintainer accepts)

- [ ] **Step 1:** Run `pnpm dev:web`, open the app with the dev pages enabled, and capture light and dark screenshots of: the home screen with the sidebar, a chat with an answer and the composer, Settings, and `/dev/design-system`. Compare against canvas screens RV1, CH0, CO1, KN3 and DK1/DK2: colours, type, the active sidebar row, the composer order (+, Tools, model, dictate, Send).
- [ ] **Step 2:** Fix what the screenshots show is off (usually a hard-coded hex in a component); each fix adds a line to the matching scan test when it is a pattern, then commit `fix(theme): …`.
- [ ] **Step 3:** Run `pnpm test`, `pnpm check`, `pnpm lint` one last time. Expected: all pass, tsc error count equal to `main`'s.
- [ ] **Step 4:** Add the log line and move TASK-8 notes on the board with the Backlog CLI (`backlog task edit 8 --append-notes "…"`), then commit `docs: log the Dango theme slice`.
