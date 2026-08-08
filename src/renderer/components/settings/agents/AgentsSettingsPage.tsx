/**
 * Settings → Agents — gallery + progressive editor (studio chrome).
 */

import { Button, Flex, Switch, Text, TextInput } from '@mantine/core'
import type { CopilotDetail } from '@shared/types'
import { IconPlus, IconSearch } from '@tabler/icons-react'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { v4 as uuidv4 } from 'uuid'
import { ScalableIcon } from '@/components/common/ScalableIcon'
import { useMyCopilots, useRemoteCopilots } from '@/hooks/useCopilots'
import { trackingEvent } from '@/packages/event'
import * as remote from '@/packages/remote'
import platform from '@/platform'
import { useUIStore } from '@/stores/uiStore'
import { AgentCard } from './AgentCard'
import { AgentEditor } from './AgentEditor'

export function AgentsSettingsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const showCopilotsInNewSession = useUIStore((s) => s.showCopilotsInNewSession)
  const setShowCopilotsInNewSession = useUIStore((s) => s.setShowCopilotsInNewSession)
  const store = useMyCopilots()
  const { copilots: remoteCopilots } = useRemoteCopilots()
  const [query, setQuery] = useState('')
  const [starredOnly, setStarredOnly] = useState(false)
  const [copilotEdit, setCopilotEdit] = useState<CopilotDetail | null>(null)

  useEffect(() => {
    trackingEvent('copilot_window', { event_category: 'screen_view' })
  }, [])

  const list = useMemo(() => {
    let items = [...store.copilots]
    if (starredOnly) items = items.filter((i) => i.starred)
    const q = query.trim().toLowerCase()
    if (q) {
      items = items.filter((i) => {
        const hay = [i.name, i.description || '', i.role || '', i.tags?.join(' ') || ''].join(' ').toLowerCase()
        return hay.includes(q)
      })
    }
    return [
      ...items.filter((item) => item.starred).sort((a, b) => b.usedCount - a.usedCount),
      ...items.filter((item) => !item.starred).sort((a, b) => b.usedCount - a.usedCount),
    ]
  }, [store.copilots, query, starredOnly])

  const community = useMemo(() => {
    const items = remoteCopilots || []
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((i) => {
      const hay = [i.name, i.description || '', i.prompt?.slice(0, 80) || ''].join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [remoteCopilots, query])

  const selectCopilot = (detail: CopilotDetail) => {
    const newDetail = { ...detail, usedCount: (detail.usedCount || 0) + 1 }
    if (newDetail.shared) {
      void remote.recordCopilotShare(newDetail)
    }
    store.addOrUpdate(newDetail)
    navigate({
      to: '/',
      search: { copilotId: detail.id },
    })
  }

  if (copilotEdit) {
    return (
      <div className="p-4 max-w-4xl mx-auto">
        <AgentEditor
          copilotDetail={copilotEdit}
          close={() => setCopilotEdit(null)}
          save={(detail) => {
            store.addOrUpdate(detail)
            setCopilotEdit(null)
          }}
        />
      </div>
    )
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <Flex direction="column" gap="lg">
        <div>
          <Text size="lg" fw={700} c="chatbox-primary" style={{ textWrap: 'balance' }}>
            {t('Agents')}
          </Text>
          <Text size="sm" c="chatbox-tertiary" mt={4}>
            {t('Specialized personas with unique identities for chat and team rooms.')}
          </Text>
        </div>

        <div
          className="rounded-[11px] p-3.5"
          style={{
            border: '1px solid var(--chatbox-border-primary)',
            background: 'var(--chatbox-background-secondary)',
          }}
        >
          <Text size="sm" fw={700} mb={8} c="chatbox-primary">
            {t('Preferences')}
          </Text>
          <Switch
            checked={showCopilotsInNewSession}
            onChange={(event) => setShowCopilotsInNewSession(event.currentTarget.checked)}
            label={t('Show Agents in New Session')}
          />
        </div>

        <Flex gap="sm" wrap="wrap" align="center">
          <TextInput
            placeholder={t('Search agents…') || ''}
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            leftSection={<ScalableIcon icon={IconSearch} size={14} />}
            className="flex-1 min-w-[200px]"
          />
          <Switch
            checked={starredOnly}
            onChange={(e) => setStarredOnly(e.currentTarget.checked)}
            label={t('Starred only')}
          />
          <Button
            variant="light"
            leftSection={<ScalableIcon icon={IconPlus} size={18} />}
            onClick={() => {
              void getEmptyAgent().then(setCopilotEdit)
            }}
            className="active:scale-[0.96] transition-transform"
          >
            {t('Create New Agent')}
          </Button>
        </Flex>

        <section>
          <Text size="md" fw={700} mb={12} c="chatbox-primary">
            {t('My Agents')}
          </Text>
          {list.length === 0 ? (
            <Text size="sm" c="chatbox-tertiary">
              {t('No agents match your search.')}
            </Text>
          ) : (
            <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(240px,1fr))]">
              {list.map((item) => (
                <AgentCard
                  key={item.id}
                  detail={item}
                  mode="local"
                  canDelete={!item.builtIn}
                  onUse={() => selectCopilot(item)}
                  onEdit={() => setCopilotEdit(item)}
                  onStar={() => store.addOrUpdate({ ...item, starred: !item.starred })}
                  onDelete={() => store.remove(item.id)}
                />
              ))}
            </div>
          )}
        </section>

        <section>
          <Text size="md" fw={700} mb={4} c="chatbox-primary">
            {t('Community agents')}
          </Text>
          <Text size="xs" c="chatbox-tertiary" mb={12}>
            {t('Shared catalog from the community. Secondary to your Chaeboxi cast.')}
          </Text>
          {community.length === 0 ? (
            <Text size="sm" c="chatbox-tertiary">
              {t('No community agents loaded.')}
            </Text>
          ) : (
            <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(240px,1fr))] opacity-95">
              {community.map((item) => (
                <AgentCard key={item.id} detail={item} mode="remote" onUse={() => selectCopilot(item)} />
              ))}
            </div>
          )}
        </section>
      </Flex>
    </div>
  )
}

async function getEmptyAgent(): Promise<CopilotDetail> {
  const conf = await platform.getConfig()
  return {
    id: `${conf.uuid}:${uuidv4()}`,
    name: '',
    prompt: '',
    description: '',
    role: 'custom',
    stance: 'neutral',
    starred: false,
    usedCount: 0,
    shared: true,
    avatarSeed: `custom:${uuidv4().slice(0, 8)}`,
  }
}

export default AgentsSettingsPage
