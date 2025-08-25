import { Button, Flex, Group, Menu, Switch } from '@mantine/core'
import { IconSettings2 } from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'
import type { FC, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useMCPServerStatus, useToggleMCPServer } from '@/hooks/mcp'
import { BUILTIN_MCP_SERVERS } from '@/packages/mcp/builtin'
import { useAutoValidate } from '@/stores/premiumActions'
import { useMcpSettings } from '@/stores/settingsStore'
import MCPStatus from './MCPStatus'

interface ServerItem {
  id: string
  name: string
  enabled: boolean
}

const ServerItem: FC<{
  item: ServerItem
  onEnabledChange: (id: string, enabled: boolean) => void
}> = ({ item, onEnabledChange }) => {
  const status = useMCPServerStatus(item.id)
  return (
    <Menu.Item
      c="chatbox-primary"
      leftSection={<MCPStatus status={status} />}
      rightSection={
        <Switch
          checked={item.enabled}
          size="xs"
          disabled={status?.state === 'starting' || status?.state === 'stopping'}
          onChange={(e) => onEnabledChange(item.id, e.currentTarget.checked)}
        />
      }
    >
      {item.name}
    </Menu.Item>
  )
}

const MCPMenu: FC<{ children: (enabledTools: number) => ReactNode }> = ({ children }) => {
  const { t } = useTranslation()
  const mcp = useMcpSettings()
  const isPremium = useAutoValidate()
  const onEnabledChange = useToggleMCPServer()
  const enabledToolsCount = mcp.servers.filter((s) => s.enabled).length + mcp.enabledBuiltinServers.length
  return (
    <Menu
      trigger="hover"
      openDelay={100}
      closeDelay={100}
      shadow="md"
      withArrow
      width={240}
      closeOnItemClick={false}
      position="top-start"
      transitionProps={{
        transition: 'pop',
        duration: 200,
      }}
    >
      <Menu.Target>{children(enabledToolsCount)}</Menu.Target>
      <Menu.Dropdown>
        <Flex justify="space-between">
          <Menu.Label fw={600}>MCP</Menu.Label>
          <Menu.Label>
            <Link to="/settings/mcp">
              <IconSettings2 size={16} color="var(--mantine-color-chatbox-tertiary-text)" />
            </Link>
          </Menu.Label>
        </Flex>
        {isPremium && (
          <>
            {BUILTIN_MCP_SERVERS.map((server) => (
              <ServerItem
                key={server.id}
                item={{
                  id: server.id,
                  name: server.name,
                  enabled: mcp.enabledBuiltinServers.includes(server.id),
                }}
                onEnabledChange={onEnabledChange}
              />
            ))}
            <Menu.Divider />
          </>
        )}
        {mcp.servers.map((server) => (
          <ServerItem key={server.id} item={server} onEnabledChange={onEnabledChange} />
        ))}
        {!mcp.servers.length && !mcp.enabledBuiltinServers.length && (
          <Group justify="center">
            <Link to="/settings/mcp">
              <Button size="xs" my={12} variant="outline">
                {t('Add your first MCP server')}
              </Button>
            </Link>
          </Group>
        )}
      </Menu.Dropdown>
    </Menu>
  )
}

export default MCPMenu
