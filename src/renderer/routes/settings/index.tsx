import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/settings/')({
  component: RouteComponent,
  beforeLoad: ({ navigate }) => {
    navigate({ to: '/settings/provider', replace: true })
    return null
  },
})

function RouteComponent() {
  return null
}
