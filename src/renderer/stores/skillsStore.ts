import type { SkillPackage } from '@shared/types'
import { useAtom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import {
  discoverAgentSkills,
  getBuiltinSkills,
  isValidSkillName,
  parseSkillMd,
  serializeSkillMd,
  type SkillScanResult,
} from '@/packages/skills'
import storage, { StorageKey } from '@/storage'

/** User + import skills only; builtins + agent skills merged at read time */
export const userSkillsAtom = atomWithStorage<SkillPackage[]>(StorageKey.Skills, [], storage)

/** In-memory cache of filesystem agent skills (desktop scan) */
let agentSkillsCache: SkillPackage[] = []
let agentScanRoots: SkillScanResult['roots'] = []
let agentScanPromise: Promise<void> | null = null
/** Workspace key used for last successful scan (`__cwd__` when unset) */
let agentScanWorkspaceKey = ''
const agentSkillsListeners = new Set<() => void>()

function workspaceScanKey(workspaceRoot?: string | null): string {
  return workspaceRoot?.trim() || '__cwd__'
}

function notifyAgentSkillsListeners() {
  for (const listener of agentSkillsListeners) {
    listener()
  }
}

function sortSkills(skills: SkillPackage[]) {
  return [...skills].sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Merge priority for same skill name (first wins):
 * 1. user / import (app storage)
 * 2. agent filesystem (project → global, already ordered)
 * 3. builtin
 */
function mergeSkills(userSkills: SkillPackage[], agentSkills: SkillPackage[] = agentSkillsCache): SkillPackage[] {
  const builtins = getBuiltinSkills()
  const merged: SkillPackage[] = []
  const seenNames = new Set<string>()

  const push = (skill: SkillPackage) => {
    if (seenNames.has(skill.name)) return
    seenNames.add(skill.name)
    merged.push(skill)
  }

  // 1) User-authored / imports
  for (const u of userSkills) {
    if (u.source === 'agent') continue // agent skills live in memory cache only
    // Builtin enable overrides are not "names" that block agents — handled below
    if (u.source === 'builtin') continue
    push(u)
  }

  // 2) Agent filesystem skills (with enable overrides from storage by id)
  for (const a of agentSkills) {
    const override = userSkills.find((u) => u.id === a.id || (u.name === a.name && u.source === 'agent'))
    if (override && typeof override.enabled === 'boolean') {
      push({ ...a, enabled: override.enabled })
    } else {
      push(a)
    }
  }

  // 3) Builtins (with enable overrides)
  for (const b of builtins) {
    if (seenNames.has(b.name)) continue
    const override = userSkills.find((u) => u.id === b.id)
    push(override ? { ...b, enabled: override.enabled } : b)
  }

  return sortSkills(merged)
}

export async function refreshAgentSkills(options?: {
  workspaceRoot?: string | null
  /** Force rescan even if workspace key unchanged */
  force?: boolean
}): Promise<{
  count: number
  roots: SkillScanResult['roots']
}> {
  const key = workspaceScanKey(options?.workspaceRoot)

  // Reuse cache when same workspace already scanned
  if (!options?.force && !agentScanPromise && agentScanWorkspaceKey === key) {
    return { count: agentSkillsCache.length, roots: agentScanRoots }
  }

  if (agentScanPromise) {
    await agentScanPromise
    if (!options?.force && agentScanWorkspaceKey === key) {
      return { count: agentSkillsCache.length, roots: agentScanRoots }
    }
  }

  agentScanPromise = (async () => {
    try {
      const result = await discoverAgentSkills({ workspaceRoot: options?.workspaceRoot })
      agentSkillsCache = result.skills
      agentScanRoots = result.roots
      agentScanWorkspaceKey = key
      notifyAgentSkillsListeners()
    } catch (error) {
      console.warn('[skills] agent refresh failed', error)
    } finally {
      agentScanPromise = null
    }
  })()

  await agentScanPromise
  return { count: agentSkillsCache.length, roots: agentScanRoots }
}

export function getAgentSkillsCache(): SkillPackage[] {
  return agentSkillsCache
}

export function useSkills() {
  const [userSkills, setUserSkills] = useAtom(userSkillsAtom)
  const [agentTick, setAgentTick] = useState(0)

  useEffect(() => {
    const listener = () => setAgentTick((n) => n + 1)
    agentSkillsListeners.add(listener)
    // Auto-scan once on first mount (desktop)
    void refreshAgentSkills()
    return () => {
      agentSkillsListeners.delete(listener)
    }
  }, [])

  const skills = useMemo(
    () => mergeSkills(userSkills, agentSkillsCache),
    // agentTick forces recompute after scan
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userSkills, agentTick]
  )
  const enabledSkills = useMemo(() => skills.filter((s) => s.enabled), [skills])

  const upsertSkill = (input: Omit<SkillPackage, 'id' | 'updatedAt'> & Partial<Pick<SkillPackage, 'id'>>) => {
    if (!isValidSkillName(input.name)) {
      throw new Error(`Invalid skill name: ${input.name}`)
    }
    const next: SkillPackage = {
      ...input,
      id: input.id || `user:${input.name}:${uuidv4().slice(0, 8)}`,
      updatedAt: Date.now(),
    }

    setUserSkills(async (prev) => {
      const list = await prev
      if (next.source === 'builtin' || next.source === 'agent') {
        const without = list.filter((s) => s.id !== next.id)
        return [...without, { ...next, instructions: next.instructions || '' }]
      }
      const exists = list.some((s) => s.id === next.id)
      const nextList = exists ? list.map((s) => (s.id === next.id ? next : s)) : [...list, next]
      return sortSkills(nextList)
    })

    return next
  }

  const setSkillEnabled = (skillId: string, enabled: boolean) => {
    const current = skills.find((s) => s.id === skillId)
    if (!current) return

    if (current.source === 'builtin' || current.source === 'agent') {
      setUserSkills(async (prev) => {
        const list = await prev
        const without = list.filter((s) => s.id !== skillId)
        return [
          ...without,
          {
            ...current,
            enabled,
            instructions: current.instructions,
            updatedAt: Date.now(),
          },
        ]
      })
      return
    }

    setUserSkills(async (prev) =>
      (await prev).map((s) => (s.id === skillId ? { ...s, enabled, updatedAt: Date.now() } : s))
    )
  }

  const removeSkill = (skillId: string) => {
    setUserSkills(async (prev) => (await prev).filter((s) => s.id !== skillId && s.source !== 'agent'))
  }

  const importSkillMd = (raw: string, source: 'user' | 'import' = 'import') => {
    const parsed = parseSkillMd(raw, { source, enabled: true })
    const skill: SkillPackage = {
      ...parsed,
      id: `${source}:${parsed.name}:${uuidv4().slice(0, 8)}`,
      source,
    }
    setUserSkills(async (prev) => {
      const list = await prev
      const filtered = list.filter((s) => !(s.name === skill.name && s.source !== 'builtin' && s.source !== 'agent'))
      return sortSkills([...filtered, skill])
    })
    return skill
  }

  const exportSkillMd = (skillId: string): string | null => {
    const skill = skills.find((s) => s.id === skillId)
    if (!skill) return null
    return serializeSkillMd(skill)
  }

  const rescanAgentSkills = useCallback(async (workspaceRoot?: string | null) => {
    return refreshAgentSkills({ workspaceRoot, force: true })
  }, [])

  return {
    skills,
    enabledSkills,
    userSkills,
    agentRoots: agentScanRoots,
    agentSkillCount: agentSkillsCache.length,
    upsertSkill,
    setSkillEnabled,
    removeSkill,
    importSkillMd,
    exportSkillMd,
    rescanAgentSkills,
  }
}

/** Sync merge for non-React code (generation path). */
export function mergeSkillsList(userSkills: SkillPackage[]): SkillPackage[] {
  return mergeSkills(userSkills, agentSkillsCache)
}
