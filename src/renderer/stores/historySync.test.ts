import { describe, expect, it, vi } from 'vitest'

vi.mock('@/storage', () => ({
  default: {
    getItem: async (_key: string, initialValue: unknown) => initialValue,
    setItemNow: async () => undefined,
  },
}))

import { getHistorySyncState, pullHistoryFromServer, pushHistoryToServer, syncHistoryNow } from './historySync'

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

function createPayload() {
  return {
    __type: 'chatbox-history-transfer',
    __version: 1,
    __exported_at: new Date().toISOString(),
    sessionMetaList: [],
    sessions: [],
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

describe('historySync', () => {
  it('pulls and imports when remote revision is newer', async () => {
    const store = new MemoryStore({
      'history-sync-state': {
        revision: 1,
      },
    })
    const remotePayload = createPayload()
    const fetchImpl = vi.fn(async () =>
      jsonResponse(
        {
          revision: 2,
          updatedAt: '2026-02-22T10:00:00.000Z',
          payload: remotePayload,
        },
        200
      )
    )
    const importHistory = vi.fn(async () => ({
      totalIncoming: 1,
      imported: 1,
      updated: 0,
      skipped: 0,
    }))

    const result = await pullHistoryFromServer(
      {
        endpoint: 'http://sync.local',
        token: 'token',
      },
      {
        store: store as never,
        fetchImpl: fetchImpl as never,
        importHistory: importHistory as never,
      }
    )

    expect(result).toEqual({
      changed: true,
      revision: 2,
      imported: 1,
      updated: 0,
      skipped: 0,
    })
    expect(importHistory).toHaveBeenCalledWith(JSON.stringify(remotePayload))

    const state = await getHistorySyncState({ store: store as never })
    expect(state.revision).toBe(2)
    expect(state.lastSyncedAt).toBeTypeOf('string')
    expect(state.lastError).toBeUndefined()
  })

  it('handles push conflict by importing remote snapshot and retrying', async () => {
    const store = new MemoryStore({
      'history-sync-state': {
        revision: 1,
      },
    })
    const localPayload = createPayload()
    const mergedPayload = createPayload()
    const conflictPayload = createPayload()

    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          {
            message: 'Revision conflict',
            snapshot: {
              revision: 2,
              updatedAt: '2026-02-22T10:01:00.000Z',
              payload: conflictPayload,
            },
          },
          409
        )
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            revision: 3,
            updatedAt: '2026-02-22T10:02:00.000Z',
            payload: mergedPayload,
          },
          200
        )
      )

    const exportHistory = vi
      .fn()
      .mockResolvedValueOnce({
        fileName: 'local.json',
        content: JSON.stringify(localPayload),
        sessionCount: 1,
      })
      .mockResolvedValueOnce({
        fileName: 'merged.json',
        content: JSON.stringify(mergedPayload),
        sessionCount: 1,
      })

    const importHistory = vi.fn(async () => ({
      totalIncoming: 1,
      imported: 1,
      updated: 0,
      skipped: 0,
    }))

    const result = await pushHistoryToServer(
      {
        endpoint: 'http://sync.local',
        token: 'token',
      },
      {
        store: store as never,
        fetchImpl: fetchImpl as never,
        exportHistory: exportHistory as never,
        importHistory: importHistory as never,
      }
    )

    expect(result).toEqual({
      pushed: true,
      revision: 3,
      conflictResolved: true,
      imported: 1,
      updated: 0,
      skipped: 0,
    })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(importHistory).toHaveBeenCalledWith(JSON.stringify(conflictPayload))

    const firstRequestBody = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))
    const secondRequestBody = JSON.parse(String(fetchImpl.mock.calls[1]?.[1]?.body))
    expect(firstRequestBody.baseRevision).toBe(1)
    expect(secondRequestBody.baseRevision).toBe(2)

    const state = await getHistorySyncState({ store: store as never })
    expect(state.revision).toBe(3)
    expect(state.lastError).toBeUndefined()
  })

  it('stores lastError when sync now fails', async () => {
    const store = new MemoryStore({
      'history-sync-state': {
        revision: 7,
      },
    })

    const fetchImpl = vi.fn(async () => jsonResponse({ message: 'server down' }, 500))

    await expect(
      syncHistoryNow(
        {
          endpoint: 'http://sync.local',
          token: 'token',
        },
        {
          store: store as never,
          fetchImpl: fetchImpl as never,
        }
      )
    ).rejects.toThrow('Failed to fetch remote history snapshot')

    const state = await getHistorySyncState({ store: store as never })
    expect(state.revision).toBe(7)
    expect(state.lastError).toContain('Failed to fetch remote history snapshot')
  })

  it('skips push when pull already imported remote changes', async () => {
    const store = new MemoryStore({
      'history-sync-state': {
        revision: 1,
      },
    })

    const remotePayload = createPayload()
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          {
            revision: 2,
            updatedAt: '2026-02-22T10:00:00.000Z',
            payload: remotePayload,
          },
          200
        )
      )

    const importHistory = vi.fn(async () => ({
      totalIncoming: 1,
      imported: 1,
      updated: 0,
      skipped: 0,
    }))

    const result = await syncHistoryNow(
      {
        endpoint: 'http://sync.local',
        token: 'token',
      },
      {
        store: store as never,
        fetchImpl: fetchImpl as never,
        importHistory: importHistory as never,
      }
    )

    expect(result.pull).toEqual({
      changed: true,
      revision: 2,
      imported: 1,
      updated: 0,
      skipped: 0,
    })
    expect(result.push).toEqual({
      pushed: false,
      revision: 2,
      conflictResolved: false,
      imported: 0,
      updated: 0,
      skipped: 0,
    })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})
