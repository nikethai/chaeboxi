import * as Sentry from '@sentry/react'
import { countWord as sharedCountWord } from '../../shared/utils/word_count'

/**
 * Renderer countWord ， Sentry
 */
export function countWord(data: string): number {
  try {
    return sharedCountWord(data)
  } catch (e) {
    Sentry.captureException(e)
    return -1
  }
}
