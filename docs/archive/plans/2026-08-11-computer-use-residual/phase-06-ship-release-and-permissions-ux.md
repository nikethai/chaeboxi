---
phase: 6
title: "Ship release and permissions UX"
status: pending
priority: P0
effort: "1–2d"
dependencies: [1]
---

# Phase 6: Ship release and permissions UX

## Overview

Users on **App Store / old install never see Harness v2** until a new binary ships. Also fix class **A** confusion: TCC grants do not transfer across ad-hoc vs store vs dev identities.

Can start after Calculator smoke (class F or A fixed); does not require Phase 3–5.

## Requirements

- Functional: publish build containing residual harness; permissions UI states **which binary** is granted.
- Non-functional: clear quit/relaunch guidance; no false “feature missing” for store users.

## Architecture

```
Build pipeline → signed app id com.chaeboxi (or store id)
  → Settings shows executable path + permission status
  → User enables TCC for THAT identity
  → Recheck uses in-process CG (already)
```

## Related Code Files

- Modify: `src/renderer/routes/settings/computer-use.tsx` (copy / binary path / warnings)
- Existing: reveal executable, permission recheck (extend copy only if needed)
- Docs: `docs/computer-use.md` ship section
- Release: project’s usual Tauri/App Store/TestFlight process (see repo deploy docs if any)

## Implementation Steps

1. **Choose channel:** TestFlight / local notarized / App Store (product decision).
2. **Version bump** + changelog line: Computer Use harness (auto-verify screenshots, app lock, wait tool).
3. **Settings UX**
   - Show short path to running executable.
   - Warn: “Dev builds and App Store builds are different apps for macOS privacy.”
   - Link Open Settings + Recheck + quit/relaunch steps (strengthen existing).
4. **Smoke on release candidate**
   - Same Phase 1 demos on RC binary.
5. **Ship** and notify that old store binary will not get code fixes until update.
6. Update `docs/computer-use.md` “Ship / update” section.

## Success Criteria

- [ ] RC binary runs harness tools (`computer_wait` present in tool list when armed)
- [ ] Permissions UI mentions binary identity
- [ ] Calculator smoke on RC
- [ ] Release notes mention Computer Use improvements
- [ ] App Store/TestFlight or local install path documented for user

## Risk Assessment

- Shipping without measure → bad reviews. Prefer Phase 1 F or known limitations in notes.
- Dual TCC entries confuse users — UX must show path.

## Test / validation gate

- Manual RC smoke
- No full unit suite required beyond existing green CI
