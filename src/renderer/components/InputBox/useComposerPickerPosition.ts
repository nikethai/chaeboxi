import { type RefObject, useLayoutEffect, useState } from 'react'

export type ComposerPickerPlacement = 'above' | 'below'

export interface ComposerPickerPosition {
  /** When placement is above, use CSS `bottom` (distance from viewport bottom). */
  bottom?: number
  /** When placement is below, use CSS `top`. */
  top?: number
  left: number
  width: number
  maxHeight: number
  placement: ComposerPickerPlacement
}

const GAP_PX = 8
const PREFERRED_MAX_H = 320
const MIN_MAX_H = 120
const VIEWPORT_PAD = 8

function measure(anchor: DOMRect | null): ComposerPickerPosition | null {
  if (!anchor || (anchor.width === 0 && anchor.height === 0)) {
    return null
  }

  const vw = window.innerWidth
  const vh = window.innerHeight
  const spaceAbove = anchor.top - VIEWPORT_PAD
  const spaceBelow = vh - anchor.bottom - VIEWPORT_PAD

  // Prefer above (composer lists grow upward); flip when headroom is tight.
  const placeAbove = spaceAbove >= MIN_MAX_H || spaceAbove >= spaceBelow
  const available = placeAbove ? spaceAbove : spaceBelow
  const maxHeight = Math.max(MIN_MAX_H, Math.min(PREFERRED_MAX_H, available - GAP_PX))

  const left = Math.max(VIEWPORT_PAD, Math.min(anchor.left, vw - VIEWPORT_PAD - Math.min(anchor.width, vw)))
  const width = Math.min(anchor.width, vw - left - VIEWPORT_PAD)

  if (placeAbove) {
    // Pin bottom edge of panel just above the composer so short lists don't float.
    return {
      bottom: vh - anchor.top + GAP_PX,
      left,
      width,
      maxHeight,
      placement: 'above',
    }
  }

  return {
    top: anchor.bottom + GAP_PX,
    left,
    width,
    maxHeight,
    placement: 'below',
  }
}

/**
 * Fixed-position coords for a portaled composer picker anchored to an element.
 * Recomputes on resize, scroll, and visualViewport changes.
 */
export function useComposerPickerPosition(anchorRef: RefObject<HTMLElement | null>, open: boolean) {
  const [position, setPosition] = useState<ComposerPickerPosition | null>(null)

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null)
      return
    }

    let raf = 0
    const update = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const el = anchorRef.current
        setPosition(measure(el?.getBoundingClientRect() ?? null))
      })
    }

    update()

    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    window.visualViewport?.addEventListener('resize', update)
    window.visualViewport?.addEventListener('scroll', update)

    const el = anchorRef.current
    const ro = typeof ResizeObserver !== 'undefined' && el ? new ResizeObserver(update) : null
    if (ro && el) {
      ro.observe(el)
    }

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
      window.visualViewport?.removeEventListener('resize', update)
      window.visualViewport?.removeEventListener('scroll', update)
      ro?.disconnect()
    }
  }, [anchorRef, open])

  return position
}
