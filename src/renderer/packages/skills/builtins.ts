import type { SkillPackage } from '@shared/types'
import { parseSkillMd } from './parse-skill-md'

const CODE_REVIEW_MD = `---
name: code-review
description: Review code and pull requests for bugs, regressions, security, and maintainability. Use when the user asks to review code, PRs, diffs, or improve code quality.
---

# Code Review

You are performing a careful code review.

## Process
1. Identify the change scope and intent before nitpicking style.
2. Flag bugs, edge cases, security issues, and broken contracts first.
3. Note maintainability and test gaps after correctness issues.
4. Suggest concrete fixes with short reasoning.

## Output
- Lead with critical findings (if any)
- Use severity labels: critical / major / minor / nit
- Prefer actionable diffs or snippets over vague advice
- End with a short summary of overall risk
`

const WRITING_EDITOR_MD = `---
name: writing-editor
description: Polish and improve written content for clarity, tone, grammar, and structure. Use when editing emails, essays, docs, copy, or creative writing.
---

# Writing Editor

Help the user improve prose while preserving their intent and voice.

## Process
1. Clarify goal if needed: light proofread vs deep rewrite.
2. Fix grammar, clarity, and structure.
3. Show concrete edits; explain only the important changes.
4. Offer 1–2 tone variants when useful.

## Output
- Provide an improved version first
- Then list key changes briefly
- Match the user's language unless they ask otherwise
`

const DEEP_RESEARCH_MD = `---
name: deep-research
description: Research a topic thoroughly with structured evidence, cross-checking, and citations. Use when the user asks to research, investigate, compare sources, or write an evidence-based report.
---

# Deep Research

Conduct rigorous research and synthesize a clear report.

## Process
1. Break the question into sub-questions.
2. Gather evidence from multiple angles when tools/search are available.
3. Distinguish facts, inferences, and uncertainty.
4. Cite sources so the user can verify claims.
5. Assign confidence to major conclusions.

## Output
- Structured report with clear takeaways
- Inline or end references for key claims
- Explicit unknowns and what would change the conclusion
`

export function getBuiltinSkills(): SkillPackage[] {
  return [
    parseSkillMd(CODE_REVIEW_MD, { source: 'builtin', id: 'builtin:code-review', enabled: true }),
    parseSkillMd(WRITING_EDITOR_MD, { source: 'builtin', id: 'builtin:writing-editor', enabled: true }),
    parseSkillMd(DEEP_RESEARCH_MD, { source: 'builtin', id: 'builtin:deep-research', enabled: true }),
  ]
}
