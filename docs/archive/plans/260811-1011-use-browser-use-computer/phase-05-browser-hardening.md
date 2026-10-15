---
phase: 5
title: "Browser Hardening"
status: completed
priority: P1
dependencies: [4]
effort: "3-5 days"
---

# Phase 5: Browser Hardening

## Overview

Productionize browser agent to **M2 Browser GA**: download policy, login handoff, domain allowlist, audit log, multi-agent lock, snapshot caps, and docs. No user-profile attach.

## Requirements

### Functional
- Downloads: redirect to `{workspaceRoot}/.chaeboxi-browser-downloads/` (or `downloads/` under workspace) with user-visible notice; **if no workspace root → block download** with clear tool error (D14)
- Auth walls: detect common login patterns lightly OR on tool error → instruction to pause for user
- Optional domain allowlist setting — **default off** (D15); empty allowlist means no extra filter beyond http(s)
- Audit log of browser actions (session-scoped; reuse toolApproval audit or dedicated ring buffer)
- Multi-agent: mutex — **single-agent chats** or **Work mode lead only**; Discuss mode tools off; swarm non-lead cannot acquire (D10)
- Ref invalidation after navigation; clear errors
- `docs/browser-agent.md` user+dev doc
<!-- Updated: Validation Session 1 - D10 D14 D15 downloads/rooms -->

### Non-functional
- Snapshot hard cap enforced backend + toolset
- Profile wipe on session delete / disarm option
- No `file://` unless explicitly future-flagged

## Architecture

```text
navigate(url)
  → scheme check
  → allowlist check
  → approval (if required)
  → act
download events
  → deny or redirect to sandbox path
room generation
  → if discuss: strip browser tools
  → if swarm/work: lock owner = lead or assignee with tools
```

### Multi-agent lock

```text
BrowserLock { sessionId, ownerRunId, acquiredAt }
acquire on first browser tool in a run
release on run end / stop / error
concurrent acquire → tool error BROWSER_BUSY
```

## Related Code Files

- Modify: browser manager + sidecar (download handler)
- Modify: `toolsets/browser.ts` — allowlist, errors
- Modify: room/generation paths — strip tools in Discuss; lock
- Modify: `risk-engine` / audit store
- Create: `docs/browser-agent.md`
- Modify: `docs/project-overview-pdr.md` / `codebase-summary.md` feature inventory when shipping
- Tests: allowlist, lock, download blocked

## Implementation Steps

1. Implement URL allowlist helper + settings UI field.
2. Download policy in sidecar; tests with fixture.
3. Browser lock in generation/tool execute path.
4. Discuss mode: force browser tools off.
5. Profile cleanup on session delete / disarm.
6. Snapshot truncation tests.
7. Write `docs/browser-agent.md` (setup, safety, limits).
8. Update PDR feature inventory row.
9. GA checklist report `reports/phase-05-m2-ga.md`.

## Todo List

- [x] Allowlist + scheme guards
- [x] Download policy
- [x] Room lock + Discuss off
- [x] Audit + cleanup
- [x] Docs + GA report

## Success Criteria

- [x] Download cannot write outside workspace downloads dir; no-workspace → blocked
- [x] Second concurrent browser run gets busy error
- [x] Discuss mode never registers browser tools; non-lead swarm cannot acquire lock
- [x] Docs published in repo
- [x] M1 scenarios still pass
<!-- Updated: Validation Session 1 - download/room criteria -->

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Fragile login detection | Prefer pause-on-user-request over heuristic magic |
| Allowlist too strict | Empty default = off; power users opt in |
| Lock deadlocks | Release in `finally` on generation end |

## Security Considerations

- RT1/RT2: keep isolated profile; no advanced profile attach
- Audit args must not store passwords typed via browser_type (truncate/redact password fields if known)
- Consider marking password inputs in snapshot as `[password]` without values

## Next Steps

Phase 6 computer observe — only after M2 accepted or explicit parallel decision.
