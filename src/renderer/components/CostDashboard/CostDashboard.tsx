/**
 * CostDashboard
 *
 * Displays prompt caching metrics for the current session:
 * - Badge showing estimated session cost
 * - Popover with cache hit rate, tokens saved, cost savings per provider
 */

import { Badge, Divider, Flex, Group, Popover, Progress, Stack, Text, Tooltip } from '@mantine/core'
import type { Message } from '@shared/types/session'
import { formatNumber } from '@shared/utils'
import { IconCoins } from '@tabler/icons-react'
import { type FC, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { aggregateSessionCosts, formatCost } from '@/packages/cost-tracking'

interface CostDashboardProps {
  messages: Message[]
}

const CostDashboard: FC<CostDashboardProps> = ({ messages }) => {
  const { t } = useTranslation()
  const [opened, setOpened] = useState(false)

  const metrics = useMemo(() => aggregateSessionCosts(messages), [messages])

  if (metrics.messagesWithUsage === 0) {
    return null
  }

  const hitRatePercent = Math.round(metrics.cacheHitRate * 100)
  const providerEntries = Object.values(metrics.byProvider)

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="bottom-end"
      shadow="md"
      width={320}
      withArrow
      transitionProps={{ transition: 'pop', duration: 200 }}
    >
      <Popover.Target>
        <Tooltip label={t('Session cost estimate')} withArrow>
          <Badge
            variant="light"
            color="chatbox-brand"
            size="sm"
            leftSection={<IconCoins size={12} />}
            className="cursor-pointer select-none"
            onClick={() => setOpened((o) => !o)}
          >
            {formatCost(metrics.actualCost)}
          </Badge>
        </Tooltip>
      </Popover.Target>

      <Popover.Dropdown>
        <Stack gap="xs">
          <Text size="sm" fw={600}>
            {t('Session Cost Estimate')}
          </Text>

          <Flex justify="space-between" align="center">
            <Text size="xs" c="dimmed">
              {t('Input tokens')}
            </Text>
            <Text size="xs" fw={500}>
              {formatNumber(metrics.totalInputTokens)}
            </Text>
          </Flex>

          <Flex justify="space-between" align="center">
            <Text size="xs" c="dimmed">
              {t('Output tokens')}
            </Text>
            <Text size="xs" fw={500}>
              {formatNumber(metrics.totalOutputTokens)}
            </Text>
          </Flex>

          {metrics.totalReasoningTokens > 0 && (
            <Flex justify="space-between" align="center">
              <Text size="xs" c="dimmed">
                {t('Reasoning tokens')}
              </Text>
              <Text size="xs" fw={500}>
                {formatNumber(metrics.totalReasoningTokens)}
              </Text>
            </Flex>
          )}

          <Divider />

          <Flex justify="space-between" align="center">
            <Text size="xs" c="dimmed">
              {t('Cache hit rate')}
            </Text>
            <Text size="xs" fw={500} c={hitRatePercent > 50 ? 'green' : hitRatePercent > 0 ? 'yellow' : 'dimmed'}>
              {hitRatePercent}%
            </Text>
          </Flex>

          {metrics.totalCachedInputTokens > 0 && (
            <Progress value={hitRatePercent} size="xs" color={hitRatePercent > 50 ? 'green' : 'yellow'} />
          )}

          <Flex justify="space-between" align="center">
            <Text size="xs" c="dimmed">
              {t('Cached tokens')}
            </Text>
            <Text size="xs" fw={500}>
              {formatNumber(metrics.totalCachedInputTokens)}
            </Text>
          </Flex>

          <Divider />

          <Flex justify="space-between" align="center">
            <Text size="xs" c="dimmed">
              {t('Cost without cache')}
            </Text>
            <Text size="xs" fw={500}>
              {formatCost(metrics.costWithoutCache)}
            </Text>
          </Flex>

          <Flex justify="space-between" align="center">
            <Text size="xs" fw={600}>
              {t('Estimated cost')}
            </Text>
            <Text size="xs" fw={600}>
              {formatCost(metrics.actualCost)}
            </Text>
          </Flex>

          {metrics.totalSavings > 0 && (
            <Flex justify="space-between" align="center">
              <Text size="xs" c="green">
                {t('Savings')}
              </Text>
              <Text size="xs" fw={500} c="green">
                {formatCost(metrics.totalSavings)} ({Math.round(metrics.savingsPercent)}%)
              </Text>
            </Flex>
          )}

          {providerEntries.length > 1 && (
            <>
              <Divider />
              <Text size="xs" fw={600}>
                {t('By provider')}
              </Text>
              {providerEntries.map((p) => (
                <Group key={p.provider} justify="space-between" gap="xs">
                  <Text size="xs" c="dimmed">
                    {p.provider}
                  </Text>
                  <Flex gap="xs" align="center">
                    <Text size="xs" fw={500}>
                      {formatCost(p.actualCost)}
                    </Text>
                    {p.savings > 0 && (
                      <Text size="xs" c="green">
                        (-{formatCost(p.savings)})
                      </Text>
                    )}
                  </Flex>
                </Group>
              ))}
            </>
          )}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  )
}

export default CostDashboard
