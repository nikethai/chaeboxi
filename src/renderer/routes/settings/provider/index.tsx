import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/settings/provider/')({
  component: RouteComponent,
  beforeLoad: ({ navigate }) => {
    navigate({ to: '/settings/provider/chatbox-ai', replace: true })
    return null
  },
})

function RouteComponent() {
  return null
}
