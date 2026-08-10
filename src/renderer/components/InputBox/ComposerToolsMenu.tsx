/**
 * Composer overflow — single + control for attach, tools, mode, session actions.
 * Click-primary (no hover-only). Model auto-uses tools; this is override + progressive disclosure.
 */

import { ActionIcon, Button, Flex, Menu, Modal, Switch, Text, TextInput, UnstyledButton } from '@mantine/core'
import type { KnowledgeBase } from '@shared/types'
import {
  IconAdjustmentsHorizontal,
  IconArrowBackUp,
  IconCheck,
  IconFile,
  IconFilePencil,
  IconFolder,
  IconLink,
  IconPhoto,
  IconPlus,
  IconRobot,
  IconSettings2,
  IconVocabulary,
  IconWorldWww,
  IconX,
} from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'
import { type FC, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useKnowledgeBases } from '@/hooks/knowledge-base'
import { useMCPServerStatus, useToggleMCPServer } from '@/hooks/mcp'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import { cn } from '@/lib/utils'
import { navigateToSettings } from '@/modals/Settings'
import { BUILTIN_MCP_SERVERS } from '@/packages/mcp/builtin'
import { useMcpSettings } from '@/stores/settingsStore'
import { featureFlags } from '@/utils/feature-flags'
import { platformCapabilities } from '@/platform'
import { ScalableIcon } from '../common/ScalableIcon'
import MCPStatus from '../mcp/MCPStatus'

export type ComposerToolsMenuProps = {
  isOpenClawModel: boolean
  sessionType: string
  webBrowsingMode: boolean
  webSearchConfigured: boolean
  onWebBrowsingChange: (enabled: boolean) => void
  agentMode: boolean
  onToggleAgentMode?: () => void
  /** Absolute workspace path for agent file/terminal tools (desktop). */
  workspaceRoot?: string
  onWorkspaceRootChange?: (workspaceRoot: string | undefined) => void
  knowledgeBaseId?: number
  onSelectKnowledgeBase?: (kb: KnowledgeBase | null) => void
  showRollbackThreadButton: boolean
  onStartNewThread?: () => void
  onRollbackThread?: () => void
  onClickSessionSettings?: () => void
  onImageUploadClick: () => void
  onFileUploadClick: () => void
  onAttachLink: () => void
  toolbarButtonClass: string
  toolbarIconSize: number
}

const ComposerToolsMenu: FC<ComposerToolsMenuProps> = ({
  isOpenClawModel,
  sessionType,
  webBrowsingMode,
  webSearchConfigured,
  onWebBrowsingChange,
  agentMode,
  onToggleAgentMode,
  workspaceRoot,
  onWorkspaceRootChange,
  knowledgeBaseId,
  onSelectKnowledgeBase,
  showRollbackThreadButton,
  onStartNewThread,
  onRollbackThread,
  onClickSessionSettings,
  onImageUploadClick,
  onFileUploadClick,
  onAttachLink,
  toolbarButtonClass,
  toolbarIconSize,
}) => {
  const { t } = useTranslation()
  const isSmallScreen = useIsSmallScreen()
  const [opened, setOpened] = useState(false)
  const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false)
  const [workspaceDraft, setWorkspaceDraft] = useState(workspaceRoot ?? '')
  const mcp = useMcpSettings()
  const onMcpEnabledChange = useToggleMCPServer()
  const { data: knowledgeBases } = useKnowledgeBases()

  const mcpServers = mcp.servers.filter((server) => platformCapabilities.supportsMcpStdio || server.transport.type !== 'stdio')
  const mcpEnabledCount = mcpServers.filter((server) => server.enabled).length + mcp.enabledBuiltinServers.length
  const showMcp = featureFlags.mcp && !isOpenClawModel
  const showKb = featureFlags.knowledgeBase && !isOpenClawModel
  const showWeb = !isOpenClawModel
  const showAgent =
    sessionType === 'chat' && !isOpenClawModel && platformCapabilities.supportsDesktopOnlySettings && Boolean(onToggleAgentMode)
  // Desktop Tauri builds use CHATBOX_BUILD_PLATFORM=unknown; web/android cannot write FS.
  const showWorkspace =
    showAgent && Boolean(onWorkspaceRootChange)

  useEffect(() => {
    if (workspaceModalOpen) {
      setWorkspaceDraft(workspaceRoot ?? '')
    }
  }, [workspaceModalOpen, workspaceRoot])

  const badgeActive = useMemo(() => {
    return (
      (!webBrowsingMode && webSearchConfigured) ||
      agentMode ||
      Boolean(workspaceRoot) ||
      Boolean(knowledgeBaseId) ||
      (showMcp && mcpEnabledCount > 0)
    )
  }, [webBrowsingMode, webSearchConfigured, agentMode, workspaceRoot, knowledgeBaseId, showMcp, mcpEnabledCount])

  const workspaceLabel = useMemo(() => {
    if (!workspaceRoot) return null
    const parts = workspaceRoot.replace(/\\/g, '/').split('/').filter(Boolean)
    return parts.at(-1) || workspaceRoot
  }, [workspaceRoot])

  const saveWorkspace = () => {
    const next = workspaceDraft.trim()
    onWorkspaceRootChange?.(next || undefined)
    setWorkspaceModalOpen(false)
    setOpened(false)
  }

  return (
    <>
      <Menu
        opened={opened}
        onChange={setOpened}
        trigger="click"
        position="top-start"
        shadow="md"
        width={280}
        closeOnItemClick={false}
        transitionProps={{ transition: 'pop', duration: 160 }}
      >
        <Menu.Target>
          <UnstyledButton
            className={cn(toolbarButtonClass, 'relative min-w-9 min-h-9 active:scale-[0.96] transition-transform', isSmallScreen && 'mobile-touch-target')}
            aria-label={t('Tools and attachments')}
            aria-expanded={opened}
          >
            <IconPlus
              size={toolbarIconSize}
              strokeWidth={1.8}
              className={badgeActive ? 'text-[var(--chatbox-tint-brand)]' : 'text-[var(--chatbox-tint-secondary)]'}
            />
            {badgeActive && (
              <span
                className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-[var(--chatbox-tint-brand)]"
                aria-hidden
              />
            )}
          </UnstyledButton>
        </Menu.Target>

        <Menu.Dropdown className="composer-tools-menu">
          <Menu.Label fw={600}>{t('Attach')}</Menu.Label>
          <Menu.Item
            leftSection={<IconPhoto size={16} stroke={1.5} />}
            onClick={() => {
              onImageUploadClick()
              setOpened(false)
            }}
          >
            {t('Image')}
          </Menu.Item>
          <Menu.Item
            leftSection={<IconFolder size={16} stroke={1.5} />}
            onClick={() => {
              onFileUploadClick()
              setOpened(false)
            }}
          >
            {t('File')}
          </Menu.Item>
          <Menu.Item
            leftSection={<IconLink size={16} stroke={1.5} />}
            onClick={() => {
              onAttachLink()
              setOpened(false)
            }}
          >
            {t('Link')}
          </Menu.Item>

          {(showWeb || showMcp || showKb) && (
            <>
              <Menu.Divider />
              <Menu.Label fw={600}>{t('Tools')}</Menu.Label>
            </>
          )}

          {showWeb && (
            <Menu.Item
              leftSection={<IconWorldWww size={16} stroke={1.5} />}
              closeMenuOnClick={false}
              disabled={!webSearchConfigured && !webBrowsingMode}
              rightSection={
                <Switch
                  size="xs"
                  checked={webBrowsingMode}
                  disabled={!webSearchConfigured && !webBrowsingMode}
                  onChange={(e) => onWebBrowsingChange(e.currentTarget.checked)}
                  onClick={(e) => e.stopPropagation()}
                />
              }
              onClick={() => {
                if (webSearchConfigured || webBrowsingMode) {
                  onWebBrowsingChange(!webBrowsingMode)
                }
              }}
            >
              <Flex direction="column" gap={2}>
                <Text size="sm">{t('Web Search')}</Text>
                {!webSearchConfigured && (
                  <Text size="xs" c="dimmed">
                    {t('Configure in Settings')}
                  </Text>
                )}
              </Flex>
            </Menu.Item>
          )}

          {showMcp && (
            <>
              <Flex justify="space-between" align="center" px="sm" pt="xs">
                <Text size="xs" fw={600} c="dimmed" style={{ letterSpacing: '-0.01em' }}>
                  {t('Extensions')}
                  {mcpEnabledCount > 0 ? ` · ${mcpEnabledCount}` : ''}
                </Text>
                <ActionIcon
                  variant="subtle"
                  size={22}
                  onClick={() => {
                    setOpened(false)
                    navigateToSettings('/mcp')
                  }}
                  aria-label={t('Extension settings')}
                >
                  <ScalableIcon icon={IconSettings2} size={14} color="var(--chatbox-tint-tertiary)" />
                </ActionIcon>
              </Flex>
              {BUILTIN_MCP_SERVERS.map((server) => (
                <McpServerRow
                  key={server.id}
                  id={server.id}
                  name={server.name}
                  enabled={mcp.enabledBuiltinServers.includes(server.id)}
                  onEnabledChange={onMcpEnabledChange}
                />
              ))}
              {mcpServers.map((server) => (
                <McpServerRow
                  key={server.id}
                  id={server.id}
                  name={server.name}
                  enabled={server.enabled}
                  onEnabledChange={onMcpEnabledChange}
                />
              ))}
              {!mcpServers.length && !mcp.enabledBuiltinServers.length && (
                <Menu.Item component={Link} to="/settings/mcp" onClick={() => setOpened(false)}>
                  {t('Connect an extension')}
                </Menu.Item>
              )}
            </>
          )}

          {showKb && (
            <>
              <Flex justify="space-between" align="center" px="sm" pt="xs">
                <Text size="xs" fw={600} c="dimmed" style={{ letterSpacing: '-0.01em' }}>
                  {t('Knowledge')}
                </Text>
                <ActionIcon
                  variant="subtle"
                  size={22}
                  component={Link}
                  to="/settings/knowledge-base"
                  onClick={() => setOpened(false)}
                  aria-label={t('Knowledge Base Settings')}
                >
                  <ScalableIcon icon={IconVocabulary} size={14} color="var(--chatbox-tint-tertiary)" />
                </ActionIcon>
              </Flex>
              {knowledgeBases?.map((kb) => (
                <Menu.Item
                  key={kb.id}
                  leftSection={<IconFile size={14} stroke={1.5} />}
                  rightSection={
                    kb.id === knowledgeBaseId ? <IconCheck size={14} color="var(--chatbox-tint-brand)" /> : null
                  }
                  onClick={() => {
                    if (kb.id === knowledgeBaseId) {
                      onSelectKnowledgeBase?.(null)
                    } else {
                      onSelectKnowledgeBase?.(kb)
                    }
                  }}
                >
                  <Text size="sm" c={kb.id === knowledgeBaseId ? 'chatbox-brand' : undefined}>
                    {kb.name}
                  </Text>
                </Menu.Item>
              ))}
              {knowledgeBases?.length === 0 && (
                <Menu.Item component={Link} to="/settings/knowledge-base" onClick={() => setOpened(false)}>
                  {t('Create')}
                </Menu.Item>
              )}
              {knowledgeBaseId != null && (
                <Menu.Item onClick={() => onSelectKnowledgeBase?.(null)}>{t('Clear selection')}</Menu.Item>
              )}
            </>
          )}

          {showAgent && (
            <>
              <Menu.Divider />
              <Menu.Label fw={600}>{t('Mode')}</Menu.Label>
              <Menu.Item
                leftSection={<IconRobot size={16} stroke={1.5} />}
                closeMenuOnClick={false}
                rightSection={
                  <Switch
                    size="xs"
                    checked={agentMode}
                    onChange={() => onToggleAgentMode?.()}
                    onClick={(e) => e.stopPropagation()}
                  />
                }
                onClick={() => onToggleAgentMode?.()}
              >
                <Flex direction="column" gap={2}>
                  <Text size="sm">{t('Agent Mode')}</Text>
                  <Text size="xs" c="dimmed" style={{ lineHeight: 1.3 }}>
                    {t('Use tools and work in steps')}
                  </Text>
                </Flex>
              </Menu.Item>
              {showWorkspace && (
                <Menu.Item
                  leftSection={<IconFolder size={16} stroke={1.5} />}
                  rightSection={
                    workspaceRoot ? (
                      <ActionIcon
                        size={18}
                        variant="subtle"
                        aria-label={t('Clear project folder')}
                        onClick={(e) => {
                          e.stopPropagation()
                          onWorkspaceRootChange?.(undefined)
                        }}
                      >
                        <IconX size={12} />
                      </ActionIcon>
                    ) : null
                  }
                  onClick={() => {
                    setWorkspaceModalOpen(true)
                  }}
                >
                  <Flex direction="column" gap={2}>
                    <Text size="sm">{t('Project folder')}</Text>
                    <Text size="xs" c="dimmed" style={{ lineHeight: 1.3 }} lineClamp={1}>
                      {workspaceLabel ? workspaceLabel : t('Where the AI can read and edit files')}
                    </Text>
                  </Flex>
                </Menu.Item>
              )}
            </>
          )}

          <Menu.Divider />
          <Menu.Label fw={600}>{t('Chat')}</Menu.Label>
          {showRollbackThreadButton ? (
            <Menu.Item
              leftSection={<IconArrowBackUp size={16} stroke={1.5} />}
              onClick={() => {
                onRollbackThread?.()
                setOpened(false)
              }}
            >
              {t('Undo last reply')}
            </Menu.Item>
          ) : (
            <Menu.Item
              leftSection={<IconFilePencil size={16} stroke={1.5} />}
              disabled={!onStartNewThread}
              onClick={() => {
                onStartNewThread?.()
                setOpened(false)
              }}
            >
              {t('New Thread')}
            </Menu.Item>
          )}
          <Menu.Item
            leftSection={<IconAdjustmentsHorizontal size={16} stroke={1.5} />}
            disabled={!onClickSessionSettings}
            onClick={() => {
              onClickSessionSettings?.()
              setOpened(false)
            }}
          >
            {t('Chat settings')}
          </Menu.Item>

          {isSmallScreen && null}
        </Menu.Dropdown>
      </Menu>

      <Modal
        opened={workspaceModalOpen}
        onClose={() => setWorkspaceModalOpen(false)}
        title={t('Project folder')}
        centered
        size="md"
      >
        <Flex direction="column" gap="sm">
          <Text size="sm" c="dimmed">
            {t(
              'The AI can only read and edit files inside this folder. Paste the full path (for example /Users/you/projects/my-app).'
            )}
          </Text>
          <TextInput
            label={t('Folder path')}
            placeholder="/Users/you/projects/my-app"
            value={workspaceDraft}
            onChange={(e) => setWorkspaceDraft(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                saveWorkspace()
              }
            }}
            data-autofocus
          />
          <Flex justify="flex-end" gap="xs" mt="xs">
            <Button variant="default" onClick={() => setWorkspaceModalOpen(false)}>
              {t('Cancel')}
            </Button>
            <Button onClick={saveWorkspace}>{t('Save')}</Button>
          </Flex>
        </Flex>
      </Modal>
    </>
  )
}

const McpServerRow: FC<{
  id: string
  name: string
  enabled: boolean
  onEnabledChange: (id: string, enabled: boolean) => void
}> = ({ id, name, enabled, onEnabledChange }) => {
  const status = useMCPServerStatus(id)
  return (
    <Menu.Item
      closeMenuOnClick={false}
      leftSection={<MCPStatus status={status} />}
      rightSection={
        <Switch
          size="xs"
          checked={enabled}
          disabled={status?.state === 'starting' || status?.state === 'stopping'}
          onChange={(e) => onEnabledChange(id, e.currentTarget.checked)}
          onClick={(e) => e.stopPropagation()}
        />
      }
      onClick={() => {
        if (status?.state !== 'starting' && status?.state !== 'stopping') {
          onEnabledChange(id, !enabled)
        }
      }}
    >
      {name}
    </Menu.Item>
  )
}

export default ComposerToolsMenu
