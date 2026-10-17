import { createFileRoute, redirect } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { z } from 'zod'

// Slice 5 replaces this redirect with Review. Until then `/` (old links, startup) lands on `/new`.
export const Route = createFileRoute('/')({
  validateSearch: zodValidator(z.object({ copilotId: z.string().optional() })),
  beforeLoad: ({ search }) => {
    throw redirect({ to: '/new', search, replace: true })
  },
})
