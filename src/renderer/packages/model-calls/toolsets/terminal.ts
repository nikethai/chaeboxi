import { tool } from 'ai'
import z from 'zod'
import platform from '@/platform'
import { runSecurityGates } from '@/packages/tools/terminal-security'

const MAX_OUTPUT_LENGTH = 50_000
const DEFAULT_TIMEOUT_MS = 30_000

const toolSetDescription = `
Use the terminal tool to execute shell commands on the user's machine.

## terminal
Execute a shell command and return its output. Available only on the desktop app.
- Commands are subject to security validation before execution.
- Blocked commands (e.g., mkfs, dd, shutdown) will be rejected.
- Commands targeting sensitive system paths will be rejected.
- Destructive commands will include warnings in the output.
- Output is limited to ${MAX_OUTPUT_LENGTH} characters.
- Default timeout is ${DEFAULT_TIMEOUT_MS / 1000} seconds.
`

export const terminalTool = tool({
  description:
    'Execute a shell command on the user\'s machine and return its stdout/stderr. ' +
    'Use for running build commands, scripts, git operations, file inspection, etc. ' +
    'Commands are security-validated before execution.',
  inputSchema: z.object({
    command: z.string().describe('The shell command to execute.'),
    cwd: z.string().optional().describe('Optional working directory for command execution.'),
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

    // Run security gates
    const gateResult = runSecurityGates(input.command, input.cwd)

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
        input.cwd,
        input.timeoutMs ?? DEFAULT_TIMEOUT_MS
      )

      const stdout = truncateOutput(result.stdout)
      const stderr = truncateOutput(result.stderr)

      return {
        exitCode: result.exitCode,
        stdout,
        stderr,
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

function truncateOutput(output: string): string {
  if (output.length <= MAX_OUTPUT_LENGTH) {
    return output
  }
  return `${output.slice(0, MAX_OUTPUT_LENGTH)}\n... [output truncated at ${MAX_OUTPUT_LENGTH} characters]`
}

export default {
  description: toolSetDescription,
  tools: {
    terminal: terminalTool,
  },
}
