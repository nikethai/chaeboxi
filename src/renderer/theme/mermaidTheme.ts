import { dangoColors } from './dangoTokens'

/** Mermaid derives shades from its colours, so it gets the concrete Dango values for the mode, not CSS variables. */
export function mermaidThemeVariables(theme: 'light' | 'dark') {
  const c = dangoColors[theme]
  return {
    fontSize: '14px',
    fontFamily: 'var(--chatbox-font-ui, ui-sans-serif, system-ui, sans-serif)',
    primaryColor: c['green-wash'],
    primaryTextColor: c.ink,
    primaryBorderColor: c.green,
    lineColor: c.muted,
    secondaryColor: c.surface,
    tertiaryColor: c.raised,
    background: 'transparent',
    mainBkg: c['green-wash'],
    nodeBorder: c.green,
    clusterBkg: c.surface,
    clusterBorder: c.line,
    titleColor: c.muted,
    edgeLabelBackground: c.raised,
  }
}
