# Phase 0 status — 2026-08-21

Late scout/research (same day) added: ChatGPT numbered JSON variant; do not reuse history-transfer `JSON.parse`; first handoff must force-off MCP/web/skills, not only browser/computer flags. Folded into ADRs 002/004 and threat models.

**Plan:** `phase-0-artifacts-complete-field-work-open`  
**MVP Phase 1:** CLOSED. Not started. No retention numbers claimed (`TELEMETRY_ENABLED = false`).

## In-repo (complete)

- Protocols, ChatGPT export feasibility, search baseline spike, untrusted-context spike
- 5 ADRs, 2 threat models
- Review 8/10, 0 critical; untrusted-block warnings fixed (delimiter neutralization, prefix packing, omitted reason codes)
- Focused tests **16/16** pass after those fixes
- Spikes not wired to send/import/index/UI

## Field work (open, human)

- Recruit 8–12 qualified participants
- Consented ChatGPT ZIP (not in git)
- Desktop `session:*` I/O timing
- ZIP inspector red-team (inspector not written)

## Gate

Do not open Phase 1 until product, feasibility, security, and performance exit criteria in `plan.md` all pass.
