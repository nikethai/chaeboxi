import { createFileRoute } from '@tanstack/react-router'
import { AgentsSettingsPage } from '@/components/settings/agents'

export const Route = createFileRoute('/settings/agents')({
  component: RouteComponent,
})

export function RouteComponent() {
  return <AgentsSettingsPage />
}
