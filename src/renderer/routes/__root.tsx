import { Theme } from '@shared/types'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import Toasts from '@/components/common/Toasts'
import ExitFullscreenButton from '@/components/layout/ExitFullscreenButton'
import useAppTheme from '@/hooks/useAppTheme'
import { useSystemLanguageWhenInit } from '@/hooks/useDefaultSystemLanguage'
import { useI18nEffect } from '@/hooks/useI18nEffect'
import useNeedRoomForWinControls from '@/hooks/useNeedRoomForWinControls'
import { useSidebarWidth } from '@/hooks/useScreenChange'
import useShortcut from '@/hooks/useShortcut'
import '@/modals'
import NiceModal from '@ebay/nice-modal-react'
import {
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
  MantineProvider,
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
  useMantineColorScheme,
} from '@mantine/core'
import Box from '@mui/material/Box'
import CssBaseline from '@mui/material/CssBaseline'
import Grid from '@mui/material/Grid'
import { ThemeProvider } from '@mui/material/styles'
import { createRootRoute, Outlet, useLocation } from '@tanstack/react-router'
import { useSetAtom } from 'jotai'
import { useEffect, useMemo, useRef } from 'react'
import { navigateToSettings } from '@/modals/Settings'
import { getOS } from '@/packages/navigator'
import PictureDialog from '@/pages/PictureDialog'
import RemoteDialogWindow from '@/pages/RemoteDialogWindow'
import SearchDialog from '@/pages/SearchDialog'
import platform from '@/platform'
import { router } from '@/router'
import Sidebar from '@/Sidebar'
import * as atoms from '@/stores/atoms'
import * as settingActions from '@/stores/settingActions'
import { settingsStore, useLanguage, useSettingsStore, useTheme } from '@/stores/settingsStore'
import { useUIStore } from '@/stores/uiStore'

function Root() {
  const location = useLocation()
  const spellCheck = useSettingsStore((state) => state.spellCheck)
  const language = useLanguage()
  const initialized = useRef(false)

  const setOpenAboutDialog = useUIStore((s) => s.setOpenAboutDialog)

  const setRemoteConfig = useSetAtom(atoms.remoteConfigAtom)

  useEffect(() => {
    if (initialized.current) {
      return
    }
    // 通过定时器延迟启动，防止处理状态底层存储的异步加载前错误的初始数据
    const tid = setTimeout(() => {
      // biome-ignore lint/nursery/noFloatingPromises: inline call
      ;(async () => {
        setRemoteConfig((conf) => ({ ...conf }))
        // 是否需要弹出设置窗口
        initialized.current = true
        if (settingActions.needEditSetting() && location.pathname !== '/settings/mcp') {
          await NiceModal.show('welcome')
          return
        }
        // 是否需要弹出关于窗口（更新后首次启动）
        // 目前仅在桌面版本更新后首次启动才自动弹窗
        const shouldShowAboutDialogWhenStartUp = await platform.shouldShowAboutDialogWhenStartUp()
        if (shouldShowAboutDialogWhenStartUp) {
          setOpenAboutDialog(true)
          return
        }
      })()
    }, 2000)

    return () => clearTimeout(tid)
  }, [setOpenAboutDialog, setRemoteConfig, location.pathname])

  const showSidebar = useUIStore((s) => s.showSidebar)
  const sidebarWidth = useSidebarWidth()

  // Legacy desktop used ?settings=/settings/... modal; always use full-page routes now
  useEffect(() => {
    const settingsPath = (location.search as { settings?: string })?.settings
    if (typeof settingsPath === 'string' && settingsPath.length > 0) {
      const path = settingsPath.startsWith('/') ? settingsPath : `/${settingsPath}`
      void router.navigate({
        to: path.startsWith('/settings') ? path : `/settings${path}`,
        replace: true,
      })
    }
  }, [location.search])

  const _theme = useTheme()
  const { setColorScheme } = useMantineColorScheme()
  // biome-ignore lint/correctness/useExhaustiveDependencies: setColorScheme is stable
  useEffect(() => {
    if (_theme === Theme.Dark) {
      setColorScheme('dark')
    } else if (_theme === Theme.Light) {
      setColorScheme('light')
    } else {
      setColorScheme('auto')
    }
  }, [_theme])

  useEffect(() => {
    ;(() => {
      const { startupPage } = settingsStore.getState()
      const sid = JSON.parse(localStorage.getItem('_currentSessionIdCachedAtom') || '""') as string
      if (sid && startupPage === 'session') {
        router.navigate({
          to: `/session/${sid}`,
          replace: true,
        })
      }
    })()
  }, [])

  useEffect(() => {
    if (platform.onNavigate) {
      // 移动端和其他平台的导航监听器
      return platform.onNavigate((path) => {
        // 如果是 settings 路径，使用 navigateToSettings 以保持与主页面设置按钮一致的行为
        // 在桌面端会打开 Modal，在移动端会正常导航
        if (path.startsWith('/settings')) {
          // 提取 settings 之后的路径部分（包含查询参数）
          const settingsPath = path.substring('/settings'.length)
          navigateToSettings(settingsPath || '/')
        } else {
          router.navigate({ to: path })
        }
      })
    }
  }, [])

  const { needRoomForMacWindowControls } = useNeedRoomForWinControls()
  useEffect(() => {
    if (needRoomForMacWindowControls) {
      document.documentElement.setAttribute('data-need-room-for-mac-controls', 'true')
    } else {
      document.documentElement.removeAttribute('data-need-room-for-mac-controls')
    }
  }, [needRoomForMacWindowControls])

  return (
    <Box
      className="box-border App"
      spellCheck={spellCheck}
      dir={language === 'ar' ? 'rtl' : 'ltr'}
      sx={{
        height: '100%',
        backgroundColor: 'var(--chatbox-background-primary)',
        color: 'var(--chatbox-tint-primary)',
      }}
    >
      {platform.type === 'desktop' && (getOS() === 'Windows' || getOS() === 'Linux') && <ExitFullscreenButton />}
      <Grid container className="h-full" sx={{ minHeight: 0 }}>
        <Sidebar />
        <Box
          className="h-full w-full min-h-0"
          sx={{
            flexGrow: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--chatbox-background-primary)',
            ...(showSidebar
              ? language === 'ar'
                ? { paddingRight: { sm: `${sidebarWidth}px` } }
                : { paddingLeft: { sm: `${sidebarWidth}px` } }
              : {}),
          }}
        >
          <ErrorBoundary name="main">
            <Box className="h-full min-h-0 flex flex-col flex-1">
              <Outlet />
            </Box>
          </ErrorBoundary>
        </Box>
      </Grid>
      {/* 对话设置 */}
      {/* <AppStoreRatingDialog /> */}
      {/* 代码预览 */}
      {/* <ArtifactDialog /> */}
      {/* 对话列表清理 */}
      {/* <ChatConfigWindow /> */}
      {/* 似乎未使用 */}
      {/* <CleanWidnow /> */}
      {/* 对话列表清理 */}
      {/* <ClearConversationListWindow /> */}
      {/* 导出聊天记录 */}
      {/* <ExportChatDialog /> */}
      {/* 编辑消息 */}
      {/* <MessageEditDialog /> */}
      {/* 添加链接 */}
      {/* <OpenAttachLinkDialog /> */}
      {/* 图片预览 */}
      <PictureDialog />
      {/* 似乎是从后端拉一个弹窗的配置 */}
      <RemoteDialogWindow />
      {/* 手机端举报内容 */}
      {/* <ReportContentDialog /> */}
      {/* 搜索 */}
      <SearchDialog />
      {/* 没有配置模型时的欢迎弹窗 */}
      {/* <WelcomeDialog /> */}
      <Toasts /> {/* mui */}
    </Box>
  )
}

const creteMantineTheme = (scale = 1) =>
  createTheme({
    /** Studio shell — Satoshi UI, tight radii, indigo brand via CSS tokens */
    scale,
    fontFamily: "var(--chatbox-font-ui, 'Satoshi', 'Segoe UI', system-ui, sans-serif)",
    fontFamilyMonospace: "var(--chatbox-font-mono, 'JetBrains Mono', ui-monospace, monospace)",
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
      fontFamily: "var(--chatbox-font-ui, 'Satoshi', 'Segoe UI', system-ui, sans-serif)",
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
    // tight studio radii: ~4 / 7 / 9 / 11 / 12 / 16
    radius: {
      xs: 'calc(0.25rem * var(--mantine-scale))',
      sm: 'calc(0.4375rem * var(--mantine-scale))',
      md: 'calc(0.5625rem * var(--mantine-scale))',
      lg: 'calc(0.6875rem * var(--mantine-scale))',
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
        }),
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

export const Route = createRootRoute({
  component: () => {
    useI18nEffect()
    useSystemLanguageWhenInit()
    useShortcut()
    const theme = useAppTheme()
    const _theme = useTheme()
    const fontSize = useSettingsStore((state) => state.fontSize)
    const accentColor = useSettingsStore((state) => state.accentColor)
    const scale = fontSize / 14
    const mantineTheme = useMemo(() => creteMantineTheme(scale), [scale])

    // Apply custom accent color as CSS variables on the root element
    useEffect(() => {
      const root = document.documentElement
      if (accentColor) {
        root.style.setProperty('--chatbox-tint-brand', accentColor)
        root.style.setProperty('--chatbox-background-brand-primary', accentColor)
        // Derive a darker hover variant by reducing opacity via color-mix
        root.style.setProperty(
          '--chatbox-background-brand-primary-hover',
          `color-mix(in srgb, ${accentColor}, black 15%)`
        )
        root.style.setProperty(
          '--chatbox-background-brand-secondary',
          `color-mix(in srgb, ${accentColor}, transparent 92%)`
        )
        root.style.setProperty(
          '--chatbox-background-brand-secondary-hover',
          `color-mix(in srgb, ${accentColor}, transparent 84%)`
        )
        root.style.setProperty('--chatbox-border-brand', accentColor)
      } else {
        // Clear inline overrides so CSS file defaults take over
        root.style.removeProperty('--chatbox-tint-brand')
        root.style.removeProperty('--chatbox-background-brand-primary')
        root.style.removeProperty('--chatbox-background-brand-primary-hover')
        root.style.removeProperty('--chatbox-background-brand-secondary')
        root.style.removeProperty('--chatbox-background-brand-secondary-hover')
        root.style.removeProperty('--chatbox-border-brand')
      }
    }, [accentColor])

    return (
      <MantineProvider
        theme={mantineTheme}
        defaultColorScheme={_theme === Theme.Dark ? 'dark' : _theme === Theme.Light ? 'light' : 'auto'}
      >
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <NiceModal.Provider>
            <ErrorBoundary>
              <Root />
            </ErrorBoundary>
          </NiceModal.Provider>
        </ThemeProvider>
      </MantineProvider>
    )
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
