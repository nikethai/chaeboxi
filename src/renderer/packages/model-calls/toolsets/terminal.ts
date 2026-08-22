import type { ToolSet } from 'ai'
import { tool } from 'ai'
import z from 'zod'

const DEFAULT_TIMEOUT_MS = 30_000

export function terminalToolSetDescription(_workspaceRoot: string): string {
  return `
Project terminal is unavailable. Generic shell is not a workspace sandbox.
`
}

export function createTerminalTool(_workspaceRoot: string) {
  return tool({
    description: 'Project terminal is unavailable. Generic shell is not a workspace sandbox.',
    inputSchema: z.object({
      command: z.string().describe('The shell command to execute.'),
      cwd: z
        .string()
        .optional()
        .describe(
          'Optional working directory relative to or inside the workspace root. Defaults to the workspace root.'
        ),
      timeoutMs: z
        .number()
        .int()
        .min(1000)
        .max(300_000)
        .optional()
        .describe(`Optional timeout in milliseconds. Defaults to ${DEFAULT_TIMEOUT_MS}ms.`),
    }),
    execute: async (
      _input: { command: string; cwd?: string; timeoutMs?: number },
      _context: { abortSignal?: AbortSignal }
    ) => {
      return {
        exitCode: 1,
        stdout: '',
        stderr: 'Project terminal is unavailable. Generic shell is not a workspace sandbox.',
        error: 'UNSUPPORTED_PLATFORM',
      }
    },
  })
}

export function createTerminalToolSet(workspaceRoot: string): { description: string; tools: ToolSet } {
  return {
    description: terminalToolSetDescription(workspaceRoot),
    tools: {
      terminal: createTerminalTool(workspaceRoot),
    } as ToolSet,
  }
}

/** Unbound placeholder — prefer createTerminalToolSet(workspaceRoot). */
export const terminalTool = createTerminalTool('/')

export default {
  description: terminalToolSetDescription('(workspace not set)'),
  tools: {
    terminal: terminalTool,
  },
}
