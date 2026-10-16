# Discovery task scripts

**Session 1:** ~45 minutes  
**Session 2:** ~20 minutes, ≥7 days later  
**Prototype:** desktop Chaeboxi + paper/static handoff preview is enough. Do not wait for MVP UI.

Standardized tasks use **the participant's own prior work** when possible. If they refuse export, run tasks against visible history on their machine (they operate; researcher watches).

## Task A — Observe current retrieval (unstructured, 8 min)

Ask them to find a constraint or decision from a project at least a week old.

Record: tools used (provider search, notes, scroll, Chaeboxi search), time to first plausible result, whether the result was correct.

## Task B — Timed copy/paste handoff (standardized, 8 min)

Give the same prompt for all participants:

> Continue this project with a *different* configured model. The new model must receive: the original goal, the latest constraint, and the last two decisions. Do not paste the entire thread.

Start timer when they begin gathering context. Stop when they send the first message to the destination model.

Score correctness (predefined checklist, 0–3): goal present, constraint present, two decisions present, no extra secrets they said they wanted omitted.

## Task C — Import willingness (5 min)

If they brought a ZIP: they watch inspection of file names only (not message bodies on the researcher's screen unless they choose). Ask: "Would you import this into a desktop app that keeps it on this computer and sends only what you select to a model API?"

If they did not bring a ZIP: ask why (privacy, hassle, no export, work policy).

## Task D — Selective excerpt handoff (standardized, 10 min)

Using either imported text (if a prototype exists) or a printed/exported excerpt list they select:

- They pick excerpts + last two turns.
- Researcher shows a **destination preview card**: provider, model, estimated tokens, "this text will leave the device", omitted system/tool records.
- They confirm or abort.
- If confirm, send via Chaeboxi to a second model.

Compare time and correctness to Task B.

## Task E — Disclosure check (3 min)

Without prompting the card: "What stayed on this computer, and what did the remote API receive?"

Pass if they mention selected excerpts leaving the device and the archive remaining local (or "not imported").

## Session 2 (later week)

Repeat Task D on a **new** question against the same project. Measure whether they return to imported/prior work vs starting over.

## Metrics sheet (content-free)

- participant id
- task id
- duration_ms
- success 0/1
- correctness 0–3
- export_used 0/1
- aborted_on_disclosure 0/1
- notes_code (enum: privacy, format, time, quality, other)

No message text in the sheet.
