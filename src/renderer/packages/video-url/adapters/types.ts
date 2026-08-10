import type { NormalizedVideoRead, ParsedVideoUrl, ReadVideoUrlOptions } from '../types'

export type AdapterFetchOptions = Pick<ReadVideoUrlOptions, 'language' | 'mode' | 'abortSignal' | 'startSec' | 'endSec'>

export type PlatformAdapter = {
  platform: ParsedVideoUrl['platform']
  /**
   * Fetch metadata and/or captions. Should not throw for soft failures —
   * return NormalizedVideoRead with errorCode/warnings instead when possible.
   */
  fetch: (parsed: ParsedVideoUrl, options: AdapterFetchOptions) => Promise<NormalizedVideoRead>
}
