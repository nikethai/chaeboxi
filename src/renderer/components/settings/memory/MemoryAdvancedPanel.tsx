import { Box, Button, Code, Collapse, Group, NumberInput, Select, Stack, Switch, Text, Title } from '@mantine/core'
import type { MemoryRetrievalMode, MemorySettings } from '@shared/types/memory'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { memoryPanelStyle } from './memory-ui-state'

export type MemoryAdvancedPanelProps = {
  settings: MemorySettings
  factCount: number
  injectTokens: number
  injectText: string
  onSettingsChange: (patch: Partial<MemorySettings>) => void
}

const labelStyles = { label: { fontWeight: 400 as const } }

export function MemoryAdvancedPanel({
  settings,
  factCount,
  injectTokens,
  injectText,
  onSettingsChange,
}: MemoryAdvancedPanelProps) {
  const { t } = useTranslation()
  const [showInjectPreview, setShowInjectPreview] = useState(() => process.env.NODE_ENV === 'development')
  const mode = settings.retrievalMode ?? 'hybrid'

  const modeHelp =
    mode === 'always'
      ? t('Always inject: profile + many facts every chat (highest reliability, more tokens).')
      : mode === 'on_demand'
        ? t(
            'On-demand: almost nothing injected. Model must search memory tools. Falls back to hybrid on models without tools.'
          )
        : t(
            'Hybrid (recommended): inject short profile + pinned facts only. Unpinned facts via search tools or auto-match from the user message.'
          )

  return (
    <Stack gap="lg" maw={640}>
      <Stack gap="md">
        <Title order={6}>{t('Retrieval')}</Title>
        <Select
          maw={360}
          styles={labelStyles}
          label={t('Memory retrieval mode')}
          description={modeHelp}
          data={[
            { value: 'hybrid', label: t('Hybrid (recommended)') },
            { value: 'always', label: t('Always inject') },
            { value: 'on_demand', label: t('On-demand only') },
          ]}
          value={mode}
          onChange={(v) => {
            if (v) onSettingsChange({ retrievalMode: v as MemoryRetrievalMode })
          }}
          allowDeselect={false}
        />
        <Text size="xs" c="chatbox-tertiary" style={{ textWrap: 'pretty' as const }}>
          {t(
            'Pin important facts so they stay in hybrid inject. Use memory_recall (or auto-match) for everything else to save tokens.'
          )}
        </Text>
      </Stack>

      <Stack gap="xs">
        <Title order={6}>{t('Inject preview')}</Title>
        <Box p="sm" style={memoryPanelStyle}>
          <Group justify="space-between" mb="xs" align="flex-start">
            <div>
              <Text size="sm" fw={600}>
                {t('System prompt block')}
                {process.env.NODE_ENV === 'development' ? ' (dev)' : ''}
              </Text>
              <Text size="xs" c="chatbox-tertiary" style={{ textWrap: 'pretty' as const }}>
                {t('Exact block prepended into the model system prompt when Memory is enabled. No Network tab needed.')}
              </Text>
            </div>
            <Button
              size="xs"
              variant="light"
              onClick={() => setShowInjectPreview((v) => !v)}
              className="active:scale-[0.96] transition-transform"
            >
              {showInjectPreview ? t('Hide') : t('Show')}
            </Button>
          </Group>
          <Text size="xs" c="chatbox-secondary" mb="xs" className="tabular-nums">
            {settings.enabled
              ? t('Status: {{mode}} · {{count}} facts · ~{{tokens}} tokens', {
                  mode,
                  count: factCount,
                  tokens: injectTokens,
                })
              : t('Status: Memory disabled — inject is empty')}
          </Text>
          <Collapse in={showInjectPreview}>
            <Code
              block
              style={{
                whiteSpace: 'pre-wrap',
                maxHeight: 320,
                overflow: 'auto',
                fontSize: 12,
                borderRadius: 9,
              }}
            >
              {injectText || t('(empty — enable Memory and add facts under Global)')}
            </Code>
            {injectText ? (
              <Button
                size="xs"
                variant="subtle"
                mt="xs"
                className="active:scale-[0.96] transition-transform"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(injectText)
                    toast.success(t('Copied inject preview'))
                  } catch {
                    toast.error(t('Copy failed'))
                  }
                }}
              >
                {t('Copy preview')}
              </Button>
            ) : null}
          </Collapse>
        </Box>
      </Stack>

      <Stack gap="md">
        <Title order={6}>{t('Budgets')}</Title>
        {(mode === 'hybrid' || mode === 'on_demand') && (
          <>
            <NumberInput
              maw={320}
              styles={labelStyles}
              label={t('Core global budget (tokens)')}
              description={t('Hybrid profile + pinned facts for global memory')}
              value={settings.injectBudgetTokensCoreGlobal ?? 250}
              min={50}
              max={2000}
              classNames={{ input: 'tabular-nums' }}
              onChange={(v) => onSettingsChange({ injectBudgetTokensCoreGlobal: Number(v) || 250 })}
            />
            <NumberInput
              maw={320}
              styles={labelStyles}
              label={t('Core agent budget (tokens)')}
              description={t('Hybrid profile + pinned facts for agent memory')}
              value={settings.injectBudgetTokensCoreAgent ?? 150}
              min={50}
              max={1500}
              classNames={{ input: 'tabular-nums' }}
              onChange={(v) => onSettingsChange({ injectBudgetTokensCoreAgent: Number(v) || 150 })}
            />
          </>
        )}
        {mode === 'always' && (
          <>
            <NumberInput
              maw={320}
              styles={labelStyles}
              label={t('Global inject budget (tokens)')}
              value={settings.injectBudgetTokensGlobal}
              min={200}
              max={8000}
              classNames={{ input: 'tabular-nums' }}
              onChange={(v) => onSettingsChange({ injectBudgetTokensGlobal: Number(v) || 1200 })}
            />
            <NumberInput
              maw={320}
              styles={labelStyles}
              label={t('Agent inject budget (tokens)')}
              value={settings.injectBudgetTokensAgent}
              min={100}
              max={4000}
              classNames={{ input: 'tabular-nums' }}
              onChange={(v) => onSettingsChange({ injectBudgetTokensAgent: Number(v) || 800 })}
            />
          </>
        )}
        <NumberInput
          maw={320}
          styles={labelStyles}
          label={t('Max global entries')}
          value={settings.maxEntriesGlobal}
          min={20}
          max={2000}
          classNames={{ input: 'tabular-nums' }}
          onChange={(v) => onSettingsChange({ maxEntriesGlobal: Number(v) || 300 })}
        />
        <NumberInput
          maw={320}
          styles={labelStyles}
          label={t('Max entries per agent')}
          value={settings.maxEntriesPerAgent}
          min={10}
          max={1000}
          classNames={{ input: 'tabular-nums' }}
          onChange={(v) => onSettingsChange({ maxEntriesPerAgent: Number(v) || 150 })}
        />
        <NumberInput
          maw={320}
          styles={labelStyles}
          label={t('Auto-save every N turns')}
          value={settings.retainEveryNTurns}
          min={1}
          max={20}
          classNames={{ input: 'tabular-nums' }}
          onChange={(v) => onSettingsChange({ retainEveryNTurns: Number(v) || 3 })}
        />
      </Stack>

      <Stack gap="md">
        <Title order={6}>{t('Auto-match from message')}</Title>
        <Switch
          label={t('Host pre-search')}
          description={t(
            'Keyword-match the latest user message against memory and attach a few relevant facts (hybrid / on-demand). No extra model call.'
          )}
          checked={settings.hostPreSearchEnabled !== false}
          onChange={(e) => onSettingsChange({ hostPreSearchEnabled: e.currentTarget.checked })}
        />
        <NumberInput
          maw={320}
          styles={labelStyles}
          label={t('Pre-search limit')}
          value={settings.hostPreSearchLimit ?? 5}
          min={1}
          max={20}
          disabled={settings.hostPreSearchEnabled === false}
          classNames={{ input: 'tabular-nums' }}
          onChange={(v) => onSettingsChange({ hostPreSearchLimit: Number(v) || 5 })}
        />
      </Stack>

      <Stack gap="md">
        <Title order={6}>{t('Behavior')}</Title>
        <Switch
          label={t('Auto-consolidate profile')}
          description={t('LLM rewrite of profile summary (lazy — after several new facts, not every turn)')}
          checked={settings.autoConsolidate}
          onChange={(e) => onSettingsChange({ autoConsolidate: e.currentTarget.checked })}
        />
        <NumberInput
          maw={320}
          styles={labelStyles}
          label={t('LLM consolidate every N new facts')}
          value={settings.consolidateEveryNRetains ?? 5}
          min={1}
          max={50}
          disabled={!settings.autoConsolidate}
          classNames={{ input: 'tabular-nums' }}
          onChange={(v) => onSettingsChange({ consolidateEveryNRetains: Number(v) || 5 })}
        />
        <Switch
          label={t('Fallback-pin last message if extract empty')}
          description={t('Off by default — avoids filling memory with chat noise')}
          checked={Boolean(settings.autoSaveFallbackPin)}
          onChange={(e) => onSettingsChange({ autoSaveFallbackPin: e.currentTarget.checked })}
        />
        <Switch
          label={t('Soft-archive on overflow')}
          description={t('When over max entries, disable old unused facts instead of hard-delete (pins kept)')}
          checked={settings.softArchiveOnPrune !== false}
          onChange={(e) => onSettingsChange({ softArchiveOnPrune: e.currentTarget.checked })}
        />
        <Switch
          label={t('Local semantic boost')}
          description={t('Hybrid lexical + token-vector scoring for recall (no external embed API)')}
          checked={settings.semanticSearchEnabled !== false}
          onChange={(e) => onSettingsChange({ semanticSearchEnabled: e.currentTarget.checked })}
        />
        <Switch
          label={t('Show memory updated toast')}
          checked={settings.showMemoryUpdatedToast}
          onChange={(e) => onSettingsChange({ showMemoryUpdatedToast: e.currentTarget.checked })}
        />
      </Stack>
    </Stack>
  )
}
