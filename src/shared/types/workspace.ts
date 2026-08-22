import { z } from 'zod'

export const WorkspaceStatusSchema = z.enum([
  'ready',
  'missing',
  'permission-denied',
  'relink-required',
  'legacy-reconnect-required',
  'chat-only',
  'unsupported',
])

export type WorkspaceStatus = z.infer<typeof WorkspaceStatusSchema>

export const WorkspaceTrustCategorySchema = z.enum(['files', 'instructions', 'skillsCommands', 'hooks'])
export type WorkspaceTrustCategory = z.infer<typeof WorkspaceTrustCategorySchema>

export const WorkspaceTrustValueSchema = z.enum(['allowed', 'denied', 'unset'])
export type WorkspaceTrustValue = z.infer<typeof WorkspaceTrustValueSchema>

export const WorkspaceTrustStateSchema = z.object({
  files: WorkspaceTrustValueSchema,
  instructions: WorkspaceTrustValueSchema,
  skillsCommands: WorkspaceTrustValueSchema,
  hooks: WorkspaceTrustValueSchema,
})

export type WorkspaceTrustState = z.infer<typeof WorkspaceTrustStateSchema>

export const WorkspaceDescriptorSchema = z.object({
  projectId: z.string(),
  capabilityId: z.string(),
  rootGeneration: z.string(),
  displayPath: z.string(),
  status: WorkspaceStatusSchema,
  trust: WorkspaceTrustStateSchema.optional(),
})

export type WorkspaceDescriptor = z.infer<typeof WorkspaceDescriptorSchema>

export const WorkspaceReadResultSchema = z.object({
  content: z.string(),
  revision: z.string(),
  truncated: z.boolean(),
  encoding: z.enum(['utf-8', 'binary']),
  relativePath: z.string(),
  size: z.number(),
})

export type WorkspaceReadResult = z.infer<typeof WorkspaceReadResultSchema>

export const WorkspaceListEntrySchema = z.object({
  name: z.string(),
  relativePath: z.string(),
  kind: z.enum(['file', 'directory']),
  size: z.number().optional(),
  revision: z.string().optional(),
})

export type WorkspaceListEntry = z.infer<typeof WorkspaceListEntrySchema>

export const WorkspaceListResultSchema = z.object({
  entries: z.array(WorkspaceListEntrySchema),
  cursor: z.string().nullable(),
  requestId: z.string().optional(),
})

export type WorkspaceListResult = z.infer<typeof WorkspaceListResultSchema>

export const WorkspaceSearchHitSchema = z.object({
  relativePath: z.string(),
  line: z.number().optional(),
  excerpt: z.string().optional(),
  kind: z.enum(['filename', 'content']),
})

export type WorkspaceSearchHit = z.infer<typeof WorkspaceSearchHitSchema>

export const WorkspaceMutationCodeSchema = z.enum([
  'CONFLICT',
  'NOT_FOUND',
  'ALREADY_EXISTS',
  'AMBIGUOUS_EDIT',
  'REVOKED',
  'UNAUTHORIZED_ROOT',
  'OUTSIDE_ROOT',
  'SYMLINK_ESCAPE',
  'STALE_CAPABILITY',
  'WRONG_WINDOW',
  'PERMISSION_DENIED',
  'UNSUPPORTED_PLATFORM',
  'MUTATION_DISABLED',
  'HARD_DENIED',
  'BINARY',
])

export type WorkspaceMutationCode = z.infer<typeof WorkspaceMutationCodeSchema>

export type WorkspaceMutationResult =
  | { ok: true; revision: string; relativePath: string }
  | { ok: false; code: WorkspaceMutationCode; message?: string }

export const WorkspaceContextDraftEntrySchema = z.object({
  projectId: z.string(),
  rootGeneration: z.string(),
  relativePath: z.string(),
  revision: z.string(),
  excerpt: z.string(),
  range: z
    .object({
      startLine: z.number(),
      endLine: z.number(),
    })
    .optional(),
  byteLength: z.number(),
})

export type WorkspaceContextDraftEntry = z.infer<typeof WorkspaceContextDraftEntrySchema>

export const WORKSPACE_CONTEXT_MAX_ENTRIES = 20
export const WORKSPACE_CONTEXT_MAX_BYTES = 512 * 1024

export const ProjectWorkspaceFlagsSchema = z
  .object({
    migrationEnabled: z.boolean().optional().catch(true),
    directoryUxEnabled: z.boolean().optional().catch(true),
    explorerEnabled: z.boolean().optional().catch(true),
    mutationEnabled: z.boolean().optional().catch(true),
  })
  .optional()
  .catch(undefined)

export type ProjectWorkspaceFlags = NonNullable<z.infer<typeof ProjectWorkspaceFlagsSchema>>

export const DEFAULT_PROJECT_WORKSPACE_FLAGS: ProjectWorkspaceFlags = {
  migrationEnabled: true,
  directoryUxEnabled: true,
  explorerEnabled: true,
  mutationEnabled: true,
}
