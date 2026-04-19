import { ActionIcon, Button, Card, Divider, Group, Stack, Switch, Text, TextInput, Textarea, Title } from '@mantine/core'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { IconCheck, IconEdit, IconPlus, IconTrash, IconX } from '@tabler/icons-react'
import { v4 as uuidv4 } from 'uuid'
import { useSettingsStore } from '@/stores/settingsStore'
import type { UserPersonalInfoEntry } from '@shared/types/settings'

export const Route = createFileRoute('/settings/user-personal-info')({
  component: RouteComponent,
})

export function RouteComponent() {
  const { t } = useTranslation()
  const setSettings = useSettingsStore((state) => state.setSettings)
  const userPersonalInfo = useSettingsStore((state) => state.userPersonalInfo)

  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [editKey, setEditKey] = useState('')
  const [editValue, setEditValue] = useState('')

  const handleAddEntry = () => {
    if (!newKey.trim()) return
    const entry: UserPersonalInfoEntry = {
      id: uuidv4(),
      key: newKey.trim(),
      value: newValue,
    }
    setSettings({
      userPersonalInfo: {
        ...userPersonalInfo,
        entries: [...userPersonalInfo.entries, entry],
      },
    })
    setNewKey('')
    setNewValue('')
    setShowAddForm(false)
  }

  const handleDeleteEntry = (id: string) => {
    setSettings({
      userPersonalInfo: {
        ...userPersonalInfo,
        entries: userPersonalInfo.entries.filter((e) => e.id !== id),
      },
    })
  }

  const handleStartEdit = (entry: UserPersonalInfoEntry) => {
    setEditingId(entry.id)
    setEditKey(entry.key)
    setEditValue(entry.value)
  }

  const handleSaveEdit = () => {
    if (!editKey.trim() || !editingId) return
    setSettings({
      userPersonalInfo: {
        ...userPersonalInfo,
        entries: userPersonalInfo.entries.map((e) =>
          e.id === editingId ? { ...e, key: editKey.trim(), value: editValue } : e
        ),
      },
    })
    setEditingId(null)
    setEditKey('')
    setEditValue('')
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditKey('')
    setEditValue('')
  }

  const handleToggleInjection = (checked: boolean) => {
    setSettings({
      userPersonalInfo: {
        ...userPersonalInfo,
        enableInjection: checked,
      },
    })
  }

  return (
    <Stack p="md" gap="md">
      <Group justify="space-between" align="center">
        <Title order={5}>{t('User Personal Info')}</Title>
        <Switch
          label={t('Enable injection into AI context')}
          checked={userPersonalInfo.enableInjection}
          onChange={(event) => handleToggleInjection(event.currentTarget.checked)}
        />
      </Group>

      <Divider />

      <Stack gap="sm">
        {userPersonalInfo.entries.map((entry) => (
          <Card key={entry.id} withBorder padding="sm">
            {editingId === entry.id ? (
              <Stack gap="xs">
                <Group gap="xs" align="center">
                  <TextInput
                    flex={1}
                    value={editKey}
                    onChange={(e) => setEditKey(e.currentTarget.value)}
                    placeholder={t('Key')}
                  />
                  <ActionIcon color="green" variant="light" onClick={handleSaveEdit}>
                    <IconCheck size={16} />
                  </ActionIcon>
                  <ActionIcon color="gray" variant="light" onClick={handleCancelEdit}>
                    <IconX size={16} />
                  </ActionIcon>
                </Group>
                <Textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.currentTarget.value)}
                  placeholder={t('Value')}
                  autosize
                  minRows={2}
                />
              </Stack>
            ) : (
              <Group justify="space-between" align="flex-start">
                <Stack gap={4} flex={1}>
                  <Text size="sm" fw={500}>
                    {entry.key}
                  </Text>
                  <Text size="sm" c="dimmed">
                    {entry.value || <span style={{ fontStyle: 'italic' }}>{t('No value')}</span>}
                  </Text>
                </Stack>
                <Group gap={4}>
                  <ActionIcon
                    color="blue"
                    variant="light"
                    onClick={() => handleStartEdit(entry)}
                  >
                    <IconEdit size={16} />
                  </ActionIcon>
                  <ActionIcon
                    color="red"
                    variant="light"
                    onClick={() => handleDeleteEntry(entry.id)}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              </Group>
            )}
          </Card>
        ))}

        {userPersonalInfo.entries.length === 0 && !showAddForm && (
          <Text size="sm" c="dimmed" ta="center" py="md">
            {t('No personal info entries yet. Add one to personalize AI responses.')}
          </Text>
        )}

        {showAddForm && (
          <Card withBorder padding="sm">
            <Stack gap="xs">
              <TextInput
                value={newKey}
                onChange={(e) => setNewKey(e.currentTarget.value)}
                placeholder={t('Key')}
                autoFocus
              />
              <Textarea
                value={newValue}
                onChange={(e) => setNewValue(e.currentTarget.value)}
                placeholder={t('Value')}
                autosize
                minRows={2}
              />
              <Group gap="xs" justify="flex-end">
                <Button variant="subtle" size="xs" onClick={() => setShowAddForm(false)}>
                  {t('Cancel')}
                </Button>
                <Button size="xs" onClick={handleAddEntry} disabled={!newKey.trim()}>
                  {t('Add')}
                </Button>
              </Group>
            </Stack>
          </Card>
        )}

        {!showAddForm && (
          <Button
            variant="light"
            leftSection={<IconPlus size={16} />}
            onClick={() => setShowAddForm(true)}
          >
            {t('Add Entry')}
          </Button>
        )}
      </Stack>
    </Stack>
  )
}
