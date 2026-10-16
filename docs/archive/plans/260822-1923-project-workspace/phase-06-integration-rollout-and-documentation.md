---
phase: 6
title: "Integration Rollout and Documentation"
status: pending
priority: P1
dependencies: [5]
effort: "5-7 engineering days"
---

# Phase 6: Integration Rollout and Documentation

## Overview

Converge all project-root consumers on Project context and native trust, complete privacy/cross-window integration, stage rollout flags, document boundaries, and validate desktop platforms. Generic shell remains disabled/deferred.

## Requirements

### Functional

- Skills, commands, instruction rules, hooks config and browser downloads use one effective Project descriptor and capability-relative native APIs.
- Trust categories remain independent; project shell hooks stay disabled.
- Restart revalidates bindings and obtains fresh main-window capabilities.
- Flags independently control migration, directory UX, explorer and mutation.
- Diagnostics use safe IDs/status/timing, not content/full paths.

### Non-Functional

- No active project-bound caller composes arbitrary host paths or falls back to broad IPC.
- No capability/binding/root export or sync.
- Main and Quick state agree while Quick remains unprivileged.
- Rollout falls back to chat-only/read-only without data loss.

## Rollout Sequence

```text
Phase 1 flags exist dark
  -> metadata migration/dual-write
  -> internal directory binding UX
  -> read-only explorer
  -> safe mutation
  -> one compatibility release
  -> separate future legacy-field removal plan
```

No phase is production-enabled before its own security/test gate. Generic shell, PTY, Git, worktrees and background agents remain deferred.

## File Inventory

| Action | File | Purpose | Test impact |
|---|---|---|---|
| Modify | `src/renderer/stores/session/generation.ts` | Resolve one Project context/trust source | Generation tests |
| Modify | `src/renderer/packages/model-calls/stream-text.ts` | Neutral project alias, trusted instructions, gated tools | Model-call tests |
| Modify | `src/renderer/packages/agent-scan/resolve-roots.ts` | Project/global source classification | Existing tests |
| Modify | `src/renderer/packages/agent-scan/resolve-roots.test.ts` | Capability/trust cases | Unit |
| Modify | `src/renderer/packages/skills/discover-agent-skills.ts` | Capability-relative Project scan | Unit |
| Modify | `src/renderer/packages/commands/discover-agent-commands.ts` | Capability-relative Project scan | Unit |
| Modify | `src/renderer/packages/hooks/discover-agent-hooks.ts` | Capability-relative config discovery | Unit |
| Modify | `src/renderer/packages/hooks/executor.ts` | Independent trust; shell hooks disabled | Hook tests |
| Modify | `src/renderer/packages/hooks/wrap-tools.ts` | Approval ordering before project-derived lifecycle work | Hook tests |
| Modify | `src/renderer/packages/hooks/wrap-tools.test.ts` | Denied tool runs no pre-hook | Unit |
| Modify | `src/renderer/stores/skillsStore.ts` | Cache by Project/root generation/trust | Store tests |
| Modify | `src/renderer/stores/commandsStore.ts` | Project-scoped refresh | Store tests |
| Modify | `src/renderer/stores/hooksStore.ts` | Trust-aware cache/invalidation | Store tests |
| Modify | `src/renderer/packages/browser/url-policy.ts` | Capability-derived browser download root | Policy tests |
| Modify | `src/renderer/packages/browser/url-policy.test.ts` | Missing/switch/revoke cases | Unit |
| Modify | `src/renderer/packages/model-calls/toolsets/browser.ts` | Use project descriptor for downloads | Tool tests |
| Modify | `src/renderer/stores/toolApprovalStore.ts` | Cleanup/redaction/expiry integration | Store tests |
| Modify | `src/renderer/stores/historyTransfer.ts` | Final Project privacy/compatibility | Transfer tests |
| Modify | `src/shared/room-pack.ts` | Final privacy contract | Unit |
| Modify | `src/shared/room-pack.test.ts` | No binding/root/capability | Unit |
| Create | `test/integration/project-workspace/project-workspace.test.ts` | End-to-end workflow | Integration |
| Create | `docs/project-workspaces.md` | User/developer guide | Docs review |
| Modify | `docs/system-architecture.md` | Authority/data flow | Docs review |
| Modify | `docs/codebase-summary.md` | New modules | Docs review |
| Modify | `docs/project-overview-pdr.md` | Feature inventory/limits | Docs review |
| Modify | `docs/design-guidelines.md` | Project/Context/Artifact terminology | Visual contract |
| Modify | `README.md` | Honest feature/privacy summary after enablement | Release review |
| Modify | `AGENTS.md` | Contributor architecture | Review |
| Modify | `src/renderer/i18n/locales/en/translation.json` | Final English copy | i18n |

Before coding, record exact `workspaceRoot`, `folderId`, `Folder`, artifact workspace, scanner, hook and download callers. Known callers are already listed; grep may append, not replace, this inventory.

## Function and Interface Checklist

- [ ] One `resolveProjectContext` in route and generation paths.
- [ ] Project-bound scanners use capability-relative APIs; global scanners use native-known roots.
- [ ] Cache key includes Project ID, root generation and trust category state.
- [ ] Approval occurs before any project-derived `PreToolUse` hook; denied tool runs no hook.
- [ ] Trusting instructions never trusts skills/commands/hooks.
- [ ] Shell hooks remain disabled and generic shell unavailable.
- [ ] Session deletion/project removal clears associated drafts, approvals and redacted audit references.
- [ ] Feature disable/relink revokes capabilities and cancels requests.
- [ ] Restart restores only native-authorized binding records.
- [ ] Legacy field removal criteria documented, not implemented.

## Test Scenario Matrix

| Priority | Scenario | Expected result |
|---|---|---|
| Critical | Untrusted project rules/hooks | No activation or shell execution |
| Critical | Tool denied | No project pre-tool hook ran |
| Critical | Feature disabled mid-operation | Request cancelled/capability revoked |
| Critical | Export/sync/history/room pack | No native binding/root/capability leak |
| High | Rapid Project switch | No cache/tool/context/approval leak |
| High | Browser download without ready Project | Existing blocked behavior |
| High | Restart with ready/missing binding | Reverify or explicit unavailable |
| High | Main/Quick | Shared chats/Projects; Quick no privileged operations |
| High | Session/project deletion | Drafts, approvals and runtime state cleared |
| Medium | Web/mobile | Chat Projects only; no native controls |
| Medium | Dark/light/narrow desktop | Usable and accessible |

## Dependency Map

- Requires all prior phases.
- Integrates current scanners, hooks, browser, model context, storage, room packs and docs.
- Blocks production enablement only; deferred features have no dependency.

## Implementation Steps

1. Produce and check in an authoritative caller classification: app-internal, global-user, project-bound, attachment.
2. Route project-bound scanners/config/downloads through capability APIs; remove fallback paths.
3. Centralize generation and caches on Project/root-generation/trust context.
4. Correct hook/approval ordering and keep project shell hooks disabled.
5. Finalize flags, revocation, cancellation, deletion cleanup and safe diagnostics.
6. Add end-to-end and cross-window fixtures.
7. Update docs, terminology and English copy.
8. Run TS/Rust unit and integration suites.
9. Run macOS, Windows and Linux manual/CI matrix.
10. Enable sequentially and observe one compatibility release.

## Validation Commands

```bash
pnpm check
pnpm lint
pnpm test
pnpm test:integration
pnpm build:renderer
cargo test --manifest-path src-tauri/Cargo.toml
```

Known baseline failures must be recorded before implementation. New failures are blockers; do not claim a globally clean baseline without evidence.

## Success Criteria

- [ ] Every project-bound consumer uses capability-relative APIs.
- [ ] Project switch cannot leak scans, hooks, tools, approvals or selected context.
- [ ] Untrusted repository content cannot execute automation.
- [ ] Export/privacy and deletion cleanup tests pass.
- [ ] Flags independently disable explorer/mutation and revoke state.
- [ ] Documentation makes provider disclosure and disabled shell explicit.
- [ ] Unit/integration/build gates have evidence; no new failure over recorded baseline.
- [ ] Platform matrix has no P0/P1 blocker.

## Risk Assessment

- **High:** hidden root consumers. Checked-in caller classification and contract verification.
- **High:** trust coupling. Independent category tests and cache invalidation.
- **Medium:** permanent compatibility code. Removal criteria and follow-up plan after one release.
- **Medium:** platform QA cost. Target-specific CI/manual evidence.

## Security Considerations

Redact local paths, command arguments and content from diagnostics. Project instructions are untrusted; host policy wins. Removing a Project never deletes source files.

## Rollback Strategy

Disable mutation, explorer, then directory UX independently; revoke/cancel all runtime state. Continue dual-written chat Projects. Never restore broad filesystem/shell access.
