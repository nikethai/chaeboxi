import type { HookDefinition, HookOverrides, HookRunRecord } from '@shared/types'
import { getDefaultStore, useAtom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { discoverAgentHooks, getBuiltinHooks } from '@/packages/hooks'
import storage, { StorageKey } from '@/storage'

const defaultOverrides: HookOverrides = {
  shellHooksEnabled: false,
  enabledById: {},
}

export const hookOverridesAtom = atomWithStorage<HookOverrides>(
  StorageKey.HookOverrides,
  defaultOverrides,
  storage
)

let agentHooksCache: HookDefinition[] = []
let agentHookRoots: Array<{ path: string; origin: string; exists: boolean }> = []
let agentHookScanPromise: Promise<void> | null = null
let agentHookWorkspaceKey = ''
const agentHookListeners = new Set<() => void>()

/** In-memory audit log (last 50) */
let auditLog: HookRunRecord[] = []
const auditListeners = new Set<() => void>()

/** SessionStart fired keys: `${sessionId}::${workspaceKey}` */
const sessionStartFired = new Set<string>()

function workspaceScanKey(workspaceRoot?: string | null): string {
  return workspaceRoot?.trim() || '__cwd__'
}

/** Returns true once per sessionId+workspace; subsequent calls return false. */
export function claimSessionStart(sessionId: string, workspaceRoot?: string | null): boolean {
  const key = `${sessionId}::${workspaceScanKey(workspaceRoot)}`
  if (sessionStartFired.has(key)) return false
  sessionStartFired.add(key)
  return true
}

function notifyHookListeners() {
  for (const l of agentHookListeners) l()
}

function notifyAudit() {
  for (const l of auditListeners) l()
}

export function pushHookAudit(record: HookRunRecord) {
  auditLog = [record, ...auditLog].slice(0, 50)
  notifyAudit()
}

export function getHookAuditLog(): HookRunRecord[] {
  return auditLog
}

function applyOverrides(hooks: HookDefinition[], overrides: HookOverrides): HookDefinition[] {
  return hooks.map((h) => {
    const ov = overrides.enabledById[h.id]
    if (typeof ov === 'boolean') {
      return { ...h, enabled: ov }
    }
    return h
  })
}

export function normalizeHookOverrides(
  raw: HookOverrides | Promise<HookOverrides> | null | undefined
): HookOverrides {
  if (!raw || typeof raw !== 'object' || 'then' in raw) {
    return { ...defaultOverrides }
  }
  return {
    shellHooksEnabled: Boolean((raw as HookOverrides).shellHooksEnabled),
    enabledById: (raw as HookOverrides).enabledById || {},
  }
}

export function mergeHooksList(overrides: HookOverrides, agent = agentHooksCache): HookDefinition[] {
  const builtins = getBuiltinHooks()
  const byId = new Map<string, HookDefinition>()
  for (const h of builtins) byId.set(h.id, h)
  for (const h of agent) {
    if (!byId.has(h.id)) byId.set(h.id, h)
  }
  return applyOverrides([...byId.values()], normalizeHookOverrides(overrides))
}

export async function loadHookOverrides(): Promise<HookOverrides> {
  const raw = getDefaultStore().get(hookOverridesAtom)
  if (raw && typeof raw === 'object' && 'then' in raw) {
    return normalizeHookOverrides(await (raw as Promise<HookOverrides>))
  }
  return normalizeHookOverrides(raw as HookOverrides)
}

export async function refreshAgentHooks(options?: {
  workspaceRoot?: string | null
  force?: boolean
}): Promise<{ count: number; roots: typeof agentHookRoots }> {
  const key = workspaceScanKey(options?.workspaceRoot)

  if (!options?.force && !agentHookScanPromise && agentHookWorkspaceKey === key) {
    return { count: agentHooksCache.length, roots: agentHookRoots }
  }

  if (agentHookScanPromise) {
    await agentHookScanPromise
    if (!options?.force && agentHookWorkspaceKey === key) {
      return { count: agentHooksCache.length, roots: agentHookRoots }
    }
  }

  agentHookScanPromise = (async () => {
    try {
      const result = await discoverAgentHooks({ workspaceRoot: options?.workspaceRoot })
      agentHooksCache = result.hooks
      agentHookRoots = result.roots
      agentHookWorkspaceKey = key
      notifyHookListeners()
    } catch (error) {
      console.warn('[hooks] refresh failed', error)
    } finally {
      agentHookScanPromise = null
    }
  })()

  await agentHookScanPromise
  return { count: agentHooksCache.length, roots: agentHookRoots }
}

export function getAgentHooksCache(): HookDefinition[] {
  return agentHooksCache
}

export function useHooks() {
  const [overrides, setOverrides] = useAtom(hookOverridesAtom)
  const [tick, setTick] = useState(0)
  const [auditTick, setAuditTick] = useState(0)

  useEffect(() => {
    const l = () => setTick((n) => n + 1)
    const a = () => setAuditTick((n) => n + 1)
    agentHookListeners.add(l)
    auditListeners.add(a)
    void refreshAgentHooks()
    return () => {
      agentHookListeners.delete(l)
      auditListeners.delete(a)
    }
  }, [])

  const hooks = useMemo(
    () => mergeHooksList(overrides, agentHooksCache),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [overrides, tick]
  )

  const audit = useMemo(() => getHookAuditLog(), [auditTick])

  const setHookEnabled = useCallback(
    (hookId: string, enabled: boolean) => {
      setOverrides(async (prev) => {
        const base = await Promise.resolve(prev)
        return {
          ...defaultOverrides,
          ...base,
          enabledById: { ...base.enabledById, [hookId]: enabled },
        }
      })
    },
    [setOverrides]
  )

  const setShellHooksEnabled = useCallback(
    (shellHooksEnabled: boolean) => {
      setOverrides(async (prev) => {
        const base = await Promise.resolve(prev)
        return { ...defaultOverrides, ...base, shellHooksEnabled }
      })
    },
    [setOverrides]
  )

  const rescanAgentHooks = useCallback(async (workspaceRoot?: string | null) => {
    return refreshAgentHooks({ workspaceRoot, force: true })
  }, [])

  return {
    hooks,
    agentRoots: agentHookRoots,
    agentHookCount: agentHooksCache.length,
    shellHooksEnabled: overrides.shellHooksEnabled,
    setShellHooksEnabled,
    setHookEnabled,
    rescanAgentHooks,
    audit,
  }
}
