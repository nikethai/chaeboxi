import type { CompactionPoint, Message, Settings } from '@shared/types'

export const MAX_INLINE_FILE_LINES = 500
export const PREVIEW_LINES = 100

export interface AttachmentWrapperPrefixParams {
  attachmentIndex: number
  fileName: string
  fileKey: string
  fileLines: number
  fileSize: number
}

export interface AttachmentWrapperSuffixParams {
  isTruncated: boolean
  previewLines?: number
  totalLines?: number
  fileKey?: string
}

export interface SelectMessagesForSendContextParams {
  settings: Partial<Settings>
  msgs: Message[]
  compactionPoints?: CompactionPoint[]
  preserveLastUserMessage?: boolean
  keepToolCallRounds?: number
}

export function buildAttachmentWrapperPrefix(params: AttachmentWrapperPrefixParams): string {
  const { attachmentIndex, fileName, fileKey, fileLines, fileSize } = params

  let prefix = '\n\n<ATTACHMENT_FILE>\n'
  prefix += `<FILE_INDEX>${attachmentIndex}</FILE_INDEX>\n`
  prefix += `<FILE_NAME>${fileName}</FILE_NAME>\n`
  prefix += `<FILE_KEY>${fileKey}</FILE_KEY>\n`
  prefix += `<FILE_LINES>${fileLines}</FILE_LINES>\n`
  prefix += `<FILE_SIZE>${fileSize} bytes</FILE_SIZE>\n`
  prefix += '<FILE_CONTENT>\n'

  return prefix
}

export function buildAttachmentWrapperSuffix(params: AttachmentWrapperSuffixParams): string {
  const { isTruncated, previewLines, totalLines, fileKey } = params

  let suffix = '</FILE_CONTENT>\n'

  if (isTruncated && previewLines !== undefined && totalLines !== undefined && fileKey !== undefined) {
    suffix += `<TRUNCATED>Content truncated. Showing first ${previewLines} of ${totalLines} lines. Use read_file or search_file_content tool with FILE_KEY="${fileKey}" to read more content.</TRUNCATED>\n`
  }

  suffix += '</ATTACHMENT_FILE>\n'

  return suffix
}

export interface VideoAttachmentWrapperParams {
  attachmentIndex: number
  fileName: string
  fileKey: string
  durationSec?: number
  byteLength?: number
  width?: number
  height?: number
  sampledFrameCount?: number
  maxFramesPerTurn?: number
  toolEnabled?: boolean
}

/** Metadata-only video attachment block (never includes binary). */
export function buildVideoAttachmentWrapper(params: VideoAttachmentWrapperParams): string {
  const {
    attachmentIndex,
    fileName,
    fileKey,
    durationSec,
    byteLength,
    width,
    height,
    sampledFrameCount = 0,
    maxFramesPerTurn,
    toolEnabled = false,
  } = params

  let body = '\n\n<ATTACHMENT_VIDEO>\n'
  body += `<FILE_INDEX>${attachmentIndex}</FILE_INDEX>\n`
  body += `<FILE_NAME>${fileName}</FILE_NAME>\n`
  body += `<FILE_KEY>${fileKey}</FILE_KEY>\n`
  if (durationSec !== undefined) {
    body += `<DURATION_SEC>${durationSec.toFixed(2)}</DURATION_SEC>\n`
  }
  if (byteLength !== undefined) {
    body += `<FILE_SIZE>${byteLength} bytes</FILE_SIZE>\n`
  }
  if (width && height) {
    body += `<RESOLUTION>${width}x${height}</RESOLUTION>\n`
  }
  body += `<SAMPLED_FRAMES>${sampledFrameCount}</SAMPLED_FRAMES>\n`
  if (maxFramesPerTurn !== undefined) {
    body += `<MAX_FRAMES_PER_TURN>${maxFramesPerTurn}</MAX_FRAMES_PER_TURN>\n`
  }
  if (toolEnabled) {
    body +=
      '<HINT>Sampled frames are attached as images with timestamps. Use read_video with FILE_KEY to extract additional frames at specific times within remaining budget.</HINT>\n'
  } else {
    body +=
      '<HINT>Sampled frames from this video are attached as images with timestamps in the user message.</HINT>\n'
  }
  body += '</ATTACHMENT_VIDEO>\n'
  return body
}

export function selectMessagesForSendContext(params: SelectMessagesForSendContextParams): Message[] {
  const { settings, msgs, compactionPoints, preserveLastUserMessage = true, keepToolCallRounds = 2 } = params

  if (msgs.length === 0) {
    return []
  }

  const maxContextMessageCount = settings.maxContextMessageCount ?? Number.MAX_SAFE_INTEGER

  const filtered: Message[] = []
  for (const msg of msgs) {
    if (msg.error || msg.errorCode) {
      continue
    }
    if (msg.generating === true) {
      continue
    }
    filtered.push(msg)
  }

  if (filtered.length === 0) {
    return []
  }

  const limit = preserveLastUserMessage ? maxContextMessageCount + 1 : maxContextMessageCount

  if (filtered.length <= limit) {
    return filtered
  }

  return filtered.slice(-limit)
}
