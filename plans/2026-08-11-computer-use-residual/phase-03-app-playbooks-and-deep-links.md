---
phase: 3
title: "App playbooks and deep links"
status: pending
priority: P1
effort: "2–3d"
dependencies: [1]
---

# Phase 3: App playbooks and deep links

## Overview

When WhatsApp (or similar) is open but vision cannot run a reliable “find contact” path, inject **structured app playbooks** and **URL schemes** so the agent skips Finder-style search. Industry parallel: Perplexity connectors / Claude skills — app-specific path before raw pixels.

**Cook only if:** Phase 1 class **E**, or F-but-flaky WhatsApp, or phone-based messaging is a product goal.

## Requirements

- Functional:
  - Static playbooks for WhatsApp, Calculator (min); optional Telegram/Messages/Slack.
  - Deep link when user provides phone/id: open chat without UI contact search.
  - Optional documented fallback: Browser Agent + web.whatsapp.com.
- Non-functional: no full RPA framework; map of strings + one open-uri path.

## Architecture

```
targetApp / user text
  → resolve skill id (whatsapp | calculator | …)
  → inject playbook steps into computer tool instructions (or system addendum)
  → if phone match: computer_open_uri(whatsapp://send?phone=…&text=…) then verify shot
  → else: vision playbook (search field → type → row → message)
```

### Playbook shape (KISS)

```ts
type AppPlaybook = {
  id: string
  match: RegExp // app name
  steps: string[] // human + model readable
  deepLink?: (ctx: { phone?: string; text?: string }) => string | null
}
```

### Deep link (validate on device)

| App | Scheme to try |
|-----|----------------|
| WhatsApp | `whatsapp://send?phone=<E164noPlus>&text=<enc>` |
| Messages | `sms:<phone>&body=<enc>` where valid |
| Fallback | `open -a` + UI steps |

Backend: extend open path with `open <uri>` (macOS) or reuse shell open; return same activate/frontmost meta when possible.

## Related Code Files

- Create: `src/renderer/packages/model-calls/toolsets/computer-playbooks.ts` (+ tests)
- Modify: `toolsets/computer.ts` — inject playbook when target set
- Modify: `computer-ui-lock.ts` — reference skills briefly
- Modify: `src-tauri/src/computer_manager.rs` — `open_uri` / channel if needed
- Modify: `platform/interfaces.ts`, `desktop_platform.ts`
- Modify: `docs/computer-use.md`
- Optional: browser fallback note only (no big browser rewrite)

## Implementation Steps

1. **Extract phone/text heuristics** from latest user message (E.164-ish, “message 84…”) — pure function + tests.
2. **Playbook registry** for calculator + whatsapp; inject into tool-set description when `getComputerUiTargetApp` matches or user names app.
3. **`computer_open_uri` tool** (or `computer_open_app` optional `uri` field):
   - CRITICAL risk, approval required
   - macOS: `open "whatsapp://…"` then short wait + auto screenshot
   - Block non-http(s)/known schemes? Allow allowlist: `whatsapp:`, `sms:`, `imessage:`, `http(s):` for web fallback
4. **Wire open_app success** → still set target app; if deep link used, set target WhatsApp.
5. **Docs:** phone-based prompt example; UI-search playbook; when to arm browser instead.
6. **Manual:** phone path once; name path once.

## Success Criteria

- [ ] Calculator playbook still works (no regression)
- [ ] WhatsApp with **phone** opens compose path without Finder (≥5/5 if scheme works on machine)
- [ ] WhatsApp **name** path uses in-app steps from playbook text (measure ≥3/5)
- [ ] Unit tests for phone parse + playbook match
- [ ] No Finder regression

## Risk Assessment

- Schemes broken on some WhatsApp builds → must fallback to UI playbook, not hard fail forever.
- `open_uri` abuse (phishing) → approval + scheme allowlist.
- Over-specific playbooks rot when UI changes → keep steps abstract (“click search field in left sidebar”), not fixed coords.

## Test / validation gate

- Unit: playbook match, phone extract, scheme builder
- Manual: WhatsApp phone + name demos
- `pnpm test` subset for new files
