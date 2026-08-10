import { getLogger } from '@/lib/utils'
import { settingsStore } from '@/stores/settingsStore'

const log = getLogger('memory-sync-bootstrap')

let initialized = false

function canSync(): boolean {
  const config = settingsStore.getState().extension.memorySync
  return Boolean(config?.enabled) && Boolean(config?.endpoint?.trim()) && Boolean(config?.token?.trim())
}

function maybeRunStartupMemorySync() {
  if (!canSync()) {
    return
  }
  // The passphrase is never persisted (no recovery), so encrypted pushes/pulls
  // are only possible while the user has entered it this session via the Memory
  // Sync UI. The startup attempt is still scheduled so the bootstrap wiring is
  // exercised when sync is enabled; enabling sync later re-runs this path
  // through the settings subscription below.
  log.info('memory sync enabled; awaiting passphrase for encrypted sync')
}

export function initMemorySyncBootstrap() {
  if (initialized) {
    return
  }
  initialized = true

  settingsStore.subscribe(
    (state) => state.extension.memorySync,
    () => {
      setTimeout(() => {
        void maybeRunStartupMemorySync()
      }, 0)
    },
    {
      fireImmediately: true,
    }
  )
}
