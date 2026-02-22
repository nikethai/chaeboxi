import {
  Alert,
  Button,
  Checkbox,
  Divider,
  FileButton,
  Flex,
  NumberInput,
  Radio,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { type Language, type ProviderInfo, type Settings, Theme } from '@shared/types'
import { formatFileSize } from '@shared/utils'
import { IconInfoCircle } from '@tabler/icons-react'
import { createFileRoute } from '@tanstack/react-router'
import dayjs from 'dayjs'
import { mapValues, uniqBy } from 'lodash'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AdaptiveSelect } from '@/components/AdaptiveSelect'
import LazySlider from '@/components/common/LazySlider'
import { languageNameMap, languages } from '@/i18n/locales'
import platform from '@/platform'
import storage, { StorageKey } from '@/storage'
import { recoverSessionList } from '@/stores/chatStore'
import {
  getHistorySyncState,
  pullHistoryFromServer,
  pushHistoryToServer,
  syncHistoryNow,
  testHistorySyncConnection,
} from '@/stores/historySync'
import { exportHistoryTransferFile, importHistoryTransferFile } from '@/stores/historyTransfer'
import { migrateOnData } from '@/stores/migration'
import { useSettingsStore } from '@/stores/settingsStore'

export const Route = createFileRoute('/settings/general')({
  component: RouteComponent,
})

export function RouteComponent() {
  const { t } = useTranslation()
  const { setSettings, ...settings } = useSettingsStore((state) => state)

  return (
    <Stack p="md" gap="xl">
      <Title order={5}>{t('General Settings')}</Title>

      {/* Display Settings */}
      <Stack gap="md">
        <Title order={5}>{t('Display Settings')}</Title>

        {/* language */}
        <AdaptiveSelect
          maw={320}
          comboboxProps={{ withinPortal: true }}
          value={settings.language}
          data={languages.map((language) => ({
            value: language,
            label: languageNameMap[language],
            // style: language === 'ar' ? { fontFamily: 'Cairo, Arial, sans-serif' } : {},
          }))}
          label={t('Language')}
          styles={{
            label: {
              fontWeight: 400,
            },
          }}
          onChange={(val) => {
            if (val) {
              setSettings({
                language: val as Language,
              })
            }
          }}
        />

        {/* theme */}
        <AdaptiveSelect
          maw={320}
          comboboxProps={{ withinPortal: true, withArrow: true }}
          label={t('Theme')}
          styles={{
            label: {
              fontWeight: 400,
            },
          }}
          data={[
            { value: `${Theme.System}`, label: t('Follow System') },
            { value: `${Theme.Light}`, label: t('Light Mode') },
            { value: `${Theme.Dark}`, label: t('Dark Mode') },
          ]}
          value={`${settings.theme}`}
          onChange={(val) => {
            if (val) {
              setSettings({
                theme: parseInt(val),
              })
            }
          }}
        />

        {/* Font Size */}
        <Stack>
          <Text>{t('Font Size')}</Text>
          <LazySlider
            step={1}
            min={10}
            max={22}
            maw={320}
            marks={[
              {
                value: 14,
              },
            ]}
            value={settings.fontSize}
            onChange={(val) =>
              setSettings({
                fontSize: val,
              })
            }
          />
        </Stack>

        {/* Startup Page */}
        <Stack>
          <Text>{t('Startup Page')}</Text>
          <Radio.Group
            value={settings.startupPage}
            defaultValue="home"
            onChange={(val) => setSettings({ startupPage: val as any })}
          >
            <Flex gap="md">
              <Radio label={t('Home Page')} value="home" />
              <Radio label={t('Last Session')} value="session" />
            </Flex>
          </Radio.Group>
        </Stack>
      </Stack>

      <Divider />

      {/* Network Proxy */}
      <Stack gap="xs">
        <Title order={5}>{t('Network Proxy')}</Title>
        <TextInput
          maw={320}
          placeholder="socks5://127.0.0.1:6153"
          value={settings.proxy}
          onChange={(e) =>
            setSettings({
              proxy: e.currentTarget.value,
            })
          }
        />
      </Stack>

      <Divider />

      {/* Data Recovery */}
      <DataRecoverySection />

      <Divider />

      {/* import and export data */}
      <ImportExportDataSection />

      <Divider />

      {/* Export Logs */}
      <ExportLogsSection />

      <Divider />

      {/* Error Reporting */}
      <Stack gap="md">
        <Stack gap="xxs">
          <Title order={5}>{t('Error Reporting')}</Title>
          <Text c="chatbox-tertiary">
            {t(
              'Chatbox respects your privacy and only uploads anonymous error data and events when necessary. You can change your preferences at any time in the settings.'
            )}
          </Text>
        </Stack>

        <Checkbox
          label={t('Enable optional anonymous reporting of crash and event data')}
          checked={settings.allowReportingAndTracking}
          onChange={(e) => setSettings({ allowReportingAndTracking: e.target.checked })}
        />
      </Stack>

      {/* others */}
      {platform.type === 'desktop' && (
        <>
          <Divider />

          <Stack gap="xl">
            <Switch
              label={t('Launch at system startup')}
              checked={settings.autoLaunch}
              onChange={(e) =>
                setSettings({
                  autoLaunch: e.currentTarget.checked,
                })
              }
            />
            <Switch
              label={t('Automatic updates')}
              checked={settings.autoUpdate}
              onChange={(e) =>
                setSettings({
                  autoUpdate: e.currentTarget.checked,
                })
              }
            />
            <Switch
              label={t('Beta updates')}
              checked={settings.betaUpdate}
              onChange={(e) =>
                setSettings({
                  betaUpdate: e.currentTarget.checked,
                })
              }
            />
          </Stack>
        </>
      )}
    </Stack>
  )
}

const DataRecoverySection = () => {
  const { t } = useTranslation()
  const [isRecovering, setIsRecovering] = useState(false)
  const [recoveryResult, setRecoveryResult] = useState<{
    success: boolean
    recovered?: number
    failed?: number
    error?: string
  } | null>(null)

  const handleRecover = async () => {
    setIsRecovering(true)
    setRecoveryResult(null)
    try {
      const result = await recoverSessionList()
      setRecoveryResult({ success: true, recovered: result.recovered, failed: result.failed })
    } catch (error) {
      console.error('Failed to recover session list:', error)
      setRecoveryResult({ success: false, error: String(error) })
    } finally {
      setIsRecovering(false)
    }
  }

  const hasPartialFailure = recoveryResult?.success && recoveryResult.failed && recoveryResult.failed > 0

  return (
    <Stack gap="md">
      <Stack gap="xxs">
        <Title order={5}>{t('Data Recovery')}</Title>
        <Text c="chatbox-tertiary">
          {t('If conversations are missing from the list, use this feature to scan and recover them from storage')}
        </Text>
      </Stack>
      <Button className="self-start" onClick={handleRecover} disabled={isRecovering} loading={isRecovering}>
        {isRecovering ? t('Recovering...') : t('Recover Conversation List')}
      </Button>
      {recoveryResult && (
        <Alert
          className="self-start"
          variant="light"
          color={recoveryResult.success ? (hasPartialFailure ? 'yellow' : 'green') : 'red'}
          title={
            recoveryResult.success
              ? t('Recovered {{count}} conversations', { count: recoveryResult.recovered })
              : t('Recovery failed')
          }
          icon={<IconInfoCircle />}
        >
          {recoveryResult.success ? (
            <Stack gap="xs">
              <Text size="sm">{t('The conversation list has been successfully recovered')}</Text>
              {hasPartialFailure && (
                <Text size="sm" c="orange">
                  {t('{{count}} conversations could not be recovered due to data read errors', {
                    count: recoveryResult.failed,
                  })}
                </Text>
              )}
            </Stack>
          ) : (
            <Text size="sm">{recoveryResult.error || t('Unknown error')}</Text>
          )}
        </Alert>
      )}
    </Stack>
  )
}

const ImportExportDataSection = () => {
  const { t } = useTranslation()
  const { setSettings, extension } = useSettingsStore((state) => ({
    setSettings: state.setSettings,
    extension: state.extension,
  }))
  const historySyncConfig = extension.historySync || {
    enabled: false,
    endpoint: '',
    token: '',
    autoSync: false,
    intervalSeconds: 60,
  }

  const [importTips, setImportTips] = useState('')
  const [historySyncTips, setHistorySyncTips] = useState('')
  const [historySyncError, setHistorySyncError] = useState(false)
  const [historySyncStatus, setHistorySyncStatus] = useState<Awaited<ReturnType<typeof getHistorySyncState>>>()
  const [historySyncAction, setHistorySyncAction] = useState<'test' | 'pull' | 'push' | 'sync' | null>(null)
  const [historyTransferTips, setHistoryTransferTips] = useState('')
  const [historyTransferError, setHistoryTransferError] = useState(false)
  const [isHistoryTransferPending, setIsHistoryTransferPending] = useState(false)
  const [exportItems, setExportItems] = useState<ExportDataItem[]>([
    ExportDataItem.Setting,
    ExportDataItem.Conversations,
    ExportDataItem.Copilot,
  ])

  const refreshHistorySyncStatus = async () => {
    const state = await getHistorySyncState()
    setHistorySyncStatus(state)
  }

  const updateHistorySyncConfig = (next: Partial<typeof historySyncConfig>) => {
    setSettings((state) => {
      const current = state.extension.historySync || {
        enabled: false,
        endpoint: '',
        token: '',
        autoSync: false,
        intervalSeconds: 60,
      }
      state.extension.historySync = {
        ...current,
        ...next,
      }
    })
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

  const onTestHistorySync = async () => {
    await runHistorySyncAction('test', async () => {
      const snapshot = await testHistorySyncConnection({
        endpoint: historySyncConfig.endpoint,
        token: historySyncConfig.token,
      })
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
      const result = await pullHistoryFromServer({
        endpoint: historySyncConfig.endpoint,
        token: historySyncConfig.token,
      })
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
      const result = await pushHistoryToServer({
        endpoint: historySyncConfig.endpoint,
        token: historySyncConfig.token,
      })

      const conflictSuffix = result.conflictResolved
        ? t(
            ' (resolved conflict: imported {{imported}}, updated {{updated}}, skipped {{skipped}} conversations)',
            {
              imported: result.imported,
              updated: result.updated,
              skipped: result.skipped,
            }
          )
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
      const result = await syncHistoryNow({
        endpoint: historySyncConfig.endpoint,
        token: historySyncConfig.token,
      })
      const recoverFromPull = result.pull.imported > 0 || result.pull.updated > 0
      const recoverFromPushConflict =
        result.push.conflictResolved && (result.push.imported > 0 || result.push.updated > 0)

      return {
        tip: t(
          'Sync completed. Pull imported {{imported}}, updated {{updated}}, skipped {{skipped}}. Push revision: {{revision}}',
          {
            imported: result.pull.imported,
            updated: result.pull.updated,
            skipped: result.pull.skipped,
            revision: result.push.revision,
          }
        ),
        recoverSessions: recoverFromPull || recoverFromPushConflict,
      }
    })
  }

  const onExportHistoryTransfer = async () => {
    setHistoryTransferTips('')
    setHistoryTransferError(false)
    setIsHistoryTransferPending(true)
    try {
      const { fileName, content, sessionCount } = await exportHistoryTransferFile()
      await platform.exporter.exportTextFile(fileName, content)
      setHistoryTransferTips(t('Exported {{count}} conversations for transfer', { count: sessionCount }))
    } catch (error) {
      console.error('Failed to export history transfer file:', error)
      setHistoryTransferError(true)
      setHistoryTransferTips(t('Failed to export chat history'))
    } finally {
      setIsHistoryTransferPending(false)
    }
  }

  const onImportHistoryTransfer = (file: File | null) => {
    if (!file) {
      return
    }

    void (async () => {
      setHistoryTransferTips('')
      setHistoryTransferError(false)
      setIsHistoryTransferPending(true)
      try {
        const text = await file.text()
        const result = await importHistoryTransferFile(text)
        await recoverSessionList()
        setHistoryTransferTips(
          t('Imported {{imported}} new, updated {{updated}}, skipped {{skipped}} conversations', {
            imported: result.imported,
            updated: result.updated,
            skipped: result.skipped,
          })
        )
      } catch (error) {
        console.error('Failed to import history transfer file:', error)
        setHistoryTransferError(true)
        setHistoryTransferTips(error instanceof Error ? error.message : t('Failed to import chat history'))
      } finally {
        setIsHistoryTransferPending(false)
      }
    })()
  }

  const onExport = async () => {
    const data = await storage.getAll()
    delete data[StorageKey.Configs] // 不导出 uuid
    ;(data[StorageKey.Settings] as Settings).licenseDetail = undefined // 不导出历史兼容字段
    ;(data[StorageKey.Settings] as Settings).licenseInstances = undefined // 不导出历史兼容字段
    if (!exportItems.includes(ExportDataItem.Key)) {
      delete (data[StorageKey.Settings] as Settings).licenseKey
      data[StorageKey.Settings].providers = mapValues(
        (data[StorageKey.Settings] as Settings).providers,
        (provider: ProviderInfo) => {
          delete provider.apiKey
          delete provider.cloudflareClientSecret
          return provider
        }
      )
    }
    if (!exportItems.includes(ExportDataItem.Setting)) {
      delete data[StorageKey.Settings]
    }
    if (!exportItems.includes(ExportDataItem.Conversations)) {
      delete data[StorageKey.ChatSessions]
      delete data[StorageKey.ChatSessionsList]
      for (const key of Object.keys(data)) {
        if (key.startsWith('session:')) {
          delete data[key]
        }
      }
    }
    if (!exportItems.includes(ExportDataItem.Copilot)) {
      delete data[StorageKey.MyCopilots]
    }
    const date = new Date()
    data['__exported_items'] = exportItems
    data['__exported_at'] = date.toISOString()
    const dateStr = dayjs(date).format('YYYY-M-D')
    platform.exporter.exportTextFile(`chatbox-exported-data-${dateStr}.json`, JSON.stringify(data))
  }

  const onImport = (file: File | null) => {
    const errTip = t('Import failed, unsupported data format')
    if (!file) {
      return
    }
    const reader = new FileReader()
    reader.onload = (event) => {
      void (async () => {
        setImportTips('')
        try {
          const result = event.target?.result
          if (typeof result !== 'string') {
            throw new Error('FileReader result is not string')
          }
          const importData = JSON.parse(result)
          // 如果导入数据中包含了老的版本号，应该仅仅针对老的版本号进行迁移
          await migrateOnData(
            {
              getData: (key, defaultValue) => Promise.resolve(importData[key] ?? defaultValue),
              setData: (key, value) => {
                importData[key] = value
                return Promise.resolve()
              },
              setAll: (data) => {
                Object.assign(importData, data)
                return Promise.resolve()
              },
            },
            false
          )

          const entriesToImport = Object.entries(importData).filter(
            ([key]) => key !== StorageKey.ChatSessionsList && key !== StorageKey.ConfigVersion && !key.startsWith('__')
          )

          const importedChatSessions = Array.isArray(importData[StorageKey.ChatSessionsList])
            ? importData[StorageKey.ChatSessionsList]
            : undefined

          for (const [key, value] of entriesToImport) {
            await storage.setItemNow(key, value)
          }

          if (importedChatSessions) {
            const previousChatSessions = await storage.getItem(StorageKey.ChatSessionsList, [])

            await storage.setItemNow(
              StorageKey.ChatSessionsList,
              uniqBy([...previousChatSessions, ...importedChatSessions], 'id')
            )
          }

          // 由于即将重启应用，这里不需要清理loading状态
          // props.onCancel() // 导入成功后立即关闭设置窗口，防止用户点击保存、导致设置数据被覆盖
          platform.relaunch() // 重启应用以生效
        } catch (err) {
          setImportTips(errTip)

          throw err
        }
      })()
    }
    reader.onerror = (event) => {
      setImportTips(errTip)
      const err = event.target?.error
      if (!err) {
        throw new Error('FileReader error but no error message')
      }
      throw err
    }
    reader.readAsText(file)
  }

  const [showStorageInfo, setShowStorageInfo] = useState(false)
  const [storagePersisted, setStoragePersisted] = useState<boolean>()
  const [storageEstimate, setStorageEstimate] = useState<StorageEstimate>()
  const storageInfo = useMemo(
    () =>
      `Storage persisted: ${storagePersisted}; Storage Estimate: { quota: ${formatFileSize(storageEstimate?.quota || 0)}, usage: ${formatFileSize(storageEstimate?.usage || 0)} }`,
    [storagePersisted, storageEstimate]
  )
  useEffect(() => {
    if (window?.navigator?.storage) {
      window.navigator.storage.estimate?.().then((res) => setStorageEstimate(res))
      window.navigator.storage.persisted?.().then((p) => setStoragePersisted(p))
    }
  }, [])
  useEffect(() => {
    void (async () => {
      const state = await getHistorySyncState()
      setHistorySyncStatus(state)
    })()
  }, [])

  const isHistorySyncPending = historySyncAction !== null
  const hasHistorySyncCredentials = Boolean(historySyncConfig.endpoint?.trim() && historySyncConfig.token?.trim())
  const canRunSyncAction = historySyncConfig.enabled && hasHistorySyncCredentials && !isHistorySyncPending
  const lastSyncedAt = historySyncStatus?.lastSyncedAt
    ? dayjs(historySyncStatus.lastSyncedAt).format('YYYY-MM-DD HH:mm:ss')
    : t('Never')

  return (
    <>
      <Stack gap="lg">
        <Stack gap="xxs">
          <Title order={5}>{t('Cross-device Chat History')}</Title>
          <Text c="chatbox-tertiary">
            {t(
              'Export conversations from this machine and import them on another machine. Existing conversations will be merged by session id.'
            )}
          </Text>
        </Stack>
        {historyTransferTips && (
          <Alert
            className="self-start"
            variant="light"
            color={historyTransferError ? 'yellow' : 'green'}
            title={historyTransferError ? t('History transfer failed') : t('History transfer completed')}
            icon={<IconInfoCircle />}
          >
            <Text size="sm">{historyTransferTips}</Text>
          </Alert>
        )}
        <Flex gap="md">
          <Button className="self-start" onClick={onExportHistoryTransfer} loading={isHistoryTransferPending}>
            {t('Export Chat History for Transfer')}
          </Button>
          <FileButton accept="application/json" onChange={onImportHistoryTransfer}>
            {(props) => (
              <Button {...props} className="self-start" loading={isHistoryTransferPending}>
                {t('Import and Merge Chat History')}
              </Button>
            )}
          </FileButton>
        </Flex>
      </Stack>

      <Divider />

      <Stack gap="lg">
        <Stack gap="xxs">
          <Title order={5}>{t('Self-hosted History Sync')}</Title>
          <Text c="chatbox-tertiary">
            {t(
              'Connect to your own sync service (for example on Proxmox). The client syncs snapshots with revision conflict handling.'
            )}
          </Text>
        </Stack>

        <Switch
          label={t('Enable server sync')}
          checked={historySyncConfig.enabled}
          onChange={(e) => updateHistorySyncConfig({ enabled: e.currentTarget.checked })}
        />

        <TextInput
          maw={520}
          label={t('Sync endpoint')}
          placeholder="https://your-sync-host.example.com"
          value={historySyncConfig.endpoint || ''}
          onChange={(e) => updateHistorySyncConfig({ endpoint: e.currentTarget.value })}
        />

        <TextInput
          maw={520}
          label={t('Sync token')}
          type="password"
          value={historySyncConfig.token || ''}
          onChange={(e) => updateHistorySyncConfig({ token: e.currentTarget.value })}
        />

        <Flex gap="md" wrap="wrap" align="flex-end">
          <Switch
            label={t('Auto sync in background')}
            checked={historySyncConfig.autoSync}
            onChange={(e) => updateHistorySyncConfig({ autoSync: e.currentTarget.checked })}
          />
          <NumberInput
            maw={220}
            label={t('Auto sync interval (seconds)')}
            min={15}
            max={3600}
            value={historySyncConfig.intervalSeconds}
            onChange={(value) =>
              updateHistorySyncConfig({ intervalSeconds: typeof value === 'number' ? value : 60 })
            }
          />
        </Flex>

        <Stack gap={2}>
          <Text size="sm" c="chatbox-tertiary">
            {t('Local sync state: revision {{revision}}, last synced {{lastSyncedAt}}', {
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
            {t('Set endpoint and token first, then test/pull/push/sync')}
          </Text>
        )}

        <Flex gap="md" wrap="wrap">
          <Button
            className="self-start"
            variant="light"
            onClick={onTestHistorySync}
            loading={historySyncAction === 'test'}
            disabled={!hasHistorySyncCredentials || isHistorySyncPending}
          >
            {t('Test Connection')}
          </Button>
          <Button
            className="self-start"
            variant="light"
            onClick={onPullHistorySync}
            loading={historySyncAction === 'pull'}
            disabled={!canRunSyncAction}
          >
            {t('Pull from Server')}
          </Button>
          <Button
            className="self-start"
            variant="light"
            onClick={onPushHistorySync}
            loading={historySyncAction === 'push'}
            disabled={!canRunSyncAction}
          >
            {t('Push to Server')}
          </Button>
          <Button
            className="self-start"
            onClick={onSyncHistoryNow}
            loading={historySyncAction === 'sync'}
            disabled={!canRunSyncAction}
          >
            {t('Sync Now')}
          </Button>
        </Flex>
      </Stack>

      <Divider />

      <Stack gap="md">
        <Title order={5} onDoubleClick={() => setShowStorageInfo(true)}>
          {t('Data Backup')}
        </Title>
        {showStorageInfo && (
          <Text size="xs" c="chatbox-tertiary">
            {storageInfo}
          </Text>
        )}
        {[
          { label: t('Settings'), value: ExportDataItem.Setting },
          { label: t('API Keys'), value: ExportDataItem.Key },
          { label: t('Chat History'), value: ExportDataItem.Conversations },
          { label: t('My Copilots'), value: ExportDataItem.Copilot },
        ].map(({ label, value }) => (
          <Checkbox
            key={value}
            checked={exportItems.includes(value)}
            label={label}
            onChange={(e) => {
              const checked = e.currentTarget.checked
              if (checked && !exportItems.includes(value)) {
                setExportItems([...exportItems, value])
              } else if (!checked) {
                setExportItems(exportItems.filter((v) => v !== value))
              }
            }}
          />
        ))}
        <Button className="self-start" onClick={onExport}>
          {t('Export Selected Data')}
        </Button>
      </Stack>

      <Divider />

      <Stack gap="lg">
        <Stack gap="xxs">
          <Title order={5}>{t('Data Restore')}</Title>
          <Text c="chatbox-tertiary">
            {t('Upon import, changes will take effect immediately and existing data will be overwritten')}
          </Text>
        </Stack>
        {importTips && (
          <Alert
            className=" self-start"
            variant="light"
            color="yellow"
            title={importTips}
            icon={<IconInfoCircle />}
          ></Alert>
        )}
        <FileButton accept="application/json" onChange={onImport}>
          {(props) => (
            <Button {...props} className="self-start">
              {t('Import and Restore')}
            </Button>
          )}
        </FileButton>
      </Stack>
    </>
  )
}

enum ExportDataItem {
  Setting = 'setting',
  Key = 'key',
  Conversations = 'conversations',
  Copilot = 'copilot',
}

const ExportLogsSection = () => {
  const { t } = useTranslation()
  const [isExporting, setIsExporting] = useState(false)
  const [exportResult, setExportResult] = useState<{
    success: boolean
    error?: string
  } | null>(null)

  const handleExportLogs = async () => {
    setIsExporting(true)
    setExportResult(null)
    try {
      const logs = await platform.exportLogs()
      if (!logs || logs.trim() === '') {
        setExportResult({ success: true })
        return
      }

      const date = new Date()
      const dateStr = dayjs(date).format('YYYY-M-D_H-m')
      await platform.exporter.exportTextFile(`chatbox-logs-${dateStr}.txt`, logs)
      setExportResult({ success: true })
    } catch (error) {
      console.error('Failed to export logs:', error)
      setExportResult({ success: false, error: String(error) })
    } finally {
      setIsExporting(false)
    }
  }

  const handleClearLogs = async () => {
    try {
      await platform.clearLogs()
      setExportResult({ success: true })
    } catch (error) {
      console.error('Failed to clear logs:', error)
    }
  }

  return (
    <Stack gap="md">
      <Stack gap="xxs">
        <Title order={5}>{t('Diagnostic Logs')}</Title>
        <Text c="chatbox-tertiary">
          {t(
            'Export application logs for troubleshooting. These logs may be requested by support to help diagnose issues.'
          )}
        </Text>
      </Stack>
      <Flex gap="md">
        <Button variant="primary" onClick={handleExportLogs} disabled={isExporting} loading={isExporting}>
          {isExporting ? t('Exporting...') : t('Export Logs')}
        </Button>
        {/* <Button variant="subtle" color="red" onClick={handleClearLogs} disabled={isExporting}>
          {t('Clear Logs')}
        </Button> */}
      </Flex>
      {exportResult && !exportResult.success && (
        <Alert className="self-start" variant="light" color="red" title={t('Export failed')} icon={<IconInfoCircle />}>
          <Text size="sm">{exportResult.error || t('Unknown error')}</Text>
        </Alert>
      )}
    </Stack>
  )
}
