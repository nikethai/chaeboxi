import {
  ActionIcon,
  Avatar,
  Button,
  Checkbox,
  Combobox,
  colorsTuple,
  createTheme,
  type DefaultMantineColor,
  Drawer,
  Input,
  type MantineColorsTuple,
  Modal,
  NativeSelect,
  Popover,
  rem,
  Select,
  Slider,
  Switch,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core'

const ON_BRAND = 'var(--chatbox-tint-on-brand)'

/** Mantine's default variant is `filled`; the default colour is the primary colour (`chatbox-brand`). */
const isFilledBrand = (props: { variant?: string; color?: unknown }) =>
  (props.variant === undefined || props.variant === 'filled') &&
  (props.color === undefined || props.color === 'chatbox-brand')

export const createDangoMantineTheme = (scale = 1) =>
  createTheme({
    /** Dango shell — system UI font, tight radii, green brand; all colours/fonts via CSS tokens */
    scale,
    fontFamily: 'var(--chatbox-font-ui)',
    fontFamilyMonospace: 'var(--chatbox-font-mono)',
    primaryColor: 'chatbox-brand',
    defaultRadius: 'md',
    colors: {
      'chatbox-brand': colorsTuple(Array.from({ length: 10 }, () => 'var(--chatbox-tint-brand)')),
      'chatbox-gray': colorsTuple(Array.from({ length: 10 }, () => 'var(--chatbox-tint-gray)')),
      'chatbox-success': colorsTuple(Array.from({ length: 10 }, () => 'var(--chatbox-tint-success)')),
      'chatbox-error': colorsTuple(Array.from({ length: 10 }, () => 'var(--chatbox-tint-error)')),
      'chatbox-warning': colorsTuple(Array.from({ length: 10 }, () => 'var(--chatbox-tint-warning)')),

      'chatbox-primary': colorsTuple(Array.from({ length: 10 }, () => 'var(--chatbox-tint-primary)')),
      'chatbox-secondary': colorsTuple(Array.from({ length: 10 }, () => 'var(--chatbox-tint-secondary)')),
      'chatbox-tertiary': colorsTuple(Array.from({ length: 10 }, () => 'var(--chatbox-tint-tertiary)')),
    },
    headings: {
      fontFamily: 'var(--chatbox-font-ui)',
      fontWeight: '600',
      sizes: {
        h1: {
          fontSize: 'calc(2.5rem * var(--mantine-scale))', // 40px
          lineHeight: '1.2', // 48px
        },
        h2: {
          fontSize: 'calc(2rem * var(--mantine-scale))', // 32px
          lineHeight: '1.25', //  40px
        },
        h3: {
          fontSize: 'calc(1.5rem * var(--mantine-scale))', // 24px
          lineHeight: '1.3333333333', // 32px
        },
        h4: {
          fontSize: 'calc(1.125rem * var(--mantine-scale))', // 18px
          lineHeight: '1.3333333333', // 24px
        },
        h5: {
          fontSize: 'calc(1rem * var(--mantine-scale))', // 16px
          lineHeight: '1.25', // 20px
        },
        h6: {
          fontSize: 'calc(0.75rem * var(--mantine-scale))', // 12px
          lineHeight: '1.3333333333', // 16px
        },
      },
    },
    fontSizes: {
      xxs: 'calc(0.625rem * var(--mantine-scale))', // 10px
      xs: 'calc(0.75rem * var(--mantine-scale))', // 12px
      sm: 'calc(0.875rem * var(--mantine-scale))', // 14px
      md: 'calc(1rem * var(--mantine-scale))', // 16px
      lg: 'calc(1.125rem * var(--mantine-scale))', // 18px
      xl: 'calc(1.25rem * var(--mantine-scale))', // 20px
    },
    lineHeights: {
      xxs: '1.3', // 13px
      xs: '1.3333333333', // 16px
      sm: '1.4285714286', // 20px
      md: '1.55',
      lg: '1.5555555556', // 28px
      xl: '1.6', // 32px
    },
    // Dango radii: 4 / 6 / 8 / 10 / 12 / 16
    radius: {
      xs: 'calc(0.25rem * var(--mantine-scale))',
      sm: 'calc(0.375rem * var(--mantine-scale))',
      md: 'calc(0.5rem * var(--mantine-scale))',
      lg: 'calc(0.625rem * var(--mantine-scale))',
      xl: 'calc(0.75rem * var(--mantine-scale))',
      xxl: 'calc(1rem * var(--mantine-scale))',
    },
    spacing: {
      '3xs': 'calc(0.125rem * var(--mantine-scale))',
      xxs: 'calc(0.25rem * var(--mantine-scale))',
      xs: 'calc(0.5rem * var(--mantine-scale))',
      sm: 'calc(0.75rem * var(--mantine-scale))',
      md: 'calc(1rem * var(--mantine-scale))',
      lg: 'calc(1.25rem * var(--mantine-scale))',
      xl: 'calc(1.5rem * var(--mantine-scale))',
      xxl: 'calc(2rem * var(--mantine-scale))',
    },
    components: {
      Text: Text.extend({
        defaultProps: {
          size: 'sm',
          c: 'chatbox-primary',
        },
      }),
      Title: Title.extend({
        defaultProps: {
          c: 'chatbox-primary',
        },
      }),
      Button: Button.extend({
        defaultProps: {
          color: 'chatbox-brand',
        },
        styles: () => ({
          root: {
            '--button-height-sm': rem('32px'),
            '--button-height-compact-xs': rem('24px'),
            fontWeight: '400',
          },
          label: {
            color: 'inherit',
          },
        }),
        // flat CSS-var brand palette has no auto-contrast: filled brand buttons take on-brand text
        vars: (_theme, props) => ({ root: isFilledBrand(props) ? { '--button-color': ON_BRAND } : {} }),
      }),
      ActionIcon: ActionIcon.extend({
        vars: (_theme, props) => ({ root: isFilledBrand(props) ? { '--ai-color': ON_BRAND } : {} }),
      }),
      Input: Input.extend({
        styles: (_theme, props) => ({
          wrapper: {
            '--input-height-sm': rem('36px'),
            '--input-bd': 'var(--chatbox-border-primary)',
            '--input-bg': 'var(--chatbox-background-primary)',
            '--input-color': 'var(--chatbox-tint-primary)',
            '--input-placeholder-color': 'var(--chatbox-tint-tertiary)',
            ...(props.error
              ? {
                  '--input-color': 'var(--chatbox-tint-error)',
                  '--input-bd': 'var(--chatbox-tint-error)',
                }
              : {}),
          },
          input: {
            backgroundColor: 'var(--chatbox-background-primary)',
            borderColor: 'var(--chatbox-border-primary)',
            color: 'var(--chatbox-tint-primary)',
            borderRadius: 'var(--chatbox-radius-md)',
            fontSize: '0.875rem',
            transition: 'border-color 140ms var(--chatbox-ease), background-color 140ms var(--chatbox-ease)',
            '&:focus, &:focus-within': {
              borderColor: 'var(--chatbox-tint-brand)',
            },
            '&::placeholder': {
              color: 'var(--chatbox-tint-tertiary)',
            },
          },
        }),
      }),
      TextInput: TextInput.extend({
        defaultProps: {
          size: 'sm',
        },
        styles: () => ({
          label: {
            marginBottom: 'var(--chatbox-spacing-xxs)',
            fontWeight: '600',
            lineHeight: '1.5',
            color: 'var(--chatbox-tint-secondary)',
            fontSize: '0.8125rem',
          },
          description: {
            color: 'var(--chatbox-tint-tertiary)',
          },
          input: {
            backgroundColor: 'var(--chatbox-background-primary)',
            borderColor: 'var(--chatbox-border-secondary)',
            color: 'var(--chatbox-tint-primary)',
            borderRadius: 'var(--chatbox-radius-md)',
          },
        }),
      }),
      Textarea: TextInput.extend({
        defaultProps: {
          size: 'sm',
        },
        styles: () => ({
          label: {
            marginBottom: 'var(--chatbox-spacing-xxs)',
            fontWeight: '600',
            lineHeight: '1.5',
            color: 'var(--chatbox-tint-secondary)',
            fontSize: '0.8125rem',
          },
          input: {
            backgroundColor: 'var(--chatbox-background-primary)',
            borderColor: 'var(--chatbox-border-secondary)',
            color: 'var(--chatbox-tint-primary)',
            borderRadius: 'var(--chatbox-radius-md)',
          },
        }),
      }),
      Select: Select.extend({
        defaultProps: {
          size: 'sm',
          allowDeselect: false,
        },
        styles: () => ({
          label: {
            marginBottom: 'var(--chatbox-spacing-xxs)',
            fontWeight: '600',
            lineHeight: '1.5',
            color: 'var(--chatbox-tint-secondary)',
            fontSize: '0.8125rem',
          },
          input: {
            backgroundColor: 'var(--chatbox-background-primary)',
            borderColor: 'var(--chatbox-border-secondary)',
            color: 'var(--chatbox-tint-primary)',
            borderRadius: 'var(--chatbox-radius-md)',
          },
          dropdown: {
            backgroundColor: 'var(--chatbox-background-secondary)',
            borderColor: 'var(--chatbox-border-secondary)',
          },
          option: {
            borderRadius: 'var(--chatbox-radius-sm)',
          },
        }),
      }),
      NativeSelect: NativeSelect.extend({
        defaultProps: {
          size: 'sm',
        },
        styles: () => ({
          label: {
            marginBottom: 'var(--chatbox-spacing-xxs)',
            fontWeight: '600',
            lineHeight: '1.5',
            color: 'var(--chatbox-tint-secondary)',
            fontSize: '0.8125rem',
          },
          input: {
            backgroundColor: 'var(--chatbox-background-primary)',
            borderColor: 'var(--chatbox-border-secondary)',
            color: 'var(--chatbox-tint-primary)',
            borderRadius: 'var(--chatbox-radius-md)',
          },
        }),
      }),
      Switch: Switch.extend({
        defaultProps: {
          size: 'sm',
        },
        styles: (_theme, props) => {
          return {
            label: {
              color: props.checked ? 'var(--chatbox-tint-primary)' : 'var(--chatbox-tint-tertiary)',
            },
          }
        },
      }),
      Checkbox: Checkbox.extend({
        defaultProps: {
          size: 'sm',
        },
        styles: (_theme, props) => ({
          label: {
            color: props.checked ? 'var(--chatbox-tint-primary)' : 'var(--chatbox-tint-tertiary)',
          },
        }),
      }),
      Modal: Modal.extend({
        defaultProps: {
          zIndex: 2000,
          radius: 'md',
          padding: 'md',
          shadow: 'xl',
          overlayProps: {
            backgroundOpacity: 0.62,
            blur: 2,
          },
        },
        classNames: {
          content: 'studio-modal-content',
          header: 'studio-modal-header',
          body: 'studio-modal-body',
          title: 'studio-modal-title',
          close: 'studio-modal-close',
        },
        styles: () => ({
          content: {
            backgroundColor: 'var(--chatbox-background-secondary)',
            border: '1px solid var(--chatbox-border-secondary)',
            borderRadius: 'var(--chatbox-radius-lg)',
            boxShadow: '0 16px 48px rgba(0, 0, 0, 0.55)',
          },
          header: {
            backgroundColor: 'var(--chatbox-background-secondary)',
            borderBottom: '1px solid var(--chatbox-border-primary)',
            paddingBottom: 'var(--chatbox-spacing-sm)',
            marginBottom: 0,
            minHeight: rem('48px'),
          },
          title: {
            fontWeight: '600',
            color: 'var(--chatbox-tint-primary)',
            fontSize: '0.9375rem',
            letterSpacing: '-0.015em',
          },
          body: {
            paddingTop: 'var(--chatbox-spacing-md)',
          },
          close: {
            width: rem('28px'),
            height: rem('28px'),
            color: 'var(--chatbox-tint-tertiary)',
            borderRadius: 'var(--chatbox-radius-sm)',
            '&:hover': {
              backgroundColor: 'var(--chatbox-background-tertiary)',
              color: 'var(--chatbox-tint-primary)',
            },
          },
          overlay: {
            '--overlay-bg': 'var(--chatbox-background-mask-overlay)',
          },
        }),
      }),
      Drawer: Drawer.extend({
        defaultProps: {
          zIndex: 2000,
        },
        styles: () => ({
          title: {
            fontWeight: '600',
            color: 'var(--chatbox-tint-primary)',
            fontSize: '0.9375rem',
            letterSpacing: '-0.015em',
          },
          close: {
            width: rem('28px'),
            height: rem('28px'),
            color: 'var(--chatbox-tint-tertiary)',
          },
          content: {
            backgroundColor: 'var(--chatbox-background-secondary)',
            borderColor: 'var(--chatbox-border-primary)',
          },
          header: {
            borderBottom: '1px solid var(--chatbox-border-primary)',
          },
          overlay: {
            '--overlay-bg': 'var(--chatbox-background-mask-overlay)',
          },
        }),
      }),
      Combobox: Combobox.extend({
        defaultProps: {
          shadow: 'md',
          zIndex: 2100,
        },
      }),
      Avatar: Avatar.extend({
        styles: () => ({
          image: {
            objectFit: 'contain',
          },
        }),
      }),
      Tooltip: Tooltip.extend({
        defaultProps: {
          zIndex: 3000,
        },
      }),
      Popover: Popover.extend({
        defaultProps: {
          zIndex: 3000,
        },
      }),
      Slider: Slider.extend({
        classNames: {
          trackContainer: 'max-sm:pointer-events-none',
          thumb: 'max-sm:pointer-events-auto',
        },
      }),
    },
  })

type ExtendedCustomColors =
  | 'chatbox-brand'
  | 'chatbox-gray'
  | 'chatbox-success'
  | 'chatbox-error'
  | 'chatbox-warning'
  | 'chatbox-primary'
  | 'chatbox-secondary'
  | 'chatbox-tertiary'
  | DefaultMantineColor

declare module '@mantine/core' {
  export interface MantineThemeColorsOverride {
    colors: Record<ExtendedCustomColors, MantineColorsTuple>
  }
}
