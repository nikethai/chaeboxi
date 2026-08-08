/**
 * Agent gallery card — avatar, name, description, actions.
 */

import { ActionIcon, Badge, Flex, Menu, Text, UnstyledButton } from '@mantine/core'
import type { CopilotDetail } from '@shared/types'
import {
  IconDots,
  IconPencil,
  IconPlayerPlay,
  IconStar,
  IconStarFilled,
  IconTrash,
} from '@tabler/icons-react'
import { type FC } from 'react'
import { useTranslation } from 'react-i18next'
import { AgentAvatar } from '@/components/agents/AgentAvatar'
import { ScalableIcon } from '@/components/common/ScalableIcon'
import { cn } from '@/lib/utils'

export type AgentCardProps = {
  detail: CopilotDetail
  mode: 'local' | 'remote'
  onUse(): void
  onEdit?(): void
  onStar?(): void
  onDelete?(): void
  canDelete?: boolean
}

export const AgentCard: FC<AgentCardProps> = ({
  detail,
  mode,
  onUse,
  onEdit,
  onStar,
  onDelete,
  canDelete,
}) => {
  const { t } = useTranslation()
  const blurb = detail.description || detail.prompt?.slice(0, 100) || ''

  return (
    <div
      className={cn(
        'group relative flex flex-col gap-3 p-3.5 rounded-[11px]',
        'bg-[var(--chatbox-background-secondary)]',
        'shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_8px_24px_rgba(0,0,0,0.18)]',
        'transition-[transform,box-shadow,background-color] duration-200',
        'hover:bg-[var(--chatbox-background-tertiary)]',
        'active:scale-[0.98]'
      )}
      style={{ border: '1px solid var(--chatbox-border-primary)' }}
    >
      <Flex align="flex-start" gap="sm" justify="space-between">
        <UnstyledButton
          onClick={onUse}
          className="flex items-start gap-3 min-w-0 flex-1 text-left rounded-[9px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--chatbox-tint-brand)]"
          aria-label={`${t('Use')} ${detail.name}`}
        >
          <AgentAvatar size={40} agent={detail} />
          <div className="min-w-0 flex-1">
            <Flex align="center" gap={6} wrap="wrap">
              <Text size="sm" fw={600} c="chatbox-primary" className="truncate max-w-full" style={{ textWrap: 'balance' }}>
                {detail.name}
              </Text>
              {detail.builtIn ? (
                <Badge size="xs" variant="light" color="chatbox-brand">
                  {t('Cast')}
                </Badge>
              ) : null}
              {mode === 'remote' ? (
                <Badge size="xs" variant="outline" color="gray">
                  {t('Community')}
                </Badge>
              ) : null}
            </Flex>
            {blurb ? (
              <Text size="xs" c="chatbox-tertiary" lineClamp={2} mt={4}>
                {blurb}
              </Text>
            ) : null}
            {detail.role || detail.stance ? (
              <Text size="xs" c="chatbox-tertiary" mt={6} className="tabular-nums">
                {[detail.role, detail.stance].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
          </div>
        </UnstyledButton>

        {mode === 'local' ? (
          <Menu withinPortal position="bottom-end" shadow="md">
            <Menu.Target>
              <ActionIcon
                variant="subtle"
                color="gray"
                size={36}
                radius="md"
                aria-label={t('Agent actions')}
                className="shrink-0 active:scale-[0.96] transition-transform"
                onClick={(e) => e.stopPropagation()}
              >
                {detail.starred ? (
                  <ScalableIcon icon={IconStarFilled} size={16} className="text-[var(--chatbox-tint-brand)]" />
                ) : (
                  <ScalableIcon icon={IconDots} size={16} />
                )}
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                leftSection={<ScalableIcon icon={IconPlayerPlay} size={14} />}
                onClick={onUse}
              >
                {t('Use in chat')}
              </Menu.Item>
              {onEdit ? (
                <Menu.Item leftSection={<ScalableIcon icon={IconPencil} size={14} />} onClick={onEdit}>
                  {t('Edit')}
                </Menu.Item>
              ) : null}
              {onStar ? (
                <Menu.Item
                  leftSection={
                    <ScalableIcon icon={detail.starred ? IconStar : IconStarFilled} size={14} />
                  }
                  onClick={onStar}
                >
                  {detail.starred ? t('unstar') : t('star')}
                </Menu.Item>
              ) : null}
              {canDelete && onDelete ? (
                <>
                  <Menu.Divider />
                  <Menu.Item color="red" leftSection={<ScalableIcon icon={IconTrash} size={14} />} onClick={onDelete}>
                    {t('Delete')}
                  </Menu.Item>
                </>
              ) : null}
            </Menu.Dropdown>
          </Menu>
        ) : (
          <ActionIcon
            variant="subtle"
            color="gray"
            size={36}
            radius="md"
            aria-label={t('Use in chat')}
            onClick={onUse}
            className="shrink-0 active:scale-[0.96] transition-transform"
          >
            <ScalableIcon icon={IconPlayerPlay} size={16} />
          </ActionIcon>
        )}
      </Flex>

      {mode === 'local' && onEdit ? (
        <Flex gap="xs" mt="auto">
          <UnstyledButton
            onClick={onEdit}
            className={cn(
              'flex-1 text-center text-xs font-medium py-2 rounded-[9px]',
              'bg-[var(--chatbox-background-primary)] text-[var(--chatbox-tint-secondary)]',
              'hover:text-[var(--chatbox-tint-primary)] active:scale-[0.96] transition-transform'
            )}
            style={{ border: '1px solid var(--chatbox-border-primary)', minHeight: 40 }}
          >
            {t('Edit')}
          </UnstyledButton>
          <UnstyledButton
            onClick={onUse}
            className={cn(
              'flex-1 text-center text-xs font-semibold py-2 rounded-[9px]',
              'bg-[var(--chatbox-background-brand-secondary)] text-[var(--chatbox-tint-brand)]',
              'active:scale-[0.96] transition-transform'
            )}
            style={{ minHeight: 40 }}
          >
            {t('Use')}
          </UnstyledButton>
        </Flex>
      ) : null}
    </div>
  )
}

export default AgentCard
