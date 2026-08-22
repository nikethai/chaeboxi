import type { ToolSet } from 'ai'
import { tool } from 'ai'
import z from 'zod'
import { MAX_INLINE_FILE_LINES, PREVIEW_LINES } from '@/packages/context-management/attachment-payload'
import platform from '@/platform'

const DEFAULT_LINES = 200
const MAX_LINES = MAX_INLINE_FILE_LINES
const MAX_LINE_LENGTH = 2000

const truncateLine = (line: string) => {
  if (line.length <= MAX_LINE_LENGTH) {
    return line
  }

  if (MAX_LINE_LENGTH <= 3) {
    return line.slice(0, MAX_LINE_LENGTH)
  }

  return `${line.slice(0, MAX_LINE_LENGTH - 3)}...`
}

const formatLineWithNumber = (line: string, lineNumber: number) => {
  const lineNumberStr = String(lineNumber).padStart(6, ' ')
  return `${lineNumberStr}\t${line}`
}

const GREP_MAX_RESULTS = 100

const toErrorMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err))

/** Attachment tools only — for uploaded chat files (fileKey blobs). */
export const attachmentFileToolSetDescription = `
Use these tools to read and search large user-uploaded files (marked with <ATTACHMENT_FILE></ATTACHMENT_FILE>).

IMPORTANT:
- Files with ≤${MAX_LINES} lines have their FULL content in <FILE_CONTENT> tags - read them directly without tools.
- Files with >${MAX_LINES} lines only show the first ${PREVIEW_LINES} lines as preview in <FILE_CONTENT>, with a <TRUNCATED> tag indicating more content is available. Use these tools to read additional content beyond the preview.
- These tools use \`fileKey\` from <FILE_KEY> tags. They do NOT write to the local filesystem.

## read_file
Reads uploaded file content with line numbers (like \`cat -n\`).
- Returns up to ${DEFAULT_LINES} lines by default, max ${MAX_LINES} lines per call
- Lines exceeding ${MAX_LINE_LENGTH} characters are truncated with "..."
- Use \`lineOffset\` and \`maxLines\` to read specific portions
- Prefer \`search_file_content\` when searching for specific content
- Call in parallel when reading multiple files

## search_file_content
Searches for text patterns within an uploaded file.
- Returns matching lines with line numbers and optional context
- Use \`beforeContextLines\` / \`afterContextLines\` to include surrounding lines
- Returns up to ${GREP_MAX_RESULTS} matches maximum
- Call in parallel when searching multiple files
`

export type WorkspaceToolContext = {
  capabilityId: string
  projectId: string
  rootGeneration: string
  mutationEnabled: boolean
}

export function workspaceFileToolSetDescription(context: WorkspaceToolContext | string): string {
  if (typeof context === 'string') {
    return `
# Workspace filesystem tools

Filesystem mutation requires a native Project folder binding. A pasted path is not authorization.
Generic project shell is unavailable.
`
  }
  return `
# Project filesystem tools

Use relative paths only (e.g. src/App.tsx). Absolute host paths are rejected.
create/edit/delete require an expected revision. Conflicts return CONFLICT and keep the original file.
Generic project shell is unavailable.

## create_file
Create a new file, or overwrite when mode=overwrite and expected_revision matches.

## edit_file
Native replacement of old_string. Rejects 0 or >1 matches (AMBIGUOUS_EDIT).

## delete_file
Deletes a file when expected_revision matches.
`
}

const readFileTool = tool({
  description: 'Reads the content of a file uploaded by the user (attachment fileKey).',
  inputSchema: z.object({
    fileKey: z.string().describe('The identifier of the file to read within tag `<FILE_KEY>`.'),
    lineOffset: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe('Optional line offset to start reading from. Defaults to 0.'),
    maxLines: z
      .number()
      .int()
      .min(1)
      .max(MAX_LINES)
      .default(DEFAULT_LINES)
      .optional()
      .describe(`Optional maximum number of lines to read. Defaults to ${DEFAULT_LINES}.`),
  }),
  execute: async (
    input: { fileKey: string; lineOffset?: number; maxLines?: number },
    _context: { abortSignal?: AbortSignal }
  ) => {
    const fileContent = await platform.getStoreBlob(input.fileKey)
    if (fileContent === null) {
      return 'File not found or inaccessible. Ensure the fileKey is the correct identifier within <FILE_KEY> tags.'
    }
    const lines = fileContent.split('\n')
    const lineOffset = input.lineOffset ?? 0
    const maxLines = input.maxLines ?? DEFAULT_LINES
    const selectedLines = lines.slice(lineOffset, lineOffset + maxLines)
    const truncatedLines = selectedLines.map(truncateLine)
    const numberedLines = truncatedLines.map((line, index) => formatLineWithNumber(line, lineOffset + index + 1))
    return {
      fileKey: input.fileKey,
      content: numberedLines.join('\n'),
      lineOffset,
      linesRead: selectedLines.length,
      totalLines: lines.length,
    }
  },
})

const searchFileTool = tool({
  description: 'Searches for a keyword or phrase within a file uploaded by the user (attachment fileKey).',
  inputSchema: z.object({
    fileKey: z.string().describe('The identifier of the file to read within tag `<FILE_KEY>`.'),
    query: z.string().describe('The keyword or phrase to search for within the file.'),
    beforeContextLines: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe('Optional number of context lines to include before each match. Defaults to 0.'),
    afterContextLines: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe('Optional number of context lines to include after each match. Defaults to 0.'),
    maxResults: z
      .number()
      .int()
      .min(1)
      .max(GREP_MAX_RESULTS)
      .default(10)
      .optional()
      .describe('Optional maximum number of results to return. Defaults to 10.'),
  }),
  execute: async (
    input: {
      fileKey: string
      query: string
      beforeContextLines?: number
      afterContextLines?: number
      maxResults?: number
    },
    _context: { abortSignal?: AbortSignal }
  ) => {
    const fileContent = await platform.getStoreBlob(input.fileKey)
    if (fileContent === null) {
      return 'File not found or inaccessible. Ensure the fileKey is the correct identifier within <FILE_KEY> tags.'
    }
    const lines = fileContent.split('\n')
    const results: Array<{ lineNumber: number; lineContent: string; context: string[] }> = []

    const beforeLines = input.beforeContextLines ?? 0
    const afterLines = input.afterContextLines ?? 0
    const maxResults = input.maxResults ?? 10

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(input.query)) {
        const contextStart = Math.max(0, i - beforeLines)
        const contextEnd = Math.min(lines.length, i + afterLines + 1)
        const context = lines.slice(contextStart, contextEnd).map(truncateLine)
        results.push({ lineNumber: i + 1, lineContent: truncateLine(lines[i]), context })
        if (results.length >= maxResults) {
          break
        }
      }
    }

    return {
      fileKey: input.fileKey,
      query: input.query,
      results,
      totalMatches: results.length,
    }
  },
})

export const attachmentFileTools = {
  read_file: readFileTool,
  search_file_content: searchFileTool,
} as ToolSet

export const attachmentFileToolSet = {
  description: attachmentFileToolSetDescription,
  tools: attachmentFileTools,
}

function relativeOnly(path: string): string | { error: string } {
  const trimmed = path.trim()
  if (!trimmed || trimmed.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(trimmed) || trimmed.includes('..')) {
    return { error: 'Path must be a relative project path without .. or absolute roots.' }
  }
  return trimmed.replace(/\\/g, '/')
}

/** Workspace create/edit/delete tools via native capability. Dark unless mutationEnabled. */
export function createWorkspaceFileTools(context: WorkspaceToolContext | string): ToolSet {
  const ctx: WorkspaceToolContext | null =
    typeof context === 'string' ? null : context.mutationEnabled && context.capabilityId ? context : null
  if (!ctx) {
    return {} as ToolSet
  }
  const createFileTool = tool({
    description:
      'Creates or overwrites a file under the session workspace root. Prefer relative paths (e.g. src/App.tsx).',
    inputSchema: z.object({
      path: z.string().describe('File path relative to the project root.'),
      content: z.string().describe('The full content to write to the file.'),
      mode: z
        .enum(['create', 'overwrite'])
        .optional()
        .describe('create rejects existing files; overwrite requires expected_revision.'),
      expected_revision: z.string().optional().describe('Required when mode is overwrite.'),
    }),
    execute: async (input: {
      path: string
      content: string
      mode?: 'create' | 'overwrite'
      expected_revision?: string
    }) => {
      const rel = relativeOnly(input.path)
      if (typeof rel !== 'string') return { success: false, message: rel.error, code: 'OUTSIDE_ROOT' }
      if (!platform.createWorkspaceFile) {
        return { success: false, message: 'Workspace mutation is unavailable.', code: 'UNSUPPORTED_PLATFORM' }
      }
      try {
        const result = await platform.createWorkspaceFile(
          ctx.capabilityId,
          rel,
          input.content,
          input.mode === 'overwrite' ? 'overwrite' : 'create',
          input.expected_revision
        )
        if (result && 'ok' in result && result.ok === false) {
          return { success: false, message: result.code, code: result.code }
        }
        void import('@/projects/open-workspace-preview').then((m) => {
          m.openWorkspaceFilePreview(rel, input.content)
        })
        return { success: true, path: rel, revision: (result as { revision?: string }).revision }
      } catch (err) {
        return { success: false, message: `Failed to create file: ${toErrorMessage(err)}` }
      }
    },
  })

  const editFileTool = tool({
    description:
      'Edits a workspace file by replacing the first occurrence of old_string with new_string. Path must be under the workspace root.',
    inputSchema: z.object({
      path: z.string().describe('File path relative to the project root.'),
      old_string: z.string().min(1).describe('The exact string to find and replace. Must not be empty.'),
      new_string: z.string().describe('The replacement string.'),
      expected_revision: z.string().describe('Revision from the last native read. Required.'),
    }),
    execute: async (input: { path: string; old_string: string; new_string: string; expected_revision: string }) => {
      const rel = relativeOnly(input.path)
      if (typeof rel !== 'string') return { success: false, message: rel.error, changes_made: 0, code: 'OUTSIDE_ROOT' }
      if (!platform.editWorkspaceFile) {
        return {
          success: false,
          message: 'Workspace mutation is unavailable.',
          code: 'UNSUPPORTED_PLATFORM',
          changes_made: 0,
        }
      }
      try {
        const result = await platform.editWorkspaceFile(
          ctx.capabilityId,
          rel,
          input.old_string,
          input.new_string,
          input.expected_revision
        )
        if (result && 'ok' in result && result.ok === false) {
          return { success: false, message: result.code, code: result.code, changes_made: 0 }
        }
        const preview =
          (platform.readWorkspaceFile
            ? await platform
                .readWorkspaceFile(ctx.capabilityId, rel)
                .then((file) => file.content)
                .catch(() => '')
            : '') || input.new_string
        void import('@/projects/open-workspace-preview').then((m) => {
          m.openWorkspaceFilePreview(rel, preview)
        })
        return { success: true, path: rel, revision: (result as { revision?: string }).revision, changes_made: 1 }
      } catch (err) {
        return { success: false, message: `Failed to edit file: ${toErrorMessage(err)}`, changes_made: 0 }
      }
    },
  })

  const deleteFileTool = tool({
    description: 'Deletes a file under the session workspace root.',
    inputSchema: z.object({
      path: z.string().describe('File path relative to the project root.'),
      expected_revision: z.string().describe('Revision from the last native read. Required.'),
    }),
    execute: async (input: { path: string; expected_revision: string }) => {
      const rel = relativeOnly(input.path)
      if (typeof rel !== 'string') return { success: false, message: rel.error, code: 'OUTSIDE_ROOT' }
      if (!platform.deleteWorkspaceFile) {
        return { success: false, message: 'Workspace mutation is unavailable.', code: 'UNSUPPORTED_PLATFORM' }
      }
      try {
        const result = await platform.deleteWorkspaceFile(ctx.capabilityId, rel, input.expected_revision)
        if (result && 'ok' in result && result.ok === false) {
          return { success: false, message: result.code, code: result.code }
        }
        return { success: true, path: rel }
      } catch (err) {
        return { success: false, message: `Failed to delete file: ${toErrorMessage(err)}` }
      }
    },
  })

  return {
    create_file: createFileTool,
    edit_file: editFileTool,
    delete_file: deleteFileTool,
  } as ToolSet
}

export function createWorkspaceFileToolSet(context: WorkspaceToolContext | string) {
  return {
    description: workspaceFileToolSetDescription(context),
    tools: createWorkspaceFileTools(context),
  }
}

/** @deprecated Prefer attachmentFileToolSet / createWorkspaceFileToolSet — kept for callers that import default. */
export default {
  description: attachmentFileToolSetDescription,
  tools: attachmentFileTools,
}
