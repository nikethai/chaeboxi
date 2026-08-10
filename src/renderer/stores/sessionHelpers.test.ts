import { beforeEach, describe, expect, it, vi } from 'vitest'
import { settings as getDefaultSettings } from '@shared/defaults'
import { SessionSettingsSchema } from '@shared/types'

const getSettingsMock = vi.fn()
const lastUsedState = { chat: undefined as { provider: string; modelId: string } | undefined, picture: undefined as { provider: string; modelId: string } | undefined }

vi.mock('./settingsStore', () => ({
  getPlatformDefaultDocumentParser: () => ({ type: 'local' }),
  settingsStore: {
    getState: () => ({
      getSettings: getSettingsMock,
    }),
  },
}))

vi.mock('./lastUsedModelStore', () => ({
  lastUsedModelStore: {
    getState: () => lastUsedState,
  },
}))

vi.mock('@/i18n', () => ({
  default: { t: (value: string) => value },
}))

vi.mock('@/platform', () => ({ default: {} }))
vi.mock('@/storage', () => ({ default: {} }))
vi.mock('@/lib/format-chat', () => ({ formatChatAsHtml: vi.fn(), formatChatAsMarkdown: vi.fn(), formatChatAsTxt: vi.fn() }))
vi.mock('@/lib/utils', () => ({ getLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }) }))
vi.mock('@/packages/context-management/attachment-payload', () => ({ PREVIEW_LINES: 20 }))
vi.mock('@/packages/local-parser', () => ({}))
vi.mock('@/packages/token', () => ({ estimateTokens: vi.fn(), getTokenizerType: () => 'default' }))
vi.mock('@/packages/video', () => ({
  dataUrlToBlob: vi.fn(),
  extractVideoFrames: vi.fn(),
  extractVideoPoster: vi.fn(),
  formatBytesForDisplay: vi.fn(),
  getVideoLimits: vi.fn(),
  loadVideoMetadata: vi.fn(),
  readAsDataUrl: vi.fn(),
}))
vi.mock('@/packages/video-url', () => ({
  formatVideoUrlAttachmentContent: vi.fn(),
  isSupportedVideoUrl: vi.fn(),
  readVideoUrl: vi.fn(),
  storeRemoteThumbnail: vi.fn(),
  videoUrlAttachmentTitle: vi.fn(),
}))
vi.mock('@/storage/StoreStorage', () => ({ StorageKey: {}, StorageKeyGenerator: {} }))
vi.mock('@/utils/session-utils', () => ({ migrateSession: vi.fn(), sortSessions: vi.fn() }))

import { initEmptyChatSession, mergeSettings } from './sessionHelpers'

describe('sessionHelpers reasoning defaults', () => {
  beforeEach(() => {
    getSettingsMock.mockReset()
    lastUsedState.chat = undefined
    lastUsedState.picture = undefined
  })

  it('merges global provider options into chat session settings', () => {
    const globalSettings = getDefaultSettings()

    const merged = mergeSettings(globalSettings, {
      provider: 'openai',
      modelId: 'gpt-4o',
    })

    expect(merged.providerOptions?.openai?.reasoningEffort).toBe('medium')
  })

  it('lets session provider options override the global reasoning default', () => {
    const globalSettings = getDefaultSettings()

    const merged = mergeSettings(globalSettings, {
      provider: 'openai',
      modelId: 'gpt-4o',
      providerOptions: {
        openai: {
          reasoningEffort: 'high',
        },
      },
    })

    expect(merged.providerOptions?.openai?.reasoningEffort).toBe('high')
  })

  it('seeds a new chat session with the global reasoning default', () => {
    getSettingsMock.mockReturnValue(getDefaultSettings())

    const session = initEmptyChatSession()
    const parsed = SessionSettingsSchema.parse(session.settings)

    expect(parsed.providerOptions?.openai?.reasoningEffort).toBe('medium')
  })
})
