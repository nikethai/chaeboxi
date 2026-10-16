# Research-data consent, custody, and deletion

**Status:** Phase 0 protocol  
**Applies to:** consented provider export files and session recordings used for Continuity discovery  
**Not legal advice.** Confirm with counsel before collecting data.

## Purpose

Obtain the minimum data needed to (1) verify one archive format and (2) time retrieval/handoff tasks, then delete it on a fixed schedule.

## What we may collect

| Allowed | Forbidden |
| --- | --- |
| Participant-provided ChatGPT or Claude **conversation export ZIP** after they review it | Passwords, API keys, payment data, other people's private chats they do not have rights to share |
| Sanitized copies they produce (redacted names, secrets stripped) | Whole-disk images, mailbox dumps, Claude/ChatGPT **memory** exports treated as conversation history |
| Content-free metrics (durations, success/fail, counts) | Committing exports or unsanitized JSON to git, issue trackers, or chat logs |
| Optional screen recording of Chaeboxi UI only, if they agree | Recording provider websites while signed in, unless they explicitly consent |

## Consent (session 1, before any file is copied)

Read aloud and get a written yes:

1. Participation is voluntary; they can stop and request deletion at any time.
2. They confirm they have the right to share this export (their account, not a company workspace they do not control).
3. They understand Chaeboxi will store the file **only on the researcher's disk**, not in product telemetry or cloud.
4. Selected excerpts used in a handoff prototype are sent to **the model provider they configure** (same as using Chaeboxi).
5. Retention is **30 days after the last research session**, then secure delete, unless they ask sooner.
6. Quotes in reports will be paraphrased; no message bodies in public docs.

Do not collect the file if any item is no.

## Custody

- Store exports in an encrypted disk image or OS-encrypted folder outside the git repo (`~/Research/chaeboxi-continuity/` or equivalent). Add the path to personal ignore lists; never to the repository.
- Name files `pNN-provider-YYYYMMDD.zip`. Do not use emails in filenames.
- Keep a paper/local ledger: participant code, date received, byte size, checksum, deletion due date. Ledger has no message text.
- Only the researcher running the session may copy the file. No Slack/email attachments of exports.
- Sanitization before any fixture work: strip `email`, `phone`, `api_key`, `Authorization`, and attachment binaries. Prefer synthetic golden files derived from structure, not copied user text.

## Deletion

- On request or at day 30: `rm` the ZIP, staging dirs, and any extracted JSON; empty trash; confirm checksum no longer matches any remaining file.
- Derived native Chaeboxi sessions created during the prototype are deleted with the same rule.
- Provider-side copies already sent during a handoff **cannot be retracted**. Tell the participant this before the handoff task.

## Chaeboxi product constraints this protocol must not violate

- `TELEMETRY_ENABLED` stays false.
- Do not add export files to Sentry breadcrumbs or `appLog`.
- Diagnostics from a future importer must be content-free (counts, codes, format version).
