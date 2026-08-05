import type { Folder, SessionMeta } from '@shared/types'
import { arrayMove } from '@dnd-kit/sortable'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import NiceModal from '@ebay/nice-modal-react'
import { ActionIcon, Button, Flex, Select, Text, TextInput, Tooltip } from '@mantine/core'
import { IconSearch, IconTrash } from '@tabler/icons-react'
import { useRouterState } from '@tanstack/react-router'
import type { MutableRefObject } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Virtuoso } from 'react-virtuoso'
import { useFolders } from '@/hooks/useFolders'
import { useMyCopilots, useRemoteCopilots } from '@/hooks/useCopilots'
import { getSession, updateSession, updateSessionList, useSessionList } from '@/stores/chatStore'
import { useUIStore } from '@/stores/uiStore'
import FolderItem from './FolderItem'
import SessionItem from './SessionItem'
import { AdaptiveModal } from '../common/AdaptiveModal'

const ALL_FOLDER_KEY = '__all__'

type Props = {
  sessionListViewportRef: MutableRefObject<HTMLDivElement | null>
  showArchived?: boolean
}

type FolderGroup = {
  count: number
  emoji?: string
  implicit?: boolean
  key: string
  name: string
  sessions: SessionMeta[]
}

type RowItem =
  | {
      folder: FolderGroup
      type: 'folder'
    }
  | {
      folderKey: string
      session: SessionMeta
      type: 'session'
    }

function reorderSessionsInSubset(
  sessions: SessionMeta[],
  subsetIds: string[],
  activeId: string,
  overId: string
): SessionMeta[] {
  const subset = sessions.filter((session) => subsetIds.includes(session.id))
  const oldIndex = subset.findIndex((session) => session.id === activeId)
  const newIndex = subset.findIndex((session) => session.id === overId)

  if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) {
    return sessions
  }

  const reorderedSubset = arrayMove(subset, oldIndex, newIndex)
  let subsetIndex = 0

  return sessions.map((session) => (subsetIds.includes(session.id) ? reorderedSubset[subsetIndex++] : session))
}

export default function SessionList({ sessionListViewportRef, showArchived = false }: Props) {
  const { t } = useTranslation()
  const { sessionMetaList: sortedSessions, refetch } = useSessionList()
  const { folders, removeFolder, updateFolder } = useFolders()
  const { copilots: myCopilots } = useMyCopilots()
  const { copilots: remoteCopilots } = useRemoteCopilots()
  const setOpenSearchDialog = useUIStore((s) => s.setOpenSearchDialog)
  const routerState = useRouterState()
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({})
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null)
  const [folderName, setFolderName] = useState('')
  const [folderEmoji, setFolderEmoji] = useState('')
  const [folderDefaultCopilotId, setFolderDefaultCopilotId] = useState<string | null>(null)

  useEffect(() => {
    if (!editingFolder) {
      setFolderName('')
      setFolderEmoji('')
      setFolderDefaultCopilotId(null)
      return
    }

    setFolderName(editingFolder.name)
    setFolderEmoji(editingFolder.emoji || '')
    setFolderDefaultCopilotId(editingFolder.defaultCopilotId || null)
  }, [editingFolder])

  const sensors = useSensors(
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 10,
      },
    }),
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 10,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const visibleSessions = useMemo(
    () => (sortedSessions || []).filter((session) => Boolean(session.archived) === showArchived),
    [showArchived, sortedSessions]
  )

  const groups = useMemo<FolderGroup[]>(() => {
    const groupMap = new Map<string, FolderGroup>()

    for (const folder of folders) {
      groupMap.set(folder.id, {
        key: folder.id,
        name: folder.name,
        emoji: folder.emoji,
        count: 0,
        sessions: [],
      })
    }

    const unfiledSessions: SessionMeta[] = []

    for (const session of visibleSessions) {
      if (session.folderId && groupMap.has(session.folderId)) {
        const group = groupMap.get(session.folderId)!
        group.sessions.push(session)
        group.count += 1
      } else {
        unfiledSessions.push(session)
      }
    }

    const nextGroups: FolderGroup[] = []

    if (unfiledSessions.length > 0 || folders.length === 0) {
      nextGroups.push({
        key: ALL_FOLDER_KEY,
        name: t('All'),
        count: unfiledSessions.length,
        sessions: unfiledSessions,
        implicit: true,
      })
    }

    nextGroups.push(...Array.from(groupMap.values()))
    return nextGroups
  }, [folders, t, visibleSessions])

  const rowItems = useMemo<RowItem[]>(
    () =>
      groups.flatMap((group) => {
        const expanded = expandedFolders[group.key] ?? true
        const rows: RowItem[] = [{ type: 'folder', folder: group }]

        if (expanded) {
          rows.push(
            ...group.sessions.map((session) => ({
              type: 'session' as const,
              session,
              folderKey: group.key,
            }))
          )
        }

        return rows
      }),
    [expandedFolders, groups]
  )

  const visibleSessionIds = useMemo(
    () =>
      rowItems
        .filter((row): row is Extract<RowItem, { type: 'session' }> => row.type === 'session')
        .map((row) => row.session.id),
    [rowItems]
  )

  const folderKeyBySessionId = useMemo(() => {
    const entries = rowItems
      .filter((row): row is Extract<RowItem, { type: 'session' }> => row.type === 'session')
      .map((row) => [row.session.id, row.folderKey] as const)
    return new Map(entries)
  }, [rowItems])

  const copilotOptions = useMemo(
    () => [
      { value: '', label: t('None') },
      ...[...myCopilots, ...remoteCopilots]
        .filter((copilot, index, list) => list.findIndex((item) => item.id === copilot.id) === index)
        .map((copilot) => ({
          value: copilot.id,
          label: copilot.name,
        })),
    ],
    [myCopilots, remoteCopilots, t]
  )

  const onDragEnd = async (event: DragEndEvent) => {
    if (!event.over || !sortedSessions) {
      return
    }

    const activeId = String(event.active.id)
    const overId = String(event.over.id)

    if (activeId === overId) {
      return
    }

    const activeFolderKey = folderKeyBySessionId.get(activeId)
    const overFolderKey = folderKeyBySessionId.get(overId)

    if (!activeFolderKey || activeFolderKey !== overFolderKey) {
      return
    }

    const subsetIds = groups.find((group) => group.key === activeFolderKey)?.sessions.map((session) => session.id) || []

    if (subsetIds.length < 2) {
      return
    }

    await updateSessionList((sessions) => reorderSessionsInSubset(sessions || [], subsetIds, activeId, overId))
    refetch()
  }

  const toggleFolder = (folderKey: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderKey]: !(prev[folderKey] ?? true),
    }))
  }

  const handleDeleteFolder = async (folder: Folder) => {
    const matchingSessionIds = (sortedSessions || [])
      .filter((session) => session.folderId === folder.id)
      .map((session) => session.id)
    await Promise.all(
      matchingSessionIds.map(async (sessionId) => {
        const session = await getSession(sessionId)
        if (!session) {
          return
        }
        await updateSession(sessionId, { folderId: undefined })
      })
    )
    removeFolder(folder.id)
  }

  const handleSaveFolder = () => {
    if (!editingFolder || !folderName.trim()) {
      return
    }

    updateFolder(editingFolder.id, {
      name: folderName.trim(),
      emoji: folderEmoji.trim() || undefined,
      defaultCopilotId: folderDefaultCopilotId || undefined,
    })
    setEditingFolder(null)
  }

  return (
    <>
      <Flex align="center" py="xs" px="md" gap="xs">
        <Text
          c="chatbox-tertiary"
          flex={1}
          className="uppercase tracking-wider"
          style={{ fontFamily: 'var(--chatbox-font-mono)', fontSize: '0.7rem', letterSpacing: '0.08em', fontWeight: 500 }}
        >
          {showArchived ? t('Archived Chats') : t('chat')}
        </Text>

        <Tooltip label={t('Search')} openDelay={1000} withArrow>
          <ActionIcon
            variant="subtle"
            color="chatbox-tertiary"
            size={24}
            onClick={() => setOpenSearchDialog(true, true)}
          >
            <IconSearch />
          </ActionIcon>
        </Tooltip>

        <Tooltip label={t('Clear Conversation List')} openDelay={1000} withArrow>
          <ActionIcon
            variant="subtle"
            color="chatbox-tertiary"
            size={20}
            onClick={() => NiceModal.show('clear-session-list')}
          >
            <IconTrash />
          </ActionIcon>
        </Tooltip>
      </Flex>

      <DndContext
        modifiers={[restrictToVerticalAxis]}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={visibleSessionIds} strategy={verticalListSortingStrategy}>
          <Virtuoso
            style={{ flex: 1 }}
            data={rowItems}
            scrollerRef={(ref) => {
              if (ref instanceof HTMLDivElement) {
                sessionListViewportRef.current = ref
              }
            }}
            itemContent={(_index, row) =>
              row.type === 'folder' ? (
                <FolderItem
                  count={row.folder.count}
                  emoji={row.folder.emoji}
                  expanded={expandedFolders[row.folder.key] ?? true}
                  implicit={row.folder.implicit}
                  name={row.folder.name}
                  onDelete={
                    row.folder.implicit
                      ? undefined
                      : () => {
                          const folder = folders.find((item) => item.id === row.folder.key)
                          if (folder) {
                            void handleDeleteFolder(folder)
                          }
                        }
                  }
                  onRename={
                    row.folder.implicit
                      ? undefined
                      : () => {
                          const folder = folders.find((item) => item.id === row.folder.key)
                          if (folder) {
                            setEditingFolder(folder)
                          }
                        }
                  }
                  onSetDefaultCopilot={
                    row.folder.implicit
                      ? undefined
                      : () => {
                          const folder = folders.find((item) => item.id === row.folder.key)
                          if (folder) {
                            setEditingFolder(folder)
                          }
                        }
                  }
                  onToggle={() => toggleFolder(row.folder.key)}
                />
              ) : (
                <SortableItem id={row.session.id}>
                  <SessionItem
                    selected={routerState.location.pathname === `/session/${row.session.id}`}
                    session={row.session}
                  />
                </SortableItem>
              )
            }
          />
        </SortableContext>
      </DndContext>

      <AdaptiveModal opened={!!editingFolder} onClose={() => setEditingFolder(null)} title={t('Edit Folder')} centered>
        <TextInput
          label={t('Folder Name')}
          value={folderName}
          onChange={(event) => setFolderName(event.currentTarget.value)}
        />
        <TextInput
          mt="sm"
          label={t('Folder Emoji')}
          placeholder="📁"
          value={folderEmoji}
          onChange={(event) => setFolderEmoji(event.currentTarget.value)}
        />
        <Select
          mt="sm"
          label={t('Default Copilot')}
          comboboxProps={{ withinPortal: true }}
          data={copilotOptions}
          value={folderDefaultCopilotId ?? ''}
          onChange={(value) => setFolderDefaultCopilotId(value || null)}
        />

        <AdaptiveModal.Actions>
          <AdaptiveModal.CloseButton onClick={() => setEditingFolder(null)} />
          <Button onClick={handleSaveFolder}>{t('Save')}</Button>
        </AdaptiveModal.Actions>
      </AdaptiveModal>
    </>
  )
}

function SortableItem(props: { id: string; children?: React.ReactNode }) {
  const { id, children } = props
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  )
}
