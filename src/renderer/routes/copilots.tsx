/**
 * Legacy /copilots route — redirects to Settings → Agents.
 * Empty-agent helper kept for any residual imports.
 */

import type { CopilotDetail } from '@shared/types'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { v4 as uuidv4 } from 'uuid'
import platform from '@/platform'

export const Route = createFileRoute('/copilots')({
  beforeLoad: () => {
    throw redirect({ to: '/settings/agents' })
  },
  component: () => null,
})

/** @deprecated Prefer AgentsSettingsPage create flow. */
export async function getEmptyCopilot(): Promise<CopilotDetail> {
  const conf = await platform.getConfig()
  return {
    id: `${conf.uuid}:${uuidv4()}`,
    name: '',
    picUrl: '',
    prompt: '',
    starred: false,
    usedCount: 0,
    shared: true,
    role: 'custom',
    stance: 'neutral',
  }
}
