# Android Mobile Enhancement Design

**Date:** 2026-08-08  
**Status:** Drafted from verified repo review + on-device validation  
**Scope:** Android mobile app usability hardening, onboarding improvement, and accessibility/ergonomics refinement

## 1. Objective

Improve the Android app so it behaves like an intentional mobile product rather than a desktop-oriented app rendered on a phone. The work should address three layers in order:

1. **Foundation hardening** — platform truth, capability gating, unsupported feature visibility, loading/error states, safe-area/keyboard reliability
2. **Onboarding and first-use UX** — blank state, starter prompts, provider/model readiness, first-success flow
3. **Accessibility and ergonomics** — touch targets, scaling/zoom, TalkBack/semantics, contrast/focus

This is a **targeted mobile enhancement program**, not a rewrite.

## 2. Non-goals

- Full desktop/mobile feature parity where Android cannot support the same runtime capabilities
- A broad visual redesign unrelated to mobile usability
- Net-new AI product features not required to improve mobile usability
- Reworking desktop-only settings or flows except where their visibility leaks into Android

## 3. Recommendation

### Chosen approach: Foundation-first mobile hardening

Alternative sequencing options were considered:

- **Onboarding-first** — would improve first impression quickly but risks polishing unstable or misleading mobile behavior
- **Accessibility-first** — would improve ergonomics quickly but would not resolve platform/capability confusion first

**Recommendation:** fix platform and feature behavior first, then onboarding, then accessibility. This minimizes rework and prevents false UX bugs caused by inconsistent Android behavior.

## 4. Verified findings

| Finding | Status | Evidence | Notes |
|---|---|---|---|
| Android runtime/platform capability model is inconsistent | Verified | `src/renderer/platform/index.ts`, `src/renderer/utils/feature-flags.ts`, `src/renderer/index.tsx` | Android sets `formFactor = 'mobile'` but often still behaves like `platform.type = 'desktop'` for gating |
| Skills rescan is not available on Android | Verified | `src-tauri/src/lib.rs` (`"skills:scan"` branch) | Android explicitly returns `"'skills:scan' is not available on Android"` |
| Viewport zoom is disabled | Verified | `src/renderer/index.html` | `user-scalable=no` is present |
| Mobile touch targets are compact | Verified | `src/renderer/components/InputBox/actionIconStyles.ts`, `ComposerToolsMenu.tsx` | Several actions are 20–36 px effective targets |
| Session route does not clearly distinguish loading/error/missing states | Verified | `src/renderer/stores/chatStore.ts`, `src/renderer/routes/session/$sessionId.tsx` | Root issue is weak state-specific UX, not absence of query state |
| Safe-area fallback references a native command that does not appear implemented | Verified | `src/renderer/setup/tauri_android_safe_area.ts`, `src-tauri/src/lib.rs` | Frontend calls `get_system_bar_insets`; Rust handler/IPC branch was not found |
| Android MCP visibility/availability can drift | Verified | `src/renderer/utils/feature-flags.ts`, `src/renderer/index.tsx`, `src/renderer/setup/mcp_bootstrap.ts` | UI can consider Android desktop-capable while bootstrap is skipped or transport-filtered |
| Basic current-build Android flows work on-device | Verified | On-device rebuild/install and screenshots | Launch, sidebar, model picker, model selection, composer, keyboard interactions worked in tested flow |

## 5. Findings corrected from the earlier review

The following earlier concerns were narrowed after rebuilding and testing the current app:

1. **Main-content offset vs. drawer width mismatch**  
   This was not reproduced on the tested phone. The sidebar padding logic in `__root.tsx` only applies at `sm` and above, so the specific mismatch concern is weaker than originally stated for this device class.

2. **Safe-area fallback reliability**  
   The bigger issue is not a badly functioning native fallback, but that the referenced native inset command seems absent. The current app still behaved acceptably in tested keyboard/composer flows, so this should be treated as a cleanup/reliability risk, not an observed blocker.

## 6. On-device evidence

### Device profile
- Connected Android phone via ADB
- Android version: 16
- Model: `CPH2745`
- Physical size: `1272x2772`
- Density: `560`
- Installed/validated build: rebuilt current `1.6.0` debug APK

### Build/deployment notes
- The original release build path exposed a capability problem: desktop-only shortcut permissions were being applied to Android.
- This was corrected by keeping desktop permissions in `src-tauri/capabilities/default.json` and adding `src-tauri/capabilities/android.json` for Android-safe permissions.
- Because the older installed app was signed differently, it had to be uninstalled before installing the rebuilt debug APK.

### Captured evidence
- Initial current-build blank state: `tmp/chaeboxi-current.png`
- Model picker opened: `tmp/chaeboxi-model-picker-current.png`
- Model selected and returned to composer: `tmp/chaeboxi-model-selected.png`
- Navigation drawer opened: `tmp/chaeboxi-drawer-current.png`
- Keyboard/composer snapshots captured during validation:
  - `tmp/chaeboxi-keyboard-current.png`
  - `tmp/chaeboxi-keyboard-dismissed.png`

### Observed behavior
- App launched successfully
- Sidebar opened and closed correctly
- Model picker bottom sheet opened correctly
- Model selection persisted back into the composer
- Composer remained usable with the keyboard in the tested flow
- No obvious Tauri permission-denied, IPC, or fatal crash errors appeared in the observed log samples

## 7. Success criteria

A successful outcome means:

1. Android users see only features that are truly supported on Android, or see clearly explained alternatives
2. First-time users can understand how to start and reach a successful first prompt quickly
3. The app distinguishes loading, failure, and missing-data states clearly
4. Composer, keyboard, sheets, and navigation are reliable across normal mobile interactions
5. Common mobile controls have comfortable touch targets
6. Zoom/scaling/accessibility basics are no longer actively blocked
7. The Android validation loop passes on the current test phone and at least one constrained-layout configuration

## 8. Design

## Phase 1 — Foundation hardening

### 8.1 Platform truth cleanup

**Problem**  
Android currently mixes three concepts:
- layout form factor (`mobile` vs `desktop`)
- runtime shell type (`desktop`, `web`, etc.)
- feature capability (what the platform actually supports)

This causes Android to inherit desktop assumptions in some places while being treated as mobile in others.

**Design**  
Introduce a single authoritative capability model for runtime decisions. Layout code can continue to use a mobile form factor where appropriate, but feature visibility and execution should rely on explicit capability checks rather than ad hoc mixes of `platform.type`, `formFactor`, and `CHATBOX_BUILD_PLATFORM`.

**Likely files**
- `src/renderer/platform/index.ts`
- `src/renderer/platform/desktop_platform.ts`
- `src/renderer/utils/feature-flags.ts`
- callers that directly inspect platform/build values

**Outcome**  
Android becomes a first-class mobile target with predictable feature gating.

### 8.2 Android capability + unsupported feature visibility cleanup

**Problem**  
Some settings and controls either do not work on Android or only partially work, yet they can still appear in mobile surfaces.

**Design**  
Retain separate capability definitions:
- desktop-only permissions in `default.json`
- Android-safe permissions in `android.json`

Then clean Android UX so unsupported features are hidden or intentionally replaced. Priority areas:
- skills rescan
- desktop tray / quick window / autolaunch / automatic update controls
- any MCP or KB surfaces that are not truly Android-ready
- feature entries that currently exist because Android still looks desktop-like in some gates

**Likely files**
- `src-tauri/capabilities/default.json`
- `src-tauri/capabilities/android.json`
- `src/renderer/routes/settings/route.tsx`
- `src/renderer/routes/settings/general.tsx`
- `src/renderer/routes/settings/skills.tsx`
- `src/renderer/components/InputBox/ComposerToolsMenu.tsx`

**Outcome**  
Android no longer exposes obviously broken or desktop-only controls.

### 8.3 Loading/error/empty-state correctness

**Problem**  
The session route can collapse distinct conditions into a generic fallback such as “Conversation not found.”

**Design**  
Explicitly model and render:
- loading state
- fetch error state
- true missing session state
- new/empty state

Retry should be available where useful, and copy should be compact and mobile-friendly.

**Likely files**
- `src/renderer/stores/chatStore.ts`
- `src/renderer/routes/session/$sessionId.tsx`
- relevant error/empty-state UI helpers

**Outcome**  
Users understand what is happening instead of seeing ambiguous failure states.

### 8.4 Safe-area and keyboard reliability cleanup

**Problem**  
Current hands-on behavior was acceptable, but the safe-area JS references a native command that appears unimplemented.

**Design**  
Choose a clean hierarchy:
1. CSS/env safe-area support
2. JS fallback only where needed
3. Native inset command only if actually implemented and wired

Either implement `get_system_bar_insets` in Rust/IPC or remove the dead path and rely on deterministic fallback behavior. Re-test keyboard interactions, bottom sheets, and focus dismissal.

**Likely files**
- `src/renderer/setup/tauri_android_safe_area.ts`
- `src/renderer/setup/tauri_android_keyboard.ts`
- `src-tauri/src/lib.rs`
- `src-tauri/gen/android/app/src/main/java/com/chaeboxi/MainActivity.kt`

**Outcome**  
No phantom native fallback and fewer future mobile layout regressions.

## Phase 2 — Onboarding and first-use UX

### 8.5 Blank-state improvement

**Problem**  
The current home screen is visually strong but sparse. It does not sufficiently guide the first action.

**Design**  
Keep the visual simplicity, but add:
- a small set of starter prompts
- compact first-step guidance
- lightweight readiness cues near the composer/model selector

This should not become a dashboard; it should remain a focused launchpad.

**Likely files**
- `src/renderer/routes/index.tsx`
- `src/renderer/static/globals.css`
- possibly model trigger and composer-supporting UI

**Outcome**  
New users can understand how to start without guesswork.

### 8.6 First-success flow

**Problem**  
A selected model does not necessarily communicate whether it is configured, available, or suitable for the user’s task.

**Design**  
Expose mobile-friendly readiness states for the selected provider/model, and show lightweight corrective guidance when:
- no provider is configured
- selected provider is unavailable
- the selected model lacks required capability

Remediation should be one-tap where possible.

**Likely files**
- `src/renderer/components/InputBox/InputBox.tsx`
- `src/renderer/components/ModelSelector/*`
- `src/renderer/components/chat/MessageErrTips.tsx`
- settings navigation helpers

**Outcome**  
More users reach a successful first prompt without dead ends.

## Phase 3 — Accessibility and ergonomics

### 8.7 Touch-target expansion

**Problem**  
Several Android controls are visually elegant but physically dense.

**Design**  
Increase effective hit areas to around 44dp minimum while preserving the current compact visual appearance. Priority controls:
- composer tools
- model selector trigger
- send button
- header/sidebar toggles
- drawer action rows and utility actions

**Likely files**
- `src/renderer/components/InputBox/actionIconStyles.ts`
- `src/renderer/components/InputBox/ComposerToolsMenu.tsx`
- `src/renderer/components/layout/Header.tsx`
- `src/renderer/Sidebar.tsx`

**Outcome**  
Less precision required, fewer tap misses, better one-handed use.

### 8.8 Scaling, zoom, and semantics

**Problem**  
The app disables zoom and has not been validated under large text or TalkBack.

**Design**  
- Remove or justify `user-scalable=no`
- Validate larger text and display scaling
- Improve semantic labeling for icon-only or icon-heavy controls
- Confirm focus and announcement behavior for major navigation and composer surfaces

**Likely files**
- `src/renderer/index.html`
- `src/renderer/components/InputBox/*`
- `src/renderer/components/ModelSelector/*`
- `src/renderer/Sidebar.tsx`
- `src/renderer/components/layout/Header.tsx`

**Outcome**  
The app no longer blocks basic accessibility behavior and becomes more resilient under assistive settings.

## 9. Ordered implementation sequence

1. Platform truth + capability model cleanup
2. Unsupported Android feature visibility cleanup
3. Session loading/error/missing-state cleanup
4. Safe-area/native fallback cleanup
5. Blank-state/onboarding enhancements
6. Model readiness and first-success UX
7. Touch-target expansion
8. Accessibility/scaling/TalkBack pass
9. Final rebuild and regression validation

## 10. Validation strategy

Each phase ends with the same Android validation loop:

1. Build Android debug APK
2. Install on device
3. Run a focused on-device pass for affected flows
4. Capture screenshots before/after
5. Review `adb logcat` for crashes, permission denials, missing IPC/capability issues
6. Record deltas before moving to the next phase

### Minimum device matrix
- **Primary device:** current connected Android phone
- **Constrained configuration:** small-width and/or large-text setup on Android
- **Optional expansion:** tablet/foldable for wider responsive layout checks

### Required flows to re-test repeatedly
- launch and blank state
- sidebar open/close
- model picker and selection
- composer focus, keyboard show/hide, Back dismissal
- first message flow
- settings visibility for Android-only supported features

## 11. Risks and mitigation

| Risk | Impact | Mitigation |
|---|---|---|
| Platform cleanup touches many gates | Medium | Centralize capability helpers before changing callers |
| Hiding unsupported features may confuse existing users | Medium | Replace with concise explanatory copy only where needed |
| Safe-area cleanup may regress working keyboard behavior | High | Keep device-based validation after every change in this area |
| Onboarding additions could overcomplicate the current clean blank state | Medium | Keep all additions lightweight and subordinate to the composer |
| Accessibility changes may alter visual density | Medium | Expand hit area separately from visual chrome where possible |

## 12. Implementation readiness summary

This work is ready to move into implementation planning. The codebase has already been explored, the major findings were verified, one Android build blocker was corrected, and current-build on-device behavior was validated. The remaining work is to turn the ordered design above into a concrete implementation plan and execute it phase by phase.
