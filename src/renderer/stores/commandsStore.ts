import type { CommandPackage } from '@shared/types'
import { useAtom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import {
  discoverAgentCommands,
  isValidCommandName,
  parseCommandMd,
  serializeCommandMd,
  type CommandScanResult,
} from '@/packages/commands'
import storage, { StorageKey } from '@/storage'

/** User + import commands only; agent commands merged at read time */
export const userCommandsAtom = atomWithStorage<CommandPackage[]>(StorageKey.Commands, [], storage)

let agentCommandsCache: CommandPackage[] = []
let agentCommandRoots: CommandScanResult['roots'] = []
let agentCommandScanPromise: Promise<void> | null = null
let agentCommandWorkspaceKey = ''
const agentCommandListeners = new Set<() => void>()

function workspaceScanKey(workspaceRoot?: string | null): string {
  return workspaceRoot?.trim() || '__cwd__'
}

function notifyAgentCommandListeners() {
  for (const listener of agentCommandListeners) {
    listener()
  }
}

function sortCommands(commands: CommandPackage[]) {
  return [...commands].sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Merge priority for same command name (first wins):
 * 1. user / import
 * 2. agent filesystem (project → global, already ordered)
 */
function mergeCommands(
  userCommands: CommandPackage[],
  agentCommands: CommandPackage[] = agentCommandsCache
): CommandPackage[] {
  const merged: CommandPackage[] = []
  const seenNames = new Set<string>()

  const push = (cmd: CommandPackage) => {
    if (seenNames.has(cmd.name)) return
    seenNames.add(cmd.name)
    merged.push(cmd)
  }

  for (const u of userCommands) {
    if (u.source === 'agent') continue
    push(u)
  }

  for (const a of agentCommands) {
    const override = userCommands.find((u) => u.id === a.id || (u.name === a.name && u.source === 'agent'))
    if (override && typeof override.enabled === 'boolean') {
      push({ ...a, enabled: override.enabled })
    } else {
      push(a)
    }
  }

  return sortCommands(merged)
}

export function mergeCommandsList(userCommands: CommandPackage[]): CommandPackage[] {
  return mergeCommands(userCommands, agentCommandsCache)
}

export async function refreshAgentCommands(options?: {
  workspaceRoot?: string | null
  force?: boolean
}): Promise<{
  count: number
  roots: CommandScanResult['roots']
}> {
  const key = workspaceScanKey(options?.workspaceRoot)

  if (!options?.force && !agentCommandScanPromise && agentCommandWorkspaceKey === key) {
    return { count: agentCommandsCache.length, roots: agentCommandRoots }
  }

  if (agentCommandScanPromise) {
    await agentCommandScanPromise
    if (!options?.force && agentCommandWorkspaceKey === key) {
      return { count: agentCommandsCache.length, roots: agentCommandRoots }
    }
  }

  agentCommandScanPromise = (async () => {
    try {
      const result = await discoverAgentCommands({ workspaceRoot: options?.workspaceRoot })
      agentCommandsCache = result.commands
      agentCommandRoots = result.roots
      agentCommandWorkspaceKey = key
      notifyAgentCommandListeners()
    } catch (error) {
      console.warn('[commands] agent refresh failed', error)
    } finally {
      agentCommandScanPromise = null
    }
  })()

  await agentCommandScanPromise
  return { count: agentCommandsCache.length, roots: agentCommandRoots }
}

export function getAgentCommandsCache(): CommandPackage[] {
  return agentCommandsCache
}

export function useCommands() {
  const [userCommands, setUserCommands] = useAtom(userCommandsAtom)
  const [agentTick, setAgentTick] = useState(0)

  useEffect(() => {
    const listener = () => setAgentTick((n) => n + 1)
    agentCommandListeners.add(listener)
    void refreshAgentCommands()
    return () => {
      agentCommandListeners.delete(listener)
    }
  }, [])

  const commands = useMemo(
    () => mergeCommands(userCommands, agentCommandsCache),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userCommands, agentTick]
  )
  const enabledCommands = useMemo(() => commands.filter((c) => c.enabled), [commands])

  const upsertCommand = (input: Omit<CommandPackage, 'id' | 'updatedAt'> & Partial<Pick<CommandPackage, 'id'>>) => {
    if (!isValidCommandName(input.name)) {
      throw new Error(`Invalid command name: ${input.name}`)
    }
    const next: CommandPackage = {
      ...input,
      id: input.id || `user:${input.name}:${uuidv4().slice(0, 8)}`,
      updatedAt: Date.now(),
    }

    setUserCommands(async (prev) => {
      const list = await prev
      if (next.source === 'agent') {
        const without = list.filter((c) => c.id !== next.id)
        return [...without, { ...next, instructions: next.instructions || '' }]
      }
      const exists = list.some((c) => c.id === next.id)
      const nextList = exists ? list.map((c) => (c.id === next.id ? next : c)) : [...list, next]
      return sortCommands(nextList)
    })

    return next
  }

  const setCommandEnabled = (commandId: string, enabled: boolean) => {
    const current = commands.find((c) => c.id === commandId)
    if (!current) return

    if (current.source === 'agent') {
      setUserCommands(async (prev) => {
        const list = await prev
        const existing = list.find((c) => c.id === commandId || (c.name === current.name && c.source === 'agent'))
        if (existing) {
          return list.map((c) => (c.id === existing.id ? { ...c, enabled, updatedAt: Date.now() } : c))
        }
        return [
          ...list,
          {
            ...current,
            enabled,
            instructions: '',
            updatedAt: Date.now(),
          },
        ]
      })
      return
    }

    setUserCommands(async (prev) =>
      (await prev).map((c) => (c.id === commandId ? { ...c, enabled, updatedAt: Date.now() } : c))
    )
  }

  const removeCommand = (commandId: string) => {
    setUserCommands(async (prev) => (await prev).filter((c) => c.id !== commandId && c.source !== 'agent'))
  }

  const importCommandMd = (raw: string, source: 'user' | 'import' = 'import') => {
    const parsed = parseCommandMd(raw, { source, enabled: true })
    const cmd: CommandPackage = {
      ...parsed,
      id: `${source}:${parsed.name}:${uuidv4().slice(0, 8)}`,
      source,
    }
    setUserCommands(async (prev) => {
      const list = await prev
      const filtered = list.filter((c) => !(c.name === cmd.name && c.source !== 'agent'))
      return sortCommands([...filtered, cmd])
    })
    return cmd
  }

  const exportCommandMd = (commandId: string): string | null => {
    const cmd = commands.find((c) => c.id === commandId)
    if (!cmd) return null
    return serializeCommandMd(cmd)
  }

  const rescanAgentCommands = useCallback(async (workspaceRoot?: string | null) => {
    return refreshAgentCommands({ workspaceRoot, force: true })
  }, [])

  return {
    commands,
    enabledCommands,
    agentRoots: agentCommandRoots,
    agentCommandCount: agentCommandsCache.length,
    upsertCommand,
    setCommandEnabled,
    removeCommand,
    importCommandMd,
    exportCommandMd,
    rescanAgentCommands,
  }
}
