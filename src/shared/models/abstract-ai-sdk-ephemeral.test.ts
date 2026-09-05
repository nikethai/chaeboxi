import type { LanguageModelV3 } from '@ai-sdk/provider'
import type { ModelDependencies } from '@shared/types/adapters'
import { describe, expect, it, vi } from 'vitest'
import AbstractAISDKModel from './abstract-ai-sdk'
import type { CallChatCompletionOptions } from './types'

class FailingModel extends AbstractAISDKModel {
  protected getProvider() {
    return { languageModel: () => this.getChatModel() }
  }

  protected getChatModel(): LanguageModelV3 {
    throw new Error('PRIVATE_PROVIDER_RESPONSE')
  }
}

describe('ephemeral model diagnostics', () => {
  it.each([true, false])('suppresses content-bearing error reporting only for ephemeral=%s', async (ephemeral) => {
    const captureException = vi.fn()
    const setExtra = vi.fn()
    const withScope = vi.fn((callback) => callback({ setExtra, setTag: vi.fn() }))
    const dependencies: ModelDependencies = {
      request: { fetchWithOptions: vi.fn(), apiRequest: vi.fn() },
      storage: { saveImage: vi.fn(), getImage: vi.fn() },
      sentry: { withScope, captureException },
      getRemoteConfig: vi.fn(),
    }
    const model = new FailingModel({ model: { modelId: 'test' } }, dependencies)
    const options: CallChatCompletionOptions = ephemeral ? { contentPrivacy: 'ephemeral' } : {}
    await expect(model.chat([{ role: 'user', content: 'PRIVATE_DRAFT' }], options)).rejects.toThrow(
      'PRIVATE_PROVIDER_RESPONSE'
    )
    expect(withScope).toHaveBeenCalledTimes(ephemeral ? 0 : 1)
    expect(captureException).toHaveBeenCalledTimes(ephemeral ? 0 : 1)
    if (ephemeral) expect(setExtra).not.toHaveBeenCalled()
  })
})
