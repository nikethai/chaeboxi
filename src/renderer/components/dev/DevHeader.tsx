import { ActionIcon, Group, Paper, Text, Tooltip } from '@mantine/core'
import { IconArrowLeft, IconBrightnessAuto, IconHome, IconMoon, IconSun } from '@tabler/icons-react'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { useAtom } from 'jotai'
import { Theme } from 'src/shared/types'
import * as atoms from '@/stores/atoms'

interface DevHeaderProps {
  title?: string
}

export function DevHeader({ title }: DevHeaderProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [theme, setTheme] = useAtom(atoms.themeAtom)

  const isDevIndex = location.pathname === '/dev' || location.pathname === '/dev/'

  const cycleTheme = () => {
    // Cycle through: Light -> Dark -> Light (skip Auto for simplicity in dev)
    if (theme === Theme.Light) {
      setTheme(Theme.Dark)
    } else {
      setTheme(Theme.Light)
    }
  }

  const getThemeIcon = () => {
    if (theme === Theme.Light) return <IconSun size={20} />
    if (theme === Theme.Dark) return <IconMoon size={20} />
    return <IconBrightnessAuto size={20} />
  }

  const getThemeLabel = () => {
    if (theme === Theme.Light) return 'Light mode (click for Dark)'
    if (theme === Theme.Dark) return 'Dark mode (click for Light)'
    return 'Auto mode'
  }

  return (
    <Paper
      p="md"
      shadow="sm"
      style={{
        borderBottom: '1px solid var(--mantine-color-default-border)',
        backgroundColor: 'var(--mantine-color-body)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      <Group justify="space-between">
        <Group gap="md">
          {/* Back button - show only if not on dev index */}
          {!isDevIndex && (
            <Tooltip label="Back to Dev Tools">
              <ActionIcon variant="subtle" size="lg" onClick={() => navigate({ to: '/dev' })}>
                <IconArrowLeft size={20} />
              </ActionIcon>
            </Tooltip>
          )}

          {/* Home button - always show */}
          <Tooltip label="Home">
            <ActionIcon variant="subtle" size="lg" onClick={() => navigate({ to: '/' })}>
              <IconHome size={20} />
            </ActionIcon>
          </Tooltip>

          {/* Page title */}
          {title && (
            <Text fw={600} size="lg">
              {title}
            </Text>
          )}
        </Group>

        <Group gap="xs">
          {/* Quick actions */}
          <Tooltip label={getThemeLabel()}>
            <ActionIcon variant="subtle" size="lg" onClick={cycleTheme}>
              {getThemeIcon()}
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
    </Paper>
  )
}

export default DevHeader
