import { createFileRoute } from '@tanstack/react-router'
import { CopilotsContent } from '@/routes/copilots'

export const Route = createFileRoute('/settings/copilots')({
  component: RouteComponent,
})

export function RouteComponent() {
  return <CopilotsContent />
}
