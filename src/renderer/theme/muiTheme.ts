import type { ThemeOptions } from '@mui/material/styles'
import type { Language } from '../../shared/types'
import { dangoColors, dangoFonts } from './dangoTokens'

/**
 * Legacy MUI theme. MUI cannot resolve CSS variables, so it reads the concrete Dango values
 * for the active mode (the `--dango-*` variables carry the same values for everything else).
 */
export function getThemeDesign(realTheme: 'light' | 'dark', fontSize: number, language: Language): ThemeOptions {
  const c = dangoColors[realTheme]
  return {
    palette: {
      mode: realTheme,
      background: {
        default: c.ground,
        paper: c.raised,
      },
      primary: {
        main: c.green,
        contrastText: c['on-green'],
      },
      text: {
        primary: c.ink,
        secondary: c['ink-2'],
      },
      divider: c.hairline,
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          html: {
            backgroundColor: c.ground,
          },
          body: {
            backgroundColor: c.ground,
            color: c.ink,
          },
          '#root': {
            backgroundColor: c.ground,
            minHeight: '100%',
          },
        },
      },
      MuiSnackbarContent: {
        styleOverrides: {
          root: {
            backgroundColor: realTheme === 'dark' ? c.raised : undefined,
            color: realTheme === 'dark' ? c.ink : undefined,
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: c.surface,
            backgroundImage: 'none',
            borderRight: `1px solid ${c.hairline}`,
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
            fontFamily: dangoFonts.sans,
          }),
      fontSize: (fontSize * 14) / 16,
    },
    direction: language === 'ar' ? 'rtl' : 'ltr',
    breakpoints: {
      values: {
        xs: 0,
        sm: 640, // smtailwindcss
        md: 900,
        lg: 1200,
        xl: 1536,
      },
    },
  }
}
