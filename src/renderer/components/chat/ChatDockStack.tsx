import type { ReactNode } from 'react'
import TaskProgress, { type TaskDetailsMode } from '@/components/TaskProgress/TaskProgress'

type ChatDockStackProps = {
  sessionId: string
  onContinueTasks?: () => void
  children: ReactNode
  afterComposer?: ReactNode
  /** How task details open. Quick Chat uses `sheet` so the dock never grows. */
  taskDetailsMode?: TaskDetailsMode
  /**
   * @deprecated Dual live chrome removed — thread work strip + statusline pulse are SoT.
   * Kept optional so call sites can drop props without a flag day.
   */
  generating?: boolean
  /** @deprecated See `generating`. */
  liveMessage?: unknown
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
      {/* Live generation lives in the thread strip + statusline pulse only (no dual chrome). */}
      <div className="chat-dock-composer">{children}</div>
      {afterComposer ? <div className="chat-dock-after-composer">{afterComposer}</div> : null}
    </div>
  )
}
