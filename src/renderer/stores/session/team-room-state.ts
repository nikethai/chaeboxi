/**
 * Ephemeral Team Room UI state (live status + post-discuss actions).
 * Not persisted — cleared on new user send / navigation.
 */

import { atom } from 'jotai'
import type { RoomMode, RoomRole } from '@shared/agent-room'

export type TeamRoomLiveStatus = {
  sessionId: string
  phase: RoomRole | 'idle'
  mode: RoomMode
  speakerName?: string
  round?: number
  totalRounds?: number
} | null

export type TeamRoomActionsState = {
  sessionId: string
  speakers: string[]
  discussRoundsCompleted: number
  canKeepDiscussing: boolean
  mode: RoomMode
} | null

export const teamRoomLiveAtom = atom<TeamRoomLiveStatus>(null)
export const teamRoomActionsAtom = atom<TeamRoomActionsState>(null)

/** Imperative helpers for non-React orchestrator code */
let live: TeamRoomLiveStatus = null
let actions: TeamRoomActionsState = null
const listeners = new Set<() => void>()

function notify() {
  for (const l of listeners) l()
}

export function getTeamRoomLive(): TeamRoomLiveStatus {
  return live
}

export function getTeamRoomActions(): TeamRoomActionsState {
  return actions
}

export function setTeamRoomLive(next: TeamRoomLiveStatus) {
  live = next
  notify()
}

export function setTeamRoomActions(next: TeamRoomActionsState) {
  actions = next
  notify()
}

export function clearTeamRoomState(sessionId?: string) {
  if (sessionId) {
    if (live?.sessionId === sessionId) live = null
    if (actions?.sessionId === sessionId) actions = null
  } else {
    live = null
    actions = null
  }
  notify()
}

export function subscribeTeamRoomState(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

/** Sync jotai from imperative store (for React components that prefer atoms). */
export function syncTeamRoomAtomsToStore(
  setLive: (v: TeamRoomLiveStatus) => void,
  setActions: (v: TeamRoomActionsState) => void
) {
  setLive(live)
  setActions(actions)
}
