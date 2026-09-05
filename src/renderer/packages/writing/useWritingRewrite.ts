import { WritingError, type WritingErrorCode, type WritingRequest } from '@shared/types/writing'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { WritingResult } from './rewrite'
import { requestWritingRewrite } from './runtime'

export const WRITING_TIMEOUT_MS = 60_000

type WritingState =
  | { status: 'idle' | 'cancelled' }
  | { status: 'running'; text: string }
  | { status: 'complete'; result: WritingResult }
  | { status: 'error'; code: WritingErrorCode }

/** Request identity guards protect against providers that finish after cancellation. */
export function useWritingRewrite() {
  const [state, setState] = useState<WritingState>({ status: 'idle' })
  const active = useRef<{ controller: AbortController; timeout: ReturnType<typeof setTimeout> } | null>(null)

  const abort = useCallback(() => {
    if (active.current) {
      const request = active.current
      active.current = null
      clearTimeout(request.timeout)
      request.controller.abort()
    }
  }, [])

  useEffect(() => abort, [abort])

  const reset = useCallback(() => {
    abort()
    setState({ status: 'idle' })
  }, [abort])

  const cancel = useCallback(() => {
    abort()
    setState({ status: 'cancelled' })
  }, [abort])

  const rewrite = useCallback(
    async (request: WritingRequest) => {
      abort()
      const controller = new AbortController()
      const run = {
        controller,
        timeout: setTimeout(() => {
          if (active.current !== run) return
          abort()
          setState({ status: 'error', code: 'timeout' })
        }, WRITING_TIMEOUT_MS),
      }
      active.current = run
      setState({ status: 'running', text: '' })
      try {
        const result = await requestWritingRewrite(request, {
          signal: controller.signal,
          onText: (text) => {
            if (active.current === run) setState({ status: 'running', text })
          },
        })
        if (active.current === run) setState({ status: 'complete', result })
      } catch (error) {
        if (active.current === run) {
          setState({ status: 'error', code: error instanceof WritingError ? error.code : 'request_failed' })
        }
      } finally {
        clearTimeout(run.timeout)
        if (active.current === run) active.current = null
      }
    },
    [abort]
  )

  return { state, rewrite, reset, cancel }
}
