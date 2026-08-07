import {
  SKILL_AUTO_MAX,
  SKILL_CATALOG_MAX,
  SKILL_EXPLICIT_MAX,
  type SkillActivation,
  type SkillPackage,
} from '@shared/types'

/** Minimum score for a skill to auto-activate (explicit tags ignore this). */
export const SKILL_AUTO_MIN_SCORE = 6

/**
 * Second auto skill only if score >= this fraction of the top skill's score
 * and still above SKILL_AUTO_MIN_SCORE.
 */
export const SKILL_AUTO_SECOND_RATIO = 0.85

export interface ResolveSkillActivationsInput {
  /** Skill package ids from $ chips / message.skillIds */
  explicitSkillIds?: string[]
  /** Session-pinned skill ids */
  pinnedSkillIds?: string[]
  /** User message text for auto scoring */
  userText?: string
  /** When false, skip auto selection. Default true. */
  autoSkills?: boolean
  /** All known skill packages (enabled + disabled; disabled filtered out) */
  skills: SkillPackage[]
  /** Max forced (explicit + session) activations */
  explicitMax?: number
  /** Max auto activations */
  autoMax?: number
}

/**
 * Resolve which skills activate for a turn.
 * Priority: explicit > session pin > auto. Dedupes by skill id.
 */
export function resolveSkillActivations(input: ResolveSkillActivationsInput): SkillActivation[] {
  const byId = new Map(input.skills.map((s) => [s.id, s]))
  const byName = new Map(input.skills.map((s) => [s.name.toLowerCase(), s]))
  const enabled = input.skills.filter((s) => s.enabled)

  const forcedMax = input.explicitMax ?? SKILL_EXPLICIT_MAX
  const autoMax = input.autoMax ?? SKILL_AUTO_MAX
  const seen = new Set<string>()
  const result: SkillActivation[] = []

  const resolveRef = (ref: string): SkillPackage | undefined => {
    return byId.get(ref) || byName.get(ref.toLowerCase())
  }

  const tryPush = (ref: string | undefined, mode: SkillActivation['mode']) => {
    if (!ref) return
    const skill = resolveRef(ref)
    if (!skill?.enabled || seen.has(skill.id)) return

    if (mode === 'auto') {
      const autoCount = result.filter((a) => a.mode === 'auto').length
      if (autoCount >= autoMax) return
    } else {
      const forcedCount = result.filter((a) => a.mode !== 'auto').length
      if (forcedCount >= forcedMax) return
    }

    seen.add(skill.id)
    result.push({ skillId: skill.id, name: skill.name, mode })
  }

  for (const id of input.explicitSkillIds || []) {
    tryPush(id, 'explicit')
  }

  for (const id of input.pinnedSkillIds || []) {
    tryPush(id, 'session')
  }

  const autoOn = input.autoSkills !== false
  if (autoOn && input.userText?.trim()) {
    const ranked = scoreSkillsForText(input.userText, enabled).filter((s) => s.score >= SKILL_AUTO_MIN_SCORE)
    if (ranked.length > 0) {
      const top = ranked[0]
      tryPush(top.skill.id, 'auto')
      // Only add more auto skills if they are nearly as strong as the top match
      for (let i = 1; i < ranked.length; i++) {
        const next = ranked[i]
        if (next.score < top.score * SKILL_AUTO_SECOND_RATIO) break
        tryPush(next.skill.id, 'auto')
        if (result.filter((a) => a.mode === 'auto').length >= autoMax) break
      }
    }
  }

  return result
}

/**
 * Intent-weighted skill scoring.
 * Prefers dedicated trigger keywords over generic description bag-of-words.
 */
export function scoreSkillsForText(
  text: string,
  skills: SkillPackage[]
): Array<{ skill: SkillPackage; score: number }> {
  const lower = text.toLowerCase()
  const tokens = tokenize(text)
  if (tokens.size === 0) return []

  return skills
    .map((skill) => {
      let score = 0

      // Strong: explicit skill name mention
      const nameSpaced = skill.name.replace(/-/g, ' ')
      if (lower.includes(skill.name) || lower.includes(nameSpaced)) {
        score += 12
      }

      // Strong: intent triggers for this skill
      for (const phrase of getSkillIntentPhrases(skill)) {
        if (lower.includes(phrase)) {
          score += phrase.includes(' ') ? 8 : 5
        }
      }

      // Weak: token overlap with description (capped so it cannot force activation alone)
      const hay = tokenize(`${skill.name.replace(/-/g, ' ')} ${skill.description}`)
      let overlap = 0
      for (const t of tokens) {
        if (STOPWORDS.has(t)) continue
        if (hay.has(t)) {
          overlap += t.length >= 5 ? 1.5 : 1
        }
      }
      score += Math.min(overlap, 4)

      return { skill, score }
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.skill.name.localeCompare(b.skill.name))
}

/** High-signal phrases that should drive auto selection. */
function getSkillIntentPhrases(skill: SkillPackage): string[] {
  const byName: Record<string, string[]> = {
    'code-review': [
      'code review',
      'review this pr',
      'review the pr',
      'review my pr',
      'pull request',
      'review code',
      'review this code',
      'review the code',
      'review this diff',
      'code quality',
      'find bugs',
      'security issue',
      'regression',
    ],
    'writing-editor': [
      'grammar',
      'proofread',
      'proof read',
      'rewrite',
      'rephrase',
      'edit my',
      'improve writing',
      'improve this text',
      'improve this email',
      'polish',
      'typo',
      'spelling',
      'tone',
      'wording',
      'correct grammar',
      'fix grammar',
      'make this clearer',
      'copyedit',
      'copy edit',
    ],
    'deep-research': [
      'research',
      'investigate',
      'deep dive',
      'cite sources',
      'with citations',
      'compare sources',
      'literature review',
      'evidence-based',
      'evidence based',
      'find sources',
      'what does the latest',
    ],
  }

  const fromName = byName[skill.name] || []
  // Also pull "Use when …" style keywords from description if present
  const fromDesc = extractUseWhenKeywords(skill.description)
  return [...fromName, ...fromDesc]
}

function extractUseWhenKeywords(description: string): string[] {
  const match = description.match(/use when[:\s]+(.+)/i)
  if (!match) return []
  return match[1]
    .split(/,| or | and |\./)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length >= 4 && s.length <= 40)
}

const STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'that',
  'this',
  'from',
  'your',
  'you',
  'are',
  'was',
  'were',
  'have',
  'has',
  'had',
  'will',
  'can',
  'could',
  'should',
  'would',
  'when',
  'what',
  'which',
  'who',
  'how',
  'why',
  'into',
  'about',
  'than',
  'then',
  'them',
  'they',
  'their',
  'using',
  'used',
  'use',
  'page',
  'site',
  'http',
  'https',
  'www',
  'com',
])

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 3)
  )
}

/**
 * Pick a short L1 catalog for system inject (protect context when hundreds of agent skills exist).
 * Priority: active → non-agent enabled → agent enabled (capped).
 */
export function selectCatalogForInject(
  all: SkillPackage[],
  activations: SkillActivation[],
  max = SKILL_CATALOG_MAX
): SkillPackage[] {
  const enabled = all.filter((s) => s.enabled)
  const byId = new Map(enabled.map((s) => [s.id, s]))
  const picked: SkillPackage[] = []
  const seen = new Set<string>()

  const push = (s?: SkillPackage) => {
    if (!s || seen.has(s.id) || picked.length >= max) return
    seen.add(s.id)
    picked.push(s)
  }

  for (const act of activations) {
    push(byId.get(act.skillId) || enabled.find((s) => s.name === act.name))
  }

  for (const s of enabled.filter((x) => x.source !== 'agent')) {
    push(s)
  }
  for (const s of enabled.filter((x) => x.source === 'agent')) {
    push(s)
  }

  return picked
}

/**
 * Build progressive-disclosure system context for skills.
 */
export function buildSkillContextBlocks(
  catalog: SkillPackage[],
  activations: SkillActivation[],
  packagesById: Map<string, SkillPackage>
): string {
  const catalogEnabled = catalog.filter((s) => s.enabled)
  if (catalogEnabled.length === 0 && activations.length === 0) {
    return ''
  }

  const parts: string[] = []

  if (catalogEnabled.length > 0) {
    parts.push('## Available skills')
    parts.push(
      'Skills are optional procedures. Follow Active skills when present. Prefer matching skills when relevant. Do not invent skill names. More skills may exist; user can tag with $name.'
    )
    for (const s of catalogEnabled) {
      const origin = s.origin && s.source === 'agent' ? ` [${s.origin}]` : ''
      parts.push(`- ${s.name}${origin}: ${s.description}`)
    }
  }

  if (activations.length > 0) {
    parts.push('')
    parts.push('## Active skills for this turn')
    for (const act of activations) {
      const pkg = packagesById.get(act.skillId)
      if (!pkg) continue
      parts.push(`### skill: ${pkg.name} [${act.mode}]`)
      parts.push(pkg.instructions.trim() || '(no instructions)')
      parts.push('')
    }
  }

  return parts.join('\n').trim()
}
