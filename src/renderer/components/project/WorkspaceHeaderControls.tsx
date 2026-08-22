import { ActionIcon, Tooltip } from '@mantine/core'
import type { Session } from '@shared/types'
import { IconFolder, IconFolderOpen, IconFolderPlus } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { useProjectWorkspace } from '@/hooks/useProjectWorkspace'
import platform, { platformCapabilities } from '@/platform'
import * as toastActions from '@/stores/toastActions'

function folderLabel(displayPath?: string) {
  if (!displayPath) return ''
  const parts = displayPath.replace(/\\/g, '/').split('/').filter(Boolean)
  return parts.slice(-2).join('/') || displayPath
}

export function WorkspaceHeaderControls({ session }: { session: Session }) {
  const { t } = useTranslation()
  const { projectId, descriptor, setDescriptor } = useProjectWorkspace(session)

  if (!platformCapabilities.supportsProjectWorkspace || !projectId) return null

  const bound = descriptor?.status === 'ready' && Boolean(descriptor.capabilityId)
  const label = bound ? folderLabel(descriptor?.displayPath) : null

  const openFolder = async () => {
    if (!platform.pickAndBindProject) {
      toastActions.add(t('Could not open folder'))
      return
    }
    try {
      const next = await platform.pickAndBindProject(projectId)
      if (next) setDescriptor(next)
    } catch {
      toastActions.add(t('Could not open folder'))
    }
  }

  const reveal = () => {
    if (!projectId) return
    void platform.revealProject?.(projectId)
  }

  return (
    <div className="workspace-header-controls controls">
      {bound && label ? (
        <button type="button" className="workspace-header-chip" title={descriptor?.displayPath} onClick={reveal}>
          <IconFolder size={13} stroke={1.7} />
          <span className="workspace-header-chip-label">{label}</span>
        </button>
      ) : null}
      <Tooltip label={t('Open Folder')} position="bottom">
        <ActionIcon
          className="active:scale-[0.96] transition-transform"
          variant="subtle"
          color="chatbox-tertiary"
          size={22}
          onClick={() => void openFolder()}
          aria-label={t('Open Folder')}
        >
          {bound ? <IconFolder size={15} stroke={1.7} /> : <IconFolderPlus size={15} stroke={1.7} />}
        </ActionIcon>
      </Tooltip>
      {bound ? (
        <Tooltip label={t('Reveal in Finder')} position="bottom">
          <ActionIcon
            className="active:scale-[0.96] transition-transform"
            variant="subtle"
            color="chatbox-tertiary"
            size={22}
            onClick={reveal}
            aria-label={t('Reveal in Finder')}
          >
            <IconFolderOpen size={15} stroke={1.7} />
          </ActionIcon>
        </Tooltip>
      ) : null}
    </div>
  )
}
