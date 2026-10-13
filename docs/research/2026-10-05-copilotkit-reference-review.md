# CopilotKit reference review for Chaeboxi

Inspected October 5, 2026. Design research only; no dependencies, code imports, hosted services, or runtime evaluations were introduced.

## Sources and scope

- [CopilotKit/OpenDots](https://github.com/CopilotKit/OpenDots), inspected main commit `c2569bb6a13a22e565cf3eb791c62267d06babb1`.
- [CopilotKit/openmuse](https://github.com/CopilotKit/openmuse), main resolved to `b06caad7005ac5b6d2b451752a3794a6ae1759c1`; feature findings come from current published README/documentation, not a complete code audit.
- [CopilotKit/OpenBot](https://github.com/CopilotKit/OpenBot), inspected main commit `cb5dc32a44517622c6db4e527e61d3abb389b43c`.
- [Automatic Learning](https://docs.copilotkit.ai/learning), [AG-UI](https://docs.ag-ui.com/introduction), and OpenDots setup documentation.

Several unrelated projects use the name OpenDots. This review concerns the CopilotKit repositories explicitly named by the user.

## Fit and reuse candidates

| Reference | Relevant patterns | Fit limits |
| --- | --- | --- |
| OpenDots | Stable conversations linked to saved pages; separate document and conversational state; per-agent Space access; visible approval cards; workflow-scoped learning evidence and versioned skill delivery. | Early single-owner template. Durable Threads and learning use configured CopilotKit Intelligence. Interactive page embeds and file uploads are not included in its current feature inventory. It is not a replacement for the confirmed Chaeboxi canvas or encrypted-sync design. |
| OpenMuse | Mobile conversation controls, retained drafts, progress and result cards, replayable threads, task receipts, and visible takeover of a persistent browser. | React Native/Expo frontend differs from Chaeboxi's existing React/Capacitor mobile target. Server workers and Intelligence-backed conversation storage are additional dependencies. Borrow UX and lifecycle patterns before considering code transplants. |
| OpenBot | Action gateway with permission decisions and recorded outcomes; agent computer isolation; scoped retrieval and learning delivery. | Enterprise-oriented service footprint and private repository workspaces. Its container browser is different from controlling the user's native desktop. It is a source reference rather than a drop-in runtime package. |

## Concrete source observations

OpenDots `src/server/learning.ts` binds a conversation to its stored learning container; `src/client/ThreadList.tsx` combines local thread bindings with SDK conversation metadata. OpenBot `server/src/learning/runtime.ts` loads skills through registries keyed by container/revision, keeps an invocation snapshot, requires verified ownership for binding, and uses a pinned internal SDK import. These are useful patterns, not an endorsement of copying that internal dependency.

The documented learning loop analyzes completed conversations, proposes skills, and requires review/publication before delivery. This differs from Chaeboxi's accepted automatic method-learning policy: reuse evidence, scoping, snapshots, and revision history, but do not import the approval policy unchanged. OpenDots also reports connected-service learning verification as outstanding; its code/configuration is not evidence of reliable learning in Chaeboxi.

All three repository license files currently state MIT. If code is reused, retain the applicable notices and inspect the licenses and terms of the specific dependencies/services separately. The template license does not establish that every underlying service can be freely copied or operated without a license.

## Selective reuse direction — accepted

Keep the accepted focused evolution of Chaeboxi. Prioritize OpenDots as a continuity/learning reference, OpenMuse for later mobile UX, and OpenBot for action-policy patterns. Evaluate AG-UI at an adapter boundary only if remote agent interoperability warrants it; do not replace current provider/storage layers merely to adopt the templates.

The user accepted this selective reuse direction. This accepts reference priorities, not wholesale runtime adoption or individual unreviewed implementation choices.

Concrete shortlist: durable source-linked work records, project-scoped learning evidence, versioned learned-method snapshots and undo, inline progress/results, and an action decision/receipt contract that respects native authority. These patterns require adaptation to the agreed knowledge approval, local-only source, Swarm activation, and offline requirements.

The earlier positioning must now be more precise: persistence, memory, model choice, and learning already appear in these references. Chaeboxi's proposed value remains quick access to context across existing AI tools, user-controlled authoritative knowledge, and convenient device continuity. That value requires a working comparison/demo, not a claim of uniqueness.
