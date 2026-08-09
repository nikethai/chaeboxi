import { createFileRoute, redirect } from '@tanstack/react-router'

/** Legacy route: personal info merged into Memory settings. */
export const Route = createFileRoute('/settings/user-personal-info')({
  beforeLoad: () => {
    throw redirect({ to: '/settings/memory' })
  },
  component: () => null,
})
