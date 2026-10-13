# Personal assistant capability boundaries

Chaeboxi retains Swarm and computer use as useful personal-assistant capabilities, while coding workspaces fall outside the refined product scope because dedicated implementation work belongs in specialists such as Codex or Pi. Swarm requires explicit manual activation by the user; Chaeboxi must not automatically enable it based on a request. This preserves optional multi-agent assistance without adding unsolicited orchestration to everyday chat.

Once manually enabled, Swarm stays enabled for that conversation with a visible toggle. New conversations, including new Quick Chats, default to Swarm off.

Computer use has separate, manually enabled Read screen and Control apps controls. Permission to observe does not grant permission to click or type. This supports screen-based questions without implicitly enabling app control.

Once the user enables Control apps and requests a task, routine clicks and typing within that task proceed without repeated confirmation. Consequential actions, such as sending a message, purchasing, or deleting content, require confirmation when they have not already been explicitly authorized. A visible Stop control remains available throughout execution.

This is a product direction decision, not authorization to remove existing code. The migration of coding-workspace features, detailed Swarm presentation, and computer-use activation lifetime remain to be resolved. The proposed action policy differs from the current computer-use documentation's per-action critical approvals and will require implementation review before rollout.

Canvas follows a visual-beside-chat interaction inspired by Cursor: users explore diagrams and visual explanations and request revisions conversationally. Its scope includes Mermaid diagrams and bounded interactivity such as tabs, filters, and sliders; image generation requires a capable configured model. Chaeboxi may create a canvas automatically when a visual materially helps, or when explicitly requested; simple answers stay in chat. Canvas creation does not require the manual activation used for Swarm or computer use. This visual capability remains part of the personal assistant rather than expanding into a coding workspace or full design editor.

Canvases are saved in the thread that created them and can be reopened beside chat. Follow-ups continuing the same subject and purpose update the existing canvas rather than creating a separate artifact for each reply. A different question or an explicit request to abandon the previous direction and start fresh creates a new canvas; sharing the same visual format alone does not justify reuse. Saving a canvas does not approve its contents as authoritative knowledge. Canvas revisions retain earlier versions for user restoration, with the latest version displayed by default and a compact history control. Rendering implementation remains undecided.

When a canvas is created from Quick Chat, automatically transition the same conversation into the full main app with canvas beside chat. The user prefers adequate visual space over keeping the compact window open or requiring a preview-card click. Preserve conversation continuity through this transition.

Canvas uses information supplied through the conversation and does not independently fetch external data. Interactive controls operate on that supplied information. Requests to refresh data go through the assistant's normal retrieval flow and produce a canvas revision, keeping source acquisition separate from visual presentation. This is Chaeboxi's chosen boundary, not an assertion about Cursor's implementation.
