import type { CopilotDetail } from '@shared/types'
import { useQuery } from '@tanstack/react-query'
import { useAtom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import * as remote from '@/packages/remote'
import storage, { StorageKey } from '@/storage'
import { useLanguage } from '@/stores/settingsStore'

export const myCopilotsAtom = atomWithStorage<CopilotDetail[]>(StorageKey.MyCopilots, [], storage)

const DEEP_RESEARCHER_COPILOT_ID = 'builtin:deep-researcher'
const BUILTIN_COPILOT_IDS = new Set<string>([DEEP_RESEARCHER_COPILOT_ID])

const DEEP_RESEARCHER_PROMPT = `You are Deep Researcher, a rigorous research copilot.

When solving a task:
1. Break the problem into focused sub-questions before answering.
2. Search systematically and gather evidence from multiple relevant sources.
3. Cross-check important claims across independent sources when possible.
4. Distinguish clearly between facts, inferences, and uncertainty.
5. Cite sources inline or in a references section so the user can verify key claims.
6. Assign confidence levels to major conclusions and explain what could change them.
7. Synthesize findings into a structured, concise report with clear takeaways.

When tools are available:
- Use web search proactively for time-sensitive or factual questions.
- Read linked pages instead of relying only on snippets.
- Prefer primary sources, official documentation, or reputable reporting.

Your default style:
- Precise, evidence-seeking, and methodical.
- Do not pretend certainty when evidence is weak or conflicting.
- Summaries should be clear, well-structured, and easy to skim.`

function buildBuiltInCopilots(t: (key: string) => string): CopilotDetail[] {
  return [
    {
      id: DEEP_RESEARCHER_COPILOT_ID,
      name: t('Deep Researcher'),
      emojiAvatar: '🔬',
      prompt: DEEP_RESEARCHER_PROMPT,
      starred: true,
      usedCount: 0,
      shared: false,
      builtIn: true,
      modelSettings: {
        temperature: 0.3,
      },
    },
  ]
}

export function getBuiltInCopilotById(id: string) {
  return buildBuiltInCopilots((key) => key).find((copilot) => copilot.id === id)
}

function mergeBuiltInCopilots(userCopilots: CopilotDetail[], builtInCopilots: CopilotDetail[]) {
  const overridesById = new Map(userCopilots.map((copilot) => [copilot.id, copilot]))

  const mergedBuiltIns = builtInCopilots.map((copilot) => ({
    ...copilot,
    ...overridesById.get(copilot.id),
    builtIn: true,
  }))

  const customCopilots = userCopilots.filter((copilot) => !BUILTIN_COPILOT_IDS.has(copilot.id))
  return [...mergedBuiltIns, ...customCopilots]
}

export function useMyCopilots() {
  const { t } = useTranslation()
  const [storedCopilots, setCopilots] = useAtom(myCopilotsAtom)
  const builtInCopilots = useMemo(() => buildBuiltInCopilots(t), [t])
  const copilots = useMemo(
    () => mergeBuiltInCopilots(storedCopilots, builtInCopilots),
    [builtInCopilots, storedCopilots]
  )

  const addOrUpdate = (target: CopilotDetail) => {
    setCopilots(async (prev) => {
      const copilots = await prev
      let found = false
      const newCopilots = copilots.map((c) => {
        if (c.id === target.id) {
          found = true
          return target
        }
        return c
      })
      if (!found) {
        newCopilots.push(target)
      }
      return newCopilots
    })
  }

  const remove = (id: string) => {
    if (BUILTIN_COPILOT_IDS.has(id)) {
      return
    }
    setCopilots(async (prev) => {
      const copilots = await prev
      return copilots.filter((c) => c.id !== id)
    })
  }

  return {
    copilots,
    addOrUpdate,
    remove,
  }
}

export function useRemoteCopilots() {
  const language = useLanguage()
  const { data: copilots, ...others } = useQuery({
    queryKey: ['remote-copilots', language],
    queryFn: () => remote.listCopilots(language),
    initialData: [],
    initialDataUpdatedAt: 0,
    staleTime: 3600 * 1000,
  })
  return { copilots, ...others }
}
