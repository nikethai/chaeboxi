/**
 * Sandboxed live preview for HTML/SVG artifacts.
 * Uses a local srcdoc iframe — never chatboxai.app.
 * Scripts may run, but the frame is not same-origin with the app.
 */

import { buildHtmlPreviewDocument, buildSvgPreviewDocument } from '@shared/artifacts'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

export function SandboxedPreview(props: { html: string; title?: string; reloadSign?: number; className?: string }) {
  const { html, title, reloadSign = 0, className } = props
  const { t } = useTranslation()
  const srcDoc = useMemo(() => html, [html])

  return (
    <div className={cn('workspace-html', className)}>
      <iframe
        key={reloadSign}
        title={title || t('Artifact preview')}
        className="workspace-html-frame"
        sandbox="allow-scripts allow-forms"
        srcDoc={srcDoc}
      />
    </div>
  )
}

export function HtmlWorkspaceView(props: {
  htmlCode: string
  kind?: 'html' | 'svg'
  reloadSign?: number
  className?: string
}) {
  const { htmlCode, kind = 'html', reloadSign = 0, className } = props
  const srcDoc = kind === 'svg' ? buildSvgPreviewDocument(htmlCode) : buildHtmlPreviewDocument(htmlCode)
  return <SandboxedPreview html={srcDoc} reloadSign={reloadSign} className={className} />
}
