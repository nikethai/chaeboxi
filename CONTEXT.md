# Dango Personal Assistant

Dango is a personal assistant for quick conversations, information, brainstorming, sketches, and finding the user's knowledge and past work.

## Language

**Personal assistant**:
The user's everyday companion for thinking, creating rough ideas, and recalling useful information across their work.
_Avoid_: Coding agent, development environment

**Specialist agent**:
An external assistant, such as Codex or Pi, used for dedicated work such as implementing and testing code.
_Avoid_: Dango coding mode

**Quick Chat**:
A readily accessible conversation for a question, an idea, or a small creative request.
_Avoid_: Coding session

**Authoritative knowledge**:
Knowledge explicitly approved by the user as the accepted reference in Dango.
_Avoid_: Automatically trusted agent memory

**Reference material**:
Information available as evidence, including other agents' memories and work records, without approval as authoritative knowledge.
_Avoid_: Confirmed fact, authoritative knowledge

**Knowledge proposal**:
A suggested addition or change to authoritative knowledge awaiting the user's explicit approval.
_Avoid_: Automatic memory update

**Approver**:
The user who decides whether a knowledge proposal becomes authoritative knowledge.
_Avoid_: Agent approver

**Memory worker**:
A background assistant that reviews opted-in records, prepares knowledge proposals for user approval, and learns supported methods within existing permissions, with history and undo.
_Avoid_: Automatic approver, source of truth

**Project knowledge**:
Knowledge whose applicability is limited to a particular project, such as its review guidelines or decisions.
_Avoid_: Global preference

**Personal preference**:
A user-approved preference that can apply across projects, such as a preferred response style. Lives in Everywhere.
_Avoid_: Project guideline

**Everywhere**:
The built-in scope whose knowledge and documents every other scope also reads. A scope's own knowledge wins over Everywhere inside that scope. Client scopes read Everywhere documents only when turned on.
_Avoid_: Global memory, default scope

**Knowledge conflict**:
A potential contradiction between saved knowledge and new information within the same scope, awaiting user review.
_Avoid_: Confirmed error, automatic replacement

**Knowledge source**:
A collection of reference material the user explicitly connects for retrieval within a chosen scope, with background memory review enabled separately.
_Avoid_: Approved knowledge, automatically discovered history

**Swarm**:
An explicitly user-activated mode in which multiple agents contribute to a request.
_Avoid_: Automatic delegation, background memory worker

**Computer use**:
Assistance that observes or interacts with applications on the user's computer.
_Avoid_: Coding workspace

**Canvas**:
A visual artifact alongside a conversation that the user can explore and revise through chat, including diagrams and interactive explanations.
_Avoid_: Coding workspace, full design editor

**Mobile companion**:
The phone experience for independent Quick Chat and access to desktop-dependent capabilities when the desktop is connected.
_Avoid_: Remote-only chat client

**Recovery key**:
A user-held secret that restores access to encrypted sync-only content when trusted devices are unavailable, together with account authentication. Losing all trusted devices and the key leaves that content unrecoverable by the service.
_Avoid_: Account password, service-readable backup
