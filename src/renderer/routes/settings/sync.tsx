import { Alert, Button, PasswordInput, Stack, Switch, Text, TextInput } from '@mantine/core'
import { IconInfoCircle } from '@tabler/icons-react'
import { createFileRoute } from '@tanstack/react-router'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SettingsCard } from '@/components/settings/SettingsCard'
import { SettingsPage } from '@/components/settings/SettingsPage'
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader'
import { SettingsPrefRow } from '@/components/settings/SettingsPrefRow'
import { SettingsSection } from '@/components/settings/SettingsSection'
import { recoverSessionList } from '@/stores/chatStore'
import {
  getHistorySyncState,
  pullHistoryFromServer,
  pushHistoryToServer,
  syncHistoryNow,
  testHistorySyncConnection,
} from '@/stores/historySync'
import { useSettingsStore } from '@/stores/settingsStore'

export const Route = createFileRoute('/settings/sync')({
  component: RouteComponent,
})

type HistorySyncFormState = {
  enabled: boolean
  endpoint: string
  token: string
  passphrase: string
  autoSync: boolean
  intervalSeconds: number
}

const DEFAULT_HISTORY_SYNC_FORM_STATE: HistorySyncFormState = {
  enabled: false,
  endpoint: '',
  token: '',
  passphrase: '',
  autoSync: false,
  intervalSeconds: 60,
}

function clampHistorySyncIntervalSeconds(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_HISTORY_SYNC_FORM_STATE.intervalSeconds
  }
  return Math.min(3600, Math.max(15, Math.round(value)))
}

function normalizeHistorySyncFormState(config: Partial<HistorySyncFormState> | undefined | null): HistorySyncFormState {
  return {
    enabled: Boolean(config?.enabled),
    endpoint: typeof config?.endpoint === 'string' ? config.endpoint : '',
    token: typeof config?.token === 'string' ? config.token : '',
    passphrase: typeof config?.passphrase === 'string' ? config.passphrase : '',
    autoSync: Boolean(config?.autoSync),
    intervalSeconds: clampHistorySyncIntervalSeconds(
      typeof config?.intervalSeconds === 'number'
        ? config.intervalSeconds
        : DEFAULT_HISTORY_SYNC_FORM_STATE.intervalSeconds
    ),
  }
}

function isSameHistorySyncFormState(a: HistorySyncFormState, b: HistorySyncFormState): boolean {
  return (
    a.enabled === b.enabled &&
    a.endpoint === b.endpoint &&
    a.token === b.token &&
    a.passphrase === b.passphrase &&
    a.autoSync === b.autoSync &&
    a.intervalSeconds === b.intervalSeconds
  )
}

export function RouteComponent() {
  const { t } = useTranslation()
  const setSettings = useSettingsStore((state) => state.setSettings)
  const storedHistorySyncConfig = useSettingsStore((state) => state.extension.historySync)
  const [historySyncForm, setHistorySyncForm] = useState<HistorySyncFormState>(() =>
    normalizeHistorySyncFormState(storedHistorySyncConfig)
  )
  const [historySyncTips, setHistorySyncTips] = useState('')
  const [historySyncError, setHistorySyncError] = useState(false)
  const [historySyncStatus, setHistorySyncStatus] = useState<Awaited<ReturnType<typeof getHistorySyncState>>>()
  const [historySyncAction, setHistorySyncAction] = useState<'test' | 'pull' | 'push' | 'sync' | null>(null)

  const refreshHistorySyncStatus = async () => {
    const state = await getHistorySyncState()
    setHistorySyncStatus(state)
  }

  const updateHistorySyncForm = (next: Partial<HistorySyncFormState>) => {
    setHistorySyncForm((current) => {
      const merged = normalizeHistorySyncFormState({
        ...current,
        ...next,
      })
      return isSameHistorySyncFormState(current, merged) ? current : merged
    })
  }

  const persistHistorySyncConfig = () => {
    const normalized = normalizeHistorySyncFormState(historySyncForm)
    setSettings((state) => {
      const current = normalizeHistorySyncFormState(state.extension.historySync)
      if (isSameHistorySyncFormState(current, normalized)) {
        return
      }
      state.extension.historySync = normalized
    })
    setHistorySyncTips(t('Sync settings saved'))
    setHistorySyncError(false)
  }

  const runHistorySyncAction = async (
    action: 'test' | 'pull' | 'push' | 'sync',
    runner: () => Promise<{
      tip: string
      recoverSessions?: boolean
    }>
  ) => {
    setHistorySyncAction(action)
    setHistorySyncTips('')
    setHistorySyncError(false)
    try {
      const result = await runner()
      if (result.recoverSessions) {
        await recoverSessionList()
      }
      await refreshHistorySyncStatus()
      setHistorySyncTips(result.tip)
    } catch (error) {
      console.error(`History sync ${action} failed:`, error)
      setHistorySyncError(true)
      setHistorySyncTips(error instanceof Error ? error.message : t('History sync failed'))
      await refreshHistorySyncStatus()
    } finally {
      setHistorySyncAction(null)
    }
  }

  const syncConfig = () => ({
    endpoint: historySyncForm.endpoint,
    token: historySyncForm.token,
    passphrase: historySyncForm.passphrase,
  })

  const onTestHistorySync = async () => {
    await runHistorySyncAction('test', async () => {
      const snapshot = await testHistorySyncConnection(syncConfig())
      return {
        tip: t('Connected. Remote revision {{revision}}, updated at {{updatedAt}}', {
          revision: snapshot.revision,
          updatedAt: snapshot.updatedAt,
        }),
      }
    })
  }

  const onPullHistorySync = async () => {
    await runHistorySyncAction('pull', async () => {
      const result = await pullHistoryFromServer(syncConfig())
      return {
        tip: t('Pulled revision {{revision}}. Imported {{imported}}, updated {{updated}}, skipped {{skipped}}', {
          revision: result.revision,
          imported: result.imported,
          updated: result.updated,
          skipped: result.skipped,
        }),
        recoverSessions: result.imported > 0 || result.updated > 0,
      }
    })
  }

  const onPushHistorySync = async () => {
    await runHistorySyncAction('push', async () => {
      const result = await pushHistoryToServer(syncConfig())
      const conflictSuffix = result.conflictResolved
        ? t(' (resolved conflict: imported {{imported}}, updated {{updated}}, skipped {{skipped}} conversations)', {
            imported: result.imported,
            updated: result.updated,
            skipped: result.skipped,
          })
        : ''
      return {
        tip: t('Pushed history to revision {{revision}}{{suffix}}', {
          revision: result.revision,
          suffix: conflictSuffix,
        }),
        recoverSessions: result.conflictResolved && (result.imported > 0 || result.updated > 0),
      }
    })
  }

  const onSyncHistoryNow = async () => {
    await runHistorySyncAction('sync', async () => {
      const result = await syncHistoryNow(syncConfig())
      const recoverFromPull = result.pull.imported > 0 || result.pull.updated > 0
      const recoverFromPushConflict =
        result.push.conflictResolved && (result.push.imported > 0 || result.push.updated > 0)
      const pushText = result.push.pushed
        ? t('Push revision: {{revision}}', { revision: result.push.revision })
        : t('Push skipped after pull merge')
      return {
        tip: t('Sync completed. Pull imported {{imported}}, updated {{updated}}, skipped {{skipped}}. {{pushText}}', {
          imported: result.pull.imported,
          updated: result.pull.updated,
          skipped: result.pull.skipped,
          pushText,
        }),
        recoverSessions: recoverFromPull || recoverFromPushConflict,
      }
    })
  }

  useEffect(() => {
    void refreshHistorySyncStatus()
  }, [])

  const storedHistorySyncForm = normalizeHistorySyncFormState(storedHistorySyncConfig)
  const hasUnsavedHistorySyncChanges = !isSameHistorySyncFormState(historySyncForm, storedHistorySyncForm)
  const isHistorySyncPending = historySyncAction !== null
  const hasHistorySyncCredentials = Boolean(
    historySyncForm.endpoint.trim() && historySyncForm.token.trim() && historySyncForm.passphrase.trim()
  )
  const canRunSyncAction = historySyncForm.enabled && hasHistorySyncCredentials && !isHistorySyncPending
  const lastSyncedAt = historySyncStatus?.lastSyncedAt
    ? dayjs(historySyncStatus.lastSyncedAt).format('YYYY-MM-DD HH:mm:ss')
    : t('Never')

  return (
    <SettingsPage>
      <SettingsPageHeader
        title={t('Sync')}
        description={t(
          "Chats only, on your server, locked with your passphrase. No Chaeboxi account. The server stores an opaque blob and never sees plaintext."
        )}
      />

      <SettingsSection
        title={t('Self-hosted History Sync')}
        description={t(
          'Connect Chaeboxi to a sync server you run (Docker or one command). Same session id keeps the newer chat. Merge never wipes. Soft-reload, no relaunch.'
        )}
      >
        <SettingsCard>
          <div className="settings-card-fields">
            <SettingsPrefRow
              title={t('Enable server sync')}
              control={
                <Switch
                  checked={historySyncForm.enabled}
                  onChange={(e) => updateHistorySyncForm({ enabled: e.currentTarget.checked })}
                />
              }
            />
            <TextInput
              label={t('Sync endpoint')}
              placeholder="https://your-sync-host.example.com"
              value={historySyncForm.endpoint}
              onChange={(e) => updateHistorySyncForm({ endpoint: e.currentTarget.value })}
            />
            <PasswordInput
              label={t('Sync token')}
              description={t('HTTP auth for your server. Not the encryption passphrase.')}
              value={historySyncForm.token}
              onChange={(e) => updateHistorySyncForm({ token: e.currentTarget.value })}
            />
            <PasswordInput
              label={t('Sync passphrase')}
              description={t(
                'Encrypts chats on this device with AES-GCM before upload. Never sent to the server. There is no recovery if you lose it.'
              )}
              value={historySyncForm.passphrase}
              onChange={(e) => updateHistorySyncForm({ passphrase: e.currentTarget.value })}
            />
            <SettingsPrefRow
              title={t('Auto sync in background')}
              control={
                <Switch
                  checked={historySyncForm.autoSync}
                  onChange={(e) => updateHistorySyncForm({ autoSync: e.currentTarget.checked })}
                />
              }
            />
            <TextInput
              maw={220}
              label={t('Auto sync interval (seconds)')}
              type="number"
              value={`${historySyncForm.intervalSeconds}`}
              onChange={(e) => {
                const parsed = Number(e.currentTarget.value)
                if (Number.isFinite(parsed)) {
                  updateHistorySyncForm({ intervalSeconds: clampHistorySyncIntervalSeconds(parsed) })
                }
              }}
            />
            <div className="settings-actions">
              <Button variant="light" onClick={persistHistorySyncConfig} disabled={!hasUnsavedHistorySyncChanges}>
                {t('Save Sync Settings')}
              </Button>
            </div>
            {hasUnsavedHistorySyncChanges && (
              <Text size="sm" c="chatbox-tertiary">
                {t('You have unsaved sync settings. Save to apply background auto sync.')}
              </Text>
            )}
            <Stack gap={2}>
              <Text size="sm" c="chatbox-tertiary">
                {t('Last synced {{lastSyncedAt}} · local revision {{revision}}', {
                  revision: historySyncStatus?.revision || 0,
                  lastSyncedAt,
                })}
              </Text>
              {historySyncStatus?.lastError && (
                <Text size="sm" c="red">
                  {historySyncStatus.lastError}
                </Text>
              )}
            </Stack>
            {historySyncTips && (
              <Alert
                className="self-start"
                variant="light"
                color={historySyncError ? 'yellow' : 'green'}
                title={historySyncError ? t('History sync failed') : t('History sync completed')}
                icon={<IconInfoCircle />}
              >
                <Text size="sm">{historySyncTips}</Text>
              </Alert>
            )}
            {!hasHistorySyncCredentials && (
              <Text size="sm" c="chatbox-tertiary">
                {t('Set endpoint, token, and passphrase first, then test or Sync now')}
              </Text>
            )}
            <div className="settings-actions">
              <Button
                variant="light"
                onClick={onTestHistorySync}
                loading={historySyncAction === 'test'}
                disabled={!hasHistorySyncCredentials || isHistorySyncPending}
              >
                {t('Test Connection')}
              </Button>
              <Button
                variant="light"
                onClick={onPullHistorySync}
                loading={historySyncAction === 'pull'}
                disabled={!canRunSyncAction}
              >
                {t('Pull from Server')}
              </Button>
              <Button
                variant="light"
                onClick={onPushHistorySync}
                loading={historySyncAction === 'push'}
                disabled={!canRunSyncAction}
              >
                {t('Push to Server')}
              </Button>
              <Button onClick={onSyncHistoryNow} loading={historySyncAction === 'sync'} disabled={!canRunSyncAction}>
                {t('Sync Now')}
              </Button>
            </div>
          </div>
        </SettingsCard>
      </SettingsSection>
    </SettingsPage>
  )
}
