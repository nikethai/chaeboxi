import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/settings/copilots')({
  // Copilots renamed to Agents — keep legacy path as redirect
  beforeLoad: () => {
    throw redirect({ to: '/settings/agents' })
  },
  component: () => null,
})
