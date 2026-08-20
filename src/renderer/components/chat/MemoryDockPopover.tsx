import { Button, Divider, Flex, Popover, Stack, Switch, Text, Textarea, TextInput, UnstyledButton } from '@mantine/core'
import type { MemoryEntry } from '@shared/types/memory'
import { IconBrain, IconPlus, IconSearch, IconSettings } from '@tabler/icons-react'
import { type FC, type ReactNode, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { AdaptiveModal } from '@/components/common/AdaptiveModal'
import { parseTagsInput } from '@/components/settings/memory/memory-ui-state'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
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
  /**
   * Session-level memory auto-save. undefined/true = on (inherit), false = off.
   * When onMemoryAutoSaveChange is provided, a prominent toggle is shown.
   */
  memoryAutoSave?: boolean
  onMemoryAutoSaveChange?: (enabled: boolean) => void
  /** Disable toggle while session is not ready (e.g. new unsaved chat). */
  memoryAutoSaveDisabled?: boolean
  /**
   * Force AdaptiveModal instead of Popover.
   * Use from tools overflow so Memory never stacks over the + menu on small desktop.
   */
  forceModal?: boolean
  /** Called when Memory opens (tools menu should close). */
  onOpen?: () => void
}

export const MemoryDockPopover: FC<MemoryDockPopoverProps> = ({
  className,
  label,
  on,
  title,
  trigger,
  onInsertMemory,
  getMemorySaveContent,
  memoryAutoSave,
  onMemoryAutoSaveChange,
  memoryAutoSaveDisabled = false,
  forceModal = false,
  onOpen,
}) => {
  const { t } = useTranslation()
  const isSmallScreen = useIsSmallScreen()
  const ready = useMemoryStore((state) => state.ready)
  const globalBank = useMemoryStore((state) => state.globalBank)
  const globalMemoryEnabled = useMemoryStore((state) => state.settings.enabled)
  const globalAutoSave = useMemoryStore((state) => state.settings.autoSave)
  const maxEntryChars = useMemoryStore((state) => state.settings.maxEntryChars ?? 500)
  const retain = useMemoryStore((state) => state.retain)
  const sessionAutoSaveOn = memoryAutoSave !== false
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

  // useModal is defined below body via const — compute early for header layout
  const preferModal = forceModal || isSmallScreen

  const body = (
    <Stack gap="sm" className="memory-dock-body">
      <Flex justify={preferModal ? 'flex-end' : 'space-between'} align="center" gap="sm" className="memory-dock-header">
        {!preferModal ? (
          <Flex align="center" gap={6}>
            <IconBrain size={16} stroke={1.6} className="memory-dock-header-icon" />
            <Text size="sm" fw={600} className="memory-dock-title">
              {t('Memory')}
            </Text>
          </Flex>
        ) : null}
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

      {onMemoryAutoSaveChange && (
        <Stack
          gap={4}
          className="rounded-md border border-solid border-chatbox-border-primary bg-[var(--chatbox-background-secondary)] px-2.5 py-2"
        >
          <Flex justify="space-between" align="center" gap="sm">
            <Stack gap={0} className="min-w-0">
              <Text size="sm" fw={600}>
                {t('Auto-save this chat')}
              </Text>
              <Text size="xs" c="dimmed" lineClamp={2}>
                {!globalMemoryEnabled
                  ? t('Memory is off globally in Settings.')
                  : !sessionAutoSaveOn
                    ? t('Off — no auto-extract or model retain. Manual save still works.')
                    : !globalAutoSave
                      ? t('On for this chat, but global Auto-save is off in Settings.')
                      : t('On — durable facts may be saved from this chat.')}
              </Text>
            </Stack>
            <Switch
              size="sm"
              checked={sessionAutoSaveOn}
              disabled={memoryAutoSaveDisabled || !globalMemoryEnabled}
              onChange={(e) => onMemoryAutoSaveChange(e.currentTarget.checked)}
              aria-label={t('Auto-save memories from this chat')}
            />
          </Flex>
        </Stack>
      )}

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
              onClick={() => void saveMemory()}
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
            {query.trim() ? t('Results ranked by relevance') : t('Pinned and recent')}
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
            onCopy={(entryContent) => void copyMemory(entryContent)}
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
  )

  const openMemory = () => {
    // Close parent tools menu first so Memory never stacks over it.
    onOpen?.()
    // Defer open one frame so Menu/Drawer unmount doesn't steal focus/portal.
    window.requestAnimationFrame(() => setOpened(true))
  }

  const toggleMemory = () => {
    if (opened) {
      setOpened(false)
      return
    }
    openMemory()
  }

  const triggerNode = (
    <span
      className="inline-flex w-full min-w-0"
      onClick={(event) => {
        // Tools menu / sheet: stop so parent Menu doesn't steal the click.
        event.stopPropagation()
        toggleMemory()
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          event.stopPropagation()
          toggleMemory()
        }
      }}
    >
      {trigger ?? (
        <UnstyledButton type="button" className={className} aria-label={label} title={title}>
          <span className="session-statusline-chip-label">{t('Memory')}</span>
          <span className="session-statusline-val" style={{ opacity: on ? 1 : 0.55 }}>
            {label}
          </span>
        </UnstyledButton>
      )}
    </span>
  )

  // Modal path: mobile sheet + tools-overflow origin (never stack over + menu).
  if (preferModal) {
    return (
      <>
        {triggerNode}
        <AdaptiveModal
          opened={opened}
          onClose={() => setOpened(false)}
          title={t('Memory')}
          description={title}
          size="md"
          className="memory-dock-modal"
        >
          <div className="memory-dock-modal-body">{body}</div>
        </AdaptiveModal>
      </>
    )
  }

  return (
    <Popover
      opened={opened}
      onChange={(next) => {
        if (next) onOpen?.()
        setOpened(next)
      }}
      position="top-start"
      shadow="md"
      width={Math.min(360, typeof window !== 'undefined' ? window.innerWidth - 32 : 360)}
      withinPortal
      middlewares={{ flip: true, shift: true, inline: false }}
      offset={10}
    >
      <Popover.Target>{triggerNode}</Popover.Target>
      <Popover.Dropdown p="sm" className="memory-dock-dropdown">
        {body}
      </Popover.Dropdown>
    </Popover>
  )
}
