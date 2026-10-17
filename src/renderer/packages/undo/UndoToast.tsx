import { useTranslation } from 'react-i18next'
import { useStore } from 'zustand'
import { getOS } from '@/packages/navigator'
import { undoEntry, undoStore } from './undo'

export function UndoToast() {
  const { t } = useTranslation()
  const toast = useStore(undoStore, (s) => s.toast)
  if (!toast) {
    return null
  }
  const os = getOS()
  const hint = os === 'Mac' ? '⌘Z' : os === 'Windows' || os === 'Linux' ? 'Ctrl+Z' : null
  return (
    <div className="dango-toast-host">
      <div className="dg-toast" role="status">
        <span>{toast.message}</span>
        <button type="button" onClick={() => void undoEntry(toast.id)}>
          {t('Undo')}
        </button>
        {hint && <span className="dg-kbd">{hint}</span>}
      </div>
      {toast.extra && (
        <button type="button" className="dg-link" onClick={toast.extra.onClick}>
          {toast.extra.label}
        </button>
      )}
    </div>
  )
}
