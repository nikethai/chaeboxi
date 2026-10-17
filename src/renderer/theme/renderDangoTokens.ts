// Renders design/dango/tokens.json into the committed CSS and TypeScript token files.
// Regenerate with `pnpm tokens:sync`.

type Themed = { light: string; dark: string }

export interface DangoTokensJson {
  color: { tokens: Array<{ name: string; value: Themed }> }
  type: { families: { sans: string; mono: string } }
  spacing: { tokens: Array<{ name: string; value: string }> }
  radius: { tokens: Array<{ name: string; value: string }> }
  shadow: { tokens: Array<{ name: string; value: Themed }> }
}

type Theme = keyof Themed

const HEADER = '/* generated from design/dango/tokens.json — run pnpm tokens:sync */'
const ALIAS = /^\{([a-z0-9-]+)\}$/

function colorAsCss(value: string): string {
  const alias = ALIAS.exec(value)
  return alias ? `var(--dango-${alias[1]})` : value
}

function resolveColors(tokens: DangoTokensJson, theme: Theme): Array<[string, string]> {
  const raw = new Map(tokens.color.tokens.map((token) => [token.name, token.value[theme]]))
  return tokens.color.tokens.map((token) => {
    let value = token.value[theme]
    const seen = new Set<string>([token.name])
    for (let alias = ALIAS.exec(value); alias; alias = ALIAS.exec(value)) {
      const target = alias[1]
      const next = raw.get(target)
      if (next === undefined || seen.has(target)) {
        throw new Error(`Cannot resolve colour alias ${value} for "${token.name}"`)
      }
      seen.add(target)
      value = next
    }
    return [token.name, value]
  })
}

function declarations(entries: Array<[string, string]>): string[] {
  return entries.map(([name, value]) => `  --dango-${name}: ${value};`)
}

export function renderDangoTokensCss(tokens: DangoTokensJson): string {
  const colors = (theme: Theme) =>
    tokens.color.tokens.map((token): [string, string] => [token.name, colorAsCss(token.value[theme])])
  const shadows = (theme: Theme) =>
    tokens.shadow.tokens.map((token): [string, string] => [token.name, token.value[theme]])
  const plain = (list: Array<{ name: string; value: string }>) =>
    list.map((token): [string, string] => [token.name, token.value])

  const light = [
    ...declarations(colors('light')),
    ...declarations(shadows('light')),
    ...declarations(plain(tokens.spacing.tokens)),
    ...declarations(plain(tokens.radius.tokens)),
    ...declarations([
      ['font-sans', tokens.type.families.sans],
      ['font-mono', tokens.type.families.mono],
    ]),
  ]
  const dark = [...declarations(colors('dark')), ...declarations(shadows('dark'))]

  return [
    HEADER,
    ':root {',
    ...light,
    '}',
    '',
    ':root[data-mantine-color-scheme="dark"],',
    ':root[data-theme="dark"] {',
    ...dark,
    '}',
    '',
  ].join('\n')
}

function tsString(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

// Biome's `quoteProperties: asNeeded` leaves plain identifiers unquoted.
function tsKey(name: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : tsString(name)
}

export function renderDangoTokensTs(tokens: DangoTokensJson): string {
  const names = tokens.color.tokens.map((token) => token.name)
  const colorBlock = (theme: Theme) =>
    resolveColors(tokens, theme).map(([name, value]) => `    ${tsKey(name)}: ${tsString(value)},`)

  return [
    '// generated from design/dango/tokens.json — run pnpm tokens:sync',
    '',
    'export type DangoColor =',
    ...names.map((name) => `  | ${tsString(name)}`),
    '',
    'export const dangoColors: { light: Record<DangoColor, string>; dark: Record<DangoColor, string> } = {',
    '  light: {',
    ...colorBlock('light'),
    '  },',
    '  dark: {',
    ...colorBlock('dark'),
    '  },',
    '}',
    '',
    'export const dangoFonts: { sans: string; mono: string } = {',
    `  sans: ${tsString(tokens.type.families.sans)},`,
    `  mono: ${tsString(tokens.type.families.mono)},`,
    '}',
    '',
  ].join('\n')
}
