import { Box, Button, Collapse, Group, Menu, Modal, Stack, Switch, Text, TextInput } from '@mantine/core'
import type { MemoryBank, MemoryEntry } from '@shared/types/memory'
import { IconDots, IconDownload, IconPlus, IconRefresh, IconTrash, IconUpload } from '@tabler/icons-react'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MemoryEntryForm } from './MemoryEntryForm'
import { MemoryEntryRow } from './MemoryEntryRow'
import { filterMemoryEntries, memoryPanelStyle, parseTagsInput } from './memory-ui-state'

export type MemoryBankWorkspaceProps = {
  bank: MemoryBank
  maxEntryChars: number
  clearConfirmMessage: string
  onAdd: (content: string, tags: string[], pinned: boolean) => Promise<boolean>
  onUpdate: (id: string, patch: Partial<Pick<MemoryEntry, 'content' | 'tags' | 'pinned' | 'enabled'>>) => Promise<void>
  onRemove: (id: string) => Promise<void>
  onClear: () => Promise<void>
  onRebuild: () => Promise<void>
  onExport: () => void
  onImport: (file: File | null) => Promise<void>
}

export function MemoryBankWorkspace({
  bank,
  maxEntryChars,
  clearConfirmMessage,
  onAdd,
  onUpdate,
  onRemove,
  onClear,
  onRebuild,
  onExport,
  onImport,
}: MemoryBankWorkspaceProps) {
  const { t } = useTranslation()
  const importInputRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newContent, setNewContent] = useState('')
  const [newTags, setNewTags] = useState('')
  const [newPinned, setNewPinned] = useState(false)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editTags, setEditTags] = useState('')
  const [editPinned, setEditPinned] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  const archivedCount = useMemo(
    () => bank.entries.filter((e) => e.archived || !e.enabled).length,
    [bank.entries]
  )

  const entries = useMemo(
    () => filterMemoryEntries(bank.entries, search, { includeArchived: showArchived }),
    [bank.entries, search, showArchived]
  )

  const openAdd = () => {
    setEditingId(null)
    setShowAdd(true)
  }

  const resetAdd = () => {
    setShowAdd(false)
    setNewContent('')
    setNewTags('')
    setNewPinned(false)
  }

  const handleAdd = async () => {
    if (!newContent.trim() || adding) return
    if (newContent.length > maxEntryChars) return
    setAdding(true)
    try {
      const ok = await onAdd(newContent.trim(), parseTagsInput(newTags), newPinned)
      if (ok) resetAdd()
    } finally {
      setAdding(false)
    }
  }

  const startEdit = (entry: MemoryEntry) => {
    setShowAdd(false)
    setEditingId(entry.id)
    setEditContent(entry.content)
    setEditTags(entry.tags.join(', '))
    setEditPinned(entry.pinned)
  }

  const handleSaveEdit = async () => {
    if (!editingId || !editContent.trim()) return
    if (editContent.length > maxEntryChars) return
    setSavingEdit(true)
    try {
      await onUpdate(editingId, {
        content: editContent.trim(),
        tags: parseTagsInput(editTags),
        pinned: editPinned,
      })
      setEditingId(null)
    } finally {
      setSavingEdit(false)
    }
  }

  const handleConfirmClear = async () => {
    setClearing(true)
    try {
      await onClear()
      setClearOpen(false)
    } finally {
      setClearing(false)
    }
  }

  return (
    <Stack gap="sm">
      <Box p="sm" style={memoryPanelStyle}>
        <Text size="xs" c="chatbox-tertiary" mb={4} className="tabular-nums">
          {t('Profile summary')}
          {bank.profileUpdatedAt ? ` · ${new Date(bank.profileUpdatedAt).toLocaleString()}` : ''}
        </Text>
        {bank.profileSummary ? (
          <Text size="sm" style={{ whiteSpace: 'pre-wrap', textWrap: 'pretty' as const }}>
            {bank.profileSummary}
          </Text>
        ) : (
          <Stack gap={6}>
            <Text size="sm" c="chatbox-tertiary" style={{ textWrap: 'pretty' as const }}>
              {t('No profile summary yet. Add memories or wait for auto-save.')}
            </Text>
            {bank.entries.length > 0 && (
              <Button
                size="xs"
                variant="subtle"
                leftSection={<IconRefresh size={14} />}
                onClick={() => void onRebuild()}
                w="fit-content"
                className="active:scale-[0.96] transition-transform"
              >
                {t('Rebuild profile')}
              </Button>
            )}
          </Stack>
        )}
      </Box>

      {archivedCount > 0 ? (
        <Switch
          size="sm"
          label={t('Show archived / disabled ({{count}})', { count: archivedCount })}
          checked={showArchived}
          onChange={(e) => setShowArchived(e.currentTarget.checked)}
        />
      ) : null}

      <Group gap="xs" wrap="nowrap" align="flex-start">
        <TextInput
          placeholder={t('Search memories')}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          flex={1}
          radius={9}
        />
        <Button
          size="sm"
          leftSection={<IconPlus size={16} />}
          onClick={openAdd}
          className="active:scale-[0.96] transition-transform"
          style={{ flexShrink: 0 }}
        >
          {t('Add memory')}
        </Button>
        <Menu shadow="md" width={200} position="bottom-end">
          <Menu.Target>
            <Button
              size="sm"
              variant="default"
              px="xs"
              aria-label={t('More actions')}
              style={{ flexShrink: 0, minWidth: 36 }}
            >
              <IconDots size={16} />
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item leftSection={<IconRefresh size={14} />} onClick={() => void onRebuild()}>
              {t('Rebuild profile')}
            </Menu.Item>
            <Menu.Item leftSection={<IconDownload size={14} />} onClick={onExport}>
              {t('Export')}
            </Menu.Item>
            <Menu.Item leftSection={<IconUpload size={14} />} onClick={() => importInputRef.current?.click()}>
              {t('Import')}
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={() => setClearOpen(true)}>
              {t('Clear all')}
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
        <input
          ref={importInputRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            void onImport(e.target.files?.[0] ?? null)
            e.target.value = ''
          }}
        />
      </Group>

      <Collapse in={showAdd}>
        <MemoryEntryForm
          mode="create"
          content={newContent}
          tags={newTags}
          pinned={newPinned}
          maxChars={maxEntryChars}
          loading={adding}
          showPinned
          onContentChange={setNewContent}
          onTagsChange={setNewTags}
          onPinnedChange={setNewPinned}
          onSubmit={() => void handleAdd()}
          onCancel={resetAdd}
        />
      </Collapse>

      <Text size="xs" c="chatbox-tertiary" className="tabular-nums">
        {entries.length} {t('entries')}
        {search.trim() ? ` · ${t('filtered')}` : ''}
      </Text>

      {entries.map((entry) => (
        <MemoryEntryRow
          key={entry.id}
          entry={entry}
          editing={editingId === entry.id}
          editContent={editContent}
          editTags={editTags}
          editPinned={editPinned}
          maxChars={maxEntryChars}
          saving={savingEdit && editingId === entry.id}
          onEditContent={setEditContent}
          onEditTags={setEditTags}
          onEditPinned={setEditPinned}
          onStartEdit={() => startEdit(entry)}
          onSaveEdit={() => void handleSaveEdit()}
          onCancelEdit={() => setEditingId(null)}
          onTogglePin={() => void onUpdate(entry.id, { pinned: !entry.pinned })}
          onToggleEnabled={() => void onUpdate(entry.id, { enabled: !entry.enabled })}
          onDelete={() => void onRemove(entry.id)}
        />
      ))}

      {entries.length === 0 && !showAdd && (
        <Box py="xl" px="md" style={{ ...memoryPanelStyle, textAlign: 'center' }}>
          <Stack gap="sm" align="center">
            <Text size="sm" fw={500}>
              {search.trim() ? t('No matching memories') : t('No memories yet')}
            </Text>
            {!search.trim() && (
              <>
                <Text size="sm" c="chatbox-tertiary" maw={360} style={{ textWrap: 'pretty' as const }}>
                  {t('Add a durable fact (preferred language, project name, constraints) so models can use it later.')}
                </Text>
                <Button
                  size="sm"
                  leftSection={<IconPlus size={16} />}
                  onClick={openAdd}
                  className="active:scale-[0.96] transition-transform"
                >
                  {t('Add memory')}
                </Button>
              </>
            )}
          </Stack>
        </Box>
      )}

      <Modal
        opened={clearOpen}
        onClose={() => !clearing && setClearOpen(false)}
        title={t('Clear memories')}
        centered
        radius={11}
      >
        <Stack gap="md">
          <Text size="sm" style={{ textWrap: 'pretty' as const }}>
            {clearConfirmMessage}
          </Text>
          <Group justify="flex-end" gap="xs">
            <Button variant="default" disabled={clearing} onClick={() => setClearOpen(false)}>
              {t('Cancel')}
            </Button>
            <Button
              color="red"
              loading={clearing}
              onClick={() => void handleConfirmClear()}
              className="active:scale-[0.96] transition-transform"
            >
              {t('Clear all')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}
