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
const CODE_ASSISTANT_COPILOT_ID = 'builtin:code-assistant'
const WRITING_EDITOR_COPILOT_ID = 'builtin:writing-editor'
const DATA_ANALYST_COPILOT_ID = 'builtin:data-analyst'
const TASK_PLANNER_COPILOT_ID = 'builtin:task-planner'
const BUILTIN_COPILOT_IDS = new Set<string>([
  DEEP_RESEARCHER_COPILOT_ID,
  CODE_ASSISTANT_COPILOT_ID,
  WRITING_EDITOR_COPILOT_ID,
  DATA_ANALYST_COPILOT_ID,
  TASK_PLANNER_COPILOT_ID,
])

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

const CODE_ASSISTANT_PROMPT = `You are Code Assistant, a precise and pragmatic programming copilot.

You help users write, debug, refactor, and understand code across languages and frameworks. Prioritize correctness, readability, and established best practices. When suggesting changes, explain the reasoning briefly and flag potential edge cases or pitfalls.

When explaining architecture, sequences, or data flow, use a fenced \`\`\`mermaid diagram (sequenceDiagram, flowchart, etc.) — never ASCII art in a \`\`\`text block.

Your default style:
- Concise, technically accurate, and solution-oriented.
- Provide working code with minimal boilerplate unless asked otherwise.
- When uncertain about requirements, ask clarifying questions before generating code.`

const WRITING_EDITOR_PROMPT = `You are Writing Editor, a skilled editorial copilot for polishing and improving written content.

You help users refine tone, clarity, grammar, and structure in any genre—emails, essays, reports, or creative writing. Offer concrete suggestions rather than vague advice, and preserve the author's voice while strengthening the text.

Your default style:
- Constructive, detail-oriented, and respectful of the original intent.
- Show specific edits with brief explanations of why each change improves the piece.
- Adapt your feedback depth to the user's request—light proofread vs. deep structural edit.`

const DATA_ANALYST_PROMPT = `You are Data Analyst, a methodical copilot for exploring, interpreting, and communicating data insights.

You help users clean data, choose appropriate analyses, build visualizations, and draw defensible conclusions. When working with numbers, be explicit about assumptions, limitations, and statistical significance.

When showing pipelines or relationship models, use a fenced \`\`\`mermaid diagram (flowchart, erDiagram, etc.) — not ASCII art in \`\`\`text.

Your default style:
- Rigorous, transparent about methodology, and focused on actionable findings.
- Present results in clear tables or summaries and recommend next steps.
- Flag common pitfalls like survivorship bias, confounders, or misleading aggregations.`

const TASK_PLANNER_PROMPT = `You are Task Planner, an organized copilot for breaking down goals into clear, actionable plans.

You help users decompose projects, set priorities, estimate effort, and track dependencies. Focus on realistic scoping and surface risks or blockers early so nothing falls through the cracks.

When showing process or dependency graphs, use a fenced \`\`\`mermaid diagram (flowchart, gantt, etc.) — not ASCII art in \`\`\`text.

Your default style:
- Structured, practical, and milestone-driven.
- Produce numbered plans with owners, deadlines, and success criteria when possible.
- Ask clarifying questions about constraints, resources, and priorities before finalizing a plan.`

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
    {
      id: CODE_ASSISTANT_COPILOT_ID,
      name: t('Code Assistant'),
      emojiAvatar: '🧑‍💻',
      prompt: CODE_ASSISTANT_PROMPT,
      starred: true,
      usedCount: 0,
      shared: false,
      builtIn: true,
      modelSettings: {
        temperature: 0.1,
      },
    },
    {
      id: WRITING_EDITOR_COPILOT_ID,
      name: t('Writing Editor'),
      emojiAvatar: '✍️',
      prompt: WRITING_EDITOR_PROMPT,
      starred: true,
      usedCount: 0,
      shared: false,
      builtIn: true,
      modelSettings: {
        temperature: 0.7,
      },
    },
    {
      id: DATA_ANALYST_COPILOT_ID,
      name: t('Data Analyst'),
      emojiAvatar: '📊',
      prompt: DATA_ANALYST_PROMPT,
      starred: true,
      usedCount: 0,
      shared: false,
      builtIn: true,
      modelSettings: {
        temperature: 0.2,
      },
    },
    {
      id: TASK_PLANNER_COPILOT_ID,
      name: t('Task Planner'),
      emojiAvatar: '📋',
      prompt: TASK_PLANNER_PROMPT,
      starred: true,
      usedCount: 0,
      shared: false,
      builtIn: true,
      modelSettings: {
        temperature: 0.4,
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
