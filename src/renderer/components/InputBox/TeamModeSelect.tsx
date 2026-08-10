/**
 * Compact Team mode control (Discuss | Work | Swarm) — same visual weight as model picker.
 * Only rendered when the room has 2+ agents.
 */

import { Menu, Text, Tooltip, UnstyledButton } from '@mantine/core'
import type { RoomMode } from '@shared/agent-room'
import { IconChevronRight, IconMessages, IconTool, IconUsersGroup } from '@tabler/icons-react'
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

const MODE_META: Record<
  RoomMode,
  { labelKey: string; hintKey: string; Icon: typeof IconMessages }
> = {
  discuss: {
    labelKey: 'Discuss',
    hintKey: 'Multi-round discussion',
    Icon: IconMessages,
  },
  work: {
    labelKey: 'Work',
    hintKey: 'Plan · do · review · deliver',
    Icon: IconTool,
  },
  swarm: {
    labelKey: 'Swarm',
    hintKey: 'Auto task assign · sequential execute',
    Icon: IconUsersGroup,
  },
}

function TeamModeSelect({ value, onChange, toolbarButtonClass, isSmallScreen, className }: TeamModeSelectProps) {
  const { t } = useTranslation()
  const current = MODE_META[value] ?? MODE_META.discuss
  const Icon = current.Icon
  const label = t(current.labelKey)
  const hint = t(current.hintKey)

  return (
    <Menu position="top-end" withinPortal shadow="md" width={260} transitionProps={{ transition: 'fade-up', duration: 160 }}>
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
        {(Object.keys(MODE_META) as RoomMode[]).map((mode) => {
          const meta = MODE_META[mode]
          const ModeIcon = meta.Icon
          const selected = value === mode
          return (
            <Menu.Item
              key={mode}
              leftSection={<ModeIcon size={15} stroke={1.6} />}
              onClick={() => onChange(mode)}
              rightSection={
                selected ? (
                  <Text size="xs" c="chatbox-brand" fw={600}>
                    ✓
                  </Text>
                ) : undefined
              }
            >
              <div className="min-w-0">
                <Text size="sm" fw={500}>
                  {t(meta.labelKey)}
                </Text>
                <Text size="xs" c="dimmed" lineClamp={2}>
                  {t(meta.hintKey)}
                </Text>
              </div>
            </Menu.Item>
          )
        })}
      </Menu.Dropdown>
    </Menu>
  )
}

export default memo(TeamModeSelect)
