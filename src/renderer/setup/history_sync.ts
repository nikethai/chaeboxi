import { getLogger } from '@/lib/utils'
import { syncHistoryNow } from '@/stores/historySync'
import { settingsStore } from '@/stores/settingsStore'

const log = getLogger('history-sync-bootstrap')

const DEFAULT_INTERVAL_SECONDS = 60
const MIN_INTERVAL_SECONDS = 15
const MAX_INTERVAL_SECONDS = 3600

type RuntimeHistorySyncConfig = {
  enabled: boolean
  endpoint: string
  token: string
  autoSync: boolean
  intervalSeconds: number
}

let isInitialized = false
let intervalTimer: ReturnType<typeof setInterval> | null = null
let syncInFlight = false
let queuedSync = false
let lastConfigHash = ''

function normalizeConfig(): RuntimeHistorySyncConfig {
  const config = settingsStore.getState().extension.historySync
  const intervalRaw = Number(config?.intervalSeconds)
  const intervalSeconds = Number.isFinite(intervalRaw)
    ? Math.min(MAX_INTERVAL_SECONDS, Math.max(MIN_INTERVAL_SECONDS, intervalRaw))
    : DEFAULT_INTERVAL_SECONDS

  return {
    enabled: Boolean(config?.enabled),
    endpoint: config?.endpoint?.trim() || '',
    token: config?.token?.trim() || '',
    autoSync: Boolean(config?.autoSync),
    intervalSeconds,
  }
}

function canSync(config: RuntimeHistorySyncConfig): boolean {
  return config.enabled && Boolean(config.endpoint) && Boolean(config.token)
}

function clearSyncTimer() {
  if (intervalTimer) {
    clearInterval(intervalTimer)
    intervalTimer = null
  }
}

async function runSync(reason: string) {
  const config = normalizeConfig()
  if (!canSync(config)) {
    return
  }

  if (syncInFlight) {
    queuedSync = true
    return
  }

  syncInFlight = true
  try {
    await syncHistoryNow({
      endpoint: config.endpoint,
      token: config.token,
    })
    log.info(`history sync succeeded (${reason})`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log.error(`history sync failed (${reason}): ${message}`)
  } finally {
    syncInFlight = false
    if (queuedSync) {
      queuedSync = false
      setTimeout(() => {
        void runSync('queued')
      }, 0)
    }
  }
}

function updateScheduler(reason: 'init' | 'settings-change') {
  const config = normalizeConfig()
  const configHash = JSON.stringify(config)
  if (configHash === lastConfigHash && reason !== 'init') {
    return
  }
  lastConfigHash = configHash

  clearSyncTimer()
  if (!canSync(config) || !config.autoSync) {
    return
  }

  intervalTimer = setInterval(() => {
    void runSync('interval')
  }, config.intervalSeconds * 1000)

  void runSync(reason === 'init' ? 'startup' : 'settings-change')
}

export function initHistorySyncBootstrap() {
  if (isInitialized) {
    return
  }
  isInitialized = true

  settingsStore.subscribe(
    (state) => state.extension.historySync,
    () => {
      updateScheduler('settings-change')
    },
    {
      fireImmediately: true,
    }
  )
}

initHistorySyncBootstrap()
