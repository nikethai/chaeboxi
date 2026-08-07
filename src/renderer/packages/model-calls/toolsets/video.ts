import { tool } from 'ai'
import z from 'zod'
import {
  allocateFrameBudget,
  createFrameBudgetState,
  dataUrlToBlob,
  extractVideoFrames,
  getRemainingFrameBudget,
  getVideoLimits,
  type FrameBudgetState,
  type VideoFormFactor,
} from '@/packages/video'
import platform from '@/platform'
import storage from '@/storage'
import { StorageKeyGenerator } from '@/storage/StoreStorage'

export interface ReadVideoFrameResult {
  timestampSec: number
  storageKey: string
  width: number
  height: number
  /** data URL used only for toModelOutput; not persisted in chat history JSON long-term */
  dataUrl?: string
}

export interface ReadVideoToolResult {
  fileKey: string
  durationSec: number
  frames: Array<{
    timestampSec: number
    storageKey: string
    width: number
    height: number
  }>
  remainingBudget: number
  error?: string
  /** Internal: full frame payloads for multimodal model output */
  _frameDataUrls?: string[]
}

const toolSetDescription = `
Use these tools to inspect user-uploaded videos marked with <ATTACHMENT_VIDEO></ATTACHMENT_VIDEO>.

IMPORTANT:
- Sampled frames may already be attached as images with timestamps in the user message.
- Use read_video only when you need additional frames, a different time window, or specific timestamps.
- Respect MAX_FRAMES_PER_TURN and remaining budget. Prefer fewer frames.

## read_video
Extract frames from an uploaded video by FILE_KEY.
- mode: evenly_spaced (default), timestamps, or interval
- maxFrames is clamped by platform limits and remaining budget for that video
- Returns frame timestamps and stores frames as vision images for the next step
`

function resolveFormFactor(): VideoFormFactor {
  return platform.formFactor === 'desktop' ? 'desktop' : 'mobile'
}

/** Session-scoped budget shared across tool calls in one streamText invocation. */
let activeBudget: FrameBudgetState | null = null
let activeFormFactor: VideoFormFactor = 'mobile'

export function initVideoToolBudget(formFactor?: VideoFormFactor, preUsed?: Map<string, number>) {
  activeFormFactor = formFactor ?? resolveFormFactor()
  const limits = getVideoLimits(activeFormFactor)
  activeBudget = createFrameBudgetState(limits.maxFramesPerVideoPerTurn, limits.maxFramesPerToolCall)
  if (preUsed) {
    for (const [key, count] of preUsed) {
      activeBudget.usedByFileKey.set(key, count)
    }
  }
}

export function resetVideoToolBudget() {
  activeBudget = null
}

function ensureBudget(): FrameBudgetState {
  if (!activeBudget) {
    initVideoToolBudget()
  }
  return activeBudget!
}

export const readVideoTool = tool({
  description:
    'Extract frames from a user-uploaded video (FILE_KEY from ATTACHMENT_VIDEO). Use for additional or timestamp-specific frames within the remaining frame budget.',
  inputSchema: z.object({
    fileKey: z.string().describe('The FILE_KEY of the video within <ATTACHMENT_VIDEO> tags.'),
    mode: z
      .enum(['evenly_spaced', 'timestamps', 'interval'])
      .optional()
      .describe('Sampling mode. Defaults to evenly_spaced.'),
    maxFrames: z
      .number()
      .int()
      .min(1)
      .max(8)
      .optional()
      .describe('Maximum frames to extract this call (clamped by budget).'),
    timestamps: z
      .array(z.number())
      .optional()
      .describe('Absolute timestamps in seconds when mode is timestamps.'),
    intervalSec: z.number().positive().optional().describe('Interval in seconds when mode is interval.'),
    startSec: z.number().min(0).optional().describe('Window start in seconds.'),
    endSec: z.number().min(0).optional().describe('Window end in seconds.'),
  }),
  execute: async (input: {
    fileKey: string
    mode?: 'evenly_spaced' | 'timestamps' | 'interval'
    maxFrames?: number
    timestamps?: number[]
    intervalSec?: number
    startSec?: number
    endSec?: number
  }): Promise<ReadVideoToolResult> => {
    const budget = ensureBudget()
    const limits = getVideoLimits(activeFormFactor)
    const requested = input.maxFrames ?? Math.min(4, limits.maxFramesPerToolCall)
    const allowed = allocateFrameBudget(budget, input.fileKey, requested)

    if (allowed <= 0) {
      return {
        fileKey: input.fileKey,
        durationSec: 0,
        frames: [],
        remainingBudget: getRemainingFrameBudget(budget, input.fileKey),
        error: 'Frame budget exhausted for this video in the current turn.',
      }
    }

    const dataUrl = await storage.getBlob(input.fileKey)
    if (!dataUrl) {
      return {
        fileKey: input.fileKey,
        durationSec: 0,
        frames: [],
        remainingBudget: getRemainingFrameBudget(budget, input.fileKey),
        error: 'Video not found. Ensure fileKey matches FILE_KEY in ATTACHMENT_VIDEO tags.',
      }
    }

    try {
      const blob = dataUrlToBlob(dataUrl)
      const extracted = await extractVideoFrames(blob, {
        maxFrames: allowed,
        mode: input.mode,
        timestamps: input.timestamps,
        intervalSec: input.intervalSec,
        startSec: input.startSec,
        endSec: input.endSec,
        jpegQuality: limits.jpegQuality,
      })

      const frames: ReadVideoToolResult['frames'] = []
      const frameDataUrls: string[] = []
      for (const frame of extracted.frames) {
        const key = StorageKeyGenerator.picture('video-frame')
        await storage.setBlob(key, frame.dataUrl)
        frames.push({
          timestampSec: frame.timestampSec,
          storageKey: key,
          width: frame.width,
          height: frame.height,
        })
        frameDataUrls.push(frame.dataUrl)
      }

      // If we got fewer than allocated, refund unused budget
      const unused = allowed - frames.length
      if (unused > 0) {
        const used = budget.usedByFileKey.get(input.fileKey) ?? 0
        budget.usedByFileKey.set(input.fileKey, Math.max(0, used - unused))
      }

      return {
        fileKey: input.fileKey,
        durationSec: extracted.metadata.durationSec,
        frames,
        remainingBudget: getRemainingFrameBudget(budget, input.fileKey),
        _frameDataUrls: frameDataUrls,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      // Refund on failure
      const used = budget.usedByFileKey.get(input.fileKey) ?? 0
      budget.usedByFileKey.set(input.fileKey, Math.max(0, used - allowed))
      return {
        fileKey: input.fileKey,
        durationSec: 0,
        frames: [],
        remainingBudget: getRemainingFrameBudget(budget, input.fileKey),
        error: message,
      }
    }
  },
  toModelOutput: ({ output }: { output: ReadVideoToolResult }) => {
    if (output.error) {
      return { type: 'error-text' as const, value: output.error }
    }

    const summary = [
      `Extracted ${output.frames.length} frame(s) from video (FILE_KEY=${output.fileKey}).`,
      `Duration: ${output.durationSec.toFixed(2)}s. Remaining frame budget: ${output.remainingBudget}.`,
      ...output.frames.map(
        (f, i) => `Frame ${i + 1}: t=${f.timestampSec.toFixed(2)}s, ${f.width}x${f.height}, key=${f.storageKey}`
      ),
    ].join('\n')

    const content: Array<
      | { type: 'text'; text: string }
      | { type: 'image-data'; data: string; mediaType: string }
    > = [{ type: 'text', text: summary }]

    if (output._frameDataUrls?.length) {
      for (const dataUrl of output._frameDataUrls) {
        const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
        if (match) {
          content.push({
            type: 'image-data',
            mediaType: match[1],
            data: match[2],
          })
        }
      }
    }

    return { type: 'content' as const, value: content }
  },
})

export default {
  description: toolSetDescription,
  tools: {
    read_video: readVideoTool,
  },
}
