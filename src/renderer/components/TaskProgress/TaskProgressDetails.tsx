import { Badge, Button, Group, Progress, Stack, Text, Tooltip } from '@mantine/core'
import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { Task, TaskStatus } from '@/stores/taskStore'

const statusConfig: Record<TaskStatus, { color: string; icon: typeof Circle; label: string }> = {
  pending: { color: 'gray', icon: Circle, label: 'Pending' },
  'in-progress': { color: 'blue', icon: Loader2, label: 'In Progress' },
  done: { color: 'green', icon: CheckCircle2, label: 'Done' },
  failed: { color: 'red', icon: XCircle, label: 'Failed' },
}

function StatusIcon({ status }: { status: TaskStatus }) {
  const config = statusConfig[status]
  const Icon = config.icon

  return (
    <Icon
      size={16}
      className={status === 'in-progress' ? 'animate-spin' : ''}
      style={{ color: `var(--mantine-color-${config.color}-6)` }}
      aria-hidden
    />
  )
}

type TaskProgressDetailsProps = {
  tasks: Task[]
  overallProgress: number
  inProgressCount: number
  remainingCount: number
  failedCount: number
  showCompleted: boolean
  onShowCompletedChange: (showCompleted: boolean) => void
  onContinue?: () => void
  mobileSheet?: boolean
}

export default function TaskProgressDetails({
  tasks,
  overallProgress,
  inProgressCount,
  remainingCount,
  failedCount,
  showCompleted,
  onShowCompletedChange,
  onContinue,
  mobileSheet = false,
}: TaskProgressDetailsProps) {
  const { t } = useTranslation()
  const activeTasks = useMemo(() => tasks.filter((task) => task.status !== 'done'), [tasks])
  const completedTasks = useMemo(() => tasks.filter((task) => task.status === 'done'), [tasks])
  const collapseDoneGroup = completedTasks.length > 3

  return (
    <Stack gap="xs" p="sm" className={`todo-dock-body ${mobileSheet ? 'is-mobile-sheet' : ''}`}>
      <Progress
        value={overallProgress}
        color={failedCount > 0 ? 'orange' : 'chatbox-brand'}
        size="sm"
        radius="sm"
        animated={inProgressCount > 0}
      />

      {remainingCount > 0 && onContinue ? (
        <Button size="xs" variant="light" onClick={onContinue}>
          {t('Continue remaining work')}
        </Button>
      ) : null}

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
              {task.assigneeAgentId ? (
                <Text size="xs" c="dimmed" className="whitespace-nowrap max-w-[72px] truncate" title={task.assigneeAgentId}>
                  {task.assigneeAgentId.slice(0, 10)}
                </Text>
              ) : null}
              {task.progress !== undefined && task.status === 'in-progress' ? (
                <Text size="xs" c="dimmed" className="whitespace-nowrap tabular-nums">
                  {task.progress}%
                </Text>
              ) : null}
              <Badge size="xs" variant="dot" color={config.color}>
                {t(config.label)}
              </Badge>
            </Group>
          )
        })}

        {completedTasks.length > 0 && collapseDoneGroup && !showCompleted ? (
          <button type="button" className="todo-dock-completed-toggle" onClick={() => onShowCompletedChange(true)}>
            {t('Completed ({{count}})', { count: completedTasks.length })}
          </button>
        ) : null}

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

        {completedTasks.length > 0 && collapseDoneGroup && showCompleted ? (
          <button type="button" className="todo-dock-completed-toggle" onClick={() => onShowCompletedChange(false)}>
            {t('Hide completed')}
          </button>
        ) : null}
      </div>
    </Stack>
  )
}
