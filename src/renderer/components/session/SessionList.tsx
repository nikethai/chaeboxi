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
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import NiceModal from '@ebay/nice-modal-react'
import { ActionIcon, Button, Select, TextInput, Tooltip, UnstyledButton } from '@mantine/core'
import type { Folder, SessionMeta } from '@shared/types'
import { IconChevronDown, IconTrash } from '@tabler/icons-react'
import { useRouterState } from '@tanstack/react-router'
import type { MutableRefObject, ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Virtuoso } from 'react-virtuoso'
import { useMyCopilots, useRemoteCopilots } from '@/hooks/useCopilots'
import { useFolders } from '@/hooks/useFolders'
import { getSession, updateSession, updateSessionList, useSessionList } from '@/stores/chatStore'
import { AdaptiveModal } from '../common/AdaptiveModal'
import FolderItem from './FolderItem'
import SessionItem from './SessionItem'

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
  const routerState = useRouterState()
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({})
  const [projectsOpen, setProjectsOpen] = useState(true)
  const [historyOpen, setHistoryOpen] = useState(true)
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

  // DnD subsets still keyed by folder (or ALL for history)
  const groups = useMemo<FolderGroup[]>(() => {
    const next: FolderGroup[] = []
    if (historySessions.length > 0 || projectGroups.length === 0) {
      next.push({
        key: ALL_FOLDER_KEY,
        name: t('History'),
        count: historySessions.length,
        sessions: historySessions,
        implicit: true,
      })
    }
    next.push(...projectGroups)
    return next
  }, [historySessions, projectGroups, t])

  type SectionRow =
    | { type: 'section'; key: string; label: string; open: boolean; onToggle: () => void; trailing?: ReactNode }
    | RowItem

  const rowItems = useMemo<SectionRow[]>(() => {
    const rows: SectionRow[] = []

    // Projects — Grok-style collapsible section for folders
    if (projectGroups.length > 0) {
      rows.push({
        type: 'section',
        key: 'projects',
        label: t('Projects'),
        open: projectsOpen,
        onToggle: () => setProjectsOpen((v) => !v),
      })

      if (projectsOpen) {
        for (const group of projectGroups) {
          const expanded = expandedFolders[group.key] ?? true
          rows.push({ type: 'folder', folder: group })
          if (expanded) {
            for (const session of group.sessions) {
              rows.push({ type: 'session', session, folderKey: group.key })
            }
          }
        }
      }
    }

    // History — unfiled sessions (Grok History DNA)
    rows.push({
      type: 'section',
      key: 'history',
      label: showArchived ? t('Archived') : t('History'),
      open: historyOpen,
      onToggle: () => setHistoryOpen((v) => !v),
      trailing: (
        <Tooltip label={t('Clear Conversation List')} openDelay={600} withArrow>
          <ActionIcon
            variant="subtle"
            color="chatbox-tertiary"
            size={22}
            radius="sm"
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

    if (historyOpen) {
      for (const session of historySessions) {
        rows.push({ type: 'session', session, folderKey: ALL_FOLDER_KEY })
      }
    }

    return rows
  }, [expandedFolders, historyOpen, historySessions, projectGroups, projectsOpen, showArchived, t])

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
      defaultCopilotId: folderDefaultCopilotId || undefined,
    })
    setEditingFolder(null)
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
                  <UnstyledButton
                    type="button"
                    className="rail-section"
                    onClick={row.onToggle}
                    aria-expanded={row.open}
                  >
                    <span className="rail-section-label">{row.label}</span>
                    <span className="rail-section-trail">
                      {row.trailing}
                      <IconChevronDown
                        size={14}
                        stroke={1.75}
                        className={row.open ? 'rail-section-chevron is-open' : 'rail-section-chevron'}
                        aria-hidden
                      />
                    </span>
                  </UnstyledButton>
                )
              }

              if (row.type === 'folder') {
                return (
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
                )
              }

              return (
                <SortableItem id={row.session.id}>
                  <SessionItem
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
