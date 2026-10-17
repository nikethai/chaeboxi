import { useEffect } from 'react'
import { getOS } from '@/packages/navigator'
import { isEditableTarget } from '@/utils/isEditableTarget'
import { canUndo, undoLatest, undoStore } from './undo'

/** Cmd+Z (macOS) or Ctrl+Z (elsewhere) undoes the live toast, unless focus is in an editable field. */
export function useUndoHotkey(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'z' || e.shiftKey || e.altKey || e.defaultPrevented) {
        return
      }
      const isMac = getOS() === 'Mac'
      if (isMac ? !e.metaKey : !e.ctrlKey) {
        return
      }
      if (isEditableTarget(e.target)) {
        return
      }
      const id = undoStore.getState().toast?.id
      if (!id || !canUndo(id)) {
        return
      }
      e.preventDefault()
      void undoLatest()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
