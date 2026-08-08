/**
 * Compact Team mode control (Discuss | Work) — same visual weight as model picker.
 * Only rendered when the room has 2+ agents.
 */

import { Menu, Text, Tooltip, UnstyledButton } from '@mantine/core'
import type { RoomMode } from '@shared/agent-room'
import { IconChevronRight, IconMessages, IconTool } from '@tabler/icons-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

export interface TeamModeSelectProps {
  value: RoomMode
  onChange(mode: RoomMode): void
  toolbarButtonClass: string
  isSmallScreen?: boolean
  className?: string
}

function TeamModeSelect({ value, onChange, toolbarButtonClass, isSmallScreen, className }: TeamModeSelectProps) {
  const { t } = useTranslation()
  const isWork = value === 'work'
  const label = isWork ? t('Work') : t('Discuss')
  const Icon = isWork ? IconTool : IconMessages
  const hint = isWork ? t('Plan · do · review · deliver') : t('Multi-round discussion')

  return (
    <Menu position="top-end" withinPortal shadow="md" width={240} transitionProps={{ transition: 'fade-up', duration: 160 }}>
      <Menu.Target>
        <Tooltip label={`${t('Team mode')}: ${hint}`} withArrow position="top" openDelay={400}>
          <UnstyledButton
            className={cn(toolbarButtonClass, 'team-mode-trigger', isSmallScreen && 'px-2.5', className)}
            aria-label={t('Team mode')}
          >
            <Icon size={14} stroke={1.75} className="text-[var(--chatbox-tint-secondary)] shrink-0 opacity-90" />
            <Text
              size="xs"
              className={cn(
                'text-[var(--chatbox-tint-secondary)] truncate font-[family-name:var(--chatbox-font-mono)] tabular-nums',
                isSmallScreen ? 'max-w-[72px]' : 'max-w-[88px]'
              )}
              style={{ fontSize: '0.75rem', fontWeight: 500, letterSpacing: '-0.01em' }}
            >
              {label}
            </Text>
            <IconChevronRight
              size={11}
              stroke={1.75}
              className="text-[var(--chatbox-tint-tertiary)] flex-shrink-0 opacity-75"
              style={{ transform: 'translateY(0.5px) rotate(90deg)' }}
            />
          </UnstyledButton>
        </Tooltip>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>{t('Team mode')}</Menu.Label>
        <Menu.Item
          leftSection={<IconMessages size={15} stroke={1.6} />}
          onClick={() => onChange('discuss')}
          rightSection={
            !isWork ? (
              <Text size="xs" c="chatbox-brand" fw={600}>
                ✓
              </Text>
            ) : undefined
          }
        >
          <div className="min-w-0">
            <Text size="sm" fw={500}>
              {t('Discuss')}
            </Text>
            <Text size="xs" c="dimmed" lineClamp={2}>
              {t('Multi-round discussion')}
            </Text>
          </div>
        </Menu.Item>
        <Menu.Item
          leftSection={<IconTool size={15} stroke={1.6} />}
          onClick={() => onChange('work')}
          rightSection={
            isWork ? (
              <Text size="xs" c="chatbox-brand" fw={600}>
                ✓
              </Text>
            ) : undefined
          }
        >
          <div className="min-w-0">
            <Text size="sm" fw={500}>
              {t('Work')}
            </Text>
            <Text size="xs" c="dimmed" lineClamp={2}>
              {t('Plan · do · review · deliver')}
            </Text>
          </div>
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  )
}

export default memo(TeamModeSelect)
