import { Flex, Tooltip, UnstyledButton } from '@mantine/core'
import { IconChevronLeft, IconX } from '@tabler/icons-react'
import type { FC, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

type ChromeIconButtonProps = {
  label: string
  onClick: () => void
  children: ReactNode
  className?: string
}

/** Shared settings header control — same surface, size, motion for back + close. */
const ChromeIconButton: FC<ChromeIconButtonProps> = ({ label, onClick, children, className }) => (
  <Tooltip label={label} withArrow position="bottom" openDelay={350}>
    <UnstyledButton
      type="button"
      className={`settings-chrome-btn controls${className ? ` ${className}` : ''}`}
      onClick={onClick}
      aria-label={label}
    >
      {children}
    </UnstyledButton>
  </Tooltip>
)

type SettingsBackButtonProps = {
  onClick: () => void
}

export const SettingsBackButton: FC<SettingsBackButtonProps> = ({ onClick }) => {
  const { t } = useTranslation()

  return (
    <ChromeIconButton label={t('Back')} onClick={onClick}>
      <IconChevronLeft size={18} stroke={1.75} className="settings-chrome-back-icon" />
    </ChromeIconButton>
  )
}

type SettingsCloseButtonProps = {
  onClick: () => void
  /** Desktop only: show esc as a non-interactive hint next to the same icon button. */
  showEscHint?: boolean
}

/**
 * Leave-settings control.
 * Same icon button as Back; optional esc kbd is a label sibling (not a nested control).
 */
export const SettingsCloseButton: FC<SettingsCloseButtonProps> = ({ onClick, showEscHint = true }) => {
  const { t } = useTranslation()
  const closeLabel = t('Close')

  return (
    <Flex align="center" gap={6} className="settings-chrome-actions controls">
      {showEscHint && (
        <kbd className="settings-chrome-kbd" title={t('Press Esc to close')}>
          esc
        </kbd>
      )}
      <ChromeIconButton label={`${closeLabel}${showEscHint ? ' (Esc)' : ''}`} onClick={onClick}>
        <IconX size={16} stroke={1.75} />
      </ChromeIconButton>
    </Flex>
  )
}
