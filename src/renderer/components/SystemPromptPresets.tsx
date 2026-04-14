import { ActionIcon, Button, Flex, Stack, Text, TextInput, Textarea } from '@mantine/core'
import type { PromptPreset } from '@shared/types'
import { IconEdit, IconPlus, IconTrash } from '@tabler/icons-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AdaptiveSelect } from '@/components/AdaptiveSelect'
import { AdaptiveModal } from '@/components/common/AdaptiveModal'
import { useSystemPromptPresets } from '@/stores/systemPromptPresetsStore'
import { add as addToast } from '@/stores/toastActions'

type SystemPromptPresetDraft = Partial<PromptPreset> & Pick<PromptPreset, 'content'>

interface SystemPromptPresetEditorModalProps {
  opened: boolean
  title: string
  preset: SystemPromptPresetDraft | null
  onClose: () => void
  onSave: (preset: Omit<PromptPreset, 'id'> & Partial<Pick<PromptPreset, 'id'>>) => void
}

function SystemPromptPresetEditorModal({
  opened,
  title,
  preset,
  onClose,
  onSave,
}: SystemPromptPresetEditorModalProps) {
  const { t } = useTranslation()
  const [presetName, setPresetName] = useState('')
  const [presetContent, setPresetContent] = useState('')

  useEffect(() => {
    if (!opened || !preset) {
      setPresetName('')
      setPresetContent('')
      return
    }

    setPresetName(preset.name || '')
    setPresetContent(preset.content || '')
  }, [opened, preset])

  const handleSave = () => {
    if (!presetName.trim() || !presetContent.trim()) {
      return
    }

    onSave({
      id: preset?.id || undefined,
      name: presetName.trim(),
      content: presetContent,
    })
    onClose()
  }

  return (
    <AdaptiveModal opened={opened} onClose={onClose} title={title} centered>
      <TextInput
        label={t('Preset Name')}
        value={presetName}
        onChange={(event) => setPresetName(event.currentTarget.value)}
      />
      <Textarea
        mt="sm"
        autosize
        minRows={6}
        maxRows={16}
        label={t('Content')}
        value={presetContent}
        onChange={(event) => setPresetContent(event.currentTarget.value)}
      />

      <AdaptiveModal.Actions>
        <AdaptiveModal.CloseButton onClick={onClose} />
        <Button onClick={handleSave}>{t('Save')}</Button>
      </AdaptiveModal.Actions>
    </AdaptiveModal>
  )
}

interface SystemPromptPresetPickerProps {
  value: string
  onChange: (value: string) => void
}

export function SystemPromptPresetPicker({ value, onChange }: SystemPromptPresetPickerProps) {
  const { t } = useTranslation()
  const { systemPromptPresets, addOrUpdatePreset } = useSystemPromptPresets()
  const [editingPreset, setEditingPreset] = useState<SystemPromptPresetDraft | null>(null)

  const selectedPresetId = useMemo(
    () => systemPromptPresets.find((preset) => preset.content === value)?.id || null,
    [systemPromptPresets, value]
  )

  const selectData = useMemo(
    () => systemPromptPresets.map((preset) => ({ value: preset.id, label: preset.name })),
    [systemPromptPresets]
  )

  const handlePresetSelect = (presetId: string | null) => {
    if (!presetId) {
      return
    }

    const preset = systemPromptPresets.find((item) => item.id === presetId)
    if (preset) {
      onChange(preset.content)
    }
  }

  const handleOpenSaveModal = () => {
    if (!value.trim()) {
      addToast(t('Enter a system prompt before saving it'))
      return
    }

    setEditingPreset({
      name: selectedPresetId
        ? systemPromptPresets.find((preset) => preset.id === selectedPresetId)?.name || ''
        : '',
      content: value,
      id: selectedPresetId || undefined,
    })
  }

  const handleSavePreset = (preset: Omit<PromptPreset, 'id'> & Partial<Pick<PromptPreset, 'id'>>) => {
    addOrUpdatePreset(preset)
    onChange(preset.content)
    addToast(t(preset.id ? 'System prompt preset updated' : 'System prompt preset saved'))
  }

  return (
    <>
      <Stack gap="xs">
        <AdaptiveSelect
          label={t('Saved System Prompts')}
          placeholder={
            systemPromptPresets.length > 0
              ? (t('Select a saved system prompt') || '')
              : (t('No saved system prompts yet') || '')
          }
          data={selectData}
          value={selectedPresetId}
          onChange={handlePresetSelect}
          searchable
          nothingFoundMessage={t('No prompt presets yet') || ''}
        />

        <Flex justify="flex-end">
          <Button variant="light" size="xs" onClick={handleOpenSaveModal}>
            {selectedPresetId ? t('Update Saved Prompt') : t('Save Current as Preset')}
          </Button>
        </Flex>
      </Stack>

      <SystemPromptPresetEditorModal
        opened={!!editingPreset}
        title={editingPreset?.id ? t('Edit System Prompt Preset') : t('New System Prompt Preset')}
        preset={editingPreset}
        onClose={() => setEditingPreset(null)}
        onSave={handleSavePreset}
      />
    </>
  )
}

export function SystemPromptPresetsSection() {
  const { t } = useTranslation()
  const { systemPromptPresets, addOrUpdatePreset, removePreset } = useSystemPromptPresets()
  const [editingPreset, setEditingPreset] = useState<SystemPromptPresetDraft | null>(null)

  return (
    <>
      <Stack gap="md">
        <Flex align="center" justify="space-between">
          <Text fw="600">{t('System Prompt Presets')}</Text>
          <Button
            variant="light"
            size="xs"
            leftSection={<IconPlus size={16} />}
            onClick={() => setEditingPreset({ content: '' })}
          >
            {t('Add Preset')}
          </Button>
        </Flex>

        <Text size="xs" c="chatbox-tertiary">
          {t('Save reusable system prompts here, then apply them to a conversation or your default prompt.')}
        </Text>

        {systemPromptPresets.length > 0 ? (
          <Stack gap="sm">
            {systemPromptPresets.map((preset) => (
              <Flex
                key={preset.id}
                align="flex-start"
                justify="space-between"
                gap="sm"
                p="sm"
                style={{ border: '1px solid var(--chatbox-border-primary)', borderRadius: 8 }}
              >
                <Stack gap={2} flex={1}>
                  <Text fw={600}>{preset.name}</Text>
                  <Text size="xs" c="chatbox-tertiary">
                    {preset.content.split('\n')[0]}
                  </Text>
                </Stack>
                <Flex gap="xs">
                  <ActionIcon
                    variant="subtle"
                    color="chatbox-tertiary"
                    onClick={() => setEditingPreset(preset)}
                  >
                    <IconEdit size={16} />
                  </ActionIcon>
                  <ActionIcon variant="subtle" color="chatbox-error" onClick={() => removePreset(preset.id)}>
                    <IconTrash size={16} />
                  </ActionIcon>
                </Flex>
              </Flex>
            ))}
          </Stack>
        ) : (
          <Text size="sm" c="chatbox-tertiary">
            {t('No saved system prompts yet')}
          </Text>
        )}
      </Stack>

      <SystemPromptPresetEditorModal
        opened={!!editingPreset}
        title={editingPreset?.id ? t('Edit System Prompt Preset') : t('New System Prompt Preset')}
        preset={editingPreset}
        onClose={() => setEditingPreset(null)}
        onSave={(preset) => {
          addOrUpdatePreset(preset)
          addToast(t(preset.id ? 'System prompt preset updated' : 'System prompt preset saved'))
        }}
      />
    </>
  )
}
