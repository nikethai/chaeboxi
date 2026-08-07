import { Box, Paper, Stack, Text } from '@mantine/core'
import type { SkillPackage } from '@shared/types'
import { memo, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { fuzzyScoreSkill } from '@/packages/skills'

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
}

function SkillPicker({
  skills,
  highlightedIndex,
  onHighlightChange,
  onSelect,
  query,
  excludeIds = [],
}: SkillPickerProps) {
  const { t } = useTranslation()
  const filtered = useMemo(() => {
    const exclude = new Set(excludeIds)
    return filterSkills(
      skills.filter((s) => !exclude.has(s.id)),
      query
    ).slice(0, 8)
  }, [skills, query, excludeIds])

  useEffect(() => {
    if (filtered.length === 0) return
    if (highlightedIndex >= filtered.length) {
      onHighlightChange(0)
    }
  }, [filtered.length, highlightedIndex, onHighlightChange])

  return (
    <Paper
      shadow="md"
      radius="md"
      withBorder
      className="absolute left-0 right-0 bottom-full mb-2 overflow-hidden z-50"
      style={{ backgroundColor: 'var(--chatbox-background-primary)' }}
    >
      <Stack gap={0}>
        <Box px="sm" py="xs" style={{ borderBottom: '1px solid var(--chatbox-border-primary)' }}>
          <Text size="xs" c="chatbox-tertiary">
            {t('Skills')} · $
          </Text>
        </Box>

        {filtered.length > 0 ? (
          filtered.map((skill, index) => {
            const selected = index === highlightedIndex
            return (
              <Box
                key={skill.id}
                px="sm"
                py="xs"
                className="cursor-pointer"
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
          })
        ) : (
          <Box px="sm" py="md">
            <Text size="sm" c="chatbox-tertiary">
              {t('No skill found')}
            </Text>
          </Box>
        )}
      </Stack>
    </Paper>
  )
}

export default memo(SkillPicker)
