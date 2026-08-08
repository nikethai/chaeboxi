/**
 * Progressive agent editor — Identity, Persona, Model, Tools, Hooks.
 */

import {
  ActionIcon,
  Button,
  Checkbox,
  Collapse,
  Flex,
  MultiSelect,
  Radio,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  UnstyledButton,
} from '@mantine/core'
import type { CopilotDetail, CopilotHook } from '@shared/types'
import {
  COPILOT_MAX_STEPS_DEFAULT,
  COPILOT_MAX_STEPS_MAX,
  COPILOT_MAX_STEPS_MIN,
} from '@shared/types'
import { IconChevronDown, IconPlus, IconTrash } from '@tabler/icons-react'
import { type FC, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import LazyNumberInput from '@/components/common/LazyNumberInput'
import { ScalableIcon } from '@/components/common/ScalableIcon'
import SliderWithInput from '@/components/common/SliderWithInput'
import { trackingEvent } from '@/packages/event'
import { AgentAvatarStudio } from './AgentAvatarStudio'

const BUILT_IN_TOOLS = [
  { value: 'web_search', label: 'Web Search' },
  { value: 'parse_link', label: 'Parse Link' },
  { value: 'generate_image', label: 'Generate Image' },
  { value: 'file_read', label: 'File Read' },
  { value: 'file_write', label: 'File Write' },
  { value: 'query_knowledge_base', label: 'Knowledge Base Query' },
  { value: 'upload_file', label: 'Upload File' },
  { value: 'task_create', label: 'Task Create' },
  { value: 'task_update', label: 'Task Update' },
  { value: 'task_list', label: 'Task List' },
  { value: 'task_get', label: 'Task Get' },
  { value: 'task_delete', label: 'Task Delete' },
]

const HOOK_TYPES = [
  { value: 'inject-context', label: 'Inject Context' },
  { value: 'inject-datetime', label: 'Inject DateTime' },
  { value: 'inject-system-info', label: 'Inject System Info' },
  { value: 'web-fetch', label: 'Web Fetch' },
  { value: 'validate-format', label: 'Validate Format' },
]

const ROLE_OPTIONS = [
  { value: 'research', label: 'Research' },
  { value: 'code', label: 'Code' },
  { value: 'writing', label: 'Writing' },
  { value: 'data', label: 'Data' },
  { value: 'planning', label: 'Planning' },
  { value: 'custom', label: 'Custom' },
]

const STANCE_OPTIONS = [
  { value: 'proposer', label: 'Proposer' },
  { value: 'critic', label: 'Critic' },
  { value: 'integrator', label: 'Integrator' },
  { value: 'lead', label: 'Lead' },
  { value: 'neutral', label: 'Neutral' },
]

export type AgentEditorProps = {
  copilotDetail: CopilotDetail
  close(): void
  save(detail: CopilotDetail): void
}

function SectionShell({
  title,
  subtitle,
  open,
  onToggle,
  children,
}: {
  title: string
  subtitle?: string
  open: boolean
  onToggle(): void
  children: React.ReactNode
}) {
  return (
    <div
      className="rounded-[11px] overflow-hidden"
      style={{
        border: '1px solid var(--chatbox-border-primary)',
        background: 'var(--chatbox-background-secondary)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.03) inset',
      }}
    >
      <UnstyledButton
        onClick={onToggle}
        className="w-full px-3.5 py-3 flex items-center justify-between gap-2 text-left"
        style={{ minHeight: 44 }}
      >
        <div className="min-w-0">
          <Text size="sm" fw={700} c="chatbox-primary">
            {title}
          </Text>
          {subtitle ? (
            <Text size="xs" c="chatbox-tertiary">
              {subtitle}
            </Text>
          ) : null}
        </div>
        <ScalableIcon
          icon={IconChevronDown}
          size={16}
          className="text-[var(--chatbox-tint-tertiary)] shrink-0 transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : undefined }}
        />
      </UnstyledButton>
      <Collapse in={open}>
        <div className="px-3.5 pb-3.5 pt-0" style={{ borderTop: '1px solid var(--chatbox-border-primary)' }}>
          <div className="pt-3">{children}</div>
        </div>
      </Collapse>
    </div>
  )
}

export const AgentEditor: FC<AgentEditorProps> = ({ copilotDetail, close, save }) => {
  const { t } = useTranslation()
  const [edit, setEdit] = useState<CopilotDetail>(copilotDetail)
  const [errors, setErrors] = useState<{ name?: string; prompt?: string }>({})
  const [openModel, setOpenModel] = useState(false)
  const [openTools, setOpenTools] = useState(Boolean(copilotDetail.toolAccess))
  const [openHooks, setOpenHooks] = useState(Boolean(copilotDetail.hooks?.preTurn?.length || copilotDetail.hooks?.postTurn?.length))
  const [openAgent, setOpenAgent] = useState(true)

  useEffect(() => {
    setEdit(copilotDetail)
  }, [copilotDetail])

  const patch = (p: Partial<CopilotDetail>) => {
    setErrors({})
    setEdit((prev) => ({ ...prev, ...p }))
  }

  const handleSave = () => {
    const name = edit.name.trim()
    const prompt = edit.prompt.trim()
    if (!name) {
      setErrors({ name: t('cannot be empty') })
      return
    }
    if (!prompt) {
      setErrors({ prompt: t('cannot be empty') })
      return
    }
    save({
      ...edit,
      name,
      prompt,
      description: edit.description?.trim() || undefined,
      voice: edit.voice?.trim() || undefined,
      picUrl: edit.picUrl?.trim() || undefined,
      emojiAvatar: edit.emojiAvatar?.trim() || undefined,
    })
    trackingEvent('create_copilot', { event_category: 'user' })
  }

  return (
    <Stack gap="md" className="max-w-3xl">
      <Flex justify="space-between" align="center" gap="sm" wrap="wrap">
        <div>
          <Text size="lg" fw={700} c="chatbox-primary" style={{ textWrap: 'balance' }}>
            {copilotDetail.name?.trim() ? t('Edit Agent') : t('Create New Agent')}
          </Text>
          <Text size="xs" c="chatbox-tertiary">
            {t('Identity, persona, tools, and model overrides')}
          </Text>
        </div>
        <Flex gap="sm">
          <Button variant="default" onClick={close}>
            {t('Cancel')}
          </Button>
          <Button onClick={handleSave}>{t('Save')}</Button>
        </Flex>
      </Flex>

      {/* Identity — always open */}
      <div
        className="rounded-[11px] p-3.5"
        style={{
          border: '1px solid var(--chatbox-border-primary)',
          background: 'var(--chatbox-background-secondary)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        }}
      >
        <Stack gap="md">
          <Text size="sm" fw={700}>
            {t('Identity')}
          </Text>
          <AgentAvatarStudio detail={edit} onChange={patch} />
          <TextInput
            label={t('Agent Name')}
            placeholder={t('My Assistant') || ''}
            value={edit.name}
            onChange={(e) => patch({ name: e.currentTarget.value })}
            error={errors.name}
            autoFocus
          />
          <TextInput
            label={t('Description')}
            placeholder={t('One-line summary for the gallery') || ''}
            value={edit.description ?? ''}
            onChange={(e) => patch({ description: e.currentTarget.value })}
          />
          <Flex gap="sm" wrap="wrap">
            <Select
              label={t('Role')}
              data={ROLE_OPTIONS}
              value={edit.role || 'custom'}
              onChange={(v) => patch({ role: v || 'custom' })}
              allowDeselect={false}
              className="min-w-[140px] flex-1"
            />
            <Select
              label={t('Room stance')}
              data={STANCE_OPTIONS}
              value={edit.stance || 'neutral'}
              onChange={(v) => patch({ stance: (v as CopilotDetail['stance']) || 'neutral' })}
              allowDeselect={false}
              className="min-w-[140px] flex-1"
            />
          </Flex>
          <TextInput
            label={t('Voice')}
            placeholder={t('Short style line, e.g. Concise and technical') || ''}
            value={edit.voice ?? ''}
            onChange={(e) => patch({ voice: e.currentTarget.value })}
          />
        </Stack>
      </div>

      <SectionShell
        title={t('Persona')}
        subtitle={t('System prompt that defines this agent')}
        open={openAgent}
        onToggle={() => setOpenAgent((v) => !v)}
      >
        <Textarea
          label={t('Agent Prompt')}
          placeholder={t('Copilot Prompt Demo') || ''}
          minRows={6}
          autosize
          maxRows={16}
          value={edit.prompt}
          onChange={(e) => patch({ prompt: e.currentTarget.value })}
          error={errors.prompt}
        />
      </SectionShell>

      <SectionShell
        title={t('Model Settings Override')}
        subtitle={t('Leave blank to use session defaults')}
        open={openModel}
        onToggle={() => setOpenModel((v) => !v)}
      >
        <Stack gap="md">
          <Stack gap="xs">
            <Text size="sm" fw={600}>
              {t('Temperature')}
            </Text>
            <SliderWithInput
              value={edit.modelSettings?.temperature}
              onChange={(v) =>
                setEdit((prev) => ({
                  ...prev,
                  modelSettings: { ...prev.modelSettings, temperature: v },
                }))
              }
              max={2}
              step={0.1}
            />
          </Stack>
          <Stack gap="xs">
            <Text size="sm" fw={600}>
              Top P
            </Text>
            <SliderWithInput
              value={edit.modelSettings?.topP}
              onChange={(v) =>
                setEdit((prev) => ({
                  ...prev,
                  modelSettings: { ...prev.modelSettings, topP: v },
                }))
              }
              max={1}
              step={0.05}
            />
          </Stack>
          <Flex justify="space-between" align="center">
            <Text size="sm" fw={600}>
              {t('Max Output Tokens')}
            </Text>
            <LazyNumberInput
              width={96}
              value={edit.modelSettings?.maxTokens}
              onChange={(v) =>
                setEdit((prev) => ({
                  ...prev,
                  modelSettings: {
                    ...prev.modelSettings,
                    maxTokens: typeof v === 'number' ? v : undefined,
                  },
                }))
              }
              min={0}
              step={1024}
              allowDecimal={false}
              placeholder={t('Not set') || ''}
            />
          </Flex>
          <Stack gap="xs">
            <Text size="sm" fw={600}>
              {t('Max Steps')}
            </Text>
            <SliderWithInput
              value={edit.maxSteps ?? COPILOT_MAX_STEPS_DEFAULT}
              onChange={(v) => patch({ maxSteps: v ?? COPILOT_MAX_STEPS_DEFAULT })}
              min={COPILOT_MAX_STEPS_MIN}
              max={COPILOT_MAX_STEPS_MAX}
              step={1}
            />
          </Stack>
        </Stack>
      </SectionShell>

      <SectionShell
        title={t('Tool Access')}
        subtitle={t('Control which tools this agent can use')}
        open={openTools}
        onToggle={() => setOpenTools((v) => !v)}
      >
        <Stack gap="md">
          <Radio.Group
            value={edit.toolAccess?.mode ?? 'allowlist'}
            onChange={(value) =>
              setEdit((prev) => ({
                ...prev,
                toolAccess: {
                  mode: value as 'allowlist' | 'denylist',
                  tools: prev.toolAccess?.tools ?? [],
                  includeMcp: prev.toolAccess?.includeMcp ?? true,
                },
              }))
            }
            label={t('Access Mode')}
          >
            <Stack gap="xs" mt="xs">
              <Radio value="allowlist" label={t('Allowlist - only use selected tools')} />
              <Radio value="denylist" label={t('Denylist - use all except selected tools')} />
            </Stack>
          </Radio.Group>
          <Checkbox
            checked={edit.toolAccess?.includeMcp ?? true}
            onChange={(event) =>
              setEdit((prev) => ({
                ...prev,
                toolAccess: {
                  mode: prev.toolAccess?.mode ?? 'allowlist',
                  tools: prev.toolAccess?.tools ?? [],
                  includeMcp: event.currentTarget.checked,
                },
              }))
            }
            label={t('Include MCP tools')}
          />
          <MultiSelect
            label={t('Select Tools')}
            data={BUILT_IN_TOOLS}
            value={edit.toolAccess?.tools ?? []}
            onChange={(value) =>
              setEdit((prev) => ({
                ...prev,
                toolAccess: {
                  mode: prev.toolAccess?.mode ?? 'allowlist',
                  tools: value,
                  includeMcp: prev.toolAccess?.includeMcp ?? true,
                },
              }))
            }
            placeholder={t('Select tools...')}
            searchable
            clearable
          />
          <Text size="xs" c="dimmed">
            {t('For MCP tools, enter tool names manually (e.g., mcp__server__tool_name)')}
          </Text>
        </Stack>
      </SectionShell>

      <SectionShell
        title={t('Hooks')}
        subtitle={t('Configure pre-turn and post-turn hook actions')}
        open={openHooks}
        onToggle={() => setOpenHooks((v) => !v)}
      >
        <Stack gap="md">
          <HookList
            label={t('Pre-Turn Hooks')}
            hint={t('Run before each generation to inject context or fetch data')}
            hooks={edit.hooks?.preTurn ?? []}
            onChange={(hooks) =>
              setEdit((prev) => ({
                ...prev,
                hooks: { ...prev.hooks, preTurn: hooks },
              }))
            }
          />
          <HookList
            label={t('Post-Turn Hooks')}
            hint={t('Run after each generation to validate or process output')}
            hooks={edit.hooks?.postTurn ?? []}
            onChange={(hooks) =>
              setEdit((prev) => ({
                ...prev,
                hooks: { ...prev.hooks, postTurn: hooks },
              }))
            }
          />
        </Stack>
      </SectionShell>

      <Flex justify="space-between" align="center" wrap="wrap" gap="sm">
        <Switch
          checked={Boolean(edit.shared)}
          onChange={(e) => patch({ shared: e.currentTarget.checked })}
          label={t('Share with Chatbox')}
        />
        <Flex gap="sm">
          <Button variant="default" onClick={close}>
            {t('Cancel')}
          </Button>
          <Button onClick={handleSave}>{t('Save')}</Button>
        </Flex>
      </Flex>
    </Stack>
  )
}

function HookList({
  label,
  hint,
  hooks,
  onChange,
}: {
  label: string
  hint: string
  hooks: CopilotHook[]
  onChange(hooks: CopilotHook[]): void
}) {
  const { t } = useTranslation()

  const addHook = () => {
    onChange([...hooks, { type: 'inject-context', content: '' }])
  }

  const updateHook = (index: number, next: CopilotHook) => {
    onChange(hooks.map((h, i) => (i === index ? next : h)))
  }

  const removeHook = (index: number) => {
    onChange(hooks.filter((_, i) => i !== index))
  }

  return (
    <Stack gap="xs">
      <div>
        <Text size="sm" fw={600}>
          {label}
        </Text>
        <Text size="xs" c="dimmed">
          {hint}
        </Text>
      </div>
      {hooks.map((hook, index) => (
        <HookEditor key={index} hook={hook} onChange={(h) => updateHook(index, h)} onRemove={() => removeHook(index)} />
      ))}
      <Button variant="light" size="xs" leftSection={<ScalableIcon icon={IconPlus} size={14} />} onClick={addHook}>
        {t('Add Hook')}
      </Button>
    </Stack>
  )
}

function HookEditor({
  hook,
  onChange,
  onRemove,
}: {
  hook: CopilotHook
  onChange(hook: CopilotHook): void
  onRemove(): void
}) {
  const { t } = useTranslation()

  const handleTypeChange = (type: string) => {
    switch (type) {
      case 'inject-context':
        onChange({ type: 'inject-context', content: '' })
        break
      case 'inject-datetime':
        onChange({ type: 'inject-datetime' })
        break
      case 'inject-system-info':
        onChange({ type: 'inject-system-info' })
        break
      case 'web-fetch':
        onChange({ type: 'web-fetch', url: '', extractAs: 'text' })
        break
      case 'validate-format':
        onChange({ type: 'validate-format', format: 'markdown' })
        break
      default:
        break
    }
  }

  return (
    <div
      className="rounded-[9px] p-3"
      style={{
        border: '1px solid var(--chatbox-border-primary)',
        background: 'var(--chatbox-background-primary)',
      }}
    >
      <Flex gap="xs" align="flex-start">
        <Select
          size="xs"
          data={HOOK_TYPES}
          value={hook.type}
          onChange={(value) => value && handleTypeChange(value)}
          allowDeselect={false}
          className="flex-1"
        />
        <ActionIcon variant="subtle" color="chatbox-error" size="sm" onClick={onRemove} aria-label={t('Delete')}>
          <ScalableIcon icon={IconTrash} size={14} />
        </ActionIcon>
      </Flex>
      {hook.type === 'inject-context' && (
        <Textarea
          size="xs"
          mt="xs"
          minRows={2}
          placeholder={t('Context content to inject...')}
          value={hook.content}
          onChange={(e) => onChange({ type: 'inject-context', content: e.currentTarget.value })}
        />
      )}
      {hook.type === 'web-fetch' && (
        <Stack gap="xs" mt="xs">
          <TextInput
            size="xs"
            placeholder={t('URL to fetch...')}
            value={hook.url}
            onChange={(e) => onChange({ ...hook, url: e.currentTarget.value })}
          />
          <Select
            size="xs"
            label={t('Extract as')}
            data={[
              { value: 'text', label: 'Text' },
              { value: 'json', label: 'JSON' },
            ]}
            value={hook.extractAs}
            onChange={(value) => value && onChange({ ...hook, extractAs: value as 'text' | 'json' })}
            allowDeselect={false}
          />
        </Stack>
      )}
      {hook.type === 'validate-format' && (
        <Select
          size="xs"
          mt="xs"
          label={t('Format')}
          data={[
            { value: 'markdown', label: 'Markdown' },
            { value: 'json', label: 'JSON' },
            { value: 'code', label: 'Code' },
          ]}
          value={hook.format}
          onChange={(value) => value && onChange({ type: 'validate-format', format: value as 'markdown' | 'json' | 'code' })}
          allowDeselect={false}
        />
      )}
      {hook.type === 'inject-datetime' && (
        <Text size="xs" c="dimmed" mt="xs">
          {t('Injects current datetime (ISO 8601 format)')}
        </Text>
      )}
      {hook.type === 'inject-system-info' && (
        <Text size="xs" c="dimmed" mt="xs">
          {t('Injects OS and platform information')}
        </Text>
      )}
    </div>
  )
}

export default AgentEditor
