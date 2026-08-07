import { Badge, Group, Progress, Stack, Text, Tooltip } from '@mantine/core'
import { CheckCircle2, ChevronDown, Circle, Loader2, ListTodo, XCircle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { type TaskStatus, useTaskStore } from '@/stores/taskStore'

const statusConfig: Record<TaskStatus, { color: string; icon: typeof Circle; label: string }> = {
  pending: { color: 'gray', icon: Circle, label: 'Pending' },
  'in-progress': { color: 'blue', icon: Loader2, label: 'In Progress' },
  done: { color: 'green', icon: CheckCircle2, label: 'Done' },
  failed: { color: 'red', icon: XCircle, label: 'Failed' },
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

export function TaskProgress({ sessionId }: { sessionId: string }) {
  const { t } = useTranslation()
  const allTasks = useTaskStore((state) => state.tasks)
  const tasks = useMemo(() => allTasks.filter((task) => task.sessionId === sessionId), [allTasks, sessionId])
  const [expanded, setExpanded] = useState(false)

  const summary = useMemo(() => {
    const total = tasks.length
    const done = tasks.filter((task) => task.status === 'done').length
    const failed = tasks.filter((task) => task.status === 'failed').length
    const inProgress = tasks.filter((task) => task.status === 'in-progress').length
    const overallProgress = total > 0 ? Math.round(((done + failed) / total) * 100) : 0
    return { total, done, failed, inProgress, overallProgress }
  }, [tasks])

  // Auto-expand when work is actively running; collapse when idle after first paint of list
  useEffect(() => {
    if (summary.inProgress > 0) {
      setExpanded(true)
    }
  }, [summary.inProgress])

  if (tasks.length === 0) {
    return null
  }

  return (
    <div className="agent-dock todo-dock">
      <div className="agent-dock-panel chat-col">
        <div className="agent-panel todo-dock-panel">
          <button
            type="button"
            className="todo-dock-chip"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
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
            <ChevronDown
              size={14}
              className={`todo-dock-chip-chevron shrink-0 ${expanded ? 'is-open' : ''}`}
              aria-hidden
            />
          </button>

          {expanded && (
            <Stack gap="xs" p="sm" className="todo-dock-body">
              <Progress
                value={summary.overallProgress}
                color={summary.failed > 0 ? 'orange' : 'chatbox-brand'}
                size="sm"
                radius="sm"
                animated={summary.inProgress > 0}
              />

              <div className="todo-dock-list">
                {tasks.map((task) => {
                  const config = statusConfig[task.status]
                  return (
                    <Group key={task.id} gap="xs" wrap="nowrap" className="todo-dock-row">
                      <StatusIcon status={task.status} />
                      <Tooltip label={task.title} multiline maw={300} openDelay={500}>
                        <Text
                          size="xs"
                          lineClamp={1}
                          className="flex-1"
                          c={task.status === 'done' ? 'dimmed' : undefined}
                          td={task.status === 'done' ? 'line-through' : undefined}
                        >
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
              </div>
            </Stack>
          )}
        </div>
      </div>
    </div>
  )
}

export default TaskProgress
