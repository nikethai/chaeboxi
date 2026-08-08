import type { ToolSet } from 'ai'
import { tool } from 'ai'
import z from 'zod'
import { runSecurityGates } from '@/packages/tools/terminal-security'
import { resolveWorkspaceCwd } from '@/packages/tools/workspace-path'
import platform from '@/platform'

const MAX_OUTPUT_LENGTH = 50_000
const DEFAULT_TIMEOUT_MS = 30_000

export function terminalToolSetDescription(workspaceRoot: string): string {
  return `
Use the terminal tool to execute shell commands on the user's machine.

## terminal
Execute a shell command and return its output. Available only on the desktop app.
- Default working directory: \`${workspaceRoot}\` (session workspace root)
- Optional \`cwd\` must stay inside the workspace root
- Commands are subject to security validation before execution
- Blocked commands (e.g., mkfs, dd, shutdown) will be rejected
- Commands targeting sensitive system paths will be rejected
- Destructive commands will include warnings in the output
- Output is limited to ${MAX_OUTPUT_LENGTH} characters
- Default timeout is ${DEFAULT_TIMEOUT_MS / 1000} seconds
`
}

function truncateOutput(output: string): string {
  if (output.length <= MAX_OUTPUT_LENGTH) {
    return output
  }
  return `${output.slice(0, MAX_OUTPUT_LENGTH)}\n... [output truncated at ${MAX_OUTPUT_LENGTH} characters]`
}

export function createTerminalTool(workspaceRoot: string) {
  return tool({
    description:
      "Execute a shell command on the user's machine and return its stdout/stderr. " +
      'Use for running build commands, scripts, git operations, file inspection, etc. ' +
      'Default cwd is the session workspace root. Commands are security-validated before execution.',
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
      input: { command: string; cwd?: string; timeoutMs?: number },
      _context: { abortSignal?: AbortSignal }
    ) => {
      if (platform.type !== 'desktop') {
        return {
          exitCode: 1,
          stdout: '',
          stderr: 'Terminal tool is only available on the desktop app.',
          error: 'UNSUPPORTED_PLATFORM',
        }
      }

      if (!platform.executeCommand) {
        return {
          exitCode: 1,
          stdout: '',
          stderr: 'Terminal execution is not available on this platform.',
          error: 'NOT_IMPLEMENTED',
        }
      }

      const cwdResolved = resolveWorkspaceCwd(workspaceRoot, input.cwd)
      if (!cwdResolved.ok) {
        return {
          exitCode: 1,
          stdout: '',
          stderr: cwdResolved.error,
          error: 'INVALID_CWD',
        }
      }

      // Run security gates against the resolved cwd
      const gateResult = runSecurityGates(input.command, cwdResolved.absolutePath)

      if (!gateResult.allowed) {
        return {
          exitCode: 1,
          stdout: '',
          stderr: `Command blocked: ${gateResult.reason}`,
          error: 'SECURITY_BLOCKED',
          riskLevel: gateResult.riskLevel,
          warnings: gateResult.warnings,
        }
      }

      try {
        const result = await platform.executeCommand(
          input.command,
          cwdResolved.absolutePath,
          input.timeoutMs ?? DEFAULT_TIMEOUT_MS
        )

        const stdout = truncateOutput(result.stdout)
        const stderr = truncateOutput(result.stderr)

        return {
          exitCode: result.exitCode,
          stdout,
          stderr,
          cwd: cwdResolved.absolutePath,
          warnings: gateResult.warnings.length > 0 ? gateResult.warnings : undefined,
          riskLevel: gateResult.riskLevel,
        }
      } catch (err) {
        return {
          exitCode: 1,
          stdout: '',
          stderr: err instanceof Error ? err.message : String(err),
          error: 'EXECUTION_ERROR',
        }
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
