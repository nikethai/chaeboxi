import { createTheme, type ThemeOptions } from '@mui/material/styles'
import { useLayoutEffect, useMemo } from 'react'
import { settingsStore, useLanguage, useSettingsStore } from '@/stores/settingsStore'
import { uiStore, useUIStore } from '@/stores/uiStore'
import { type Language, Theme } from '../../shared/types'
import platform from '../platform'
import DesktopPlatform from '../platform/desktop_platform'

export const switchTheme = async (theme: Theme) => {
  let finalTheme = 'light' as 'light' | 'dark'
  if (theme === Theme.System) {
    finalTheme = (await platform.shouldUseDarkColors()) ? 'dark' : 'light'
  } else {
    finalTheme = theme === Theme.Dark ? 'dark' : 'light'
  }
  uiStore.setState({
    realTheme: finalTheme,
  })
  localStorage.setItem('initial-theme', finalTheme)
  if (platform instanceof DesktopPlatform) {
    await platform.switchTheme(finalTheme)
  }
}

export default function useAppTheme() {
  const theme = useSettingsStore((state) => state.theme)
  const fontSize = useSettingsStore((state) => state.fontSize)
  const realTheme = useUIStore((state) => state.realTheme)
  const language = useLanguage()

  useLayoutEffect(() => {
    switchTheme(theme)
  }, [theme])

  useLayoutEffect(() => {
    platform.onSystemThemeChange(() => {
      const theme = settingsStore.getState().theme
      switchTheme(theme)
    })
  }, [])

  useLayoutEffect(() => {
    // update material-ui theme
    document.querySelector('html')?.setAttribute('data-theme', realTheme)
    // update tailwindcss theme
    if (realTheme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [realTheme])

  const themeObj = useMemo(
    () => createTheme(getThemeDesign(realTheme, fontSize, language)),
    [realTheme, fontSize, language]
  )
  return themeObj
}

export function getThemeDesign(realTheme: 'light' | 'dark', fontSize: number, language: Language): ThemeOptions {
  return {
    palette: {
      mode: realTheme,
      ...(realTheme === 'light'
        ? {
            background: {
              default: '#ffffff',
              paper: '#ffffff',
            },
            primary: {
              main: '#5b63d4',
            },
          }
        : {
            // MUI cannot resolve CSS variables — concrete studio dark tokens
            background: {
              default: '#121214',
              paper: '#1c1c21',
            },
            primary: {
              main: '#5b63d4',
            },
            text: {
              primary: '#ececec',
              secondary: '#a8a8ae',
            },
            divider: '#2a2a32',
          }),
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          html: {
            backgroundColor: realTheme === 'dark' ? '#121214' : '#ffffff',
          },
          body: {
            backgroundColor: realTheme === 'dark' ? '#121214' : '#ffffff',
            color: realTheme === 'dark' ? '#ececec' : '#1a1a1e',
          },
          '#root': {
            backgroundColor: realTheme === 'dark' ? '#121214' : '#ffffff',
            minHeight: '100%',
          },
        },
      },
      MuiSnackbarContent: {
        styleOverrides: {
          root: {
            backgroundColor: realTheme === 'dark' ? '#1c1c21' : undefined,
            color: realTheme === 'dark' ? '#ececec' : undefined,
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: realTheme === 'dark' ? '#16161a' : '#ffffff',
            backgroundImage: 'none',
            borderRight: realTheme === 'dark' ? '1px solid #2a2a32' : '1px solid #e4e4e8',
          },
        },
      },
    },
    typography: {
      // In Chinese and Japanese the characters are usually larger,
      // so a smaller fontsize may be appropriate.
      ...(language === 'ar'
        ? {
            fontFamily: 'Cairo, Arial, sans-serif',
          }
        : {
            fontFamily: "'Satoshi', 'Segoe UI', system-ui, sans-serif",
          }),
      fontSize: (fontSize * 14) / 16,
    },
    direction: language === 'ar' ? 'rtl' : 'ltr',
    breakpoints: {
      values: {
        xs: 0,
        sm: 640, // 修改sm的值与tailwindcss保持一致
        md: 900,
        lg: 1200,
        xl: 1536,
      },
    },
  }
}
