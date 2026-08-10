import { Badge, Flex, Progress, Text, Tooltip } from '@mantine/core'
import { ChevronDown, ListTodo } from 'lucide-react'
import { useEffect, useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Drawer } from 'vaul'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import { type Task, type TaskStatus, taskStore, useTaskStore } from '@/stores/taskStore'
import TaskProgressDetails from './TaskProgressDetails'

const STATUS_SORT: Record<TaskStatus, number> = {
  'in-progress': 0,
  pending: 1,
  failed: 2,
  done: 3,
}

/** Export for tests — active work first, completed last. */
export function sortTasksForDisplay(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const byStatus = STATUS_SORT[a.status] - STATUS_SORT[b.status]
    if (byStatus !== 0) return byStatus
    return a.createdAt - b.createdAt
  })
}

export type TaskDetailsMode = 'inline' | 'sheet'

export function TaskProgress({
  sessionId,
  onContinue,
  detailsMode = 'inline',
}: {
  sessionId: string
  onContinue?: () => void
  /** `sheet` always opens details in a bottom drawer (Quick Chat / narrow). */
  detailsMode?: TaskDetailsMode
}) {
  const { t } = useTranslation()
  const listId = useId()
  const sheetDescriptionId = useId()
  const isSmallScreen = useIsSmallScreen()
  const useSheet = detailsMode === 'sheet' || isSmallScreen
  const allTasks = useTaskStore((state) => state.tasks)
  const tasks = useMemo(() => allTasks.filter((task) => task.sessionId === sessionId), [allTasks, sessionId])
  const [expanded, setExpanded] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)

  useEffect(() => {
    void taskStore.getState().hydrateSessionTasks(sessionId)
  }, [sessionId])

  const summary = useMemo(() => {
    const total = tasks.length
    const done = tasks.filter((task) => task.status === 'done').length
    const failed = tasks.filter((task) => task.status === 'failed').length
    const inProgress = tasks.filter((task) => task.status === 'in-progress').length
    const remaining = tasks.filter((task) => task.status === 'pending' || task.status === 'in-progress').length
    const overallProgress = total > 0 ? Math.round(((done + failed) / total) * 100) : 0
    const activeTask = tasks.find((task) => task.status === 'in-progress')
    return { total, done, failed, inProgress, remaining, overallProgress, activeTask }
  }, [tasks])

  const sortedTasks = useMemo(() => sortTasksForDisplay(tasks), [tasks])

  if (tasks.length === 0) {
    return null
  }

  const chipSubtitle =
    summary.activeTask?.title ??
    (summary.inProgress > 1
      ? t('{{count}} in progress', { count: summary.inProgress })
      : summary.failed > 0
        ? t('{{count}} failed', { count: summary.failed })
        : summary.remaining > 0
          ? t('{{count}} remaining', { count: summary.remaining })
          : t('All done'))

  const summaryButton = (
    <button
      type="button"
      className="todo-dock-chip"
      onClick={useSheet ? undefined : () => setExpanded((value) => !value)}
      aria-expanded={expanded}
      aria-controls={useSheet ? undefined : listId}
    >
      <ListTodo size={14} strokeWidth={1.75} className="shrink-0 opacity-80" aria-hidden />
      <span className="todo-dock-chip-label">{t('Tasks')}</span>
      <span className="todo-dock-chip-count tabular-nums" aria-live="polite" aria-atomic="true">
        {summary.done}/{summary.total}
      </span>
      {summary.inProgress > 0 ? (
        <Badge size="xs" variant="dot" color="blue" className="todo-dock-chip-badge">
          {t('In Progress')}
        </Badge>
      ) : null}
      {summary.inProgress === 0 && summary.failed > 0 ? (
        <Badge size="xs" variant="dot" color="red" className="todo-dock-chip-badge">
          {t('Failed')}
        </Badge>
      ) : null}
      <Tooltip label={chipSubtitle} multiline maw={320} openDelay={400} disabled={expanded || useSheet}>
        <span className="todo-dock-chip-active min-w-0 flex-1 truncate">{chipSubtitle}</span>
      </Tooltip>
      <ChevronDown size={14} className={`todo-dock-chip-chevron shrink-0 ${expanded ? 'is-open' : ''}`} aria-hidden />
    </button>
  )

  const details = (
    <TaskProgressDetails
      tasks={sortedTasks}
      overallProgress={summary.overallProgress}
      inProgressCount={summary.inProgress}
      remainingCount={summary.remaining}
      failedCount={summary.failed}
      showCompleted={showCompleted}
      onShowCompletedChange={setShowCompleted}
      onContinue={onContinue}
    />
  )

  return (
    <div className="todo-dock">
      <div className={`todo-dock-panel ${expanded && !useSheet ? 'is-expanded' : ''}`}>
        {useSheet ? (
          <Drawer.Root open={expanded} onOpenChange={setExpanded} noBodyStyles>
            <Drawer.Trigger asChild>{summaryButton}</Drawer.Trigger>
            <Drawer.Portal>
              <Drawer.Overlay className="todo-dock-sheet-overlay fixed inset-0 bg-chatbox-background-mask-overlay" />
              <Drawer.Content
                className="todo-dock-sheet fixed inset-x-0 bottom-0 flex max-h-[70dvh] flex-col rounded-t-xl bg-[var(--chatbox-background-primary)] outline-none"
                aria-describedby={sheetDescriptionId}
              >
                <Drawer.Handle />
                <Flex align="center" justify="space-between" gap="sm" px="md" py="sm" className="todo-dock-sheet-head">
                  <div className="min-w-0">
                    <Drawer.Title asChild>
                      <Text size="sm" fw={600}>
                        {t('Tasks')}
                      </Text>
                    </Drawer.Title>
                    <Text id={sheetDescriptionId} size="xs" c="dimmed" lineClamp={1}>
                      {chipSubtitle}
                    </Text>
                  </div>
                  <Text size="xs" c="dimmed" className="shrink-0 font-mono tabular-nums">
                    {summary.done}/{summary.total}
                  </Text>
                </Flex>
                <div className="todo-dock-sheet-scroll">
                  <TaskProgressDetails
                    tasks={sortedTasks}
                    overallProgress={summary.overallProgress}
                    inProgressCount={summary.inProgress}
                    remainingCount={summary.remaining}
                    failedCount={summary.failed}
                    showCompleted={showCompleted}
                    onShowCompletedChange={setShowCompleted}
                    onContinue={
                      onContinue
                        ? () => {
                            setExpanded(false)
                            onContinue()
                          }
                        : undefined
                    }
                    mobileSheet
                  />
                </div>
              </Drawer.Content>
            </Drawer.Portal>
          </Drawer.Root>
        ) : (
          summaryButton
        )}

        {summary.inProgress > 0 && !expanded ? (
          <div className="todo-dock-thin-progress" aria-hidden>
            <Progress
              value={summary.overallProgress}
              color={summary.failed > 0 ? 'orange' : 'chatbox-brand'}
              size={2}
              radius={0}
              animated
            />
          </div>
        ) : null}

        {!useSheet && expanded ? <div id={listId}>{details}</div> : null}
      </div>
    </div>
  )
}

export default TaskProgress
