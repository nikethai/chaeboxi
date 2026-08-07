# Plan: Pi SDK as Chaeboxi Agent Runtime

**Status:** Research complete — awaiting product decisions + PoC  
**Date:** 2026-08-07  
**Research:** [research/pi-sdk-research-report.md](./research/pi-sdk-research-report.md)

## Goal

Ship ChatGPT-like Chaeboxi UX for non-tech users, with optional **Agent mode** powered by Pi (local) and existing OpenClaw (remote). Observation UI + agent-of-choice bridge. Work OOTB on desktop.

## Non-goals (v1)

- Replace native multi-provider chat with Pi
- Web/mobile local Pi
- Bash-on-by-default for consumer profile
- Full sandbox/container (phase 5+)

## Architecture decision (recommended)

| Layer | Choice |
|-------|--------|
| Product | Assistant (native) default · Agent (Pi/OpenClaw) optional |
| Pi integration | RPC subprocess via Tauri (OpenClaw-pattern provider) |
| Session ownership | Pi owns agent history; Chaeboxi projects UI messages |
| Auth | Inject Chaeboxi API keys into Pi runtime |
| Safety | Chaeboxi risk-engine + approvals; Safe tool preset OOTB |

## Phases

| Phase | Name | Status | Depends |
|-------|------|--------|---------|
| 0 | Product decisions + RPC PoC | pending | — |
| 1 | Tauri Pi host (spawn/RPC/lifecycle) | pending | 0 |
| 2 | Provider + event→message mapping | pending | 1 |
| 3 | Observation UI + Safe OOTB profile | pending | 2 |
| 4 | Runtime switcher (native/pi/openclaw) | pending | 3 |
| 5 | Packaging (bundled Node/pi) + optional sandbox | pending | 4 |

## Acceptance criteria (ship-ready v1)

- [ ] Desktop user can open Agent session without terminal/CLI knowledge
- [ ] Model auth uses existing Chaeboxi provider keys (or clear connect flow)
- [ ] Streaming text + tool start/end visible in chat
- [ ] Abort works; mid-flight steer/follow-up defined
- [ ] Safe profile cannot run bash without explicit Advanced enable + approval
- [ ] Web build degrades gracefully (no crash; clear CTA for desktop/OpenClaw)
- [ ] OpenClaw path still works as remote agent option

## Open decisions (block full plan)

1. Power users first vs non-tech-first defaults
2. System `pi` install vs bundled sidecar
3. Keep OpenClaw as peer runtime (recommended) vs consolidate

## Next

1. Answer open decisions  
2. Phase 0 PoC  
3. Expand phase files under this folder when approved for `/cook`
