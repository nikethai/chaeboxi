import { Collapse, Flex, NumberInput, Select, Switch, Text, UnstyledButton } from '@mantine/core'
import type { ComfyUIGenerationParams } from '@shared/providers/definitions/models/comfyui-types'
import { ModelProviderEnum } from '@shared/types'
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useProviderSettings } from '@/stores/settingsStore'

const SAMPLER_OPTIONS = [
  'euler_ancestral',
  'euler',
  'dpmpp_2m',
  'dpmpp_2m_sde',
  'dpmpp_sde',
  'dpmpp_3m_sde',
  'ddim',
  'uni_pc',
  'heun',
  'lms',
]

const SCHEDULER_OPTIONS = ['simple', 'normal', 'karras', 'exponential', 'sgm_uniform', 'beta']

interface ComfyUIControlsProps {
  params: ComfyUIGenerationParams
  onChange: (params: ComfyUIGenerationParams) => void
}

export function ComfyUIControls({ params, onChange }: ComfyUIControlsProps) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const { providerSettings } = useProviderSettings(ModelProviderEnum.ComfyUI)

  const updateParam = useCallback(
    <K extends keyof ComfyUIGenerationParams>(key: K, value: ComfyUIGenerationParams[K]) => {
      onChange({ ...params, [key]: value })
    },
    [params, onChange],
  )

  // Use per-generation value if set, otherwise fall back to provider settings defaults
  const steps = params.steps ?? providerSettings?.comfyuiDefaultSteps ?? 29
  const cfg = params.cfg ?? providerSettings?.comfyuiDefaultCfg ?? 4.9
  const samplerName = params.samplerName ?? providerSettings?.comfyuiDefaultSampler ?? 'euler_ancestral'
  const scheduler = params.scheduler ?? providerSettings?.comfyuiDefaultScheduler ?? 'simple'
  const upscale = params.upscale ?? false

  return (
    <Flex direction="column" gap={8}>
      {/* Upscale toggle — always visible */}
      <Flex align="center" justify="space-between">
        <Switch
          label={t('Upscale (4x)')}
          size="xs"
          checked={upscale}
          onChange={(e) => updateParam('upscale', e.currentTarget.checked)}
          styles={{ label: { fontSize: 12, color: 'var(--chatbox-tint-secondary)' } }}
        />

        {/* Expand/collapse toggle */}
        <UnstyledButton
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-[var(--chatbox-background-tertiary)] transition-colors"
        >
          <Text size="xs" c="dimmed">
            {t('Advanced')}
          </Text>
          {expanded ? (
            <IconChevronDown size={14} className="text-[var(--chatbox-tint-tertiary)]" />
          ) : (
            <IconChevronRight size={14} className="text-[var(--chatbox-tint-tertiary)]" />
          )}
        </UnstyledButton>
      </Flex>

      {/* Collapsible advanced settings */}
      <Collapse in={expanded}>
        <Flex direction="column" gap={8} className="pt-1">
          <Flex gap={8}>
            <NumberInput
              label={t('Steps')}
              size="xs"
              min={1}
              max={100}
              value={steps}
              onChange={(val) => updateParam('steps', typeof val === 'number' ? val : 29)}
              style={{ flex: 1 }}
              styles={{ label: { fontSize: 11, color: 'var(--chatbox-tint-tertiary)' } }}
            />
            <NumberInput
              label={t('CFG Scale')}
              size="xs"
              min={1}
              max={30}
              step={0.1}
              decimalScale={1}
              value={cfg}
              onChange={(val) => updateParam('cfg', typeof val === 'number' ? val : 4.9)}
              style={{ flex: 1 }}
              styles={{ label: { fontSize: 11, color: 'var(--chatbox-tint-tertiary)' } }}
            />
          </Flex>

          <Flex gap={8}>
            <Select
              label={t('Sampler')}
              size="xs"
              data={SAMPLER_OPTIONS}
              value={samplerName}
              onChange={(val) => updateParam('samplerName', val ?? 'euler_ancestral')}
              style={{ flex: 1 }}
              styles={{ label: { fontSize: 11, color: 'var(--chatbox-tint-tertiary)' } }}
              allowDeselect={false}
            />
            <Select
              label={t('Scheduler')}
              size="xs"
              data={SCHEDULER_OPTIONS}
              value={scheduler}
              onChange={(val) => updateParam('scheduler', val ?? 'simple')}
              style={{ flex: 1 }}
              styles={{ label: { fontSize: 11, color: 'var(--chatbox-tint-tertiary)' } }}
              allowDeselect={false}
            />
          </Flex>
        </Flex>
      </Collapse>
    </Flex>
  )
}
