import { Flex, Text } from '@mantine/core'
import { IconChevronDown, IconServer, IconStarFilled } from '@tabler/icons-react'
import ProviderIcon from '../icons/ProviderIcon'
import { TRANSITION_DURATION } from './shared'

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

  // 根据是否是移动端决定样式
  const iconSize = isMobile ? 16 : 12
  const padding = isMobile ? 'py-xs px-xxs' : 'px-sm py-xs'
  const textColor = isMobile ? 'chatbox-tertiary' : 'chatbox-secondary'
  const textWeight = isMobile ? 600 : 500
  const iconClass = isMobile
    ? 'text-inherit'
    : isFavorite
      ? 'text-[var(--mantine-color-chatbox-tertiary-text)]'
      : provider.isCustom
        ? 'text-[var(--mantine-color-dimmed)]'
        : ''

  // Desktop 版本的容器样式
  const desktopContainerClass = `${isClickable ? 'cursor-pointer select-none hover:bg-[var(--mantine-color-gray-0)] dark:hover:bg-[var(--mantine-color-dark-7)]' : ''} ${padding} sticky top-0 z-10 bg-[var(--mantine-color-body)] ${className}`

  // Mobile 版本的容器样式
  const mobileContainerClass = `${padding} ${isMobile ? 'text-[var(--mantine-color-chatbox-tertiary-text)]' : ''} sticky top-0 z-10 bg-[var(--mantine-color-body)] ${className}`

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
        borderBottom: '1px solid var(--mantine-color-chatbox-border-primary-outline)',
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
          <span
            className="transition-transform"
            style={{
              transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0)',
              transitionDuration: `${TRANSITION_DURATION}ms`,
            }}
          >
            <IconChevronDown size={12} />
          </span>
        )}
        {isFavorite ? (
          <IconStarFilled size={iconSize} className={iconClass} />
        ) : provider.isCustom ? (
          <IconServer size={iconSize} className={iconClass} />
        ) : (
          <ProviderIcon size={iconSize} provider={provider.id} className={iconClass} />
        )}
        <Text c={textColor} size="sm" fw={textWeight}>
          {provider.name}
        </Text>
        {(showModelCount || isMobile) && modelCount !== undefined && (
          <Text c="dimmed" size="xs" ml="auto">
            {modelCount}
          </Text>
        )}
      </Flex>
    </div>
  )
}
