import { getModel } from '@shared/models'
import { WritingError, type WritingRequest, WritingRequestSchema } from '@shared/types/writing'
import { createModelDependencies } from '@/adapters'
import { settingsStore } from '@/stores/settingsStore'
import { supportsWritingProvider } from './models'
import { rewriteDraft, type WritingCallbacks } from './rewrite'

export async function requestWritingRewrite(input: WritingRequest, callbacks: WritingCallbacks) {
  const parsed = WritingRequestSchema.safeParse(input)
  if (!parsed.success) throw new WritingError('invalid_input')
  const request = parsed.data
  if (!supportsWritingProvider(request.model.provider)) throw new WritingError('unsupported_model')
  callbacks.signal.throwIfAborted()

  try {
    const dependencies = await createModelDependencies()
    callbacks.signal.throwIfAborted()
    const globalSettings = settingsStore.getState().getSettings()
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
