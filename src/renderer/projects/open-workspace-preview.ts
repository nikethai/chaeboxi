import type { ArtifactKind } from '@shared/artifacts'
import { uiStore } from '@/stores/uiStore'

function previewFromPath(relativePath: string): { kind: ArtifactKind; language: string; title: string } {
  const title = relativePath.split('/').filter(Boolean).pop() || relativePath
  const ext = (title.split('.').pop() || '').toLowerCase()
  if (ext === 'html' || ext === 'htm') return { kind: 'html', language: 'html', title }
  if (ext === 'svg') return { kind: 'svg', language: 'svg', title }
  if (ext === 'md' || ext === 'mdx' || ext === 'markdown') return { kind: 'markdown', language: 'markdown', title }
  if (ext === 'mmd' || ext === 'mermaid') return { kind: 'mermaid', language: 'mermaid', title }
  return { kind: 'code', language: ext || 'text', title }
}

/** Open Artifact Studio on a written project file (Cursor-style auto-expand). */
export function openWorkspaceFilePreview(relativePath: string, content: string) {
  const { kind, language, title } = previewFromPath(relativePath)
  uiStore.getState().setWorkspacePanel({
    kind,
    content,
    language,
    title,
  })
}
