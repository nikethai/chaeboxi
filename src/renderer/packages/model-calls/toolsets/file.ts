import type { ToolSet } from 'ai'
import { tool } from 'ai'
import z from 'zod'
import { MAX_INLINE_FILE_LINES, PREVIEW_LINES } from '@/packages/context-management/attachment-payload'
import { resolveWorkspacePath } from '@/packages/tools/workspace-path'
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

export function workspaceFileToolSetDescription(workspaceRoot: string): string {
  return `
# Workspace filesystem tools

Session workspace root: \`${workspaceRoot}\`

Use these tools to create and edit project files on the user's machine under the workspace root.
- Prefer paths relative to the workspace root (e.g. \`src/App.tsx\`). Absolute paths must stay inside the root.
- Parent directories are created automatically for \`create_file\`.
- Do not attempt to write outside the workspace; those calls will fail.

## create_file
Creates or overwrites a file under the workspace with full content.

## edit_file
Replaces the first occurrence of \`old_string\` with \`new_string\` in a workspace file.
- \`old_string\` must exist and be unique enough to match the intended location

## delete_file
Deletes a file under the workspace root.
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

/** Workspace create/edit/delete tools confined to the session workspace root. */
export function createWorkspaceFileTools(workspaceRoot: string): ToolSet {
  const createFileTool = tool({
    description:
      'Creates or overwrites a file under the session workspace root. Prefer relative paths (e.g. src/App.tsx).',
    inputSchema: z.object({
      path: z.string().describe('File path relative to the workspace root, or an absolute path inside the workspace.'),
      content: z.string().describe('The full content to write to the file.'),
    }),
    execute: async (input: { path: string; content: string }) => {
      const resolved = resolveWorkspacePath(workspaceRoot, input.path)
      if (!resolved.ok) {
        return { success: false, message: resolved.error }
      }
      try {
        await platform.writeFile(resolved.absolutePath, input.content)
        return {
          success: true,
          message: `File created successfully: ${resolved.absolutePath}`,
          path: resolved.absolutePath,
        }
      } catch (err) {
        return { success: false, message: `Failed to create file: ${toErrorMessage(err)}` }
      }
    },
  })

  const editFileTool = tool({
    description:
      'Edits a workspace file by replacing the first occurrence of old_string with new_string. Path must be under the workspace root.',
    inputSchema: z.object({
      path: z.string().describe('File path relative to the workspace root, or an absolute path inside the workspace.'),
      old_string: z.string().min(1).describe('The exact string to find and replace. Must not be empty.'),
      new_string: z.string().describe('The replacement string.'),
    }),
    execute: async (input: { path: string; old_string: string; new_string: string }) => {
      const resolved = resolveWorkspacePath(workspaceRoot, input.path)
      if (!resolved.ok) {
        return { success: false, message: resolved.error, changes_made: 0 }
      }
      try {
        const content = await platform.readFileByPath(resolved.absolutePath)
        if (!content.includes(input.old_string)) {
          return {
            success: false,
            message: `old_string not found in file: ${resolved.absolutePath}`,
            changes_made: 0,
          }
        }
        const newContent = content.replace(input.old_string, input.new_string)
        await platform.writeFile(resolved.absolutePath, newContent)
        return {
          success: true,
          message: `File edited successfully: ${resolved.absolutePath}`,
          path: resolved.absolutePath,
          changes_made: 1,
        }
      } catch (err) {
        return { success: false, message: `Failed to edit file: ${toErrorMessage(err)}`, changes_made: 0 }
      }
    },
  })

  const deleteFileTool = tool({
    description: 'Deletes a file under the session workspace root.',
    inputSchema: z.object({
      path: z.string().describe('File path relative to the workspace root, or an absolute path inside the workspace.'),
    }),
    execute: async (input: { path: string }) => {
      const resolved = resolveWorkspacePath(workspaceRoot, input.path)
      if (!resolved.ok) {
        return { success: false, message: resolved.error }
      }
      try {
        await platform.deleteFile(resolved.absolutePath)
        return {
          success: true,
          message: `File deleted successfully: ${resolved.absolutePath}`,
          path: resolved.absolutePath,
        }
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

export function createWorkspaceFileToolSet(workspaceRoot: string) {
  return {
    description: workspaceFileToolSetDescription(workspaceRoot),
    tools: createWorkspaceFileTools(workspaceRoot),
  }
}

/** @deprecated Prefer attachmentFileToolSet / createWorkspaceFileToolSet — kept for callers that import default. */
export default {
  description: attachmentFileToolSetDescription,
  tools: attachmentFileTools,
}
