import type { Message } from '@shared/types'
import type { ReactNode } from 'react'
import LiveGenerationDockHint from '@/components/chat/LiveGenerationDockHint'
import TaskProgress, { type TaskDetailsMode } from '@/components/TaskProgress/TaskProgress'

type ChatDockStackProps = {
  sessionId: string
  onContinueTasks?: () => void
  children: ReactNode
  afterComposer?: ReactNode
  /** How task details open. Quick Chat uses `sheet` so the dock never grows. */
  taskDetailsMode?: TaskDetailsMode
  /** Show fixed live-thinking hint above the composer. */
  generating?: boolean
  liveMessage?: Message | null
}

export default function ChatDockStack({
  sessionId,
  onContinueTasks,
  children,
  afterComposer,
  taskDetailsMode = 'inline',
  generating = false,
  liveMessage = null,
}: ChatDockStackProps) {
  return (
    <div className="chat-dock-stack chat-col">
      <TaskProgress key={sessionId} sessionId={sessionId} onContinue={onContinueTasks} detailsMode={taskDetailsMode} />
      {/* Always-visible live cue near the input — easier than hunting the thread strip */}
      <LiveGenerationDockHint generating={Boolean(generating)} liveMessage={liveMessage} />
      <div className="chat-dock-composer">{children}</div>
      {afterComposer ? <div className="chat-dock-after-composer">{afterComposer}</div> : null}
    </div>
  )
}
