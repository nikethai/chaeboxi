import { Box, Text } from '@mantine/core'
import type { SkillPackage } from '@shared/types'
import { memo, type RefObject, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { navigateToSettings } from '@/modals/Settings'
import { fuzzyScoreSkill } from '@/packages/skills'
import ComposerPickerPanel from './ComposerPickerPanel'

export function filterSkills(skills: SkillPackage[], query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  return skills
    .filter((s) => s.enabled)
    .map((skill) => {
      const haystack = [skill.name, skill.description, ...(skill.tags || [])].join(' ')
      return {
        skill,
        score: fuzzyScoreSkill(haystack, normalizedQuery),
      }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.skill.name.localeCompare(b.skill.name))
    .map((item) => item.skill)
}

export interface SkillPickerProps {
  skills: SkillPackage[]
  highlightedIndex: number
  onHighlightChange(index: number): void
  onSelect(skill: SkillPackage): void
  query: string
  excludeIds?: string[]
  anchorRef: RefObject<HTMLElement | null>
}

function SkillPicker({
  skills,
  highlightedIndex,
  onHighlightChange,
  onSelect,
  query,
  excludeIds = [],
  anchorRef,
}: SkillPickerProps) {
  const { t } = useTranslation()
  const available = useMemo(() => {
    const exclude = new Set(excludeIds)
    return skills.filter((s) => s.enabled && !exclude.has(s.id))
  }, [skills, excludeIds])

  const filtered = useMemo(() => filterSkills(available, query).slice(0, 8), [available, query])
  const catalogEmpty = available.length === 0
  const isEmpty = filtered.length === 0

  useEffect(() => {
    if (filtered.length === 0) return
    if (highlightedIndex >= filtered.length) {
      onHighlightChange(0)
    }
  }, [filtered.length, highlightedIndex, onHighlightChange])

  return (
    <ComposerPickerPanel
      anchorRef={anchorRef}
      open
      aria-label={t('Skills')}
      header={
        <Text size="xs" c="chatbox-tertiary">
          {t('Skills')} · $
        </Text>
      }
      isEmpty={isEmpty}
      empty={
        catalogEmpty
          ? {
              title: t('No skills yet'),
              description: t('Add or enable skills, then insert them with $ in the composer.'),
              action: {
                label: t('Manage skills'),
                onClick: () => navigateToSettings('/skills'),
              },
            }
          : {
              title: t('No skill found'),
            }
      }
    >
      {filtered.map((skill, index) => {
        const selected = index === highlightedIndex
        return (
          <Box
            key={skill.id}
            px="sm"
            py="xs"
            className="composer-picker-row cursor-pointer"
            data-selected={selected || undefined}
            bg={selected ? 'var(--chatbox-background-brand-secondary)' : undefined}
            onMouseEnter={() => onHighlightChange(index)}
            onMouseDown={(event) => {
              event.preventDefault()
              onSelect(skill)
            }}
          >
            <Text size="sm" fw={600} c={selected ? 'chatbox-brand' : 'chatbox-primary'}>
              ${skill.name}
            </Text>
            <Text size="xs" c="chatbox-secondary" lineClamp={1}>
              {skill.description}
            </Text>
          </Box>
        )
      })}
    </ComposerPickerPanel>
  )
}

export default memo(SkillPicker)
