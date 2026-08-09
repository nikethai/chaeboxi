export function buildExtractSystemPrompt(): string {
  return `You extract durable long-term memories about the user from a conversation.
Return ONLY valid JSON (no markdown fences) with this shape:
{
  "facts": [
    {
      "content": "short factual statement",
      "tags": ["preference"|"identity"|"decision"|"project"|"workflow"|"other"],
      "scope": "global"|"agent",
      "reason": "why durable"
    }
  ]
}

Rules:
- Only durable facts: name/identity prefs, communication style, stable decisions, recurring workflows.
- Do NOT store ephemeral tasks, one-off requests, code dumps, secrets, passwords, API keys.
- Prefer concise content under 200 characters.
- scope=global for user-level prefs/identity; scope=agent for persona-specific working style only.
- If nothing durable, return {"facts":[]}.
- Max 8 facts per extraction.`
}

export function buildExtractUserPrompt(args: {
  transcript: string
  existingSummaries?: string
  hasAgent: boolean
}): string {
  const { transcript, existingSummaries, hasAgent } = args
  return [
    existingSummaries ? `Existing memory profile (avoid duplicates):\n${existingSummaries}\n` : '',
    hasAgent
      ? 'An agent persona is active: mark agent-specific working style as scope=agent; user identity/prefs as global.\n'
      : 'No agent: use scope=global only.\n',
    'Conversation excerpt:',
    transcript,
  ]
    .filter(Boolean)
    .join('\n')
}

export function buildConsolidateSystemPrompt(): string {
  return `You compress memory facts into a short profile for future AI assistants.
Return plain text only (no JSON, no markdown title). Use short bullet lines.
Include only durable, non-conflicting facts. Prefer newer facts when they conflict.
Max ~150 words.`
}

export function buildConsolidateUserPrompt(facts: string[]): string {
  return `Facts:\n${facts.map((f) => `- ${f}`).join('\n')}`
}

export function buildReflectSystemPrompt(): string {
  return `Answer the question using only the provided memories. If memories are insufficient, say so briefly.
Do not invent facts. Prefer recent memories when conflicting.`
}
