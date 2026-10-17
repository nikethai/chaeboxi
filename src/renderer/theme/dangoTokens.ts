// generated from design/dango/tokens.json — run pnpm tokens:sync

export type DangoColor =
  | 'ground'
  | 'surface'
  | 'raised'
  | 'ink'
  | 'ink-2'
  | 'muted'
  | 'hairline'
  | 'line'
  | 'control-border'
  | 'green'
  | 'on-green'
  | 'green-wash'
  | 'green-text'
  | 'blue'
  | 'on-blue'
  | 'blue-wash'
  | 'blue-text'
  | 'amber-wash'
  | 'amber-text'
  | 'danger'
  | 'focus'
  | 'toast'
  | 'on-toast'
  | 'toast-action'
  | 'scrim'

export const dangoColors: { light: Record<DangoColor, string>; dark: Record<DangoColor, string> } = {
  light: {
    ground: '#fbfcfb',
    surface: '#f1f4f2',
    raised: '#ffffff',
    ink: '#17201f',
    'ink-2': '#46514d',
    muted: '#66716d',
    hairline: '#e2e7e4',
    line: '#d7ddda',
    'control-border': '#7f8a87',
    green: '#1f7a63',
    'on-green': '#ffffff',
    'green-wash': '#dcefe7',
    'green-text': '#15594a',
    blue: '#3b6fd6',
    'on-blue': '#ffffff',
    'blue-wash': '#e2eafb',
    'blue-text': '#2a4fa0',
    'amber-wash': '#fbf0d9',
    'amber-text': '#7a4b00',
    danger: '#b42318',
    focus: '#1f7a63',
    toast: '#17201f',
    'on-toast': '#ffffff',
    'toast-action': '#8fd3b4',
    scrim: 'rgba(23, 32, 31, 0.28)',
  },
  dark: {
    ground: '#121716',
    surface: '#1a201f',
    raised: '#222a28',
    ink: '#e6ebe9',
    'ink-2': '#b9c2bf',
    muted: '#8f9a96',
    hairline: '#2a3230',
    line: '#3a4341',
    'control-border': '#6e7a77',
    green: '#4fb894',
    'on-green': '#0d2a21',
    'green-wash': '#173a30',
    'green-text': '#8fd3b4',
    blue: '#7ea2f0',
    'on-blue': '#0f1d3a',
    'blue-wash': '#1d2a45',
    'blue-text': '#a9c1f5',
    'amber-wash': '#3a2f17',
    'amber-text': '#f0c97a',
    danger: '#f08a7e',
    focus: '#4fb894',
    toast: '#2c3533',
    'on-toast': '#e6ebe9',
    'toast-action': '#8fd3b4',
    scrim: 'rgba(0, 0, 0, 0.5)',
  },
}

export const dangoFonts: { sans: string; mono: string } = {
  sans: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif',
  mono: 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace',
}
