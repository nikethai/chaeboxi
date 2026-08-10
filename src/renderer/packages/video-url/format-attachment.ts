import type { NormalizedVideoRead } from './types'

/**
 * Build plain-text attachment content for a preprocessed video URL link.
 * Shown to the model via the normal link attachment path.
 */
export function formatVideoUrlAttachmentContent(result: NormalizedVideoRead): string {
  const lines: string[] = ['<title>Video URL</title>', `Platform: ${result.platform}`, `URL: ${result.url}`]

  if (result.videoId) lines.push(`Video ID: ${result.videoId}`)
  if (result.title) lines.push(`Title: ${result.title}`)
  if (result.author) lines.push(`Author: ${result.author}`)
  if (result.durationSec != null) lines.push(`Duration: ${Math.round(result.durationSec)}s`)
  if (result.description) {
    lines.push('', 'Description:', result.description.slice(0, 2000))
  }

  if (result.transcript?.text?.trim()) {
    lines.push(
      '',
      `Transcript (source: ${result.transcript.source}${result.transcript.language ? `, ${result.transcript.language}` : ''}):`,
      result.transcript.text
    )
    if (result.truncated) {
      lines.push(
        '',
        `[Truncated transcript${result.originalTranscriptLength != null ? ` from ${result.originalTranscriptLength} chars` : ''}. Agent may call read_video_url with startSec/endSec or higher maxChars for more.]`
      )
    }
  } else {
    lines.push(
      '',
      'Transcript: not available in this preprocess step.',
      result.errorMessage ? `Note: ${result.errorMessage}` : '',
      'The agent should call the read_video_url tool on this URL if a full transcript is still needed (may require provider/STT in Settings → Video URL).'
    )
  }

  if (result.warnings?.length) {
    lines.push('', `Warnings: ${result.warnings.join('; ')}`)
  }

  return lines.filter((l, i, arr) => !(l === '' && arr[i - 1] === '')).join('\n')
}

export function videoUrlAttachmentTitle(result: NormalizedVideoRead, fallbackUrl: string): string {
  if (result.title?.trim()) return result.title.trim()
  const platform = result.platform !== 'unknown' ? result.platform : 'video'
  return `${platform}: ${fallbackUrl.replace(/^https?:\/\//, '').slice(0, 64)}`
}
