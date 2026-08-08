# Android Mobile Enhancement Implementation Plan

**Date:** 2026-08-08  
**Derived from spec:** `claudedocs/2026-08-08-android-mobile-enhancement-design.md`  
**Goal:** Execute the approved Android mobile enhancement design in an order that reduces platform inconsistency first, then improves onboarding, then completes accessibility and ergonomics hardening.

## 1. Delivery strategy

Work in three implementation phases that match the approved design:

1. **Foundation hardening**
2. **Onboarding and first-use UX**
3. **Accessibility and ergonomics**

Each phase ends with:
- Android debug rebuild
- install on device
- focused manual on-device pass
- screenshot capture for changed flows
- `adb logcat` sanity pass for crashes, missing IPC, permission denials, and Android-only regressions

## 2. Execution principles

- Prefer **centralized capability helpers** over scattered `platform.type` / `formFactor` / `CHATBOX_BUILD_PLATFORM` checks.
- Avoid broad refactors unrelated to mobile correctness.
- Ship in **thin vertical slices**: foundation behavior first, then UX layers.
- Re-test only the flows impacted by the current phase before moving on.
- Keep visual changes incremental unless required for usability.

---

## 3. Phase 1 — Foundation hardening

### 3.1 Task A — Create a single Android/mobile capability model

**Objective**  
Stop relying on mixed platform signals and introduce one clear source of truth for mobile/Android feature support.

**Primary files**
- `src/renderer/platform/index.ts`
- `src/renderer/platform/desktop_platform.ts`
- `src/renderer/utils/feature-flags.ts`
- Any directly coupled callers discovered during implementation

**Work**
1. Add a small capability abstraction that answers questions such as:
   - is mobile layout?
   - is Android runtime?
   - supports MCP bootstrap?
   - supports KB?
   - supports desktop-only settings?
   - supports agent skill scan?
2. Keep `formFactor` for layout only.
3. Convert feature gates to use capability helpers instead of ad hoc conditionals.
4. Remove duplicated logic where possible.

**Dependencies**
- None; this is the first task because other Android cleanup depends on it.

**Definition of done**
- Android behavior is driven by explicit capability checks.
- New helper(s) are used by settings/tooling visibility surfaces.

**Validation checkpoint**
- Type/build sanity check in app runtime
- Rebuild Android debug APK
- Launch app and confirm it still opens normally

---

### 3.2 Task B — Finish Android capability separation and unsupported feature cleanup

**Objective**  
Ensure Android only gets Android-safe native permissions and only sees Android-supported features in the UI.

**Primary files**
- `src-tauri/capabilities/default.json`
- `src-tauri/capabilities/android.json`
- `src/renderer/routes/settings/route.tsx`
- `src/renderer/routes/settings/general.tsx`
- `src/renderer/routes/settings/skills.tsx`
- `src/renderer/components/InputBox/ComposerToolsMenu.tsx`
- Any related settings or navigation components exposed by Phase 1 helper use

**Work**
1. Keep desktop permissions desktop-only.
2. Keep Android capability limited to Android-safe permissions.
3. Hide or replace unsupported Android entries for:
   - tray / quick window
   - autolaunch / automatic updates if not meaningful on Android
   - agent skill rescan
   - any MCP/KB/agent surfaces not actually usable on Android
4. Where a surface remains visible but constrained, provide concise explanatory text.

**Dependencies**
- Phase 1 capability helper model should land first.

**Definition of done**
- Android no longer exposes clearly broken desktop-only controls.
- Native Android build still succeeds with separated capabilities.

**Validation checkpoint**
- Rebuild Android debug APK
- Install
- Open settings and verify hidden/remaining entries
- Capture settings screenshots
- `adb logcat` check for permission/capability errors

---

### 3.3 Task C — Fix loading/error/empty-state distinctions in session flow

**Objective**  
Make session-state UX honest: loading, error, missing, and empty should look different.

**Primary files**
- `src/renderer/stores/chatStore.ts`
- `src/renderer/routes/session/$sessionId.tsx`
- Supporting state/error UI helpers if extracted

**Work**
1. Audit query state returned by `useSession()`.
2. Render separate UI for:
   - loading
   - fetch failure
   - not found
   - normal loaded state
3. Add retry action where appropriate.
4. Keep copy short for mobile.
5. Avoid accidental regressions to desktop session flow.

**Dependencies**
- None strict, but best after capability cleanup to reduce confounding issues.

**Definition of done**
- “Conversation not found” appears only for true missing cases.
- Load and failure states are visually distinct.

**Validation checkpoint**
- Rebuild Android debug APK
- Test:
   - launch into existing session
   - invalid/missing session route
   - simulated loading/failure cases if feasible
- Capture screenshots of each state

---

### 3.4 Task D — Clean up safe-area and keyboard fallback behavior

**Objective**  
Make the Android inset/keyboard path explicit and remove the dangling native fallback reference unless implemented.

**Primary files**
- `src/renderer/setup/tauri_android_safe_area.ts`
- `src/renderer/setup/tauri_android_keyboard.ts`
- `src-tauri/src/lib.rs`
- `src-tauri/gen/android/app/src/main/java/com/chaeboxi/MainActivity.kt`

**Work**
1. Decide whether to:
   - implement `get_system_bar_insets`, or
   - remove the dead invocation path and rely on CSS/JS fallback only.
2. Keep keyboard behavior stable with `adjustResize`.
3. Reconfirm focus clearing on keyboard dismissal/back.
4. Re-test bottom sheets and composer with keyboard open.

**Dependencies**
- Independent, but should complete before onboarding polish.

**Definition of done**
- No unresolved reference path for safe-area fallback.
- Keyboard/composer interaction remains stable.

**Validation checkpoint**
- Rebuild Android debug APK
- Validate on device:
   - focus composer
   - open/close keyboard
   - use system Back to dismiss keyboard
   - open model picker / other bottom sheet while keyboard scenarios are exercised
- Capture screenshots
- Review `adb logcat`

---

## 4. Phase 2 — Onboarding and first-use UX

### 4.1 Task E — Improve blank state and first-step guidance

**Objective**  
Turn the clean blank home into a clearer launchpad without overloading it.

**Primary files**
- `src/renderer/routes/index.tsx`
- `src/renderer/static/globals.css`
- Possibly `src/renderer/components/InputBox/InputBox.tsx`

**Work**
1. Add a small number of starter prompts or starter actions.
2. Add minimal guidance that explains the next best action.
3. Preserve the visual simplicity of the current layout.
4. Ensure spacing still works on small phones.

**Dependencies**
- Foundation phase should be complete first.

**Definition of done**
- First-time users can infer how to start.
- The page does not become dashboard-like.

**Validation checkpoint**
- Rebuild Android debug APK
- Launch fresh state
- Capture blank-state screenshots
- Verify no overflow/crowding on tested device

---

### 4.2 Task F — Add provider/model readiness cues and first-success flow

**Objective**  
Help the user know whether the selected model is ready, unavailable, or missing needed capability.

**Primary files**
- `src/renderer/components/InputBox/InputBox.tsx`
- `src/renderer/components/ModelSelector/MobileModelSelector.tsx`
- `src/renderer/components/ModelSelector/shared.tsx`
- `src/renderer/components/chat/MessageErrTips.tsx`
- Settings navigation helpers as needed

**Work**
1. Define the minimal readiness states to expose in mobile UI.
2. Surface readiness near the model trigger/composer without clutter.
3. Add one-tap remediation paths where feasible.
4. Ensure unsupported-capability hints are understandable on mobile.

**Dependencies**
- Platform/capability cleanup should already be done.

**Definition of done**
- Users can tell when they are blocked by provider/model setup.
- The first successful message flow is easier to reach.

**Validation checkpoint**
- Rebuild Android debug APK
- Test with configured and misconfigured provider/model situations if available
- Open model picker, select model, verify cue behavior
- Capture screenshots

---

## 5. Phase 3 — Accessibility and ergonomics

### 5.1 Task G — Expand touch targets without visually bloating UI

**Objective**  
Increase effective touch comfort while keeping the current aesthetic.

**Primary files**
- `src/renderer/components/InputBox/actionIconStyles.ts`
- `src/renderer/components/InputBox/ComposerToolsMenu.tsx`
- `src/renderer/components/layout/Header.tsx`
- `src/renderer/Sidebar.tsx`
- Any other high-frequency mobile action components found during testing

**Work**
1. Raise effective hit areas toward ~44dp.
2. Prioritize:
   - tools trigger
   - model selector trigger
   - send button
   - sidebar toggle
   - drawer actions
3. Use padding/hit area expansion where possible instead of visibly oversized chrome.

**Dependencies**
- Best after foundational behavior is stable.

**Definition of done**
- Common controls are easier to hit on device.
- Layout remains visually balanced.

**Validation checkpoint**
- Rebuild Android debug APK
- Manual tap-comfort pass on tested phone
- Capture before/after screenshots if layout visibly changed

---

### 5.2 Task H — Remove zoom lock and complete accessibility baseline pass

**Objective**  
Stop blocking basic mobile accessibility and validate semantics/scaling.

**Primary files**
- `src/renderer/index.html`
- `src/renderer/components/InputBox/*`
- `src/renderer/components/ModelSelector/*`
- `src/renderer/Sidebar.tsx`
- `src/renderer/components/layout/Header.tsx`

**Work**
1. Remove or explicitly justify `user-scalable=no`.
2. Validate larger font / display scale behavior.
3. Improve semantic labels for icon-only controls where needed.
4. Run a TalkBack-oriented review of major navigation/composer surfaces.
5. Fix obvious focus/announcement issues found during testing.

**Dependencies**
- Touch-target work should precede or accompany this task.

**Definition of done**
- Basic zoom/scaling is not artificially blocked.
- Key mobile controls have usable semantics.
- No major accessibility blockers remain in the core Android flow.

**Validation checkpoint**
- Rebuild Android debug APK
- Test at larger text scale
- Perform TalkBack spot-check on:
   - sidebar toggle
   - navigation drawer
   - model selector
   - composer tools
   - send action
- Capture notes and screenshots where useful

---

## 6. Cross-phase file map

### Native / Android shell
- `src-tauri/capabilities/default.json`
- `src-tauri/capabilities/android.json`
- `src-tauri/src/lib.rs`
- `src-tauri/gen/android/app/src/main/java/com/chaeboxi/MainActivity.kt`

### Platform and feature gating
- `src/renderer/platform/index.ts`
- `src/renderer/platform/desktop_platform.ts`
- `src/renderer/utils/feature-flags.ts`
- `src/renderer/index.tsx`

### Session states and navigation
- `src/renderer/stores/chatStore.ts`
- `src/renderer/routes/session/$sessionId.tsx`
- `src/renderer/routes/settings/route.tsx`
- `src/renderer/routes/settings/general.tsx`
- `src/renderer/routes/settings/skills.tsx`

### Mobile interaction surfaces
- `src/renderer/setup/tauri_android_safe_area.ts`
- `src/renderer/setup/tauri_android_keyboard.ts`
- `src/renderer/Sidebar.tsx`
- `src/renderer/components/layout/Header.tsx`
- `src/renderer/components/InputBox/InputBox.tsx`
- `src/renderer/components/InputBox/actionIconStyles.ts`
- `src/renderer/components/InputBox/ComposerToolsMenu.tsx`
- `src/renderer/components/ModelSelector/MobileModelSelector.tsx`
- `src/renderer/components/ModelSelector/shared.tsx`
- `src/renderer/components/chat/MessageErrTips.tsx`
- `src/renderer/routes/index.tsx`
- `src/renderer/static/globals.css`
- `src/renderer/index.html`

---

## 7. Dependencies and blockers

### Resolved blocker
- Android build was previously blocked by desktop-only global-shortcut permissions being applied to Android. This is now resolved via split capability files.

### Active implementation dependencies
- Capability helper model should land before broad feature visibility cleanup.
- Safe-area cleanup should finish before broad onboarding UI polish to avoid re-testing the same core interaction twice.
- Touch-target and accessibility work should follow stable mobile feature visibility.

### Potential future blockers
- If a true native inset command is desired, Rust-side implementation must be specified clearly before frontend consumption.
- If provider readiness states need backend reachability info not currently exposed, a small additional interface may be required.

---

## 8. Validation matrix per phase

### Minimum every phase
1. `pnpm exec tauri android build --debug`
2. Install APK on device
3. Validate impacted flows
4. Capture screenshots
5. `adb logcat -d -t 300 | grep -iE 'com.chaeboxi|tauri|fatal|exception|denied|permission'`

### Phase-specific flows

**After Phase 1A/1B**
- settings visibility
- composer tools visibility
- no Android-only broken actions exposed

**After Phase 1C**
- valid session
- missing session
- failure state if reproducible

**After Phase 1D**
- keyboard show/hide
- bottom sheet with/without keyboard
- Back dismissal from focused input

**After Phase 2**
- first launch blank state
- model selection
- first-start guidance
- first-success readiness cues

**After Phase 3**
- one-handed tapping comfort
- large text / display scaling
- TalkBack spot-check

---

## 9. Suggested commit sequence

1. `refactor(mobile): centralize android capability gating`
2. `fix(android): hide unsupported desktop-only mobile surfaces`
3. `fix(session): distinguish loading error and missing states on mobile`
4. `fix(android): clean up safe-area and keyboard fallback behavior`
5. `feat(mobile): improve blank state onboarding`
6. `feat(mobile): add provider and model readiness cues`
7. `fix(mobile): expand touch targets across core controls`
8. `fix(a11y): remove zoom lock and improve mobile semantics`
9. `test(android): capture final usability validation evidence`

---

## 10. Final completion criteria

The implementation plan is complete when:
- Android feature visibility is capability-driven and consistent
- unsupported desktop-only actions no longer leak into Android
- session state UX is distinct and honest
- safe-area/keyboard path is explicit and stable
- blank state gives clear first-step guidance
- provider/model readiness is understandable on mobile
- touch targets are comfortable
- zoom/scaling/basic semantics are no longer blocked
- rebuild + on-device validation passes after each phase and at final regression
