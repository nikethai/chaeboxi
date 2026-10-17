import { t } from 'i18next'
import { v4 as uuidv4 } from 'uuid'
import { createStore } from 'zustand'
import { getLogger } from '@/lib/utils'
import * as toastActions from '@/stores/toastActions'

const log = getLogger('undo')

export const DEFAULT_UNDO_MS = 5_000

export type UndoGroup = 'knowledge' | 'other'

export type UndoInput = {
  message: string
  undo: () => void | Promise<void>
  group?: UndoGroup
  /** Records that carry their own Undo button: never shown as the toast, never reached by Cmd/Ctrl+Z. */
  silent?: boolean
  durationMs?: number
  extra?: { label: string; onClick: () => void }
}

export type UndoToastState = { id: string; message: string; until: number; extra?: UndoInput['extra'] }

type UndoRecord = {
  id: string
  message: string
  group: UndoGroup
  silent: boolean
  until: number
  undo: () => void | Promise<void>
  started: boolean
  retired: boolean
}

export const undoStore = createStore<{ toast?: UndoToastState }>()(() => ({}))

let records: UndoRecord[] = []
let timers: ReturnType<typeof setTimeout>[] = []

function isLive(r: UndoRecord) {
  return !r.started && !r.retired && Date.now() < r.until
}

function clearToastFor(id: string) {
  if (undoStore.getState().toast?.id === id) {
    undoStore.setState({ toast: undefined })
  }
}

export function pushUndo(input: UndoInput): string {
  const now = Date.now()
  records = records.filter(isLive)

  const group = input.group ?? 'other'
  if (group === 'knowledge') {
    for (const r of records) {
      if (r.group === 'knowledge') {
        r.retired = true
        clearToastFor(r.id)
      }
    }
    records = records.filter((r) => !r.retired)
  }

  const record: UndoRecord = {
    id: uuidv4(),
    message: input.message,
    group,
    silent: input.silent ?? false,
    until: now + (input.durationMs ?? DEFAULT_UNDO_MS),
    undo: input.undo,
    started: false,
    retired: false,
  }
  records.push(record)

  if (!record.silent) {
    undoStore.setState({
      toast: { id: record.id, message: input.message, until: record.until, extra: input.extra },
    })
  }
  const timer = setTimeout(() => {
    timers = timers.filter((x) => x !== timer)
    clearToastFor(record.id)
  }, record.until - now)
  timers.push(timer)
  return record.id
}

export function canUndo(id: string): boolean {
  const r = records.find((x) => x.id === id)
  return !!r && isLive(r)
}

export async function undoEntry(id: string): Promise<boolean> {
  const r = records.find((x) => x.id === id)
  if (!r || !isLive(r)) {
    return false
  }
  r.started = true
  clearToastFor(id)
  try {
    await r.undo()
    return true
  } catch (error) {
    log.error(`Undo failed for "${r.message}":`, error)
    toastActions.add(t("Couldn't undo. The change stays."))
    return false
  }
}

export async function undoLatest(): Promise<boolean> {
  for (let i = records.length - 1; i >= 0; i--) {
    const r = records[i]
    if (!r.silent && isLive(r)) {
      return undoEntry(r.id)
    }
  }
  return false
}

export function resetUndoForTests(): void {
  for (const timer of timers) {
    clearTimeout(timer)
  }
  timers = []
  records = []
  undoStore.setState({ toast: undefined })
}
