# User-approved knowledge authority

Chaeboxi is the user's main assistant and home for accepted knowledge, while other agents' memories and work records provide reference material. Additions and changes to authoritative knowledge require explicit user confirmation; neither imported records nor generated answers become authoritative automatically. This preserves the user's control over conflicting or mistaken information at the cost of an approval step, rather than allowing agents to merge or overwrite accepted knowledge autonomously.

Explicit user requests and a background memory worker may produce proposals. Pending proposals are excluded from ordinary answer context and are available only when the user explicitly reviews or asks about them; labelling them unapproved inside ordinary context is insufficient. Original records remain searchable for relevant history questions with source attribution, without becoming authoritative knowledge. This trades immediate use of worker interpretations for a clearer approval boundary and reduced risk of those interpretations contaminating answers.

New uploads, user input, and connected source material that potentially contradict saved knowledge must flag the affected knowledge for review. A changed source may mark its approved knowledge as potentially outdated; this does not prove the approved knowledge is wrong or that the newer material is correct. Preserve the approved version until the user confirms a change, and surface the review-needed status when the affected knowledge is used. Pending replacement proposals remain excluded from ordinary answer context under the rule above.

Conflict review is non-blocking: answer using the approved version with a visible review-needed notice and let the user open the comparison when convenient. Do not pause an ordinary answer to demand conflict resolution. Approval is required to change authoritative knowledge, not to continue using the assistant.

This policy governs authoritative knowledge. Automatic method learning is permitted separately under [ADR 0007](0007-automatic-method-learning.md), without promoting learned factual claims into approved knowledge.
