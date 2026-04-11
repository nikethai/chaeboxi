import { ActionIcon, Badge, Flex, Loader, Menu, Text, Tooltip, UnstyledButton } from '@mantine/core'
import { IconChevronRight, IconRefresh, IconRobot } from '@tabler/icons-react'
import { useAtom, useAtomValue } from 'jotai'
import { useCallback, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettingsStore } from '@/stores/settingsStore'
import { cn } from '@/lib/utils'
import { ScalableIcon } from '../common/ScalableIcon'
import ProviderIcon from '../icons/ProviderIcon'
import {
  openclawAgentsAtom,
  openclawGatewayStatusAtom,
  openclawSelectedAgentIdAtom,
} from '@/stores/atoms/openclawAtoms'
import type { AgentInfo } from '@shared/openclaw/gateway/types'
import { classifyCapabilityRisk, getCapabilityRiskColor, getCapabilityTooltip } from '@shared/openclaw/gateway'
import type { GatewayClientCreateOptions } from '@shared/models/openclaw'
import { getOrCreateGatewayClient } from '@shared/models/openclaw'

interface AgentSelectorProps {
  className?: string
  onSelectAgent?: (agentId: string) => void
  selectedAgentId?: string | null
  position?: 'top-end' | 'bottom-end' | 'top-start' | 'bottom-start'
}

async function fetchAgentsFromGateway(opts: GatewayClientCreateOptions): Promise<AgentInfo[]> {
  const client = getOrCreateGatewayClient(opts)
  await client.connect()
  const response = await client.listAgents()
  return response.agents.map((agent) => ({
    id: agent.id,
    name: agent.name,
    description: agent.description,
    capabilities: agent.capabilities,
  }))
}

export default function AgentSelector(props: AgentSelectorProps) {
  const { className, onSelectAgent, selectedAgentId, position = 'top-end' } = props
  const { t } = useTranslation()
  const [agents, setAgents] = useAtom(openclawAgentsAtom)
  const [selectedAgent, setSelectedAgent] = useAtom(openclawSelectedAgentIdAtom)
  const gatewayStatus = useAtomValue(openclawGatewayStatusAtom)

  const openclawSettings = useSettingsStore((state) => state.openclaw)
  const providerSettings = useSettingsStore((state) => state.providers?.['openclaw'])

  const activeGateway = useMemo(() => {
    if (!openclawSettings?.gateways) return null
    return openclawSettings.gateways.find((g) => g.isDefault) || openclawSettings.gateways[0]
  }, [openclawSettings])

  const apiHost = activeGateway?.url || providerSettings?.apiHost || 'http://127.0.0.1:18789'
  const apiKey = activeGateway?.token || providerSettings?.apiKey || ''
  const cloudflareClientId = activeGateway?.cloudflareClientId || providerSettings?.cloudflareClientId || ''
  const cloudflareClientSecret = activeGateway?.cloudflareClientSecret || providerSettings?.cloudflareClientSecret || ''

  const fetchAgents = useCallback(async () => {
    if (!apiHost) return
    try {
      const fetched = await fetchAgentsFromGateway({ apiHost, apiKey, cloudflareClientId, cloudflareClientSecret })
      setAgents(fetched)
    } catch (error) {
      console.error('[OpenClaw] Failed to fetch agents:', error)
    }
  }, [apiHost, apiKey, cloudflareClientId, cloudflareClientSecret, setAgents])

  useEffect(() => {
    if (gatewayStatus === 'connected' && agents.length === 0) {
      void fetchAgents()
    }
  }, [gatewayStatus, agents.length, fetchAgents])

  const currentAgent = useMemo(() => {
    const agentId = selectedAgentId ?? selectedAgent
    if (!agentId) return null
    return agents.find((a) => a.id === agentId) || null
  }, [selectedAgentId, selectedAgent, agents])

  const handleSelectAgent = useCallback(
    (agentId: string) => {
      setSelectedAgent(agentId)
      onSelectAgent?.(agentId)
    },
    [setSelectedAgent, onSelectAgent]
  )

  const displayText = currentAgent?.name || t('Select Agent')
  const isLoading = gatewayStatus === 'connecting'

  return (
    <Menu shadow="md" position={position} transitionProps={{ transition: 'fade-up', duration: 200 }} withArrow>
      <Menu.Target>
        <UnstyledButton
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-[var(--chatbox-background-tertiary)] transition-colors',
            className
          )}
        >
          {isLoading ? <Loader size={16} /> : <ProviderIcon size={18} provider="openclaw" />}
          <Text size="sm" className={cn('text-[var(--chatbox-tint-secondary)] truncate', 'max-w-[120px]')}>
            {displayText}
          </Text>
          <IconChevronRight size={14} className="text-[var(--chatbox-tint-tertiary)] rotate-90 flex-shrink-0" />
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <Flex justify="space-between" align="center" mb="xs">
          <Text size="xs" fw={600} c="chatbox-tertiary">
            {t('OpenClaw Agents')}
          </Text>
          <Tooltip label={t('Refresh agents')}>
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={() => void fetchAgents()}
              disabled={gatewayStatus !== 'connected'}
            >
              <ScalableIcon icon={IconRefresh} size={14} />
            </ActionIcon>
          </Tooltip>
        </Flex>
        {agents.length === 0 ? (
          <Flex direction="column" align="center" py="md" gap="xs">
            {gatewayStatus === 'connected' ? (
              <>
                <ScalableIcon icon={IconRobot} size={24} className="text-chatbox-tertiary" />
                <Text size="xs" c="chatbox-tertiary">
                  {t('No agents found')}
                </Text>
                <Text size="xs" c="chatbox-tertiary">
                  {t('Make sure OpenClaw is running')}
                </Text>
              </>
            ) : (
              <>
                <ScalableIcon icon={IconRobot} size={24} className="text-chatbox-tertiary" />
                <Text size="xs" c="chatbox-tertiary">
                  {gatewayStatus === 'disconnected' ? t('Gateway disconnected') : t('Gateway connecting...')}
                </Text>
              </>
            )}
          </Flex>
        ) : (
          agents.map((agent) => (
            <Menu.Item
              key={agent.id}
              onClick={() => handleSelectAgent(agent.id)}
              className={cn(
                selectedAgentId === agent.id || selectedAgent === agent.id
                  ? 'bg-[var(--chatbox-background-tertiary)]'
                  : ''
              )}
            >
              <Flex justify="space-between" align="flex-start" gap="xs" w="100%">
                <Flex direction="column" gap={4} style={{ flex: 1, minWidth: 0 }}>
                  <Text size="sm" fw={500} truncate="end">
                    {agent.name}
                  </Text>
                  {agent.description && (
                    <Text size="xs" c="chatbox-tertiary" lineClamp={2}>
                      {agent.description}
                    </Text>
                  )}
                </Flex>
                {agent.capabilities && agent.capabilities.length > 0 && (
                  <Flex gap={4} wrap="wrap" justify="flex-end">
                    {agent.capabilities.slice(0, 3).map((cap) => {
                      const risk = classifyCapabilityRisk(cap)
                      const color = getCapabilityRiskColor(risk)
                      const tooltip = getCapabilityTooltip(cap, risk)
                      const badge = (
                        <Badge key={cap} size="xs" variant="light" color={color}>
                          {cap}
                        </Badge>
                      )
                      return tooltip ? (
                        <Tooltip key={cap} label={tooltip} multiline w={220}>
                          {badge}
                        </Tooltip>
                      ) : (
                        badge
                      )
                    })}
                    {agent.capabilities.length > 3 && (
                      <Tooltip label={agent.capabilities.slice(3).join(', ')}>
                        <Badge size="xs" variant="light" color="chatbox-brand">
                          +{agent.capabilities.length - 3}
                        </Badge>
                      </Tooltip>
                    )}
                  </Flex>
                )}
              </Flex>
            </Menu.Item>
          ))
        )}
      </Menu.Dropdown>
    </Menu>
  )
}
