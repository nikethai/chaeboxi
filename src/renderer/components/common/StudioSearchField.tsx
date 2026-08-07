import { ActionIcon, TextInput, type TextInputProps } from '@mantine/core'
import { IconSearch, IconX } from '@tabler/icons-react'
import { type FC, useId } from 'react'
import { cn } from '@/lib/utils'
import { ScalableIcon } from './ScalableIcon'

export type StudioSearchFieldProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  /** Accessible name when placeholder is the only visible hint */
  'aria-label'?: string
  size?: 'sm' | 'md'
  autoFocus?: boolean
} & Omit<TextInputProps, 'value' | 'onChange' | 'size' | 'leftSection' | 'rightSection'>

/**
 * Shared search field DNA for model picker, session search, and similar surfaces.
 * Soft fill + focus ring; clear control when non-empty.
 */
export const StudioSearchField: FC<StudioSearchFieldProps> = ({
  value,
  onChange,
  placeholder,
  className,
  size = 'md',
  autoFocus,
  'aria-label': ariaLabel,
  ...rest
}) => {
  const id = useId()
  const height = size === 'sm' ? 34 : 38
  const iconSize = size === 'sm' ? 14 : 16

  return (
    <TextInput
      id={id}
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      placeholder={placeholder}
      aria-label={ariaLabel || placeholder}
      autoFocus={autoFocus}
      className={cn('studio-search-field', className)}
      leftSection={<ScalableIcon icon={IconSearch} size={iconSize} className="text-[var(--chatbox-tint-tertiary)]" />}
      rightSection={
        value ? (
          <ActionIcon
            size={28}
            radius="sm"
            variant="subtle"
            color="chatbox-tertiary"
            className="active:scale-[0.96] transition-transform"
            onClick={() => onChange('')}
            aria-label="Clear search"
          >
            <IconX size={14} stroke={1.5} />
          </ActionIcon>
        ) : null
      }
      rightSectionPointerEvents="all"
      styles={{
        input: {
          height,
          minHeight: height,
          borderRadius: size === 'sm' ? 7 : 9,
          fontSize: size === 'sm' ? '0.8125rem' : '0.875rem',
          background: 'var(--chatbox-background-primary)',
          border: '1px solid color-mix(in srgb, var(--chatbox-tint-primary) 12%, transparent)',
          boxShadow: 'none',
          transition:
            'border-color 140ms cubic-bezier(0.2, 0, 0, 1), box-shadow 140ms cubic-bezier(0.2, 0, 0, 1), background-color 140ms cubic-bezier(0.2, 0, 0, 1)',
        },
      }}
      {...rest}
    />
  )
}

export default StudioSearchField
