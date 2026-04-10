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
          if (newGateway.isDefault || state.gateways.length === 0) {
            for (const g of state.gateways) g.isDefault = false
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

          if (updates.isDefault) {
            for (const g of state.gateways) g.isDefault = false
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
          const currentDefault = state.gateways.find((g) => g.isDefault)
          if (currentDefault?.id === id) return

          for (const g of state.gateways) g.isDefault = g.id === id
        })
        log.info(`[OpenClaw] Set active gateway: ${id}`)
      },

      getSettings: () => ({
        gateways: get().gateways,
      }),
    }))
  )
)

// One-directional sync: settingsStore → openclawStore (hydration only)
// openclawStore writes back to settingsStore on changes
let _initialized = false
let _syncing = false

export function initOpenClawStore() {
  if (_initialized) return
  _initialized = true

  import('./settingsStore').then(({ settingsStore }) => {
    // On settingsStore hydration, seed openclawStore
    settingsStore.subscribe(
      (state) => (state as Record<string, unknown>).openclaw as OpenClawSettings | undefined,
      (openclawSettings) => {
        if (_syncing || !openclawSettings?.gateways) return
        _syncing = true
        openclawStore.setState((state) => {
          state.gateways = openclawSettings.gateways
        })
        _syncing = false
      }
    )

    // Write openclawStore changes back to settingsStore
    openclawStore.subscribe(
      (state) => state.gateways,
      (gateways) => {
        if (_syncing) return
        _syncing = true
        settingsStore.setState((state) => {
          ;(state as Record<string, unknown>).openclaw = { gateways }
        })
        _syncing = false
      }
    )
  })
}

export function useOpenClawStore<U>(selector: Parameters<typeof useStore<typeof openclawStore, U>>[1]) {
  return useStore<typeof openclawStore, U>(openclawStore, selector)
}
