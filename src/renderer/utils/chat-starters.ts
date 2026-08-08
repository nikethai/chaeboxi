/**
 * Shared conversation starters for blank home + empty session thread.
 * Fill text is English source for the composer; titles/hints are i18n keys via t().
 */

export type ChatStarter = {
  n: string
  /** i18n key or already-translated title (callers pass t()) */
  title: string
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
  titleKey: string
  hintKey: string
  fill: string
}

export const CHAT_STARTER_DEFS: ChatStarterDef[] = [
  {
    n: '01',
    titleKey: 'Trace session store modules',
    hintKey: 'Architecture · TypeScript',
    fill: CHAT_STARTER_FILLS['01'],
  },
  {
    n: '02',
    titleKey: 'PR: kill MUI drawer',
    hintKey: 'Write-up · shipping note',
    fill: CHAT_STARTER_FILLS['02'],
  },
  {
    n: '03',
    titleKey: 'Stream cancel race',
    hintKey: 'Debug · concurrency',
    fill: CHAT_STARTER_FILLS['03'],
  },
  {
    n: '04',
    titleKey: 'Composer context meter',
    hintKey: 'UX · tokens',
    fill: CHAT_STARTER_FILLS['04'],
  },
]

export function buildChatStarters(t: (key: string) => string): ChatStarter[] {
  return CHAT_STARTER_DEFS.map((d) => ({
    n: d.n,
    title: t(d.titleKey),
    hint: t(d.hintKey),
    fill: d.fill,
  }))
}

/** True when the thread has nothing the user would read as conversation yet */
export function isThreadVisuallyEmpty(messages: ReadonlyArray<{ role?: string; isSummary?: boolean }>): boolean {
  return !messages.some((m) => m.role === 'user' || m.role === 'assistant')
}
