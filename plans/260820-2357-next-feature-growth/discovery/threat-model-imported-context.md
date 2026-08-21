# Threat model — imported context handoff

**Date:** 2026-08-21  
**Boundary:** read-only imported messages → user selection → preview → native session send  
**Spike:** `src/renderer/packages/imported-context/untrusted-reference-block.ts` (not wired)

| ID | Threat | Impact | Mitigation (v1) | Residual |
| --- | --- | --- | --- | --- |
| H1 | System-prompt smuggling | Model follows imported "you are …" | Omit `system` / `tool` roles; wrap remaining text in `<untrusted-imported-context>`; attach as **user** role only | Model may still obey user-role jailbreaks — preview + user chose the text |
| H2 | Tool / MCP / computer-use escalation | Imported text causes file or OS actions | First continuation: `browserArmed=false`, `computerArmed=false`, `agentMode=false`, `includeMcp=false`, no workspaceRoot; user must arm later | User can arm tools on turn 2; keep disclosure |
| H3 | Memory poisoning | Auto-save stores jailbreak as fact | `memoryAutoSave: false` on first continuation; imported text is not a memory source | Manual "save to memory" still possible — user action |
| H4 | Hidden extra context | More leaves the device than previewed | Preview lists titles, excerpt hashes/lengths, token estimate, destination provider/model | Token estimator is approximate |
| H5 | Local-first misunderstanding | User thinks nothing is sent | Preview copy: selected content **will leave the device** for remote APIs; local models labeled local | Cannot prevent skimming the dialog |
| H6 | Lineage after delete | UI implies source still exists | Lineage shows "source deleted"; native continuation remains; cannot re-send original archive | Provider already has prior send |
| H7 | Sync of imports | Vendor archive replicated to history-sync server | Imports **must not** use `session:*` keys; historyTransfer collects `session:` only | A bug that writes imports as sessions would sync them — ADR 001/005 tests |
| H8 | Diagnostics leak | Excerpts in crash reports | Content-free codes; Sentry remains gated off | |
| H9 | Fork / mapping confusion | Wrong branch sent | v1 sends only explicitly selected message ids | User error |
| H10 | Markdown/HTML in excerpt | Link or image fetch | Render as plain text in preview; in chat, existing markdown sanitization; no raw HTML | |

## Generation order (required)

1. Existing system / default prompt (Chaeboxi, not imported)
2. Existing memory inject **if** the user already enabled memory (policy text is Chaeboxi-authored)
3. Untrusted imported block (user role)
4. New user instruction

Never merge imported text into (1) or (2).

## Tests that must exist before Phase 1 send wiring

- System/tool excerpts omitted (already in spike tests)
- Block role is `user`
- First continuation session settings have privileged tools off
- History transfer snapshot contains zero imported sources
