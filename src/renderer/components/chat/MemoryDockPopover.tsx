import { Button, Divider, Flex, Popover, Stack, Text, Textarea, TextInput, UnstyledButton } from '@mantine/core'
import type { MemoryEntry } from '@shared/types/memory'
import { IconBrain, IconPlus, IconSearch, IconSettings } from '@tabler/icons-react'
import { type FC, type ReactNode, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { parseTagsInput } from '@/components/settings/memory/memory-ui-state'
import { navigateToSettings } from '@/modals/Settings'
import { searchEntries } from '@/packages/memory/bank-ops'
import { ensureMemoryStoreInit, useMemoryStore } from '@/stores/memoryStore'
import { MemorySearchResults } from './MemorySearchResults'
import { MemoryTagFilter } from './MemoryTagFilter'
import { filterMemoryEntriesByTag, getMemoryTags } from './memory-dock-utils'

export type MemoryDockPopoverProps = {
  className?: string
  label: string
  on: boolean
  title: string
  trigger?: ReactNode
  onInsertMemory?: (entry: MemoryEntry) => void
  getMemorySaveContent?: () => string
}

export const MemoryDockPopover: FC<MemoryDockPopoverProps> = ({
  className,
  label,
  on,
  title,
  trigger,
  onInsertMemory,
  getMemorySaveContent,
}) => {
  const { t } = useTranslation()
  const ready = useMemoryStore((state) => state.ready)
  const globalBank = useMemoryStore((state) => state.globalBank)
  const maxEntryChars = useMemoryStore((state) => state.settings.maxEntryChars ?? 500)
  const retain = useMemoryStore((state) => state.retain)
  const [opened, setOpened] = useState(false)
  const [query, setQuery] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showSaveForm, setShowSaveForm] = useState(false)
  const [content, setContent] = useState('')
  const [tags, setTags] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void ensureMemoryStoreInit()
  }, [])

  const tagsByBank = useMemo(() => getMemoryTags(globalBank.entries), [globalBank.entries])
  const filteredBank = useMemo(
    () => ({ ...globalBank, entries: filterMemoryEntriesByTag(globalBank.entries, activeTag) }),
    [activeTag, globalBank]
  )
  const entries = useMemo(
    () => searchEntries(filteredBank, query, { limit: 8, enabledOnly: true }),
    [filteredBank, query]
  )
  const selectedEntries = useMemo(() => entries.filter((entry) => selectedIds.has(entry.id)), [entries, selectedIds])

  const openSaveForm = () => {
    setContent(getMemorySaveContent?.() ?? '')
    setTags('')
    setShowSaveForm(true)
  }

  const insertMemories = (memories: MemoryEntry[]) => {
    memories.forEach((memory) => onInsertMemory?.(memory))
    setOpened(false)
    toast.success(
      memories.length === 1
        ? t('Added memory to chat')
        : t('Added {{count}} memories to chat', { count: memories.length })
    )
  }

  const toggleSelectedEntry = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const changeActiveTag = (tag: string | null) => {
    setActiveTag(tag)
    setSelectedIds(new Set())
  }

  const copyMemory = async (memory: string) => {
    try {
      await navigator.clipboard.writeText(memory)
      toast.success(t('Copied memory'))
    } catch {
      toast.error(t('Failed to copy memory'))
    }
  }

  const saveMemory = async () => {
    const trimmedContent = content.trim()
    if (!trimmedContent || trimmedContent.length > maxEntryChars) return

    setSaving(true)
    try {
      const entry = await retain({
        content: trimmedContent,
        scope: 'global',
        tags: parseTagsInput(tags),
        source: 'user',
        pinned: false,
      })
      if (!entry) {
        toast.error(t('Failed to save memory'))
        return
      }
      setShowSaveForm(false)
      setContent('')
      setTags('')
      toast.success(t('Saved to Global memory'))
    } catch {
      toast.error(t('Failed to save memory'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Popover opened={opened} onChange={setOpened} position="top-end" shadow="md" width={360} withinPortal>
      <Popover.Target>
        <span className="inline-flex" onClick={() => setOpened((current) => !current)}>
          {trigger ?? (
            <UnstyledButton type="button" className={className} aria-label={label} title={title}>
              <span className="session-statusline-key">mem</span>
              <span className="session-statusline-val" style={{ opacity: on ? 1 : 0.55 }}>
                {label}
              </span>
            </UnstyledButton>
          )}
        </span>
      </Popover.Target>

      <Popover.Dropdown p="sm" className="memory-dock-dropdown">
        <Stack gap="sm" className="memory-dock-body">
          <Flex justify="space-between" align="center" gap="sm" className="memory-dock-header">
            <Flex align="center" gap={6}>
              <IconBrain size={16} stroke={1.6} className="memory-dock-header-icon" />
              <Text size="sm" fw={600} className="memory-dock-title">
                {t('Memory')}
              </Text>
            </Flex>
            <Button
              variant="subtle"
              size="compact-sm"
              leftSection={<IconSettings size={14} />}
              onClick={() => {
                setOpened(false)
                navigateToSettings('memory')
              }}
              className="memory-dock-manage"
            >
              {t('Manage')}
            </Button>
          </Flex>

          {showSaveForm ? (
            <>
              <Textarea
                label={t('Memory to save')}
                description={t('Review before saving. New memories are unpinned by default.')}
                value={content}
                onChange={(event) => setContent(event.currentTarget.value)}
                autosize
                minRows={3}
                maxRows={7}
                error={
                  content.length > maxEntryChars ? t('Over {{max}} character limit', { max: maxEntryChars }) : undefined
                }
              />
              <TextInput
                label={t('Tags')}
                description={t('Optional · comma separated')}
                value={tags}
                onChange={(event) => setTags(event.currentTarget.value)}
                placeholder={t('prefs, project')}
              />
              <Flex justify="flex-end" gap="xs">
                <Button variant="default" size="sm" disabled={saving} onClick={() => setShowSaveForm(false)}>
                  {t('Cancel')}
                </Button>
                <Button
                  size="sm"
                  loading={saving}
                  disabled={!content.trim() || content.length > maxEntryChars}
                  onClick={saveMemory}
                >
                  {t('Save memory')}
                </Button>
              </Flex>
            </>
          ) : (
            <>
              <TextInput
                leftSection={<IconSearch size={15} />}
                placeholder={t('Search memory')}
                value={query}
                onChange={(event) => {
                  setQuery(event.currentTarget.value)
                  setSelectedIds(new Set())
                }}
                disabled={!ready}
              />
              <Text size="xs" c="chatbox-tertiary">
                {query.trim() ? t('Matches use the same recall ranking as chat.') : t('Pinned and recent memories')}
              </Text>
              <MemoryTagFilter tags={tagsByBank} activeTag={activeTag} onTagChange={changeActiveTag} />
              <MemorySearchResults
                entries={entries}
                selectedIds={selectedIds}
                query={query}
                ready={ready}
                canInsert={Boolean(onInsertMemory)}
                onToggle={toggleSelectedEntry}
                onInsert={(entry) => insertMemories([entry])}
                onCopy={(content) => void copyMemory(content)}
              />
              {selectedEntries.length > 0 && (
                <Button size="sm" onClick={() => insertMemories(selectedEntries)}>
                  {t('Insert {{count}} selected', { count: selectedEntries.length })}
                </Button>
              )}
              <Divider />
              <Button variant="light" size="sm" leftSection={<IconPlus size={14} />} onClick={openSaveForm}>
                {t('Save memory from draft')}
              </Button>
            </>
          )}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  )
}
