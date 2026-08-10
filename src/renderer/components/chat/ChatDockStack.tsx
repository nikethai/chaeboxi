import type { ReactNode } from 'react'
import TaskProgress, { type TaskDetailsMode } from '@/components/TaskProgress/TaskProgress'

type ChatDockStackProps = {
  sessionId: string
  onContinueTasks?: () => void
  children: ReactNode
  afterComposer?: ReactNode
  /** How task details open. Quick Chat uses `sheet` so the dock never grows. */
  taskDetailsMode?: TaskDetailsMode
}

export default function ChatDockStack({
  sessionId,
  onContinueTasks,
  children,
  afterComposer,
  taskDetailsMode = 'inline',
}: ChatDockStackProps) {
  return (
    <div className="chat-dock-stack chat-col">
      <TaskProgress key={sessionId} sessionId={sessionId} onContinue={onContinueTasks} detailsMode={taskDetailsMode} />
      <div className="chat-dock-composer">{children}</div>
      {afterComposer ? <div className="chat-dock-after-composer">{afterComposer}</div> : null}
    </div>
  )
}
