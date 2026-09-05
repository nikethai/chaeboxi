import { getModel, getProviderSettings } from '@shared/models'
import { WritingError, type WritingRequest, WritingRequestSchema } from '@shared/types/writing'
import { createModelDependencies } from '@/adapters'
import { settingsStore } from '@/stores/settingsStore'
import { isWritingModelAvailable } from './models'
import { rewriteDraft, type WritingCallbacks } from './rewrite'

export async function requestWritingRewrite(input: WritingRequest, callbacks: WritingCallbacks) {
  const parsed = WritingRequestSchema.safeParse(input)
  if (!parsed.success) throw new WritingError('invalid_input')
  const request = parsed.data
  callbacks.signal.throwIfAborted()

  try {
    const globalSettings = settingsStore.getState().getSettings()
    // Re-resolve against current settings: stale or forged selections must not bypass the picker.
    let resolved: ReturnType<typeof getProviderSettings>
    try {
      resolved = getProviderSettings(request.model, globalSettings)
    } catch {
      throw new WritingError('unsupported_model')
    }
    const provider = { ...resolved.providerBaseInfo, ...resolved.providerSetting }
    if (!isWritingModelAvailable(provider, request.model)) throw new WritingError('unsupported_model')
    const dependencies = await createModelDependencies()
    callbacks.signal.throwIfAborted()
    const model = getModel(
      {
        provider: request.model.provider,
        modelId: request.model.modelId,
        stream: true,
      },
      { ...globalSettings, injectDefaultMetadata: false },
      { uuid: 'ephemeral-writing' },
      dependencies
    )
    return await rewriteDraft(model, request, callbacks)
  } catch (error) {
    callbacks.signal.throwIfAborted()
    if (error instanceof WritingError) throw error
    // API errors may echo private input. Do not log, persist, or display their bodies.
    throw new WritingError('request_failed')
  }
}
