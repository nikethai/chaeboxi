import { Badge, Group, Paper, Progress, Stack, Text, Tooltip } from '@mantine/core'
import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react'
import { useMemo } from 'react'
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

  const summary = useMemo(() => {
    const total = tasks.length
    const done = tasks.filter((task) => task.status === 'done').length
    const failed = tasks.filter((task) => task.status === 'failed').length
    const inProgress = tasks.filter((task) => task.status === 'in-progress').length
    const overallProgress = total > 0 ? Math.round(((done + failed) / total) * 100) : 0
    return { total, done, failed, inProgress, overallProgress }
  }, [tasks])

  if (tasks.length === 0) {
    return null
  }

  return (
    <Paper shadow="xs" radius="md" p="sm" withBorder className="mx-3 mb-2">
      <Stack gap="xs">
        <Group justify="space-between" align="center">
          <Text size="sm" fw={600}>
            {t('Tasks')}
          </Text>
          <Badge variant="light" color="blue" size="sm">
            {summary.done}/{summary.total}
          </Badge>
        </Group>

        <Progress
          value={summary.overallProgress}
          color={summary.failed > 0 ? 'orange' : 'blue'}
          size="sm"
          radius="xl"
          animated={summary.inProgress > 0}
        />

        {tasks.map((task) => {
          const config = statusConfig[task.status]
          return (
            <Group key={task.id} gap="xs" wrap="nowrap" className="py-0.5 transition-opacity duration-200">
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
                <Text size="xs" c="dimmed" className="whitespace-nowrap">
                  {task.progress}%
                </Text>
              )}
              <Badge size="xs" variant="dot" color={config.color}>
                {t(config.label)}
              </Badge>
            </Group>
          )
        })}
      </Stack>
    </Paper>
  )
}

export default TaskProgress
