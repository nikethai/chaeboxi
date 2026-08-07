import type { DragEndEvent } from '@dnd-kit/core'
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDroppable,
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
import { ActionIcon, Button, Select, Text, TextInput, Tooltip, UnstyledButton } from '@mantine/core'
import type { Folder, SessionMeta } from '@shared/types'
import { IconChevronDown, IconFolderPlus, IconTrash } from '@tabler/icons-react'
import { useRouterState } from '@tanstack/react-router'
import clsx from 'clsx'
import type { MutableRefObject, ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Virtuoso } from 'react-virtuoso'
import { useMyCopilots, useRemoteCopilots } from '@/hooks/useCopilots'
import { useFolders } from '@/hooks/useFolders'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import { trackingEvent } from '@/packages/event'
import { getSession, updateSession, updateSessionList, useSessionList } from '@/stores/chatStore'
import { createEmpty } from '@/stores/sessionActions'
import { AdaptiveModal } from '../common/AdaptiveModal'
import FolderItem from './FolderItem'
import SessionItem from './SessionItem'
import {
  ALL_FOLDER_KEY,
  type DayBucket,
  folderDropId,
  groupSessionsByDay,
  parseDropTargetId,
  RECENTS_COACHING_THRESHOLD,
  RECENTS_DROP_ID,
  reorderSessionsInSubset,
} from './session-list-helpers'

type Props = {
  onCreateProject?(): void
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
      nested?: boolean
      session: SessionMeta
      type: 'session'
    }
  | {
      type: 'empty'
      key: string
      message: string
    }
  | {
      type: 'day'
      key: string
      label: string
    }
  | {
      type: 'coaching'
      key: string
      message: string
    }

type SectionRow =
  | {
      type: 'section'
      key: string
      label: string
      open: boolean
      onToggle: () => void
      droppableId?: string
      trailing?: ReactNode
    }
  | RowItem

function dayBucketLabel(bucket: DayBucket, t: (key: string) => string): string {
  switch (bucket) {
    case 'today':
      return t('Today')
    case 'yesterday':
      return t('Yesterday')
    case 'older':
      return t('Older')
    default:
      return t('Older')
  }
}

export default function SessionList({ sessionListViewportRef, showArchived = false, onCreateProject }: Props) {
  const { t } = useTranslation()
  const isSmallScreen = useIsSmallScreen()
  const { sessionMetaList: sortedSessions, refetch } = useSessionList()
  const { folders, removeFolder, updateFolder } = useFolders()
  const { copilots: myCopilots } = useMyCopilots()
  const { copilots: remoteCopilots } = useRemoteCopilots()
  const routerState = useRouterState()
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({})
  const [projectsOpen, setProjectsOpen] = useState(true)
  const [recentsOpen, setRecentsOpen] = useState(true)
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null)
  const [folderName, setFolderName] = useState('')
  const [folderDefaultCopilotId, setFolderDefaultCopilotId] = useState<string | null>(null)

  useEffect(() => {
    if (!editingFolder) {
      setFolderName('')
      setFolderDefaultCopilotId(null)
      return
    }

    setFolderName(editingFolder.name)
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

  const { projectGroups, historySessions } = useMemo(() => {
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

    const unfiled: SessionMeta[] = []

    for (const session of visibleSessions) {
      const group = session.folderId ? groupMap.get(session.folderId) : undefined
      if (group) {
        group.sessions.push(session)
        group.count += 1
      } else {
        unfiled.push(session)
      }
    }

    return {
      projectGroups: Array.from(groupMap.values()),
      historySessions: unfiled,
    }
  }, [folders, visibleSessions])

  // DnD subsets keyed by folder (or ALL for recents)
  const groups = useMemo<FolderGroup[]>(() => {
    const next: FolderGroup[] = [
      {
        key: ALL_FOLDER_KEY,
        name: t('Recents'),
        count: historySessions.length,
        sessions: historySessions,
        implicit: true,
      },
      ...projectGroups,
    ]
    return next
  }, [historySessions, projectGroups, t])

  const showRecentsCoaching =
    !showArchived && projectGroups.length > 0 && historySessions.length >= RECENTS_COACHING_THRESHOLD

  const rowItems = useMemo<SectionRow[]>(() => {
    const rows: SectionRow[] = []

    // Projects — always visible
    rows.push({
      type: 'section',
      key: 'projects',
      label: t('Projects'),
      open: projectsOpen,
      onToggle: () => setProjectsOpen((v) => !v),
      trailing: onCreateProject ? (
        <Tooltip label={t('New Project')} openDelay={400} withArrow>
          <ActionIcon
            variant="subtle"
            color="chatbox-tertiary"
            size={28}
            radius="sm"
            className={clsx(
              'active:scale-[0.96] transition-transform rail-section-add',
              isSmallScreen ? '' : 'opacity-0 group-hover/rail-section:opacity-100 focus-visible:opacity-100'
            )}
            onClick={(e) => {
              e.stopPropagation()
              onCreateProject()
            }}
            aria-label={t('New Project')}
          >
            <IconFolderPlus size={15} stroke={1.5} />
          </ActionIcon>
        </Tooltip>
      ) : undefined,
    })

    if (projectsOpen) {
      if (projectGroups.length === 0) {
        rows.push({
          type: 'empty',
          key: 'projects-empty',
          message: t('No projects yet'),
        })
      } else {
        for (const group of projectGroups) {
          const expanded = expandedFolders[group.key] ?? true
          rows.push({ type: 'folder', folder: group })
          if (expanded) {
            for (const session of group.sessions) {
              rows.push({ type: 'session', session, folderKey: group.key, nested: true })
            }
          }
        }
      }
    }

    // Recents — unfiled sessions
    rows.push({
      type: 'section',
      key: 'recents',
      label: showArchived ? t('Archived') : t('Recents'),
      open: recentsOpen,
      onToggle: () => setRecentsOpen((v) => !v),
      droppableId: showArchived ? undefined : RECENTS_DROP_ID,
      trailing: (
        <Tooltip label={t('Clear Conversation List')} openDelay={600} withArrow>
          <ActionIcon
            variant="subtle"
            color="chatbox-tertiary"
            size={28}
            radius="sm"
            className="active:scale-[0.96] transition-transform"
            onClick={(e) => {
              e.stopPropagation()
              void NiceModal.show('clear-session-list')
            }}
            aria-label={t('Clear Conversation List')}
          >
            <IconTrash size={14} stroke={1.5} />
          </ActionIcon>
        </Tooltip>
      ),
    })

    if (recentsOpen) {
      if (showRecentsCoaching) {
        rows.push({
          type: 'coaching',
          key: 'recents-coaching',
          message: t('{{count}} chats not in a project — drag into a project to organize', {
            count: historySessions.length,
          }),
        })
      }

      if (historySessions.length === 0) {
        rows.push({
          type: 'empty',
          key: 'recents-empty',
          message: showArchived ? t('No archived chats') : t('No recent chats'),
        })
      } else if (showArchived) {
        for (const session of historySessions) {
          rows.push({ type: 'session', session, folderKey: ALL_FOLDER_KEY })
        }
      } else {
        const dayGroups = groupSessionsByDay(historySessions)
        const useDayHeaders = dayGroups.length > 1 || dayGroups[0]?.bucket !== 'unknown'
        for (const group of dayGroups) {
          if (useDayHeaders && group.bucket !== 'unknown') {
            rows.push({
              type: 'day',
              key: `day-${group.bucket}`,
              label: dayBucketLabel(group.bucket, t),
            })
          }
          for (const session of group.sessions) {
            rows.push({ type: 'session', session, folderKey: ALL_FOLDER_KEY })
          }
        }
      }
    }

    return rows
  }, [
    expandedFolders,
    historySessions,
    isSmallScreen,
    onCreateProject,
    projectGroups,
    projectsOpen,
    recentsOpen,
    showArchived,
    showRecentsCoaching,
    t,
  ])

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

    // Cross-folder assign: drop on project row or Recents zone
    const dropTarget = parseDropTargetId(overId)
    if (dropTarget) {
      const activeMeta = sortedSessions.find((s) => s.id === activeId)
      if (!activeMeta) {
        return
      }

      if (dropTarget.type === 'folder') {
        if (activeMeta.folderId === dropTarget.folderId) {
          return
        }
        setExpandedFolders((prev) => ({ ...prev, [dropTarget.folderId]: true }))
        setProjectsOpen(true)
        await updateSession(activeId, { folderId: dropTarget.folderId })
        refetch()
        return
      }

      // Recents
      if (!activeMeta.folderId) {
        return
      }
      setRecentsOpen(true)
      await updateSession(activeId, { folderId: undefined })
      refetch()
      return
    }

    // Drop on another session: if different folder group, move into that session's folder
    const activeFolderKey = folderKeyBySessionId.get(activeId)
    const overFolderKey = folderKeyBySessionId.get(overId)

    if (activeFolderKey && overFolderKey && activeFolderKey !== overFolderKey) {
      const targetFolderId = overFolderKey === ALL_FOLDER_KEY ? undefined : overFolderKey
      if (overFolderKey !== ALL_FOLDER_KEY) {
        setExpandedFolders((prev) => ({ ...prev, [overFolderKey]: true }))
        setProjectsOpen(true)
      } else {
        setRecentsOpen(true)
      }
      await updateSession(activeId, { folderId: targetFolderId })
      refetch()
      return
    }

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
      defaultCopilotId: folderDefaultCopilotId || undefined,
    })
    setEditingFolder(null)
  }

  const handleCreateChatInFolder = async (folder: Folder) => {
    setExpandedFolders((prev) => ({ ...prev, [folder.id]: true }))
    setProjectsOpen(true)
    await createEmpty('chat', {
      folderId: folder.id,
      copilotId: folder.defaultCopilotId,
    })
    trackingEvent('create_new_conversation', { event_category: 'user', source: 'project' })
    refetch()
  }

  return (
    <>
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
            itemContent={(_index, row) => {
              if (row.type === 'section') {
                return (
                  <SectionHeader
                    label={row.label}
                    open={row.open}
                    onToggle={row.onToggle}
                    trailing={row.trailing}
                    droppableId={row.droppableId}
                  />
                )
              }

              if (row.type === 'empty') {
                return (
                  <Text size="xs" c="chatbox-tertiary" px="md" py={6} className="rail-empty-hint">
                    {row.message}
                  </Text>
                )
              }

              if (row.type === 'day') {
                return (
                  <div className="rail-day-header">
                    <span>{row.label}</span>
                  </div>
                )
              }

              if (row.type === 'coaching') {
                return (
                  <Text size="xs" c="chatbox-tertiary" px="md" py={4} className="rail-coaching-hint">
                    {row.message}
                  </Text>
                )
              }

              if (row.type === 'folder') {
                const folder = folders.find((item) => item.id === row.folder.key)
                return (
                  <FolderDroppable id={folderDropId(row.folder.key)}>
                    <FolderItem
                      count={row.folder.count}
                      emoji={row.folder.emoji}
                      expanded={expandedFolders[row.folder.key] ?? true}
                      implicit={row.folder.implicit}
                      name={row.folder.name}
                      onCreateChat={
                        row.folder.implicit || !folder
                          ? undefined
                          : () => {
                              void handleCreateChatInFolder(folder)
                            }
                      }
                      onDelete={
                        row.folder.implicit || !folder
                          ? undefined
                          : () => {
                              void handleDeleteFolder(folder)
                            }
                      }
                      onRename={
                        row.folder.implicit || !folder
                          ? undefined
                          : () => {
                              setEditingFolder(folder)
                            }
                      }
                      onSetDefaultCopilot={
                        row.folder.implicit || !folder
                          ? undefined
                          : () => {
                              setEditingFolder(folder)
                            }
                      }
                      onToggle={() => toggleFolder(row.folder.key)}
                    />
                  </FolderDroppable>
                )
              }

              return (
                <SortableItem id={row.session.id}>
                  <SessionItem
                    nested={row.nested}
                    selected={routerState.location.pathname === `/session/${row.session.id}`}
                    session={row.session}
                  />
                </SortableItem>
              )
            }}
          />
        </SortableContext>
      </DndContext>

      <AdaptiveModal opened={!!editingFolder} onClose={() => setEditingFolder(null)} title={t('Edit Project')} centered>
        <TextInput
          label={t('Project Name')}
          value={folderName}
          onChange={(event) => setFolderName(event.currentTarget.value)}
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

function SectionHeader({
  label,
  open,
  onToggle,
  trailing,
  droppableId,
}: {
  label: string
  open: boolean
  onToggle: () => void
  trailing?: ReactNode
  droppableId?: string
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: droppableId || `section-static:${label}`,
    disabled: !droppableId,
  })

  return (
    <div ref={setNodeRef} className={clsx(isOver && droppableId && 'rail-drop-target')}>
      <UnstyledButton type="button" className="rail-section group/rail-section" onClick={onToggle} aria-expanded={open}>
        <span className="rail-section-label">{label}</span>
        <span className="rail-section-trail">
          {trailing}
          <IconChevronDown
            size={14}
            stroke={1.75}
            className={open ? 'rail-section-chevron is-open' : 'rail-section-chevron'}
            aria-hidden
          />
        </span>
      </UnstyledButton>
    </div>
  )
}

function FolderDroppable(props: { id: string; children?: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: props.id })
  return (
    <div ref={setNodeRef} className={clsx(isOver && 'rail-drop-target')}>
      {props.children}
    </div>
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
