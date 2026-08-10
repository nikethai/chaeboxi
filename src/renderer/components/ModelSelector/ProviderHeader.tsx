import { Flex, Text } from '@mantine/core'
import { IconChevronDown, IconServer, IconStarFilled } from '@tabler/icons-react'
import clsx from 'clsx'
import Divider from '../common/Divider'
import ProviderIcon from '../icons/ProviderIcon'
import { ScalableIcon } from '../common/ScalableIcon'

interface ProviderHeaderProps {
  provider: {
    id: string
    name: string
    isCustom?: boolean
  }
  modelCount?: number
  isCollapsed?: boolean
  showChevron?: boolean
  showModelCount?: boolean
  onClick?: () => void
  variant?: 'default' | 'favorite' | 'mobile' | 'mobile-favorite'
  className?: string
  style?: React.CSSProperties
}

export const ProviderHeader = ({
  provider,
  modelCount,
  isCollapsed = false,
  showChevron = true,
  showModelCount = true,
  onClick,
  variant = 'default',
  className = '',
  style,
}: ProviderHeaderProps) => {
  const isClickable = !!onClick
  const isFavorite = variant === 'favorite' || variant === 'mobile-favorite'
  const isMobile = variant === 'mobile' || variant === 'mobile-favorite'

  // (legacy comment removed)
  const iconSize = isMobile ? 16 : 12
  const padding = isMobile ? 'py-xs pb-0 px-xxs' : 'px-sm py-xs'
  const textColor = isMobile ? 'chatbox-tertiary' : 'chatbox-secondary'
  const textWeight = isMobile ? 600 : 500
  const iconClass = isMobile
    ? 'text-inherit'
    : isFavorite
      ? 'text-chatbox-tint-tertiary'
      : provider.isCustom
        ? 'text-chatbox-tint-gray'
        : ''

  // Sticky + opaque surface lives in CSS (.model-picker-provider) so scroll never clips brand through names
  const desktopContainerClass = clsx(
    'model-picker-provider',
    isClickable && 'cursor-pointer select-none',
    className
  )

  const mobileContainerClass = clsx(
    padding,
    'model-picker-provider',
    isMobile && 'text-chatbox-tint-tertiary',
    className
  )

  const containerClass = isMobile ? mobileContainerClass : desktopContainerClass

  const handleClick = onClick
    ? (e: React.MouseEvent | React.KeyboardEvent) => {
        e.preventDefault()
        e.stopPropagation()
        onClick()
      }
    : undefined

  const handleKeyDown = isClickable
    ? (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          e.stopPropagation()
          onClick()
        }
      }
    : undefined

  return (
    <div
      className={containerClass}
      style={{
        userSelect: isClickable && !isMobile ? 'none' : undefined,
        ...style,
      }}
      onClick={!isMobile ? handleClick : undefined}
      onKeyDown={!isMobile ? handleKeyDown : undefined}
      role={isClickable && !isMobile ? 'button' : undefined}
      aria-expanded={isClickable && !isMobile && showChevron ? !isCollapsed : undefined}
      tabIndex={isClickable && !isMobile ? 0 : undefined}
    >
      <Flex
        align="center"
        gap="xs"
        className={isMobile && onClick ? 'cursor-pointer select-none' : ''}
        onClick={isMobile ? handleClick : undefined}
        onKeyDown={isMobile ? handleKeyDown : undefined}
        role={isClickable && isMobile ? 'button' : undefined}
        aria-expanded={isClickable && isMobile && showChevron ? !isCollapsed : undefined}
        tabIndex={isClickable && isMobile ? 0 : undefined}
      >
        {showChevron && !isFavorite && (
          <ScalableIcon
            icon={IconChevronDown}
            size={11}
            className={clsx(
              'transition-transform text-[var(--chatbox-tint-tertiary)]',
              isCollapsed ? '-rotate-90' : ''
            )}
          />
        )}
        {isFavorite ? (
          <ScalableIcon icon={IconStarFilled} size={iconSize} className={iconClass} />
        ) : provider.isCustom ? (
          <ScalableIcon icon={IconServer} size={iconSize} className={iconClass} />
        ) : (
          <ScalableIcon icon={ProviderIcon} size={iconSize} provider={provider.id} className={iconClass} />
        )}
        <Text
          span
          c={isMobile ? textColor : 'chatbox-tertiary'}
          size="xs"
          fw={isMobile ? textWeight : 600}
          className={!isMobile ? 'model-picker-provider-name' : undefined}
        >
          {provider.name}
        </Text>
        {showModelCount && !isMobile && modelCount !== undefined && modelCount > 0 && (
          <Text span c="dimmed" size="xs" ml="auto" className="model-picker-provider-count tabular-nums">
            {modelCount}
          </Text>
        )}
      </Flex>

      {isMobile && <Divider className="mt-xs" />}
    </div>
  )
}
