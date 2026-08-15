import { Button, Flex, NumberInput, Stack, Table, Text, TextInput } from '@mantine/core'
import { useMemo, useState, type FC } from 'react'
import { useTranslation } from 'react-i18next'
import { SettingsCard } from '@/components/settings/SettingsCard'
import {
  listPriceTableRows,
  removePricingOverride,
  upsertPricingOverride,
  type ModelPricing,
} from '@/packages/cost-tracking'
import { useSettingsStore } from '@/stores/settingsStore'

export const PriceTableSettings: FC = () => {
  const { t } = useTranslation()
  const setSettings = useSettingsStore((s) => s.setSettings)
  const overrides = useSettingsStore((s) => s.usagePricingOverrides)
  const rows = useMemo(() => listPriceTableRows(overrides), [overrides])
  const [newProvider, setNewProvider] = useState('deepseek')
  const [newModel, setNewModel] = useState('')
  const [newInput, setNewInput] = useState<number | ''>('')
  const [newOutput, setNewOutput] = useState<number | ''>('')
  const [newCached, setNewCached] = useState<number | ''>('')

  const writeOverride = (providerId: string, modelId: string, pricing: ModelPricing) => {
    setSettings({ usagePricingOverrides: upsertPricingOverride(overrides, providerId, modelId, pricing) })
  }

  const resetRow = (providerId: string, modelId: string) => {
    setSettings({ usagePricingOverrides: removePricingOverride(overrides, providerId, modelId) })
  }

  const addRow = () => {
    const modelId = newModel.trim()
    if (!modelId || typeof newInput !== 'number' || typeof newOutput !== 'number') return
    writeOverride(newProvider.trim() || 'custom', modelId, {
      input: newInput,
      output: newOutput,
      cachedInput: typeof newCached === 'number' ? newCached : 0,
    })
    setNewModel('')
    setNewInput('')
    setNewOutput('')
    setNewCached('')
  }

  return (
    <SettingsCard>
      <Stack gap="md">
        <div>
          <Text fw={600}>{t('Price table')}</Text>
          <Text size="sm" c="dimmed">
            {t(
              'Built-in USD per 1M tokens for OpenAI, Anthropic, Gemini, DeepSeek, OpenRouter, and Qwen. Edit a row to override. Missing models show tokens only — never a made-up dollar amount.'
            )}
          </Text>
        </div>
        <div className="overflow-x-auto">
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('Provider')}</Table.Th>
                <Table.Th>{t('Model')}</Table.Th>
                <Table.Th>{t('Input / 1M')}</Table.Th>
                <Table.Th>{t('Output / 1M')}</Table.Th>
                <Table.Th>{t('Cached / 1M')}</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((row) => (
                <Table.Tr key={`${row.providerId}:${row.modelId}`}>
                  <Table.Td>
                    <Text size="sm">{row.providerLabel}</Text>
                    {row.source === 'override' && (
                      <Text size="xs" c="dimmed">
                        {t('Edited')}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td className="font-mono text-xs">{row.modelId}</Table.Td>
                  <Table.Td>
                    <NumberInput
                      size="xs"
                      value={row.pricing.input}
                      decimalScale={4}
                      min={0}
                      onChange={(v) => {
                        if (typeof v !== 'number') return
                        writeOverride(row.providerId, row.modelId, { ...row.pricing, input: v })
                      }}
                    />
                  </Table.Td>
                  <Table.Td>
                    <NumberInput
                      size="xs"
                      value={row.pricing.output}
                      decimalScale={4}
                      min={0}
                      onChange={(v) => {
                        if (typeof v !== 'number') return
                        writeOverride(row.providerId, row.modelId, { ...row.pricing, output: v })
                      }}
                    />
                  </Table.Td>
                  <Table.Td>
                    <NumberInput
                      size="xs"
                      value={row.pricing.cachedInput}
                      decimalScale={4}
                      min={0}
                      onChange={(v) => {
                        if (typeof v !== 'number') return
                        writeOverride(row.providerId, row.modelId, { ...row.pricing, cachedInput: v })
                      }}
                    />
                  </Table.Td>
                  <Table.Td>
                    {row.source === 'override' && (
                      <Button size="compact-xs" variant="subtle" onClick={() => resetRow(row.providerId, row.modelId)}>
                        {t('Reset')}
                      </Button>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </div>
        <div>
          <Text size="sm" fw={600} mb={6}>
            {t('Add a model price')}
          </Text>
          <Flex gap="sm" wrap="wrap" align="flex-end">
            <TextInput
              size="xs"
              label={t('Provider id')}
              value={newProvider}
              onChange={(e) => setNewProvider(e.currentTarget.value)}
              placeholder="deepseek"
            />
            <TextInput
              size="xs"
              label={t('Model id')}
              value={newModel}
              onChange={(e) => setNewModel(e.currentTarget.value)}
              placeholder="deepseek-chat"
            />
            <NumberInput
              size="xs"
              label={t('Input / 1M')}
              value={newInput}
              onChange={(v) => setNewInput(typeof v === 'number' ? v : '')}
              min={0}
              decimalScale={4}
            />
            <NumberInput
              size="xs"
              label={t('Output / 1M')}
              value={newOutput}
              onChange={(v) => setNewOutput(typeof v === 'number' ? v : '')}
              min={0}
              decimalScale={4}
            />
            <NumberInput
              size="xs"
              label={t('Cached / 1M')}
              value={newCached}
              onChange={(v) => setNewCached(typeof v === 'number' ? v : '')}
              min={0}
              decimalScale={4}
            />
            <Button size="xs" onClick={addRow} disabled={!newModel.trim() || newInput === '' || newOutput === ''}>
              {t('Add')}
            </Button>
          </Flex>
        </div>
      </Stack>
    </SettingsCard>
  )
}
