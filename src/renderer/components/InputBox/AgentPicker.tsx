import { Box, Text } from '@mantine/core'
import type { AgentDetail } from '@shared/types'
import { memo, type RefObject, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { navigateToSettings } from '@/modals/Settings'
import { fuzzyScoreAgent } from '@/packages/agents'
import ComposerPickerPanel from './ComposerPickerPanel'

export function filterAgents(agents: AgentDetail[], query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  return agents
    .map((agent) => {
      const haystack = [agent.name, agent.prompt?.slice(0, 120) || ''].join(' ')
      return {
        agent,
        score: fuzzyScoreAgent(haystack, normalizedQuery),
      }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.agent.name.localeCompare(b.agent.name))
    .map((item) => item.agent)
}

export interface AgentPickerProps {
  agents: AgentDetail[]
  highlightedIndex: number
  onHighlightChange(index: number): void
  onSelect(agent: AgentDetail): void
  query: string
  excludeIds?: string[]
  anchorRef: RefObject<HTMLElement | null>
}

function AgentPicker({
  agents,
  highlightedIndex,
  onHighlightChange,
  onSelect,
  query,
  excludeIds = [],
  anchorRef,
}: AgentPickerProps) {
  const { t } = useTranslation()
  const available = useMemo(() => {
    const exclude = new Set(excludeIds)
    return agents.filter((a) => !exclude.has(a.id))
  }, [agents, excludeIds])

  const filtered = useMemo(() => filterAgents(available, query).slice(0, 8), [available, query])
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
      aria-label={t('Agents')}
      header={
        <Text size="xs" c="chatbox-tertiary">
          {t('Agents')} · @
        </Text>
      }
      isEmpty={isEmpty}
      empty={
        catalogEmpty
          ? {
              title: t('No agents yet'),
              description: t('Create an agent to mention with @ in the composer.'),
              action: {
                label: t('Create agent'),
                onClick: () => navigateToSettings('/agents'),
              },
            }
          : {
              title: t('No agents found'),
            }
      }
    >
      {filtered.map((agent, index) => {
        const selected = index === highlightedIndex
        return (
          <Box
            key={agent.id}
            px="sm"
            py="xs"
            className="composer-picker-row cursor-pointer"
            data-selected={selected || undefined}
            bg={selected ? 'var(--chatbox-background-brand-secondary)' : undefined}
            onMouseEnter={() => onHighlightChange(index)}
            onMouseDown={(event) => {
              event.preventDefault()
              onSelect(agent)
            }}
          >
            <div className="flex items-start gap-1">
              <Text size="sm" className="mr-2 shrink-0">
                {agent.emojiAvatar || '🤖'}
              </Text>
              <div className="min-w-0">
                <Text size="sm" fw={500} className="truncate">
                  {agent.name}
                </Text>
                {agent.prompt ? (
                  <Text size="xs" c="chatbox-tertiary" className="truncate">
                    {agent.prompt.slice(0, 80)}
                  </Text>
                ) : null}
              </div>
            </div>
          </Box>
        )
      })}
    </ComposerPickerPanel>
  )
}

export default memo(AgentPicker)
