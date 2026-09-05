import { z } from 'zod'

export const MAX_WRITING_INPUT_CHARS = 8_000
export const MAX_WRITING_OUTPUT_CHARS = 16_000

export const WritingStyleSchema = z.enum(['grammar', 'natural', 'shorter', 'professional', 'casual'])
export type WritingStyle = z.infer<typeof WritingStyleSchema>

export const WritingModelSchema = z.object({
  provider: z.string().min(1),
  modelId: z.string().min(1),
})
export type WritingModel = z.infer<typeof WritingModelSchema>

/** Deliberately no session, history, attachments, agent, memory, or tool fields. */
export const WritingRequestSchema = z
  .object({
    draft: z
      .string()
      .max(MAX_WRITING_INPUT_CHARS)
      .refine((draft) => draft.trim().length > 0),
    style: WritingStyleSchema,
    model: WritingModelSchema.strict(),
  })
  .strict()
export type WritingRequest = z.infer<typeof WritingRequestSchema>

export type WritingErrorCode = 'invalid_input' | 'unsupported_model' | 'request_failed' | 'incomplete' | 'timeout'

export class WritingError extends Error {
  constructor(public readonly code: WritingErrorCode) {
    // Never include drafts or provider response bodies in error messages.
    super(code)
    this.name = 'WritingError'
  }
}
