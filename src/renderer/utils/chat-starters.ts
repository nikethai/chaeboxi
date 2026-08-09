/**
 * Shared conversation starters for blank home + empty session thread.
 * Short chip labels (Gemini-style); fill text is English source for the composer.
 */

export type ChatStarter = {
  n: string
  /** Short chip label — already translated when built via t() */
  title: string
  /** @deprecated kept for tests/back-compat; chips no longer show hints */
  hint: string
  /** Text inserted into the composer */
  fill: string
}

/** English fill prompts — stable product copy for the input box */
export const CHAT_STARTER_FILLS = {
  '01': 'Map the session store modules and call out circular deps.',
  '02': 'Draft a PR description for replacing the MUI drawer with a custom rail.',
  '03': 'Debug intermittent stream cancel when switching models mid-response.',
  '04': 'Propose token budget UI for the composer context meter.',
} as const

export type ChatStarterId = keyof typeof CHAT_STARTER_FILLS

export type ChatStarterDef = {
  n: ChatStarterId
  /** Short chip label i18n key */
  titleKey: string
  fill: string
}

/** Gemini-style: short action labels, not essay titles */
export const CHAT_STARTER_DEFS: ChatStarterDef[] = [
  {
    n: '01',
    titleKey: 'Review code',
    fill: CHAT_STARTER_FILLS['01'],
  },
  {
    n: '02',
    titleKey: 'Write a PR',
    fill: CHAT_STARTER_FILLS['02'],
  },
  {
    n: '03',
    titleKey: 'Debug issue',
    fill: CHAT_STARTER_FILLS['03'],
  },
  {
    n: '04',
    titleKey: 'Plan a feature',
    fill: CHAT_STARTER_FILLS['04'],
  },
]

export function buildChatStarters(t: (key: string) => string): ChatStarter[] {
  return CHAT_STARTER_DEFS.map((d) => ({
    n: d.n,
    title: t(d.titleKey),
    hint: '',
    fill: d.fill,
  }))
}

/** True when the thread has nothing the user would read as conversation yet */
export function isThreadVisuallyEmpty(messages: ReadonlyArray<{ role?: string; isSummary?: boolean }>): boolean {
  return !messages.some((m) => m.role === 'user' || m.role === 'assistant')
}
