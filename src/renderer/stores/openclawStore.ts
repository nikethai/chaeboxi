import { v4 as uuidv4 } from 'uuid'
import { createStore, useStore } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { getLogger } from '@/lib/utils'
import type { OpenClawGatewayConfig, OpenClawSettings } from '@shared/types'

const log = getLogger('openclaw-store')

type Action = {
  addGateway: (config: Omit<OpenClawGatewayConfig, 'id'>) => string
  removeGateway: (id: string) => void
  updateGateway: (id: string, updates: Partial<Omit<OpenClawGatewayConfig, 'id'>>) => void
  getGateway: (id: string) => OpenClawGatewayConfig | undefined
  getActiveGateway: () => OpenClawGatewayConfig | undefined
  setActiveGateway: (id: string) => void
  getSettings: () => OpenClawSettings
}

export const openclawStore = createStore<OpenClawSettings & Action>()(
  subscribeWithSelector(
    immer((set, get) => ({
      gateways: [],

      addGateway: (config) => {
        const id = uuidv4()
        const newGateway: OpenClawGatewayConfig = { id, ...config }

        set((state) => {
          // If this is the first gateway or marked as default, ensure it's the only default
          if (newGateway.isDefault || state.gateways.length === 0) {
            state.gateways.forEach((g) => {
              g.isDefault = false
            })
            newGateway.isDefault = true
          }
          state.gateways.push(newGateway)
        })

        log.info(`[OpenClaw] Added gateway: ${newGateway.name} (${newGateway.id})`)
        return id
      },

      removeGateway: (id) => {
        const gateway = get().gateways.find((g) => g.id === id)
        set((state) => {
          state.gateways = state.gateways.filter((g) => g.id !== id)
          // If we removed the default, make the first remaining gateway the default
          if (gateway?.isDefault && state.gateways.length > 0) {
            state.gateways[0].isDefault = true
          }
        })
        log.info(`[OpenClaw] Removed gateway: ${id}`)
      },

      updateGateway: (id, updates) => {
        set((state) => {
          const index = state.gateways.findIndex((g) => g.id === id)
          if (index === -1) return

          const gateway = state.gateways[index]
          // Short-circuit: no actual changes
          const hasChanges = Object.keys(updates).some(
            (key) => gateway[key as keyof typeof gateway] !== updates[key as keyof typeof updates]
          )
          if (!hasChanges) return

          // If setting as default, unset other defaults first
          if (updates.isDefault) {
            state.gateways.forEach((g) => {
              g.isDefault = false
            })
          }
          Object.assign(state.gateways[index], updates)
        })
        log.info(`[OpenClaw] Updated gateway: ${id}`)
      },

      getGateway: (id) => {
        return get().gateways.find((g) => g.id === id)
      },

      getActiveGateway: () => {
        const gateways = get().gateways
        return gateways.find((g) => g.isDefault) || gateways[0]
      },

      setActiveGateway: (id) => {
        set((state) => {
          // Short-circuit: if already active, skip update
          const currentDefault = state.gateways.find((g) => g.isDefault)
          if (currentDefault?.id === id) return

          state.gateways.forEach((g) => {
            g.isDefault = g.id === id
          })
        })
        log.info(`[OpenClaw] Set active gateway: ${id}`)
      },

      getSettings: () => {
        const store = get()
        return {
          gateways: store.gateways,
        }
      },
    }))
  )
)

// Sync openclawStore with settingsStore's openclaw field
let _initialized = false

export function initOpenClawStore() {
  if (_initialized) return
  _initialized = true

  // Lazy import to avoid circular dependency
  import('./settingsStore').then(({ settingsStore }) => {
    // Sync from settings to openclawStore on hydration
    settingsStore.subscribe(
      (state: any) => state.openclaw,
      (openclawSettings: OpenClawSettings | undefined) => {
        if (openclawSettings?.gateways) {
          openclawStore.setState((state) => {
            state.gateways = openclawSettings.gateways
          })
        }
      }
    )

    // Sync from openclawStore to settings when openclawStore changes
    openclawStore.subscribe(
      (state) => state.gateways,
      (gateways) => {
        // Equality guard: only write if actually changed
        const currentSettings = settingsStore.getState()
        if (currentSettings.openclaw?.gateways === gateways) return

        settingsStore.setState((state: any) => {
          state.openclaw = { gateways }
        })
      }
    )
  })
}

export function useOpenClawStore<U>(selector: Parameters<typeof useStore<typeof openclawStore, U>>[1]) {
  return useStore<typeof openclawStore, U>(openclawStore, selector)
}
