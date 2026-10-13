# Work source access feasibility

Checked: 2026-10-13. Documentation review only; no personal history was imported, no export was requested, and no connector was implemented or tested. Findings establish candidate access paths, not complete coverage of either product.

## Codex and ChatGPT Work

The documented Codex App Server supports listing stored threads and reading a thread with turns without resuming it. Filters and backing-store coverage need validation with a selected target conversation. This supports a Codex read adapter investigation, but does not establish access to every ChatGPT Work conversation. Tools available inside this assistant are not automatically an API available to Chaeboxi. [App Server documentation](https://developers.openai.com/codex/app-server/)

OpenAI distinguishes ChatGPT Work from Codex, including their history. Treat the user's phrase "Codex Work" as requiring source identification rather than assuming the Codex store contains the desired Work records. [Work and Codex](https://help.openai.com/en/articles/20001275-chatgpt-work-and-codex)

ChatGPT documents account-data exports for eligible accounts. The archive includes chat history, but the reviewed page does not establish complete Work-specific coverage, tool-output fidelity, or a continuous external history feed. Inspect a representative archive before choosing a parser or claiming support. [ChatGPT data exports](https://help.openai.com/en/articles/7260999-exporting-your-chatgpt-history-and-data)

## Claude Cowork

Anthropic documents downloading individual task data and a desktop Cowork data export in its transition guidance. It also says new Pro/Max Cowork tasks run in the cloud from October 6, while earlier local tasks remain local. A local-history reader alone therefore cannot be assumed to cover new personal Cowork work. Export format, source IDs, attachment coverage, and availability in the user's account remain untested. [Cowork surfaces and transition](https://support.claude.com/en/articles/15520349-use-claude-cowork-on-web-desktop-and-mobile)

An official Compliance API exposes local and remote Cowork session transcripts, but the reviewed endpoints are Enterprise-only and require a Compliance Access Key with the relevant scope. This is not a general personal-account connector. No personal continuous transcript API was established by this review; this is not a claim that no other supported path exists. [Session transcript API](https://platform.claude.com/docs/en/manage-claude/compliance-sessions)

## Recommendation — proposed

For the requested everyday-work use case, start with one user-selected Cowork task export as the first import feasibility sample. This has a documented task-specific extraction route and keeps the scope narrow. Build no importer until a real sample confirms usable records. ChatGPT Work exports remain another candidate; Codex App Server is preferable for automatic reading only if the desired records actually live in its supported store.

Manual imports are a bootstrap and fallback, not fulfillment of the effortless ongoing source-refresh goal. Distinguish importing external history from syncing already-imported Chaeboxi records across devices. A watched import folder can notice newly saved files but cannot make the source product export automatically.

Validate origin, timestamps, conversation ordering, recorded outcomes, unresolved work, attachment references, duplicate imports, updates, and navigation back to the source. Do not infer that an exported summary contains the complete original conversation. Any inferred guideline remains a proposal; copied source memory does not become approved knowledge automatically.
