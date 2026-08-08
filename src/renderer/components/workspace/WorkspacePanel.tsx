/**
 * Side workspace pane — HTML artifacts only (Claude Artifacts–style).
 * Mermaid stays in the inline chat card; it does not open this panel.
 */

import { ActionIcon, SegmentedControl, Text, Tooltip } from '@mantine/core'
import { IconCopy, IconReload, IconX } from '@tabler/icons-react'
import type React from 'react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { copyToClipboard } from '@/packages/navigator'
import * as toastActions from '@/stores/toastActions'
import { uiStore, useUIStore } from '@/stores/uiStore'
import { HtmlWorkspaceView } from './HtmlWorkspaceView'

const EXIT_MS = 260
const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'

type WorkspaceContent = NonNullable<ReturnType<typeof uiStore.getState>['workspacePanel']>

function WorkspacePanel() {
  const { t } = useTranslation()
  const panel = useUIStore((s) => s.workspacePanel)
  const widthPx = useUIStore((s) => s.workspaceWidthPx)
  const setWorkspacePanel = useUIStore((s) => s.setWorkspacePanel)
  const setWorkspaceWidthPx = useUIStore((s) => s.setWorkspaceWidthPx)
  const [tab, setTab] = useState<'preview' | 'source'>('preview')
  const [reloadSign, setReloadSign] = useState(0)
  const [display, setDisplay] = useState<WorkspaceContent | null>(null)
  const [open, setOpen] = useState(false)
  const closeTimer = useRef<number | null>(null)
  const panelRef = useRef<HTMLElement>(null)

  // Drop legacy mermaid workspace state if still in memory
  useEffect(() => {
    if (panel && panel.kind !== 'html') {
      setWorkspacePanel(null)
    }
  }, [panel, setWorkspacePanel])

  useEffect(() => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
    if (panel?.kind === 'html') {
      setDisplay(panel)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setOpen(true))
      })
      return
    }
    setOpen(false)
    closeTimer.current = window.setTimeout(() => {
      setDisplay(null)
      closeTimer.current = null
    }, EXIT_MS)
    return () => {
      if (closeTimer.current) {
        window.clearTimeout(closeTimer.current)
        closeTimer.current = null
      }
    }
  }, [panel])

  const contentKey =
    display?.kind === 'html' ? `html:${display.messageId ?? ''}:${display.htmlCode.length}` : ''

  useEffect(() => {
    if (!contentKey) return
    setTab('preview')
    setReloadSign(0)
  }, [contentKey])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && panel?.kind === 'html') {
        e.preventDefault()
        setWorkspacePanel(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [panel, setWorkspacePanel])

  useEffect(() => {
    if (open && panel?.kind === 'html' && panelRef.current) {
      panelRef.current.focus({ preventScroll: true })
    }
  }, [open, panel])

  const onResizePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      const startX = e.clientX
      const startW = widthPx
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'

      const onMove = (ev: PointerEvent) => {
        setWorkspaceWidthPx(startW + (startX - ev.clientX))
      }
      const onUp = () => {
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [widthPx, setWorkspaceWidthPx]
  )

  if (!display && !open) return null
  if (!display || display.kind !== 'html') return null

  const title = display.title || t('Artifact')
  const sourceText = display.htmlCode
  const close = () => setWorkspacePanel(null)

  const copySource = () => {
    if (!sourceText) return
    copyToClipboard(sourceText)
    toastActions.add(t('copied to clipboard'))
  }

  return (
    <aside
      ref={panelRef}
      className={cn('workspace-panel', open && 'is-open', !open && 'is-closing')}
      style={
        {
          '--workspace-w': `${widthPx}px`,
          width: open ? widthPx : 0,
          transition: `width ${EXIT_MS}ms ${EASE}`,
        } as React.CSSProperties
      }
      aria-label={t('Workspace')}
      aria-hidden={!open}
      tabIndex={-1}
    >
      <div
        className="workspace-panel-resizer"
        onPointerDown={onResizePointerDown}
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={widthPx}
        aria-valuemin={320}
        aria-valuemax={720}
        aria-label={t('Resize workspace')}
      />

      <div className="workspace-panel-shell" style={{ width: widthPx }}>
        <div className="workspace-panel-inner">
          <header className="workspace-panel-header">
            <div className="workspace-panel-header-left min-w-0">
              <span className="workspace-panel-kicker">HTML</span>
              <Text size="sm" fw={600} className="workspace-panel-title truncate" title={title}>
                {title}
              </Text>
            </div>

            <div className="workspace-panel-header-actions">
              <SegmentedControl
                size="xs"
                value={tab}
                onChange={(v) => setTab(v as 'preview' | 'source')}
                data={[
                  { label: t('Preview'), value: 'preview' },
                  { label: t('Source'), value: 'source' },
                ]}
                className="workspace-segmented"
                classNames={{
                  root: 'workspace-segmented-root',
                  label: 'workspace-segmented-label',
                }}
              />

              <div className="workspace-action-island" role="toolbar" aria-label={t('Workspace actions')}>
                <Tooltip label={t('Refresh')} openDelay={200}>
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size={32}
                    radius="xl"
                    onClick={() => setReloadSign((n) => n + 1)}
                    aria-label={t('Refresh')}
                    className="workspace-action-btn"
                  >
                    <IconReload size={15} stroke={1.5} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label={t('Copy source')} openDelay={200}>
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size={32}
                    radius="xl"
                    onClick={copySource}
                    aria-label={t('Copy source')}
                    className="workspace-action-btn"
                  >
                    <IconCopy size={15} stroke={1.5} />
                  </ActionIcon>
                </Tooltip>
                <span className="workspace-action-sep" aria-hidden />
                <Tooltip label={t('Close workspace')} openDelay={200}>
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size={32}
                    radius="xl"
                    onClick={close}
                    aria-label={t('Close')}
                    className="workspace-action-btn workspace-action-close"
                  >
                    <IconX size={15} stroke={1.5} />
                  </ActionIcon>
                </Tooltip>
              </div>
            </div>
          </header>

          <div className="workspace-panel-body" key={`${display.messageId ?? ''}-${tab}-${reloadSign}`}>
            {tab === 'source' ? (
              <pre className="workspace-source">{sourceText}</pre>
            ) : (
              <HtmlWorkspaceView htmlCode={display.htmlCode} reloadSign={reloadSign} />
            )}
          </div>
        </div>
      </div>
    </aside>
  )
}

export default memo(WorkspacePanel)

/** Whether the workspace chrome is visible or animating (for session shell class). */
export function useWorkspaceChromeActive(): boolean {
  const panel = useUIStore((s) => s.workspacePanel)
  const [active, setActive] = useState(Boolean(panel?.kind === 'html'))

  useEffect(() => {
    if (panel?.kind === 'html') {
      setActive(true)
      return
    }
    const t = window.setTimeout(() => setActive(false), EXIT_MS)
    return () => window.clearTimeout(t)
  }, [panel])

  return active
}
