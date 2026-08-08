/** biome-ignore-all lint/security/noDangerouslySetInnerHtml: mermaid SVG is sanitized by mermaid's own pipeline */
import { Text, Tooltip, UnstyledButton } from '@mantine/core'
import type React from 'react'
import {
  IconCopy,
  IconFocusCentered,
  IconMinus,
  IconPlus,
  IconZoomReset,
} from '@tabler/icons-react'
import { ChartBarStacked } from 'lucide-react'
import mermaid from 'mermaid'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Gallery, Item } from 'react-photoswipe-gallery'
import { cn } from '@/lib/utils'
import { copyToClipboard } from '@/packages/navigator'
import * as picUtils from '@/packages/pic_utils'
import platform from '@/platform'
import * as toastActions from '../stores/toastActions'
// picUtils/platform still used by SVGPreview export

const ZOOM_MIN = 0.4
const ZOOM_MAX = 3
const ZOOM_STEP = 0.15
const EASE = 'cubic-bezier(0.2, 0, 0, 1)'

export function MessageMermaid(props: { source: string; theme: 'light' | 'dark'; generating?: boolean }) {
  const { source, theme, generating } = props

  const [svgId, setSvgId] = useState('')
  const [svgCode, setSvgCode] = useState('')
  const [error, setError] = useState(false)

  useEffect(() => {
    if (generating) return
    let cancelled = false
    setError(false)
    ;(async () => {
      try {
        const { id, svg } = await mermaidCodeToSvgCode(source, theme)
        if (cancelled) return
        setSvgCode(normalizeMermaidSvg(svg, id))
        setSvgId(id)
      } catch (e) {
        console.error('Mermaid render failed', e)
        if (!cancelled) {
          setSvgCode('')
          setSvgId('')
          setError(true)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [source, theme, generating])

  if (generating) {
    return <Loading />
  }

  if (error || !svgCode) {
    return (
      <div className="mermaid-shell mermaid-shell--error my-3">
        <div className="mermaid-shell-inner px-3.5 py-3">
          <Text size="sm" c="chatbox-secondary">
            Mermaid diagram failed to render. Expand the source fence above if available, or ask the model to simplify
            labels.
          </Text>
        </div>
      </div>
    )
  }

  return <MermaidSVGPreviewDangerous svgId={svgId} svgCode={svgCode} mermaidCode={source} />
}

export function Loading() {
  return (
    <div className="mermaid-shell my-3" aria-busy="true" aria-label="Loading diagram">
      <div className="mermaid-shell-inner">
        <div className="mermaid-toolbar">
          <span className="mermaid-toolbar-label">Diagram</span>
          <div className="mermaid-toolbar-skeleton" />
        </div>
        <div className="mermaid-loading-body">
          <ChartBarStacked size={22} strokeWidth={1.25} className="opacity-50" />
          <span className="mermaid-loading-text">Rendering diagram…</span>
        </div>
      </div>
    </div>
  )
}

/**
 * Studio diagram card: nested shell, fit/zoom/pan, open preview.
 */
export function MermaidSVGPreviewDangerous(props: {
  svgCode: string
  svgId: string
  mermaidCode: string
  className?: string
  generating?: boolean
}) {
  const { svgId, svgCode, mermaidCode, className, generating } = props
  const { t } = useTranslation()
  const [zoom, setZoom] = useState(1)
  const [didAutoFit, setDidAutoFit] = useState(false)
  const viewportRef = useRef<HTMLDivElement>(null)
  const panRef = useRef<{ x: number; y: number; ox: number; oy: number; active: boolean }>({
    x: 0,
    y: 0,
    ox: 0,
    oy: 0,
    active: false,
  })
  const [pan, setPan] = useState({ x: 0, y: 0 })

  const zoomIn = useCallback(() => {
    setZoom((z) => Math.min(ZOOM_MAX, Math.round((z + ZOOM_STEP) * 100) / 100))
  }, [])
  const zoomOut = useCallback(() => {
    setZoom((z) => Math.max(ZOOM_MIN, Math.round((z - ZOOM_STEP) * 100) / 100))
  }, [])
  const zoomReset = useCallback(() => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [])

  const measureFitZoom = useCallback(() => {
    const viewport = viewportRef.current
    const svg = document.getElementById(svgId) as SVGSVGElement | null
    if (!viewport || !svg) return 1
    const pad = 24
    const vw = Math.max(1, viewport.clientWidth - pad)
    const vh = Math.max(160, viewport.clientHeight - pad)
    let sw = 0
    let sh = 0
    try {
      const bb = svg.getBBox()
      sw = bb.width || svg.clientWidth
      sh = bb.height || svg.clientHeight
    } catch {
      sw = svg.clientWidth || svg.viewBox?.baseVal?.width || 1
      sh = svg.clientHeight || svg.viewBox?.baseVal?.height || 1
    }
    if (!sw || !sh) return 1
    // Prefer width fit; only shrink height if vastly taller than viewport
    const byW = vw / sw
    const byH = vh / sh
    const next = Math.min(byW, byH > 0.85 ? byH : byW, 1.15)
    return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(next * 100) / 100))
  }, [svgId])

  const zoomFit = useCallback(() => {
    const next = measureFitZoom()
    setZoom(next)
    setPan({ x: 0, y: 0 })
  }, [measureFitZoom])

  // Auto-fit once after SVG mounts (readable default, not tiny 60%)
  useEffect(() => {
    if (!svgCode || didAutoFit) return
    const t = window.setTimeout(() => {
      const next = measureFitZoom()
      // If diagram already fits, stay at 100%; only shrink when needed
      setZoom(next < 0.98 ? next : 1)
      setDidAutoFit(true)
    }, 40)
    return () => window.clearTimeout(t)
  }, [svgCode, didAutoFit, measureFitZoom])

  const copySource = useCallback(() => {
    copyToClipboard(mermaidCode)
    toastActions.add(t('copied to clipboard'))
  }, [mermaidCode, t])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    const el = viewportRef.current
    if (!el) return
    el.setPointerCapture(e.pointerId)
    panRef.current = {
      active: true,
      x: pan.x,
      y: pan.y,
      ox: e.clientX,
      oy: e.clientY,
    }
  }, [pan.x, pan.y])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!panRef.current.active) return
    const dx = e.clientX - panRef.current.ox
    const dy = e.clientY - panRef.current.oy
    setPan({ x: panRef.current.x + dx, y: panRef.current.y + dy })
  }, [])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    panRef.current.active = false
    try {
      viewportRef.current?.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }, [])

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      e.preventDefault()
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
      setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round((z + delta) * 100) / 100)))
    },
    []
  )

  if (!svgCode.includes('</svg') && generating) {
    return <Loading />
  }

  const zoomPct = Math.round(zoom * 100)

  return (
    <div className={cn('mermaid-shell my-3', className)}>
      <div className="mermaid-shell-inner">
        <div className="mermaid-toolbar">
          <div className="mermaid-toolbar-left">
            <span className="mermaid-toolbar-label">{t('Diagram')}</span>
            <span className="mermaid-toolbar-hint">{t('Drag to pan · ⌘/Ctrl+scroll to zoom')}</span>
          </div>
          <div className="mermaid-toolbar-actions" role="toolbar" aria-label={t('Diagram controls')}>
            <ToolbarIconBtn label={t('Zoom out')} onClick={zoomOut} disabled={zoom <= ZOOM_MIN}>
              <IconMinus size={15} stroke={1.6} />
            </ToolbarIconBtn>
            <span className="mermaid-zoom-pct tabular-nums" aria-live="polite">
              {zoomPct}%
            </span>
            <ToolbarIconBtn label={t('Zoom in')} onClick={zoomIn} disabled={zoom >= ZOOM_MAX}>
              <IconPlus size={15} stroke={1.6} />
            </ToolbarIconBtn>
            <span className="mermaid-toolbar-sep" aria-hidden />
            <ToolbarIconBtn label={t('Reset zoom')} onClick={zoomReset}>
              <IconZoomReset size={15} stroke={1.6} />
            </ToolbarIconBtn>
            <ToolbarIconBtn label={t('Fit to width')} onClick={zoomFit}>
              <IconFocusCentered size={15} stroke={1.6} />
            </ToolbarIconBtn>
            <ToolbarIconBtn label={t('Copy source')} onClick={copySource}>
              <IconCopy size={15} stroke={1.6} />
            </ToolbarIconBtn>
          </div>
        </div>

        <div
          ref={viewportRef}
          className="mermaid-viewport"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
          role="img"
          aria-label={t('Diagram')}
        >
          <div
            className="mermaid-canvas"
            style={{
              transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
              transformOrigin: 'top center',
              transition: panRef.current.active ? 'none' : `transform 160ms ${EASE}`,
            }}
            // biome-ignore lint/security/noDangerouslySetInnerHtml: mermaid SVG
            dangerouslySetInnerHTML={{ __html: svgCode }}
          />
        </div>
      </div>
    </div>
  )
}

function ToolbarIconBtn({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <Tooltip label={label} withArrow openDelay={300}>
      <UnstyledButton
        className="mermaid-tool-btn"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        data-disabled={disabled || undefined}
      >
        {children}
      </UnstyledButton>
    </Tooltip>
  )
}

export function SVGPreview(props: { xmlCode: string; className?: string; generating?: boolean }) {
  let { xmlCode, className, generating } = props
  const svgBase64 = useMemo(() => {
    if (!xmlCode.includes('</svg') && generating) {
      return ''
    }
    if (!xmlCode.includes('xmlns="http://www.w3.org/2000/svg"')) {
      xmlCode = xmlCode.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')
    }
    try {
      return picUtils.svgCodeToBase64(xmlCode)
    } catch (e) {
      console.error(e)
      return ''
    }
  }, [xmlCode, generating])

  const size = useMemo(() => {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xmlCode, 'image/svg+xml')
    const svgEl = doc.documentElement

    let width = parseInt(svgEl.getAttribute('width') || '') || 0
    let height = parseInt(svgEl.getAttribute('height') || '') || 0
    const viewBox = svgEl.getAttribute('viewBox')
    if ((!width || !height) && viewBox) {
      const vb = viewBox.trim().split(/\s+/).map(Number)
      if (vb.length === 4 && Number.isFinite(vb[2]) && Number.isFinite(vb[3])) {
        width = width || Math.max(1, Math.round(vb[2]))
        height = height || Math.max(1, Math.round(vb[3]))
      }
    }
    return { width, height }
  }, [xmlCode])

  if (!svgBase64) {
    return <Loading />
  }

  return (
    <Gallery
      uiElements={[
        {
          name: 'custom-rotate-button',
          ariaLabel: 'Rotate',
          order: 9,
          isButton: true,
          html: {
            isCustomSVG: true,
            inner:
              '<path d="M20.5 14.3 17.1 18V10h-2.2v7.9l-3.4-3.6L10 16l6 6.1 6-6.1ZM23 23H9v2h14Z" id="pswp__icn-download"/>',
            outlineID: 'pswp__icn-download',
          },
          appendTo: 'bar',
          onClick: async () => {
            if (platform.formFactor === 'mobile') {
              const pngBase64 = await picUtils.svgToPngBase64(svgBase64)
              platform.exporter.exportImageFile(`svg_${Math.random().toString(36).substring(7)}`, pngBase64)
            } else {
              platform.exporter.exportByUrl(`svg_${Math.random().toString(36).substring(7)}`, svgBase64)
            }
          },
        },
      ]}
    >
      <div className={cn('cursor-pointer my-2', className)}>
        <Item original={svgBase64} thumbnail={svgBase64} width={size.width} height={size.height}>
          {({ ref, open }) => (
            <img
              className="!w-auto min-w-24 rounded-md"
              style={{ outline: '1px solid rgba(0,0,0,0.08)' }}
              ref={ref}
              src={svgBase64}
              alt="svg preview"
              width={size.width}
              onClick={open}
            />
          )}
        </Item>
      </div>
    </Gallery>
  )
}

/** Light normalize only — keep Mermaid strokes/markers intact. Shared by chat card + workspace. */
export function normalizeMermaidSvg(svg: string, id: string): string {
  let out = svg
  out = out.replace(/<svg([^>]*)>/i, (_m, attrs: string) => {
    let a = attrs
    a = a.replace(/\sid="[^"]*"/i, '')
    a = a.replace(/\swidth="[^"]*"/i, '')
    a = a.replace(/\sheight="[^"]*"/i, '')
    a = a.replace(/\sstyle="[^"]*"/i, '')
    a += ` id="${id}" width="100%" height="auto" style="max-width:100%;height:auto;overflow:visible"`
    return `<svg${a}>`
  })
  // Soften foreignObject clip so labels aren't cut off
  out = out.replace(/overflow:\s*hidden/gi, 'overflow: visible')
  return out
}

/** Shared Mermaid → SVG render used by chat card and workspace panel. */
export async function mermaidCodeToSvgCode(source: string, theme: 'light' | 'dark') {
  const isDark = theme === 'dark'
  mermaid.initialize({
    theme: isDark ? 'dark' : 'base',
    startOnLoad: false,
    securityLevel: 'loose',
    fontFamily: 'var(--chatbox-font-ui, ui-sans-serif, system-ui, sans-serif)',
    themeVariables: isDark
      ? {
          fontSize: '14px',
          fontFamily: 'var(--chatbox-font-ui, ui-sans-serif, system-ui, sans-serif)',
          primaryColor: '#3d3d8f',
          primaryTextColor: '#ececec',
          primaryBorderColor: '#5b63d4',
          lineColor: '#6e6e76',
          secondaryColor: '#24242b',
          tertiaryColor: '#1c1c21',
          background: 'transparent',
          mainBkg: '#2a2a4a',
          nodeBorder: '#5b63d4',
          clusterBkg: '#16161a',
          clusterBorder: '#2a2a32',
          titleColor: '#a8a8ae',
          edgeLabelBackground: '#1c1c21',
        }
      : {
          fontSize: '14px',
          fontFamily: 'var(--chatbox-font-ui, ui-sans-serif, system-ui, sans-serif)',
          primaryColor: '#e8eafc',
          primaryTextColor: '#1a1a22',
          primaryBorderColor: '#5b63d4',
          lineColor: '#6e6e76',
          secondaryColor: '#f4f4f6',
          tertiaryColor: '#ffffff',
          background: 'transparent',
          mainBkg: '#e8eafc',
          nodeBorder: '#5b63d4',
          clusterBkg: '#f7f7f9',
          clusterBorder: '#e2e2e8',
          titleColor: '#6e6e76',
          edgeLabelBackground: '#ffffff',
        },
    flowchart: {
      htmlLabels: true,
      curve: 'basis',
      padding: 16,
      nodeSpacing: 48,
      rankSpacing: 52,
      diagramPadding: 12,
      wrappingWidth: 180,
    },
    sequence: {
      diagramMarginX: 16,
      diagramMarginY: 16,
      actorMargin: 48,
      width: 168,
      height: 48,
      boxMargin: 8,
      messageMargin: 36,
      mirrorActors: false,
    },
  })
  const id = 'mermaid-' + Math.random().toString(36).substring(2, 12)
  const result = await mermaid.render(id, source.trim())
  return { id, svg: result.svg }
}
