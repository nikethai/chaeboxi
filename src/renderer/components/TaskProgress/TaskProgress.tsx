import { Badge, Button, Group, Progress, Stack, Text, Tooltip } from '@mantine/core'
import { CheckCircle2, ChevronDown, Circle, ListTodo, Loader2, XCircle } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { type Task, type TaskStatus, useTaskStore } from '@/stores/taskStore'

const statusConfig: Record<TaskStatus, { color: string; icon: typeof Circle; label: string }> = {
  pending: { color: 'gray', icon: Circle, label: 'Pending' },
  'in-progress': { color: 'blue', icon: Loader2, label: 'In Progress' },
  done: { color: 'green', icon: CheckCircle2, label: 'Done' },
  failed: { color: 'red', icon: XCircle, label: 'Failed' },
}

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

function StatusIcon({ status }: { status: TaskStatus }) {
  const config = statusConfig[status]
  const Icon = config.icon
  const isSpinning = status === 'in-progress'

  return (
    <Icon
      size={16}
      className={isSpinning ? 'animate-spin' : ''}
      style={{ color: `var(--mantine-color-${config.color}-6)` }}
    />
  )
}

export function TaskProgress({ sessionId, onContinue }: { sessionId: string; onContinue?: () => void }) {
  const { t } = useTranslation()
  const listId = useId()
  const allTasks = useTaskStore((state) => state.tasks)
  const tasks = useMemo(() => allTasks.filter((task) => task.sessionId === sessionId), [allTasks, sessionId])
  // Collapse-first: do not auto-expand on in-progress (long plans steal the thread).
  const [expanded, setExpanded] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)

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
  const activeTasks = useMemo(() => sortedTasks.filter((task) => task.status !== 'done'), [sortedTasks])
  const completedTasks = useMemo(() => sortedTasks.filter((task) => task.status === 'done'), [sortedTasks])
  const collapseDoneGroup = completedTasks.length > 3

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

  return (
    <div className="todo-dock chat-col">
      <div className="todo-dock-panel">
        <button
          type="button"
          className="todo-dock-chip"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls={listId}
        >
          <ListTodo size={14} strokeWidth={1.75} className="shrink-0 opacity-80" aria-hidden />
          <span className="todo-dock-chip-label">{t('Tasks')}</span>
          <span className="todo-dock-chip-count tabular-nums">
            {summary.done}/{summary.total}
          </span>
          {summary.inProgress > 0 && (
            <Badge size="xs" variant="dot" color="blue" className="todo-dock-chip-badge">
              {t('In Progress')}
            </Badge>
          )}
          {summary.inProgress === 0 && summary.failed > 0 && (
            <Badge size="xs" variant="dot" color="red" className="todo-dock-chip-badge">
              {t('Failed')}
            </Badge>
          )}
          <Tooltip label={chipSubtitle} multiline maw={320} openDelay={400} disabled={expanded}>
            <span className="todo-dock-chip-active min-w-0 flex-1 truncate">{chipSubtitle}</span>
          </Tooltip>
          <ChevronDown
            size={14}
            className={`todo-dock-chip-chevron shrink-0 ${expanded ? 'is-open' : ''}`}
            aria-hidden
          />
        </button>

        {summary.inProgress > 0 && !expanded && (
          <div className="todo-dock-thin-progress" aria-hidden>
            <Progress
              value={summary.overallProgress}
              color={summary.failed > 0 ? 'orange' : 'chatbox-brand'}
              size={2}
              radius={0}
              animated
            />
          </div>
        )}

        {expanded && (
          <Stack gap="xs" p="sm" className="todo-dock-body" id={listId}>
            <Progress
              value={summary.overallProgress}
              color={summary.failed > 0 ? 'orange' : 'chatbox-brand'}
              size="sm"
              radius="sm"
              animated={summary.inProgress > 0}
            />

            {summary.remaining > 0 && onContinue && (
              <Button size="xs" variant="light" onClick={onContinue}>
                {t('Continue remaining work')}
              </Button>
            )}

            <div className="todo-dock-list">
              {activeTasks.map((task) => {
                const config = statusConfig[task.status]
                return (
                  <Group key={task.id} gap="xs" wrap="nowrap" className="todo-dock-row">
                    <StatusIcon status={task.status} />
                    <Tooltip label={task.title} multiline maw={300} openDelay={500}>
                      <Text size="xs" lineClamp={1} className="flex-1">
                        {task.title}
                      </Text>
                    </Tooltip>
                    {task.progress !== undefined && task.status === 'in-progress' && (
                      <Text size="xs" c="dimmed" className="whitespace-nowrap tabular-nums">
                        {task.progress}%
                      </Text>
                    )}
                    <Badge size="xs" variant="dot" color={config.color}>
                      {t(config.label)}
                    </Badge>
                  </Group>
                )
              })}

              {completedTasks.length > 0 && collapseDoneGroup && !showCompleted && (
                <button type="button" className="todo-dock-completed-toggle" onClick={() => setShowCompleted(true)}>
                  {t('Completed ({{count}})', { count: completedTasks.length })}
                </button>
              )}

              {(showCompleted || !collapseDoneGroup) &&
                completedTasks.map((task) => (
                  <Group key={task.id} gap="xs" wrap="nowrap" className="todo-dock-row">
                    <StatusIcon status={task.status} />
                    <Tooltip label={task.title} multiline maw={300} openDelay={500}>
                      <Text size="xs" lineClamp={1} className="flex-1" c="dimmed" td="line-through">
                        {task.title}
                      </Text>
                    </Tooltip>
                    <Badge size="xs" variant="dot" color="green">
                      {t('Done')}
                    </Badge>
                  </Group>
                ))}

              {completedTasks.length > 0 && collapseDoneGroup && showCompleted && (
                <button type="button" className="todo-dock-completed-toggle" onClick={() => setShowCompleted(false)}>
                  {t('Hide completed')}
                </button>
              )}
            </div>
          </Stack>
        )}
      </div>
    </div>
  )
}

export default TaskProgress
