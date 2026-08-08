/**
 * HTML artifact preview for the side workspace (same host iframe as inline Artifact).
 */

import { debounce } from 'lodash'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

const IFRAME_ORIGIN = 'https://artifact-preview.chatboxai.app/preview'

export function HtmlWorkspaceView(props: {
  htmlCode: string
  /** Bump to force full reload of the preview. */
  reloadSign?: number
  className?: string
}) {
  const { htmlCode, reloadSign = 0, className } = props
  const { t } = useTranslation()
  const ref = useRef<HTMLIFrameElement>(null)
  const [ready, setReady] = useState(false)

  const sendIframeMsg = (type: 'html', code: string) => {
    ref.current?.contentWindow?.postMessage({ type, code }, '*')
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setReady(false)
      sendIframeMsg('html', '')
      await new Promise((r) => setTimeout(r, 400))
      if (cancelled) return
      sendIframeMsg('html', htmlCode)
      if (!cancelled) setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [reloadSign, htmlCode])

  const updateIframe = useMemo(
    () =>
      debounce(() => {
        sendIframeMsg('html', htmlCode)
      }, 280),
    [htmlCode]
  )

  useEffect(() => {
    if (reloadSign) return
    updateIframe()
    return () => updateIframe.cancel()
  }, [updateIframe, reloadSign])

  return (
    <div className={cn('workspace-html', className)}>
      {!ready ? (
        <div className="workspace-html-loading" aria-live="polite">
          <span className="workspace-html-loading-dot" />
          <span>{t('Loading preview…')}</span>
        </div>
      ) : null}
      <iframe
        ref={ref}
        title={t('Artifact preview')}
        className="workspace-html-frame"
        sandbox="allow-scripts allow-forms"
        src={IFRAME_ORIGIN}
        onLoad={() => {
          sendIframeMsg('html', htmlCode)
          setReady(true)
        }}
      />
    </div>
  )
}
