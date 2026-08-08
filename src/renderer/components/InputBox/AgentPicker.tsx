import { Box, Paper, Stack, Text } from '@mantine/core'
import type { AgentDetail } from '@shared/types'
import { memo, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { AgentAvatar } from '@/components/agents/AgentAvatar'
import { fuzzyScoreAgent } from '@/packages/agents'

export function filterAgents(agents: AgentDetail[], query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  return agents
    .map((agent) => {
      const haystack = [agent.name, agent.description || '', agent.prompt?.slice(0, 120) || ''].join(' ')
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
}

function AgentPicker({
  agents,
  highlightedIndex,
  onHighlightChange,
  onSelect,
  query,
  excludeIds = [],
}: AgentPickerProps) {
  const { t } = useTranslation()
  const filtered = useMemo(() => {
    const exclude = new Set(excludeIds)
    return filterAgents(
      agents.filter((a) => !exclude.has(a.id)),
      query
    ).slice(0, 8)
  }, [agents, query, excludeIds])

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
            {t('Agents')} · @
          </Text>
        </Box>

        {filtered.length > 0 ? (
          filtered.map((agent, index) => {
            const selected = index === highlightedIndex
            return (
              <Box
                key={agent.id}
                px="sm"
                py="xs"
                className="cursor-pointer"
                bg={selected ? 'var(--chatbox-background-brand-secondary)' : undefined}
                onMouseEnter={() => onHighlightChange(index)}
                onClick={() => onSelect(agent)}
              >
                <FlexRow>
                  <AgentAvatar size={22} agent={agent} className="mr-1" />
                  <div className="min-w-0">
                    <Text size="sm" fw={500} className="truncate">
                      {agent.name}
                    </Text>
                    {agent.description || agent.prompt ? (
                      <Text size="xs" c="chatbox-tertiary" className="truncate">
                        {(agent.description || agent.prompt || '').slice(0, 80)}
                      </Text>
                    ) : null}
                  </div>
                </FlexRow>
              </Box>
            )
          })
        ) : (
          <Box px="sm" py="md">
            <Text size="sm" c="chatbox-tertiary">
              {t('No agents found')}
            </Text>
          </Box>
        )}
      </Stack>
    </Paper>
  )
}

function FlexRow({ children }: { children: React.ReactNode }) {
  return <div className="flex items-start gap-1">{children}</div>
}

export default memo(AgentPicker)
