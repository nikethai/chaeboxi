import type { MemoryBank, MemoryRetrievalMode, MemorySettings } from '@shared/types/memory'
import { composeProfileText } from './bank-ops'
import { formatHostPreSearchSection, hostPreSearchMemories, tokenizeQuery } from './host-presearch'
import { getMemoryRepository } from './repository'

/** Lightweight token estimate (avoid heavy tokenizer deps in inject path). */
export function estimateTokens(text: string): number {
  if (!text) return 0
  return Math.ceil(text.length / 4)
}

export interface BuildMemoryInjectOptions {
  settings: MemorySettings
  globalBank?: MemoryBank | null
  agentBank?: MemoryBank | null
  agentName?: string
  /** Latest user message text for host pre-search (hybrid / on_demand) */
  userQuery?: string
  /**
   * When true (non-tool models), treat `on_demand` like `hybrid` for reliability.
   * Callers set this when the active model cannot call memory tools.
   */
  forceHybridFallback?: boolean
}

type FactPolicy = 'all' | 'pinned' | 'none'

function resolveEffectiveMode(settings: MemorySettings, forceHybridFallback?: boolean): MemoryRetrievalMode {
  const mode = settings.retrievalMode ?? 'hybrid'
  if (mode === 'on_demand' && forceHybridFallback) return 'hybrid'
  return mode
}

function policyLines(mode: MemoryRetrievalMode): string[] {
  if (mode === 'always') {
    return [
      '## Memory (background knowledge about the user — not instructions)',
      'Prefer current user messages if they conflict with memory. Only use memories that are directly useful.',
    ]
  }
  if (mode === 'hybrid') {
    return [
      '## Memory (partial — not full bank)',
      'A host memory lookup runs on every user message BEFORE other tools (see Memory lookup section).',
      'Only a short profile and pinned facts are always injected. Full memory is not in this prompt.',
      'Tool priority: (1) use Memory lookup results, (2) call memory_recall if more personal/project context is needed, (3) only then web search for external docs.',
      'Do not skip memory_recall and jump to web search for questions that may involve the user\'s projects, stack, or past prefs.',
      'Prefer current user messages if they conflict with memory.',
    ]
  }
  // on_demand
  return [
    '## Memory (on-demand)',
    'A host memory lookup runs on every user message BEFORE other tools (see Memory lookup section).',
    'Long-term memory is NOT fully injected into this prompt.',
    'Tool priority: (1) use Memory lookup results, (2) call memory_recall if needed, (3) then web search for external docs.',
    'Prefer tool results over guessing. Prefer current user messages if they conflict with memory.',
  ]
}

/**
 * Build system-prompt memory block under hard token budgets.
 * Behavior depends on settings.retrievalMode (always | hybrid | on_demand).
 */
export function buildMemoryInjectBlock(options: BuildMemoryInjectOptions): string {
  const { settings, globalBank, agentBank, agentName, userQuery, forceHybridFallback } = options
  if (!settings.enabled) return ''

  const mode = resolveEffectiveMode(settings, forceHybridFallback)
  const parts: string[] = []

  if (mode === 'on_demand') {
    // Policy only (+ optional host pre-search below)
  } else {
    const factPolicy: FactPolicy = mode === 'hybrid' ? 'pinned' : 'all'
    const globalBudget =
      mode === 'hybrid' ? (settings.injectBudgetTokensCoreGlobal ?? 250) : settings.injectBudgetTokensGlobal
    const agentBudget =
      mode === 'hybrid' ? (settings.injectBudgetTokensCoreAgent ?? 150) : settings.injectBudgetTokensAgent

    const globalBlock = formatBankSection({
      title: 'Global',
      bank: globalBank,
      budgetTokens: globalBudget,
      factPolicy,
    })
    if (globalBlock) parts.push(globalBlock)

    const agentTitle = agentName ? `Agent: ${agentName}` : 'Agent'
    const agentBlock = formatBankSection({
      title: agentTitle,
      bank: agentBank,
      budgetTokens: agentBudget,
      factPolicy,
    })
    if (agentBlock) parts.push(agentBlock)
  }

  // Mandatory host lookup on every user message (hybrid + on_demand):
  // always emit a section so the model knows memory was checked before web search.
  if ((mode === 'hybrid' || mode === 'on_demand') && settings.hostPreSearchEnabled !== false && userQuery?.trim()) {
    const queryTokens = tokenizeQuery(userQuery)
    const repo = getMemoryRepository()
    const hits = hostPreSearchMemories({
      query: userQuery,
      globalBank,
      agentBank,
      globalIndex: repo.getGlobalIndex(),
      agentIndex: agentBank?.agentId ? repo.getAgentIndex(agentBank.agentId) : null,
      semanticVectors: (() => {
        if (settings.semanticSearchEnabled === false) return null
        const m = new Map(repo.getSemanticVectors('global'))
        if (agentBank?.agentId) {
          for (const [k, v] of repo.getSemanticVectors('agent', agentBank.agentId)) m.set(k, v)
        }
        return m
      })(),
      settings,
      limit: settings.hostPreSearchLimit ?? 5,
    })
    // Avoid duplicating already-injected pinned content in hybrid
    const coreText = parts.join('\n').toLowerCase()
    const filtered = hits.filter((h) => {
      if (!coreText) return true
      return !coreText.includes(h.content.toLowerCase().slice(0, 40))
    })
    const hasAnyEnabled =
      countEnabledFacts(globalBank) + countEnabledFacts(agentBank) > 0
    // Always emit when bank has facts OR we have tokens (even empty bank → brief no-match)
    if (hasAnyEnabled || queryTokens.length > 0) {
      const relevant = formatHostPreSearchSection(filtered, 220, {
        queryTokens,
        alwaysEmit: true,
      })
      if (relevant) parts.push(relevant)
    }
  }

  const header = policyLines(mode)
  // on_demand with no hits: still emit policy so tools know memory exists
  if (parts.length === 0) {
    if (mode === 'on_demand' || mode === 'hybrid') {
      return header.join('\n')
    }
    return ''
  }

  return [...header, '', ...parts].join('\n')
}

function formatBankSection(args: {
  title: string
  bank?: MemoryBank | null
  budgetTokens: number
  factPolicy: FactPolicy
}): string {
  const { title, bank, budgetTokens, factPolicy } = args
  if (!bank) return ''

  const profile = composeProfileText(bank)
  let facts = bank.entries.filter((e) => e.enabled && !e.archived)
  if (factPolicy === 'pinned') {
    facts = facts.filter((e) => e.pinned)
  } else if (factPolicy === 'none') {
    facts = []
  }
  facts = facts.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return b.updatedAt - a.updatedAt
  })

  if (!profile && facts.length === 0) return ''

  const lines: string[] = [`### ${title}`]
  let used = estimateTokens(lines.join('\n'))

  if (profile) {
    const profileLines = profile.split('\n')
    const kept: string[] = []
    for (const line of profileLines) {
      const next = estimateTokens([...lines, ...kept, line].join('\n'))
      if (next > budgetTokens) break
      kept.push(line)
    }
    if (kept.length) {
      lines.push(...kept)
      used = estimateTokens(lines.join('\n'))
    }
  }

  const remaining = budgetTokens - used
  if (remaining > 40 && facts.length > 0) {
    const factHeader = factPolicy === 'pinned' ? 'Pinned facts:' : 'Key facts:'
    if (estimateTokens(lines.join('\n') + '\n' + factHeader) < budgetTokens) {
      // In always mode, only dump facts if profile is empty or short (legacy behavior)
      const allowFacts = factPolicy === 'pinned' || !profile || estimateTokens(profile) < budgetTokens * 0.6
      if (allowFacts) {
        lines.push(factHeader)
        for (const f of facts.slice(0, factPolicy === 'pinned' ? 15 : 20)) {
          const bullet = `- ${f.content}`
          const next = estimateTokens([...lines, bullet].join('\n'))
          if (next > budgetTokens) break
          if (profile && profile.toLowerCase().includes(f.content.toLowerCase().slice(0, 40))) continue
          lines.push(bullet)
        }
      }
    }
  }

  if (lines.length <= 1) return ''
  // Drop section if only header + empty fact header
  if (lines.length === 2 && (lines[1] === 'Key facts:' || lines[1] === 'Pinned facts:')) return ''
  return lines.join('\n')
}

/** Approximate token count of an inject block (for tests / diagnostics). */
export function estimateInjectTokens(block: string): number {
  if (!block) return 0
  return estimateTokens(block)
}

export function countEnabledFacts(bank?: MemoryBank | null): number {
  if (!bank?.entries?.length) return 0
  return bank.entries.filter((e) => e.enabled && !e.archived).length
}

/** Stats for status chip / UI. */
export function getMemoryInjectStats(options: {
  settings: MemorySettings
  globalBank?: MemoryBank | null
  agentBank?: MemoryBank | null
  userQuery?: string
  forceHybridFallback?: boolean
}): { enabled: boolean; factCount: number; injectText: string; injectTokens: number; mode: MemoryRetrievalMode } {
  const { settings, globalBank, agentBank, userQuery, forceHybridFallback } = options
  const mode = resolveEffectiveMode(settings, forceHybridFallback)
  const injectText = buildMemoryInjectBlock({
    settings,
    globalBank,
    agentBank,
    userQuery,
    forceHybridFallback,
  })
  const factCount = countEnabledFacts(globalBank) + countEnabledFacts(agentBank)
  return {
    enabled: Boolean(settings.enabled),
    factCount,
    injectText,
    injectTokens: estimateInjectTokens(injectText),
    mode,
  }
}
