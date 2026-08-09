import type { ModelDependencies } from '@shared/types/adapters'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/adapters', () => ({
  createModelDependencies: vi.fn(),
}))

vi.mock('@/stores/memoryStore', () => ({
  memoryStore: {
    getState: () => ({
      ready: true,
      settings: { enabled: false },
      globalBank: { scope: 'global', entries: [], profileSummary: '', version: 1 },
      agentBanks: {},
    }),
  },
}))

vi.mock('@/stores/settingsStore', () => ({
  settingsStore: {
    getState: () => ({
      userPersonalInfo: { enableInjection: false, entries: [] },
    }),
  },
}))

import { convertToModelMessages } from './message-utils'

const dependencies: ModelDependencies = {
  request: {
    fetchWithOptions: vi.fn(),
    apiRequest: vi.fn(),
  },
  storage: {
    saveImage: vi.fn(),
    getImage: vi.fn(),
  },
  sentry: {
    captureException: vi.fn(),
    withScope: vi.fn(),
  },
  getRemoteConfig: vi.fn(),
}

describe('convertToModelMessages', () => {
  it('keeps assistant reasoning parts out of resend payloads by default', async () => {
    const result = await convertToModelMessages(
      [
        {
          id: 'assistant-1',
          role: 'assistant',
          contentParts: [
            { type: 'reasoning', text: 'hidden chain' },
            { type: 'text', text: 'final answer' },
          ],
        },
      ],
      { modelSupportVision: true, dependencies }
    )

    expect(result).toEqual([
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'final answer' }],
      },
    ])
  })

  it('includes assistant reasoning parts in resend payloads when enabled', async () => {
    const result = await convertToModelMessages(
      [
        {
          id: 'assistant-1',
          role: 'assistant',
          contentParts: [
            { type: 'reasoning', text: 'hidden chain' },
            { type: 'text', text: 'final answer' },
          ],
        },
      ],
      {
        modelSupportVision: true,
        dependencies,
        includeAssistantReasoning: true,
      }
    )

    expect(result).toEqual([
      {
        role: 'assistant',
        content: [
          { type: 'reasoning', text: 'hidden chain' },
          { type: 'text', text: 'final answer' },
        ],
      },
    ])
  })
})
