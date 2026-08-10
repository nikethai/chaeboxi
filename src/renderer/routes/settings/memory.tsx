import { Select, Stack, Tabs, Text } from '@mantine/core'
import type { MemoryBank, MemoryEntry } from '@shared/types/memory'
import { emptyMemoryBank } from '@shared/types/memory'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  MemoryAdvancedPanel,
  MemoryBankWorkspace,
  MemorySettingsHeader,
  memoryScopeKey,
} from '@/components/settings/memory'
import { useMyCopilots } from '@/hooks/useCopilots'
import { getMemoryInjectStats } from '@/packages/memory/inject'
import { ensureMemoryStoreInit, memoryStore, useMemoryStore } from '@/stores/memoryStore'
import { initSettingsStore } from '@/stores/settingsStore'

export const Route = createFileRoute('/settings/memory')({
  component: MemorySettingsPage,
})

export function MemorySettingsPage() {
  const { t } = useTranslation()
  const ready = useMemoryStore((s) => s.ready)
  const settings = useMemoryStore((s) => s.settings)
  const globalBank = useMemoryStore((s) => s.globalBank)
  const agentBanks = useMemoryStore((s) => s.agentBanks)
  const setSettings = useMemoryStore((s) => s.setSettings)
  const retain = useMemoryStore((s) => s.retain)
  const update = useMemoryStore((s) => s.update)
  const remove = useMemoryStore((s) => s.remove)
  const clear = useMemoryStore((s) => s.clear)
  const rebuildProfile = useMemoryStore((s) => s.rebuildProfile)
  const ensureAgentBank = useMemoryStore((s) => s.ensureAgentBank)
  const importBank = useMemoryStore((s) => s.importBank)

  const { copilots: myCopilots } = useMyCopilots()
  const agents = useMemo(
    () =>
      (myCopilots ?? []).map((a) => ({
        id: a.id,
        name: a.name || a.id,
      })),
    [myCopilots]
  )

  const [tab, setTab] = useState<string>('global')
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)

  useEffect(() => {
    void ensureMemoryStoreInit()
    // Memory Sync reads extension.memorySync from the settings store; ensure it
    // is hydrated even on deep-link navigation before the Advanced panel renders.
    void initSettingsStore()
  }, [])

  useEffect(() => {
    if (tab === 'agent' && selectedAgentId) {
      void ensureAgentBank(selectedAgentId)
    }
  }, [tab, selectedAgentId, ensureAgentBank])

  useEffect(() => {
    if (!selectedAgentId && agents[0]) {
      setSelectedAgentId(agents[0].id)
    }
  }, [agents, selectedAgentId])

  const injectPreview = useMemo(() => {
    const agentBank = selectedAgentId && agentBanks[selectedAgentId] ? agentBanks[selectedAgentId] : null
    return getMemoryInjectStats({
      settings,
      globalBank,
      agentBank,
    })
  }, [settings, globalBank, agentBanks, selectedAgentId])

  const globalWorkspaceKey = memoryScopeKey('global')
  const agentWorkspaceKey = memoryScopeKey('agent', selectedAgentId)

  const makeBankHandlers = (scope: 'global' | 'agent', agentId?: string) => {
    const bank: MemoryBank =
      scope === 'agent' && agentId ? (agentBanks[agentId] ?? emptyMemoryBank('agent', agentId)) : globalBank

    return {
      bank,
      onAdd: async (content: string, tags: string[], pinned: boolean) => {
        if (scope === 'agent' && !agentId) {
          toast.error(t('Select an agent first'))
          return false
        }
        try {
          await ensureMemoryStoreInit()
          const entry = await retain({
            content,
            scope,
            agentId,
            tags,
            source: 'user',
            pinned,
          })
          if (!entry) {
            toast.error(t('Failed to save memory'))
            return false
          }
          toast.success(scope === 'global' ? t('Saved to Global memory') : t('Saved to agent memory'))
          return true
        } catch (e) {
          console.error(e)
          toast.error(t('Failed to save memory'))
          return false
        }
      },
      onUpdate: async (id: string, patch: Partial<Pick<MemoryEntry, 'content' | 'tags' | 'pinned' | 'enabled'>>) => {
        await update(scope, id, patch, agentId)
      },
      onRemove: async (id: string) => {
        await remove(scope, id, agentId)
      },
      onClear: async () => {
        await clear(scope, agentId)
      },
      onRebuild: async () => {
        await rebuildProfile(scope, agentId, true)
        toast.success(t('Profile rebuilt'))
      },
      onExport: () => {
        const exported = memoryStore.getState().exportBank(scope, agentId)
        const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = scope === 'global' ? 'memory-global.json' : `memory-agent-${agentId}.json`
        a.click()
        URL.revokeObjectURL(url)
      },
      onImport: async (file: File | null) => {
        if (!file) return
        try {
          const text = await file.text()
          const parsed = JSON.parse(text) as MemoryBank
          await importBank(scope, parsed, agentId)
          toast.success(t('Memory imported'))
        } catch {
          toast.error(t('Failed to import memory'))
        }
      },
    }
  }

  if (!ready) {
    return (
      <Stack p="md">
        <Text c="chatbox-tertiary">{t('Loading memory…')}</Text>
      </Stack>
    )
  }

  const globalHandlers = makeBankHandlers('global')
  const agentHandlers = selectedAgentId != null ? makeBankHandlers('agent', selectedAgentId) : null

  return (
    <Stack p="md" gap="md">
      <MemorySettingsHeader
        enabled={settings.enabled}
        autoSave={settings.autoSave}
        factCount={injectPreview.factCount}
        injectTokens={injectPreview.injectTokens}
        onEnabledChange={(enabled) => void setSettings({ enabled })}
        onAutoSaveChange={(autoSave) => void setSettings({ autoSave })}
      />

      <Tabs value={tab} onChange={(v) => setTab(v || 'global')}>
        <Tabs.List>
          <Tabs.Tab value="global">{t('Global')}</Tabs.Tab>
          <Tabs.Tab value="agent">{t('Agents')}</Tabs.Tab>
          <Tabs.Tab value="advanced">{t('Advanced')}</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="global" pt="md">
          <MemoryBankWorkspace
            key={globalWorkspaceKey}
            bank={globalHandlers.bank}
            maxEntryChars={settings.maxEntryChars ?? 500}
            clearConfirmMessage={t('Clear all global memories?')}
            onAdd={globalHandlers.onAdd}
            onUpdate={globalHandlers.onUpdate}
            onRemove={globalHandlers.onRemove}
            onClear={globalHandlers.onClear}
            onRebuild={globalHandlers.onRebuild}
            onExport={globalHandlers.onExport}
            onImport={globalHandlers.onImport}
          />
        </Tabs.Panel>

        <Tabs.Panel value="agent" pt="md">
          <Stack gap="sm">
            <Select
              label={t('Agent')}
              placeholder={t('Select agent')}
              data={agents.map((a) => ({ value: a.id, label: a.name }))}
              value={selectedAgentId}
              onChange={setSelectedAgentId}
              searchable
              maw={360}
              styles={{ label: { fontWeight: 400 } }}
            />
            {!agents.length ? (
              <Text size="sm" c="chatbox-tertiary">
                {t('No agents yet. Create an agent in Settings → Agents.')}
              </Text>
            ) : agentHandlers ? (
              <MemoryBankWorkspace
                key={agentWorkspaceKey}
                bank={agentHandlers.bank}
                maxEntryChars={settings.maxEntryChars ?? 500}
                clearConfirmMessage={t('Clear this agent memory?')}
                onAdd={agentHandlers.onAdd}
                onUpdate={agentHandlers.onUpdate}
                onRemove={agentHandlers.onRemove}
                onClear={agentHandlers.onClear}
                onRebuild={agentHandlers.onRebuild}
                onExport={agentHandlers.onExport}
                onImport={agentHandlers.onImport}
              />
            ) : null}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="advanced" pt="md">
          <MemoryAdvancedPanel
            settings={settings}
            factCount={injectPreview.factCount}
            injectTokens={injectPreview.injectTokens}
            injectText={injectPreview.injectText}
            onSettingsChange={(patch) => void setSettings(patch)}
          />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  )
}
