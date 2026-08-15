import { Table, Text } from '@mantine/core'
import { formatNumber } from '@shared/utils'
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { formatCost, SPEND_PRICE_PROVIDER_LABELS } from '@/packages/cost-tracking'
import type { ProviderModelSpend } from '@/packages/usage-tracking'

export const SpendBreakdown: FC<{
  rows: ProviderModelSpend[]
}> = ({ rows }) => {
  const { t } = useTranslation()
  if (rows.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        {t('No local usage in this period yet.')}
      </Text>
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table striped highlightOnHover withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t('Provider')}</Table.Th>
            <Table.Th>{t('Model')}</Table.Th>
            <Table.Th ta="right">{t('Tokens')}</Table.Th>
            <Table.Th ta="right">{t('Est. $')}</Table.Th>
            <Table.Th ta="right">{t('Messages')}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((row) => {
            const tokens = row.inputTokens + row.outputTokens
            return (
              <Table.Tr key={`${row.providerId}:${row.modelId}`}>
                <Table.Td>{SPEND_PRICE_PROVIDER_LABELS[row.providerId] ?? row.providerId}</Table.Td>
                <Table.Td className="font-mono text-xs">{row.modelId}</Table.Td>
                <Table.Td ta="right" className="font-mono">
                  {formatNumber(tokens)}
                </Table.Td>
                <Table.Td ta="right" className="font-mono">
                  {row.estimatedCostUsd > 0 ? formatCost(row.estimatedCostUsd) : t('Tokens only')}
                </Table.Td>
                <Table.Td ta="right">{row.messageCount}</Table.Td>
              </Table.Tr>
            )
          })}
        </Table.Tbody>
      </Table>
    </div>
  )
}
