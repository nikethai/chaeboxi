import { UnstyledButton } from '@mantine/core'
import type { WorkspaceListEntry } from '@shared/types/workspace'
import { IconChevronDown, IconChevronRight, IconFile, IconFolder } from '@tabler/icons-react'

export function ProjectExplorerTree({
  entries,
  attachedPaths,
  openDirs,
  childrenByDir,
  onToggle,
  onAttach,
}: {
  entries: WorkspaceListEntry[]
  attachedPaths: Set<string>
  openDirs: Record<string, boolean>
  childrenByDir: Record<string, WorkspaceListEntry[]>
  onToggle: (path: string) => void | Promise<void>
  onAttach: (path: string) => void | Promise<void>
}) {
  return (
    <>
      {entries.map((entry) => (
        <ExplorerBranch
          key={entry.relativePath}
          entry={entry}
          depth={0}
          attachedPaths={attachedPaths}
          openDirs={openDirs}
          childrenByDir={childrenByDir}
          onToggle={onToggle}
          onAttach={onAttach}
        />
      ))}
    </>
  )
}

function ExplorerBranch({
  entry,
  depth,
  attachedPaths,
  openDirs,
  childrenByDir,
  onToggle,
  onAttach,
}: {
  entry: WorkspaceListEntry
  depth: number
  attachedPaths: Set<string>
  openDirs: Record<string, boolean>
  childrenByDir: Record<string, WorkspaceListEntry[]>
  onToggle: (path: string) => void | Promise<void>
  onAttach: (path: string) => void | Promise<void>
}) {
  const open = Boolean(openDirs[entry.relativePath])
  const kids = childrenByDir[entry.relativePath] || []
  return (
    <>
      <ExplorerRow
        name={entry.name}
        kind={entry.kind}
        depth={depth}
        open={open}
        attached={attachedPaths.has(entry.relativePath)}
        onClick={() => {
          if (entry.kind === 'directory') {
            void onToggle(entry.relativePath)
            return
          }
          void onAttach(entry.relativePath)
        }}
      />
      {entry.kind === 'directory' && open
        ? kids.map((child) => (
            <ExplorerBranch
              key={child.relativePath}
              entry={child}
              depth={depth + 1}
              attachedPaths={attachedPaths}
              openDirs={openDirs}
              childrenByDir={childrenByDir}
              onToggle={onToggle}
              onAttach={onAttach}
            />
          ))
        : null}
    </>
  )
}

export function ExplorerFileRow({ name, attached, onClick }: { name: string; attached: boolean; onClick: () => void }) {
  return <ExplorerRow name={name} kind="file" depth={0} attached={attached} onClick={onClick} />
}

function ExplorerRow({
  name,
  kind,
  depth,
  open,
  attached,
  onClick,
}: {
  name: string
  kind: 'file' | 'directory'
  depth: number
  open?: boolean
  attached?: boolean
  onClick: () => void
}) {
  const Icon = kind === 'directory' ? IconFolder : IconFile
  const Chevron = open ? IconChevronDown : IconChevronRight
  return (
    <UnstyledButton
      className={`project-explorer-row${attached ? ' is-attached' : ''}`}
      style={{ paddingLeft: 6 + depth * 8 }}
      onClick={onClick}
    >
      {kind === 'directory' ? (
        <Chevron size={11} stroke={2} className="project-explorer-chevron" />
      ) : (
        <span className="project-explorer-chevron-spacer" />
      )}
      <Icon size={14} stroke={1.5} className="project-explorer-glyph" />
      <span className="project-explorer-name">{name}</span>
    </UnstyledButton>
  )
}
