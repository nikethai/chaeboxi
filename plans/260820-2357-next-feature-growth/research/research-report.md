---
type: researcher
date: 2026-08-20
timestamp: 260820-2357
topic: next-feature-growth
product: Chaeboxi 1.7.0
status: consult
---

# Research Report: How Chaeboxi Grows Into the Next Feature

**Conducted:** 2026-08-20  
**Mode:** `/ask` architecture consult + `/research` (Gemini CLI hung; WebSearch fallback)  
**Non-goal:** No implementation. No new subsystem design.

## Table of contents

1. [Executive Summary](#executive-summary)
2. [Architecture Analysis](#architecture-analysis)
3. [Research Methodology](#research-methodology)
4. [Key Findings](#key-findings)
5. [Comparative Analysis](#comparative-analysis)
6. [Design Recommendations](#design-recommendations)
7. [Technology Guidance](#technology-guidance)
8. [Implementation Strategy](#implementation-strategy)
9. [Resources](#resources--references)
10. [Unresolved Questions](#unresolved-questions)

## Executive Summary

Chaeboxi already has more product than a typical user can discover. The inventory is a **platform**: 16+ providers, agents/rooms/swarm, skills, hooks, MCP, memory, desktop RAG, video URL, browser agent, computer use, web search, OpenClaw, integrations, notifications — plus **Voice Copilot v1 in flight** (hold-to-talk STT, optional TTS, BYOK / local Whisper, no wake-word, no product cloud).

The market does not pay for “Chatbox + more checkboxes.” Cherry Studio owns “feature-packed desktop.” Chatbox owns “simple cross-platform.” Jan owns “local models.” Open WebUI owns “self-hosted teams.” Chaeboxi’s only coherent next move is **finish the in-flight input (Voice v1), then make one existing differentiator demoable** — desktop computer use + browser — **or stop adding features and ship distribution**. Adding Realtime voice, wake-word, memory sync, more providers, or a skill marketplace now is sprawl.

Brutal rule: **next feature = complete a loop, not open a new one.**

## Architecture Analysis

### What the system actually is

Three layers, one multiplexed desktop IPC (`ipc_invoke`), BYOK, cloud/telemetry flags off. Desktop is the rich shell (MCP stdio, keychain, KB ONNX, browser host, computer act). Web/mobile share the renderer and lose native depth. That is already a documented non-goal — do not fight it with “parity features.”

```text
User job
  → composer (InputBox ~3365 LOC) + tools menu
  → model-calls + toolsets (memory, kb, mcp, browser, computer, video, search, integrations)
  → AbstractAISDKModel / streamText
  → Desktop IPC (~3178 LOC lib.rs) | WebPlatform
```

Voice v1 sits in the **right place**: shared STT/TTS (`src/shared/voice-copilot.ts`) + settings route + hold button. It reuses OpenAI/Groq keys. It is an **input modality**, not a new agent runtime. Keep it that way.

### System Designer

Boundaries that matter:

| Boundary | Status | Next-feature implication |
|---|---|---|
| Composer as kitchen sink | `InputBox.tsx` 3365 lines; voice already bolted on | Do not add more composer products. Extract later, don’t grow it. |
| Tool lease | Browser vs computer already exclusive | Voice must not start a third control loop. |
| Privileged desktop | CU / browser / MCP / KB / secrets in Rust | New native capability = new IPC surface in an already-fat `lib.rs`. |
| Cloud | `CHATBOX_CLOUD_ENABLED = false` | No ephemeral Realtime token broker. No hosted STT. No remote push. |
| Platform cliff | Desktop-rich, web/mobile thinner | Next feature that needs desktop-only is fine. Next feature that promises mobile RAG/CU is a lie. |

Data flow for growth is **not** “add another package.” It is: **arm fewer tools per turn**, keep voice as transcript-in / optional speech-out, keep CU as an armed desktop lease.

### Technology Strategist

Industry 2026 voice consensus: **push/hold-to-talk first**. Wake-word is a local always-on listener (false wakes, TCC pain). Cloud wake-word streams the mic (~$1/hr idle in public PTT examples). OpenAI Realtime (`gpt-realtime-2`, WebRTC) is the speech-to-speech path — and it wants a **server-issued ephemeral key**. That fights BYOK-no-cloud unless you accept “user’s OpenAI key in the desktop process,” which is fine for this product **technically** but is a **new product** (barge-in, echo, cost, tool-calling over audio). YAGNI until PTT is shipped and used.

Computer-use market: a16z (2026) says CU crossed “demo → deployable” for **harness builders**, not for consumer “it just works.” OSWorld 2.0: even Opus 4.8 + max thinking ≈ **20.6% binary** on long-horizon tasks. Agents click well; they **drop task state**. Chaeboxi’s residual CU plan already said the quiet part: **live measure on a signed binary never happened**. Shipping more CU primitives without that measure is theater.

MCP/tool sprawl: mid-size MCP setups burn tens of thousands of tokens **before** the user types. Chaeboxi already stacks native tools + MCP + memory + KB. The 2026 fix is **retrieve/arm tools**, not add more servers.

### Scalability Consultant

Growth bottlenecks, in order:

1. **Discoverability** — settings pages for every subsystem; no single job story on the marketing site.
2. **Tool-context load** — more features make the agent worse, not better.
3. **CU reliability** — differentiator that can embarrass the product if claimed early.
4. **Distribution** — GitHub Releases + Pages exist; no telemetry; flying blind.
5. **Maintainability** — two god-files (`InputBox`, `lib.rs`) plus a 2-week feature factory.

This is an indie GPLv3 BYOK app. Scale is **downloads + daily use**, not seats. SaaS playbooks (Pro $8, Teams $15) do not apply unless the product identity is abandoned.

### Risk Analyst

| Risk | Severity | Mitigation |
|---|---|---|
| Feature factory / no wedge | High | Kill list. One demo job. |
| CU claimed, demos fail | High | Measure Calculator + WhatsApp before marketing copy. |
| Voice + CU = voice-driven OS control | High | Keep Voice v1 as composer STT only. No “hey, click that.” |
| Realtime requires product cloud or raw user key + new loop | Med | Defer. |
| Tool bloat → worse agents | High | Arm-only + later tool retrieval. |
| Independence / Chatbox origin confusion | Med | Keep BYOK, no paid cloud. Don’t copy Chatbox Pro sync. |
| No usage data | Med | Qualitative: GitHub issues, your own daily path. Don’t add Sentry to “learn.” |
| `lib.rs` / InputBox god-files | Med | Next feature that needs a new IPC channel should trigger a split, not another 200 lines. |

## Research Methodology

- Sources consulted: 5 WebSearch queries + product docs (`docs/project-overview-pdr.md`, architecture, memory, RAG, computer-use, browser, video, integrations, notifications) + current WIP (`voice-copilot.ts`, settings/voice, `VoiceHoldButton`, git status).
- Date range: 2026 industry sources (client comparisons, a16z CU, OSWorld 2.0, MCP token-bloat) + Chaeboxi docs dated 2026-08-06 → 2026-08-15.
- Gemini: `skills.research.useGemini=true`. CLI present (`gemini` on PATH) but **hung on ping (>90s)**. Fell back to WebSearch. Warn: Gemini CLI unavailable for this run.
- Search terms: BYOK desktop client comparison 2026; hold-to-talk vs Realtime vs wake-word; OSS copilot growth; computer-use reliability; feature sprawl / MCP tool bloat.
- Evaluation criteria: fit to local-first + BYOK + no product cloud; YAGNI/KISS/DRY; ships in weeks not quarters; demoable by one person.

## Key Findings

### 1. Technology Overview — Chaeboxi is a platform wearing a chat UI

PDR feature table is already a full agent OS. Recent plan history (Aug 6–15) shipped or cooked: UI polish, menubar, Gemini OAuth, video URL, memory, agents/swarm, hooks, browser+computer, marketing site. **There is no `project-roadmap.md`.** Features arrived as parallel plans, not as a sequenced product.

Voice v1 (uncommitted) is the only current “next feature” with code on disk. Scope is correct: hold-to-talk, OpenAI/Groq/local Whisper, TTS optional/off, no wake-word. That matches 2026 PTT best practice.

### 2. Current State & Trends

| Trend | What it means for Chaeboxi |
|---|---|
| Desktop clients split into simple vs packed vs local-model | Do not out-Cherry Cherry. Do not out-simple Chatbox unless you **cut**. |
| Voice: PTT default; Realtime for conversation products | Finish PTT. Realtime is a different app. |
| CU: models got good enough for harnesses; long-horizon still ~20% | Harness + 2 short demos, not “Operator.” |
| MCP token bloat is a first-class 2026 problem | Adding connectors without retrieval is a quality regression. |
| OSS growth = signed installers + first-run + one comparison page | Marketing site exists. Next growth is distribution + story, not a 17th provider. |

### 3. Best Practices (for this product class)

1. **One job on the box.** “Local-first desktop copilot: your keys, your machine, optional voice, optional computer use.”
2. **PTT before wake-word before Realtime.**
3. **Arm tools; don’t dump the catalog.** Composer already has this pattern — keep it.
4. **Measure CU on the signed binary** before more CU code.
5. **Ship the loop you started.** Voice settings + hold button + transcript into draft + optional TTS. Then stop.
6. **Growth ≠ features.** Signed DMG/NSIS, first-run “add a key → send a message → hold mic,” two screenshots on `/download/`.

### 4. Security Considerations

- Voice v1: mic only while held. Correct. Do not add always-on listener.
- CU act tools are CRITICAL and must stay non-auto-approve. Voice must not bypass that.
- Realtime-in-client with a raw API key is acceptable for a desktop BYOK app, but audio leaves the device the whole session. Disclose it.
- Integrations already do the right thing (keychain, tokens never in prompt). Don’t invent a hosted OAuth broker.
- Remote push remains correctly deferred (needs a server = identity change).

### 5. Performance Insights

- Agent quality degrades as tool schemas grow (Anthropic-scale: ~55k tokens for 58 MCP tools). Chaeboxi’s native toolsets plus user MCP will hit this first.
- CU latency is screenshot-loop bound. Industry is moving toward AX/DOM grounding to cut steps. Chaeboxi deferred full AX — correct until 2 demos pass.
- Local Whisper + optional TTS is enough for “talk then read.” Speech-to-speech Realtime is a latency/cost product, not a checkbox.

## Comparative Analysis

| Product | Wedge | Chaeboxi vs them |
|---|---|---|
| **Cherry Studio** | Packed desktop, 60+ providers, RAG, compare | Lose a feature race. Win only on independence + desktop agents (CU/browser) if they work. |
| **Chatbox** | Simple, all platforms, optional hosted Pro | Origin risk. Stay BYOK-only. Don’t clone Pro sync. |
| **Jan** | Offline local models | Don’t become a model runner. Keep Ollama/LM Studio as backends. |
| **Open WebUI / LibreChat** | Self-hosted teams | Wrong shape. Chaeboxi is a personal desktop shell. |
| **Claude Desktop / ChatGPT agent** | Vendor CU in a sandbox | Chaeboxi’s CU is **on the real desktop**. Higher value, higher blast radius. Only a wedge if 2 flows work. |
| **TypingMind / LobeChat** | Polished web BYOK | Desktop depth is the only reason to exist. |

**Implication:** Next feature that looks like “another settings page” is invisible. Next feature that makes **one desktop job obviously work** is the only thing reviewers can write down.

## Design Recommendations

### Do next (in order)

**P0 — Finish Voice v1 (already started).**  
Hold-to-talk → transcript in composer → optional spoken reply. Settings page exists. Master off by default. No wake-word. No Realtime. Ship it as input polish, not “Voice OS.”

**P0 — Stop opening new subsystems until Voice is merged and the two CU demos are measured.**  
If Calculator / WhatsApp fail, the next “feature” is harness fix, not a new package.

**P1 — Pick one public job (wedge).**  
Recommended copy: *Local-first desktop copilot. Hold-to-talk. Optional computer use. Your keys. No product cloud.*  
Alternative if CU demos fail: drop CU from the story; lead with memory + KB + MCP + voice input.

**P1 — Tool-load diet (architecture, not a feature).**  
Only armed toolsets + retrieved MCP tools in the turn. This is how you “grow” agent quality without new UI.

**P2 — Distribution, not product.**  
First-run: key → one chat → mic. Comparison page vs Chatbox/Cherry. Keep Pages origin. Custom domain later.

### Do not build (YAGNI)

- Wake-word / always-on mic
- OpenAI Realtime speech-to-speech
- Memory / KB cloud sync (designed, correctly deferred)
- yt-dlp desktop extractor (video RC already useful)
- Remote push
- Skill marketplace
- More providers
- Mobile RAG / mobile CU
- Voice-driven computer use
- Hosted OAuth broker / paid cloud (identity violation)

### Alternatives

| Option | When | Cost |
|---|---|---|
| A. Voice v1 then CU demos | Default. Uses in-flight code + existing differentiator. | 1–3 weeks if disciplined |
| B. Voice v1 then distribution only | If CU measure fails hard. | Honest. Grows users, not surface. |
| C. Realtime voice product | Only after PTT usage is real and users complain about latency. | New loop + cost + echo. Months. |
| D. Keep cooking features | Current habit. | Invisible product. God-files grow. Agents get worse. |

Choose A. Fall back to B. Never D.

## Technology Guidance

| Choice | Verdict | Why |
|---|---|---|
| Hold-to-talk + Whisper-compatible STT | **Keep** | Matches BYOK, privacy, 2026 PTT consensus. Already coded. |
| Optional OpenAI/Groq TTS | **Keep, default off** | Cheap. Don’t make the app talk unless asked. |
| Local Whisper URL | **Keep** | Only offline STT path that doesn’t bundle a model. |
| OpenAI Realtime / WebRTC | **Defer** | Needs session semantics + cost UX. Ephemeral-token guides assume a backend you refuse to run. |
| Wake-word (openWakeWord / Picovoice) | **Defer** | Always-on mic. False wakes. TCC. Not the growth problem. |
| Computer use harness + 2 playbooks | **Double down after measure** | Only unique desktop story vs Chatbox/Cherry. Science says keep tasks **short**. |
| Full AX hybrid | **Defer** | Residual plan already deferred. Measure first. |
| MCP tool retrieval | **Do after Voice** | Highest ROI quality fix. Industry pattern (RAG-MCP, SEP-1576). |
| New IPC channels in `lib.rs` | **Avoid** | File is ~3.2k LOC. Split before the next native subsystem. |
| Hosted sync / Pro cloud | **Reject** | Violates PDR. That’s Chatbox’s business, not yours. |

### Pros / cons of the recommended stack (Voice v1 + CU measure)

**Pros:** Uses code already on the branch. No new backend. Aligns with privacy story. Gives reviewers one sentence. CU is the only feature Chatbox-simple clients don’t have.

**Cons:** CU may still fail live. Voice in `InputBox` increases a god-file. No telemetry to know if anyone uses the mic. Long-horizon CU will disappoint if oversold.

## Implementation Strategy

Phased **decision** framework, not a cook plan.

### Phase 0 — Decision gate (this week)

1. Merge Voice v1 when hold → transcript → optional TTS is reliable on desktop + web.
2. Run residual CU Phase 1 measure on a **signed** `pnpm dev` / release binary (Calculator, WhatsApp). Write the failure class.
3. Freeze new feature plans until 1+2 are done.

**Exit:** Voice shipped. One page of CU evidence.

### Phase 1 — One wedge (next)

- If CU demos pass: document the 2 flows; put them on the site; keep master **off**.
- If CU demos fail: harness-only fixes by class. Do **not** add AX, marketplaces, or voice-act.
- In parallel (small): tool-arm discipline — refuse to register unused toolsets.

**Exit:** A stranger can follow a 5-step path and feel the product.

### Phase 2 — Growth (distribution)

- First-run: provider key → send → hold mic.
- Download page: one GIF (voice) + one GIF (CU or browser) + BYOK disclaimer.
- No new packages.

### Architectural decision record (use this for every proposed feature)

Ship only if **all** are true:

1. Completes an open loop **or** makes an existing armed capability demoable.
2. Needs no product cloud.
3. Does not add a toolset that is always-on.
4. Does not grow `InputBox` / `lib.rs` without a split plan.
5. Can be explained in one sentence on the homepage.

## Next Actions

| # | Action | Owner | Proof |
|---|---|---|---|
| 1 | Finish and ship Voice v1 (current branch) | Dev | Hold mic → text in composer; TTS optional; settings persist |
| 2 | Live-measure CU on signed binary | You, on device | Failure-class note in residual plan |
| 3 | Write `docs/project-roadmap.md` as a **kill list + 3 items** | Product | P0 Voice, P1 CU measure, P2 onboarding. Everything else parked |
| 4 | Homepage story = one job | Marketing site | Not a feature dump |
| 5 | After 1–4: tool retrieval spike (read-only design) | Arch | Only if agents feel dumber with MCP on |

**PoC / validation points**

- Voice: 30s hold on macOS + Chrome web build. Empty transcript and missing-key paths already have errors — keep them honest.
- CU: Calculator 7+8; WhatsApp “open contact, type, stop before send.” If either needs Finder/Spotlight, you don’t have a product story.
- Growth: a person with an OpenAI key reaches first token in <2 minutes from the download page.

**Do not start a plan for Realtime, wake-word, sync, or another provider this month.**

## Resources & References

### Product (internal)

- [docs/project-overview-pdr.md](../../../docs/project-overview-pdr.md) — vision, non-goals, inventory
- [docs/system-architecture.md](../../../docs/system-architecture.md)
- [docs/computer-use.md](../../../docs/computer-use.md) + [plans/2026-08-11-computer-use-residual/plan.md](../../2026-08-11-computer-use-residual/plan.md)
- [docs/memory.md](../../../docs/memory.md), [docs/rag.md](../../../docs/rag.md), [docs/browser-agent.md](../../../docs/browser-agent.md)
- Voice WIP: `src/shared/voice-copilot.ts`, `src/renderer/routes/settings/voice.tsx`, `VoiceHoldButton.tsx`

### External

- [10 Best AI Clients for Claude API (2026)](https://claudeapi.com/en/blog/dev-guides/best-claude-ai-clients-2026/) — Cherry #1 packed, Chatbox #2 simple
- [Open AI chat programs 2026](https://www.unifyllm.com/blog/open-ai-chat-programs-2026/) — stars / custom base URL clients
- [a16z — Can agents use a computer yet?](https://a16z.com/can-agents-use-a-computer-yet-weve-got-the-data/)
- [OSWorld 2.0](https://ar5iv.labs.arxiv.org/html/2606.29537) — long-horizon binary ~20% even for Opus 4.8
- [voice-os](https://github.com/per-simmons/voice-os) — PTT recommended; cloud wake-word costs idle
- [OpenAI Realtime 2026 guide](https://apiscout.dev/guides/openai-realtime-api-building-voice-applications-2026) — ephemeral keys / WebRTC
- [MCP tool bloat](https://dreaming.press/posts/how-many-tools-can-an-ai-agent-handle.html), [Albato MCP context](https://albato.com/blog/publications/embedded-mcp-context-bloat-hallucinations)

## Appendices

### A. Glossary

| Term | Meaning here |
|---|---|
| BYOK | User’s provider keys; no Chaeboxi-hosted LLM |
| PTT | Push/hold-to-talk; mic only while held |
| CU | Computer Use — screenshot + optional act on the real desktop |
| Wedge | The one job a stranger remembers |
| Tool diet | Only armed / retrieved tools in the model request |

### B. Compatibility / constraint matrix

| Constraint | Blocks |
|---|---|
| `CHATBOX_CLOUD_ENABLED = false` | Hosted STT, ephemeral Realtime broker, Pro sync, remote push |
| Desktop-richest shell | Mobile CU/RAG as a “next feature” |
| GPLv3 + Chatbox origin | Paid-cloud clone; muddy branding |
| God-files | Casual new composer / IPC features |

### C. Raw research notes

- Gemini CLI hung; five WebSearches only.
- Competitor listicles still treat Chatbox as the simple client. Chaeboxi will be compared to Chatbox first. Independence copy must stay sharp.
- Ghost-app style Stripe roadmaps are the wrong template for this repo.
- Voice-os and Home Assistant Realtime projects confirm: PTT is the grown-up default; wake-word is a hobby tax.

## Unresolved Questions

1. What is the actual success metric — personal daily driver, GitHub downloads, or something else?
2. Has Computer Use ever completed Calculator + WhatsApp on a **signed** binary on this machine?
3. Is Voice v1 intended as composer dictation only, or as the start of a spoken agent? (Recommend dictation only.)
4. Will you accept a public kill list (park 80% of planned subsystems), or is the habit still “cook the next plan”?
5. Custom domain / notarized release status — is distribution actually blocked, or just undocumented?

---

**Bottom line:** Ship Voice v1. Measure computer use. Write a 3-item roadmap. Do not grow the platform. The next feature is **completion**, not invention.
