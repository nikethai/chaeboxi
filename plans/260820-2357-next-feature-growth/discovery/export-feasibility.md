# Export feasibility (Phase 0)

**Date:** 2026-08-21  
**v1 choice:** ChatGPT account export ZIP  
**Claude:** official conversation export exists; adapter deferred until real samples

## ChatGPT (verified as a product feature; schema unofficial)

Official help: [Exporting your ChatGPT history and data](https://help.openai.com/en/articles/7260999-exporting-your-chatgpt-history-and-data)

- Settings → Data controls → Export, or Privacy Portal
- Available: Free, Go, Plus, Pro, eligible Edu. **Not** Business / Enterprise / Healthcare self-service
- Delivery: email or SMS, up to 7 days; download link 24h; must be signed into the same account
- Artifact: ZIP including **chat history** and other account data
- Community-observed payload: `conversations.json` plus `chat.html`; mapping is a **message tree**, not a flat list
- Format drift is documented (asset ids `file-…` → `file_…`, layout changes) with **no public schema**
- Attachments live beside JSON; v1 records "attachment existed" and skips bytes

**Adapter strategy:** stream-zip → find `conversations.json` (size-capped) → walk mapping → flatten one path per conversation (latest or selected branch) → text parts only.

Golden fixtures: synthetic trees covering mapping nodes, empty parts, tool/system authors, truncated JSON. Real consented samples stay off-git.

## Claude (official export exists; not v1)

Official help: [Export your Claude data](https://support.claude.com/en/articles/9450526-export-your-claude-data) (updated 2026-07-08)

- Settings → Privacy → Export data on web or Claude Desktop (not iOS/Android)
- Free / Pro / Max individuals; Team/Enterprise only via Primary Owner
- Email link, 24h expiry; **cannot re-import into another Claude account**
- Community-observed ZIP: `conversations.json` with `uuid`, `name`, `chat_messages[]`, `sender` human/assistant, `content[]` typed blocks, often `parent_message_uuid` (tree)
- Also reported: `projects.json` / `users.json` / memories — **out of scope** (not conversation history)
- Model id often missing on export messages
- Attachments listed empty of bytes

Treat Claude as Phase 2. Anthropic **memory** export is not a conversation archive.

## Other providers

Gemini / Poe / TypingMind / Open WebUI dumps are out of v1. Native Chaeboxi restore path is **history-transfer JSON** (`HISTORY_TRANSFER_MAGIC`), not the JSONL library and not vendor ZIP.

## Legal shareability

Participants can share **their own** consumer export. Workspace/Enterprise exports need org authorization. Researchers must follow `consent-custody-protocol.md`.

## Adversarial archive cases (fixtures after format freeze)

- Zip bomb / nested zip / symlink / `../`
- 10 GB `conversations.json`
- Truncated JSON, UTF-16, huge single `parts[]` string
- HTML/SVG in message parts
- Duplicate conversation ids

## Still needed before Phase 1

1. ≥1 consented ChatGPT ZIP covering a recent export date
2. Catalogue of mapping keys actually present
3. Decision on which mapping branch is "the" conversation in v1 (recommend: current terminal path by `current_node`)
