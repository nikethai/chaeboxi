import { Button, Text } from '@mantine/core'
import { memo, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useComposerPickerPosition } from './useComposerPickerPosition'

export interface ComposerPickerEmptyAction {
  label: string
  onClick(): void
}

export interface ComposerPickerPanelProps {
  /** Anchor element (composer card) for fixed positioning. */
  anchorRef: RefObject<HTMLElement | null>
  /** Panel is mounted only when open; still pass true while visible. */
  open?: boolean
  /** Header label e.g. "Agents · @" */
  header: ReactNode
  children: ReactNode
  /** Footer slot (e.g. Manage presets). */
  footer?: ReactNode
  /** Empty body when no rows. */
  empty?: {
    title: string
    description?: string
    /** Catalog empty (zero items) → CTA; omit when only filter miss. */
    action?: ComposerPickerEmptyAction
  }
  /** When true, render empty state instead of children. */
  isEmpty?: boolean
  className?: string
  role?: string
  'aria-label'?: string
}

/**
 * Portaled composer picker shell — never clipped by blank-home / page overflow.
 * Position: prefer above composer, flip below when headroom is insufficient.
 */
function ComposerPickerPanel({
  anchorRef,
  open = true,
  header,
  children,
  footer,
  empty,
  isEmpty = false,
  className,
  role = 'listbox',
  'aria-label': ariaLabel,
}: ComposerPickerPanelProps) {
  const position = useComposerPickerPosition(anchorRef, open)

  if (!open || !position || typeof document === 'undefined') {
    return null
  }

  const panel = (
    <div
      className={`composer-picker-panel${className ? ` ${className}` : ''}`}
      role={role}
      aria-label={ariaLabel}
      data-placement={position.placement}
      style={{
        position: 'fixed',
        top: position.top,
        bottom: position.bottom,
        left: position.left,
        width: position.width,
        maxHeight: position.maxHeight,
        zIndex: 'var(--chatbox-z-composer-picker, 400)',
      }}
    >
      <div className="composer-picker-panel-header">{header}</div>

      <div className="composer-picker-panel-body">
        {isEmpty && empty ? (
          <div className="composer-picker-empty">
            <Text size="sm" fw={500} c="chatbox-primary" className="text-balance">
              {empty.title}
            </Text>
            {empty.description ? (
              <Text size="xs" c="chatbox-tertiary" mt={4} className="text-pretty">
                {empty.description}
              </Text>
            ) : null}
            {empty.action ? (
              <Button
                size="compact-sm"
                variant="light"
                color="chatbox-brand"
                className="mt-3 active:scale-[0.96] transition-transform"
                onMouseDown={(e) => e.preventDefault()}
                onClick={empty.action.onClick}
              >
                {empty.action.label}
              </Button>
            ) : null}
          </div>
        ) : (
          children
        )}
      </div>

      {footer ? <div className="composer-picker-panel-footer">{footer}</div> : null}
    </div>
  )

  return createPortal(panel, document.body)
}

export default memo(ComposerPickerPanel)
