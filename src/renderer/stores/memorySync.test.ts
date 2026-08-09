import { describe, expect, it, vi } from 'vitest'

vi.mock('@/storage', () => ({
  default: {
    getItem: async (_key: string, initialValue: unknown) => initialValue,
    setItemNow: async () => undefined,
  },
}))

vi.mock('@/stores/memoryStore', () => ({
  memoryStore: {
    getState: () => ({
      flushPersistence: async () => undefined,
      setSettings: async () => undefined,
      replaceGlobalBank: async () => undefined,
      replaceAgentBank: async () => undefined,
      settings: undefined,
      globalBank: undefined,
    }),
  },
}))

import { defaultMemorySettings, emptyMemoryBank } from '@shared/types/memory'
import { SettingsSchema, Theme } from '@shared/types/settings'
import { encryptMemorySyncPayload } from '@/packages/memory/crypto'
import type { MemorySyncSnapshot } from '@/packages/memory/sync-types'
import {
  getMemorySyncState,
  pullMemoryFromServer,
  pushMemoryToServer,
  syncMemoryNow,
  testMemorySyncConnection,
} from './memorySync'

class MemoryStore {
  private values = new Map<string, unknown>()

  constructor(seed: Record<string, unknown> = {}) {
    for (const [key, value] of Object.entries(seed)) {
      this.values.set(key, value)
    }
  }

  async getItem<T>(key: string, initialValue: T): Promise<T> {
    if (!this.values.has(key)) {
      return initialValue
    }
    return this.values.get(key) as T
  }

  async setItemNow<T>(key: string, value: T): Promise<void> {
    this.values.set(key, value)
  }
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

function syncConfig() {
  return {
    enabled: true,
    endpoint: 'http://x',
    token: 't',
    autoSync: false,
    intervalSeconds: 60,
  }
}

function fakeSnapshot(): MemorySyncSnapshot {
  return {
    schemaVersion: 1,
    settings: defaultMemorySettings(),
    globalBank: emptyMemoryBank('global'),
    agentBanks: [],
  }
}

describe('memory sync config schema', () => {
  it('accepts memorySync extension settings', () => {
    const parsed = SettingsSchema.parse({
      theme: Theme.Dark,
      language: 'en',
      shortcuts: {
        quickToggle: '',
        quickAttachOrOpen: '',
        quickOpen: '',
        screenshotToChat: '',
        inputBoxFocus: 'mod+i',
        inputBoxWebBrowsingMode: 'mod+e',
        newChat: 'mod+n',
        newPictureChat: 'mod+shift+n',
        sessionListNavNext: 'mod+tab',
        sessionListNavPrev: 'mod+shift+tab',
        sessionListNavTargetIndex: 'mod',
        messageListRefreshContext: 'mod+r',
        dialogOpenSearch: 'mod+k',
        optionNavUp: 'up',
        optionNavDown: 'down',
        optionSelect: 'enter',
        inputBoxSendMessage: 'Enter',
        inputBoxSendMessageWithoutResponse: 'Ctrl+Enter',
      },
      extension: {
        webSearch: {
          provider: 'bing',
        },
        memorySync: {
          enabled: true,
          endpoint: 'http://127.0.0.1:8788',
          token: 'secret',
          autoSync: true,
          intervalSeconds: 60,
        },
      },
      mcp: {
        servers: [],
        enabledBuiltinServers: [],
      },
      openclaw: {},
      userPersonalInfo: {},
    })

    expect(parsed.extension.memorySync?.enabled).toBe(true)
    expect(parsed.extension.memorySync?.endpoint).toBe('http://127.0.0.1:8788')
    expect(parsed.extension.memorySync?.token).toBe('secret')
    expect(parsed.extension.memorySync?.autoSync).toBe(true)
    expect(parsed.extension.memorySync?.intervalSeconds).toBe(60)
  })
})

describe('memorySync store', () => {
  it('getMemorySyncState reads the persisted sync state', async () => {
    const store = new MemoryStore({
      'memory-sync-state': {
        revision: 4,
        lastSyncedAt: '2026-08-09T12:00:00.000Z',
      },
    })

    const state = await getMemorySyncState({ store: store as never })
    expect(state.revision).toBe(4)
    expect(state.lastSyncedAt).toBe('2026-08-09T12:00:00.000Z')
    expect(state.lastError).toBeUndefined()
  })

  it('testMemorySyncConnection returns the remote state', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ revision: 5, payload: 'abc', salt: 's', iv: 'i' }, 200)
    )

    const result = await testMemorySyncConnection(syncConfig(), {
      fetchImpl: fetchImpl as never,
    })

    expect(result.revision).toBe(5)
    expect(result.payload).toBe('abc')
    expect(fetchImpl).toHaveBeenCalledWith('http://x/api/sync/memory', expect.objectContaining({ method: 'GET' }))
  })

  it('pullMemoryFromServer imports a newer remote snapshot', async () => {
    const store = new MemoryStore({
      'memory-sync-state': {
        revision: 0,
      },
    })

    const remoteSnapshot = fakeSnapshot()
    const encrypted = await encryptMemorySyncPayload('pw', JSON.stringify(remoteSnapshot))
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(
        {
          revision: 2,
          payload: encrypted.payload,
          salt: encrypted.salt,
          iv: encrypted.iv,
          alg: encrypted.alg,
          kdf: encrypted.kdf,
        },
        200
      )
    )
    const getSnapshot = vi.fn(async () => fakeSnapshot())
    const applySnapshot = vi.fn(async () => undefined)

    await pullMemoryFromServer(syncConfig(), 'pw', {
      store: store as never,
      fetchImpl: fetchImpl as never,
      getSnapshot: getSnapshot as never,
      applySnapshot: applySnapshot as never,
    })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(fetchImpl.mock.calls[0]?.[1]?.method).toBe('GET')
    expect(applySnapshot).toHaveBeenCalledTimes(1)

    const state = await getMemorySyncState({ store: store as never })
    expect(state.revision).toBe(2)
  })

  it('pushMemoryToServer pushes the local snapshot and records the new revision', async () => {
    const store = new MemoryStore({
      'memory-sync-state': {
        revision: 0,
      },
    })

    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ revision: 1 }, 200)
    )
    const getSnapshot = vi.fn(async () => fakeSnapshot())
    const applySnapshot = vi.fn(async () => undefined)

    await pushMemoryToServer(syncConfig(), 'pw', {
      store: store as never,
      fetchImpl: fetchImpl as never,
      getSnapshot: getSnapshot as never,
      applySnapshot: applySnapshot as never,
    })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(fetchImpl.mock.calls[0]?.[1]?.method).toBe('PUT')

    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))
    expect(body.baseRevision).toBe(0)
    expect(body.payload).toBeTypeOf('string')
    expect(body.salt).toBeTypeOf('string')
    expect(body.iv).toBeTypeOf('string')
    expect(body.alg).toBe('AES-GCM')
    expect(body.kdf).toBe('PBKDF2-SHA-256')

    const state = await getMemorySyncState({ store: store as never })
    expect(state.revision).toBe(1)
  })

  it('syncMemoryNow retries after a 409 conflict by pulling and re-pushing', async () => {
    const store = new MemoryStore({
      'memory-sync-state': {
        revision: 1,
      },
    })

    // The snapshot the server claims is newer (revision 2), encrypted with 'pw'.
    const conflictSnapshot = fakeSnapshot()
    const conflictEncrypted = await encryptMemorySyncPayload('pw', JSON.stringify(conflictSnapshot))

    const fetchImpl = vi
      .fn()
      // pull: server is at revision 1 == local, so nothing new to import
      .mockResolvedValueOnce(jsonResponse({ revision: 1, payload: null }, 200))
      // push attempt: server advanced to revision 2 -> 409 conflict
      .mockResolvedValueOnce(
        jsonResponse(
          {
            message: 'Revision conflict',
            snapshot: {
              revision: 2,
              payload: conflictEncrypted.payload,
              salt: conflictEncrypted.salt,
              iv: conflictEncrypted.iv,
              alg: conflictEncrypted.alg,
              kdf: conflictEncrypted.kdf,
            },
          },
          409
        )
      )
      // re-push after merging the server snapshot: accepted at revision 3
      .mockResolvedValueOnce(jsonResponse({ revision: 3 }, 200))

    const getSnapshot = vi.fn(async () => fakeSnapshot())
    const applySnapshot = vi.fn(async () => undefined)

    await expect(
      syncMemoryNow(syncConfig(), 'pw', {
        store: store as never,
        fetchImpl: fetchImpl as never,
        getSnapshot: getSnapshot as never,
        applySnapshot: applySnapshot as never,
      })
    ).resolves.toBeUndefined()

    // pull (GET) then push (PUT) then re-push (PUT)
    expect(fetchImpl).toHaveBeenCalledTimes(3)
    expect(fetchImpl.mock.calls[0]?.[1]?.method).toBe('GET')
    expect(fetchImpl.mock.calls[1]?.[1]?.method).toBe('PUT')
    expect(fetchImpl.mock.calls[2]?.[1]?.method).toBe('PUT')

    // first push uses the local revision as base; the retry uses the conflict revision
    const firstBody = JSON.parse(String(fetchImpl.mock.calls[1]?.[1]?.body))
    const secondBody = JSON.parse(String(fetchImpl.mock.calls[2]?.[1]?.body))
    expect(firstBody.baseRevision).toBe(1)
    expect(secondBody.baseRevision).toBe(2)

    // the server's conflict snapshot was merged back into local memory
    expect(applySnapshot).toHaveBeenCalledTimes(1)

    const state = await getMemorySyncState({ store: store as never })
    expect(state.revision).toBe(3)
    expect(state.lastError).toBeUndefined()
  })
})
