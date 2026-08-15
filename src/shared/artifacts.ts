import { v4 as uuidv4 } from 'uuid'
import type { MessageArtifact } from './types/session'

export const ARTIFACT_KINDS = ['html', 'markdown', 'svg', 'mermaid', 'code'] as const
export type ArtifactKind = (typeof ARTIFACT_KINDS)[number]

export const LEGACY_HTML_TITLE = 'HTML Artifact'

export type FenceBlock = {
  language: string
  info: string
  content: string
}

export type DetectedArtifact = {
  kind: ArtifactKind
  language: string
  content: string
  title: string
}

export type ArtifactVersionLike = Pick<
  MessageArtifact,
  'id' | 'previousVersionId' | 'version' | 'type' | 'content' | 'title' | 'language'
> & {
  messageId?: string
}

const PREVIEW_LANG_TO_KIND: Record<string, ArtifactKind> = {
  html: 'html',
  htm: 'html',
  svg: 'svg',
  mermaid: 'mermaid',
  markdown: 'markdown',
  md: 'markdown',
  mdx: 'markdown',
}

const CSS_LANGUAGES = new Set(['css', 'scss', 'less'])
const JS_LANGUAGES = new Set(['js', 'javascript', 'mjs', 'cjs'])

const CODE_LANGUAGES = new Set([
  'js',
  'javascript',
  'mjs',
  'cjs',
  'ts',
  'typescript',
  'tsx',
  'jsx',
  'css',
  'scss',
  'less',
  'python',
  'py',
  'json',
  'jsonc',
  'go',
  'golang',
  'rust',
  'rs',
  'java',
  'kotlin',
  'swift',
  'c',
  'cpp',
  'cxx',
  'cc',
  'csharp',
  'cs',
  'ruby',
  'rb',
  'php',
  'sql',
  'yaml',
  'yml',
  'toml',
  'xml',
  'shell',
  'bash',
  'sh',
  'zsh',
  'powershell',
  'ps1',
  'text',
  'plaintext',
  'txt',
  'vue',
  'svelte',
  'dart',
  'r',
  'lua',
  'perl',
  'scala',
  'haskell',
  'elixir',
  'erlang',
  'clojure',
  'graphql',
  'proto',
  'dockerfile',
  'docker',
  'makefile',
  'cmake',
  'ini',
  'env',
  'diff',
  'http',
])

const LANGUAGE_LABELS: Record<string, string> = {
  js: 'JavaScript',
  javascript: 'JavaScript',
  mjs: 'JavaScript',
  cjs: 'JavaScript',
  ts: 'TypeScript',
  typescript: 'TypeScript',
  tsx: 'TSX',
  jsx: 'JSX',
  py: 'Python',
  python: 'Python',
  json: 'JSON',
  jsonc: 'JSON',
  css: 'CSS',
  scss: 'SCSS',
  less: 'Less',
  go: 'Go',
  golang: 'Go',
  rust: 'Rust',
  rs: 'Rust',
  java: 'Java',
  kotlin: 'Kotlin',
  swift: 'Swift',
  c: 'C',
  cpp: 'C++',
  cxx: 'C++',
  cc: 'C++',
  csharp: 'C#',
  cs: 'C#',
  ruby: 'Ruby',
  rb: 'Ruby',
  php: 'PHP',
  sql: 'SQL',
  yaml: 'YAML',
  yml: 'YAML',
  toml: 'TOML',
  xml: 'XML',
  shell: 'Shell',
  bash: 'Bash',
  sh: 'Shell',
  zsh: 'Shell',
  powershell: 'PowerShell',
  ps1: 'PowerShell',
  vue: 'Vue',
  svelte: 'Svelte',
  dart: 'Dart',
  html: 'HTML',
  htm: 'HTML',
  svg: 'SVG',
  mermaid: 'Mermaid',
  markdown: 'Markdown',
  md: 'Markdown',
  mdx: 'Markdown',
  text: 'Code',
  plaintext: 'Code',
  txt: 'Code',
}

const FILENAME_COMMENT_PATTERNS = [
  /^\s*<!--\s*([\w./@-]+\.\w+)\s*-->/,
  /^\s*\/\*\s*([\w./@-]+\.\w+)\s*\*\//,
  /^\s*\/\/\s*(?:file(?:name)?:?\s*)?([\w./@-]+\.\w+)/i,
  /^\s*#\s*(?:file(?:name)?:?\s*)?([\w./@-]+\.\w+)/i,
  /^\s*--\s*(?:file(?:name)?:?\s*)?([\w./@-]+\.\w+)/i,
]

const MERMAID_HEAD =
  /^(graph\b|flowchart\b|sequencediagram\b|classdiagram\b|statediagram\b|erdiagram\b|journey\b|gantt\b|pie\b|mindmap\b|timeline\b|gitgraph\b|c4context\b|xychart-beta\b|sankey-beta\b)/

export function isLegacyDefaultTitle(title?: string): boolean {
  if (!title) return true
  const normalized = title.trim().toLowerCase()
  return normalized === 'html artifact' || normalized === 'artifact'
}

export function normalizeArtifactKind(type: string | undefined): ArtifactKind {
  const value = (type || 'html').toLowerCase()
  if (value === 'html' || value === 'markdown' || value === 'svg' || value === 'mermaid' || value === 'code') {
    return value
  }
  return 'code'
}

export function languageDisplayName(language?: string): string {
  if (!language) return 'Code'
  const key = language.toLowerCase()
  return LANGUAGE_LABELS[key] ?? language.toUpperCase()
}

export function artifactKindLabel(kind: ArtifactKind, language?: string): string {
  switch (kind) {
    case 'html':
      return 'HTML'
    case 'svg':
      return 'SVG'
    case 'markdown':
      return 'Markdown'
    case 'mermaid':
      return 'Mermaid'
    case 'code':
      return languageDisplayName(language)
  }
}

export function isRenderableCodeLanguage(language: string): boolean {
  return !!language && language.toLowerCase() === 'html'
}

export function isLikelyMermaidSource(source: string): boolean {
  const head = source.trimStart().slice(0, 120).toLowerCase()
  return MERMAID_HEAD.test(head)
}

export function isSvgContent(source: string): boolean {
  return /^\s*<svg[\s>]/i.test(source)
}

export function isHtmlContent(source: string): boolean {
  const trimmed = source.trimStart()
  return /^<!doctype\s+html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)
}

function lineCount(text: string): number {
  if (!text) return 0
  return text.replace(/\n$/, '').split('\n').length
}

export function isSubstantialPreview(content: string, kind: ArtifactKind): boolean {
  const trimmed = content.trim()
  if (!trimmed) return false
  const lines = lineCount(trimmed)
  const chars = trimmed.length
  if (kind === 'html' && /<\/[a-z0-9]+>/i.test(trimmed) && chars >= 24) return true
  if (kind === 'svg' && /<svg[\s>]/i.test(trimmed) && chars >= 24) return true
  if (kind === 'mermaid' && lines >= 2 && chars >= 20) return true
  return chars >= 80 || lines >= 4
}

export function isSubstantialCode(content: string): boolean {
  const trimmed = content.trim()
  if (!trimmed) return false
  return trimmed.length >= 280 || lineCount(trimmed) >= 10
}

function makeFence(infoRaw: string, body: string): FenceBlock {
  const info = infoRaw.trim()
  const language = (info.split(/\s+/)[0] || '').toLowerCase()
  return {
    language,
    info,
    content: body.replace(/\n$/, ''),
  }
}

export function parseFencedBlocks(markdown: string, options?: { allowOpen?: boolean }): FenceBlock[] {
  const blocks: FenceBlock[] = []
  if (!markdown) return blocks
  const re = /^```([^\n`]*)\r?\n([\s\S]*?)^```[ \t]*$/gm
  let lastIndex = 0
  let match = re.exec(markdown)
  while (match) {
    blocks.push(makeFence(match[1], match[2]))
    lastIndex = re.lastIndex
    match = re.exec(markdown)
  }
  if (options?.allowOpen) {
    const rest = markdown.slice(lastIndex)
    const open = rest.match(/^```([^\n`]*)\r?\n([\s\S]*)$/m)
    if (open) {
      blocks.push(makeFence(open[1], open[2]))
    }
  }
  return blocks
}

export function mapLanguageToKind(language: string, content = ''): ArtifactKind | null {
  const lang = (language || '').toLowerCase()
  if (PREVIEW_LANG_TO_KIND[lang]) return PREVIEW_LANG_TO_KIND[lang]
  if (!lang || lang === 'text' || lang === 'plaintext' || lang === 'txt' || lang === 'xml') {
    if (isSvgContent(content)) return 'svg'
    if (isLikelyMermaidSource(content)) return 'mermaid'
    if (isHtmlContent(content)) return 'html'
  }
  if (lang && CODE_LANGUAGES.has(lang)) return 'code'
  return null
}

function titleFromFenceInfo(info: string): string | undefined {
  if (!info) return undefined
  const titled = info.match(/title=(?:"([^"]+)"|'([^']+)'|(\S+))/)
  if (titled) {
    const value = (titled[1] || titled[2] || titled[3] || '').trim()
    if (value) return value
  }
  const extra = info.trim().split(/\s+/).slice(1)
  const fileLike = extra.find((token) => /\.[\w]+$/.test(token) && !/^https?:/i.test(token))
  return fileLike
}

function filenameFromComment(content: string): string | undefined {
  const head = content.slice(0, 400)
  for (const pattern of FILENAME_COMMENT_PATTERNS) {
    const match = head.match(pattern)
    if (match?.[1] && !/^https?:/i.test(match[1])) {
      return match[1]
    }
  }
  return undefined
}

function cleanTitle(raw: string): string {
  return raw
    .replace(/[#*`_]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function inferArtifactTitle(content: string, kind: ArtifactKind, language?: string, info?: string): string {
  const fromInfo = info ? titleFromFenceInfo(info) : undefined
  if (fromInfo) return fromInfo

  const htmlTitle = content.match(/<title[^>]*>([^<]+)<\/title>/i)
  if (htmlTitle?.[1]?.trim()) return cleanTitle(htmlTitle[1])

  const htmlHeading = content.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  if (htmlHeading?.[1]?.trim()) return cleanTitle(htmlHeading[1].replace(/<[^>]+>/g, ''))

  const mdHeading = content.match(/^\s{0,3}#{1,3}\s+(.+)$/m)
  if (mdHeading?.[1]?.trim()) return cleanTitle(mdHeading[1])

  const fromComment = filenameFromComment(content)
  if (fromComment) return fromComment

  if (kind === 'mermaid') {
    const mermaidTitle = content.match(/^\s*(?:title|accTitle)\s+(.+)$/m)
    if (mermaidTitle?.[1]?.trim()) return mermaidTitle[1].trim()
  }

  return artifactKindLabel(kind, language)
}

function combineHtmlDocument(html: string, css: string[], js: string[]): string {
  const style = css.filter(Boolean).join('\n')
  const script = js.filter(Boolean).join('\n\n')
  const hasDocument = /<!doctype/i.test(html) || /<html[\s>]/i.test(html)
  if (hasDocument) {
    let out = html
    if (style) {
      out = /<\/head>/i.test(out)
        ? out.replace(/<\/head>/i, `<style>\n${style}\n</style></head>`)
        : `<style>\n${style}\n</style>\n${out}`
    }
    if (script) {
      out = /<\/body>/i.test(out)
        ? out.replace(/<\/body>/i, `<script>\n${script}\n</script></body>`)
        : `${out}\n<script>\n${script}\n</script>`
    }
    return out
  }
  return [html, style ? `<style>\n${style}\n</style>` : '', script ? `<script>\n${script}\n</script>` : '']
    .filter(Boolean)
    .join('\n\n')
}

function extractCombinedHtml(fences: FenceBlock[]): string | undefined {
  const htmlFences = fences.filter((fence) => mapLanguageToKind(fence.language, fence.content) === 'html')
  if (!htmlFences.length) return undefined
  const css = fences.filter((fence) => CSS_LANGUAGES.has(fence.language)).map((fence) => fence.content)
  const js = fences.filter((fence) => JS_LANGUAGES.has(fence.language)).map((fence) => fence.content)
  return combineHtmlDocument(htmlFences[htmlFences.length - 1].content, css, js)
}

export function detectMessageArtifact(
  markdown: string,
  options?: { allowOpen?: boolean }
): DetectedArtifact | undefined {
  if (!markdown) return undefined
  const fences = parseFencedBlocks(markdown, options)
  if (!fences.length) return undefined

  const htmlFences = fences.filter(
    (fence) =>
      mapLanguageToKind(fence.language, fence.content) === 'html' && isSubstantialPreview(fence.content, 'html')
  )
  const svgFences = fences.filter(
    (fence) => mapLanguageToKind(fence.language, fence.content) === 'svg' && isSubstantialPreview(fence.content, 'svg')
  )
  const mermaidFences = fences.filter(
    (fence) =>
      mapLanguageToKind(fence.language, fence.content) === 'mermaid' && isSubstantialPreview(fence.content, 'mermaid')
  )
  const markdownFences = fences.filter(
    (fence) =>
      mapLanguageToKind(fence.language, fence.content) === 'markdown' && isSubstantialPreview(fence.content, 'markdown')
  )
  const css = fences.filter((fence) => CSS_LANGUAGES.has(fence.language)).map((fence) => fence.content)
  const js = fences.filter((fence) => JS_LANGUAGES.has(fence.language)).map((fence) => fence.content)

  if (htmlFences.length) {
    const primary = htmlFences[htmlFences.length - 1]
    const content = combineHtmlDocument(primary.content, css, js)
    return {
      kind: 'html',
      language: 'html',
      content,
      title: inferArtifactTitle(content, 'html', 'html', primary.info),
    }
  }

  if (svgFences.length) {
    const primary = svgFences[svgFences.length - 1]
    return {
      kind: 'svg',
      language: 'svg',
      content: primary.content,
      title: inferArtifactTitle(primary.content, 'svg', 'svg', primary.info),
    }
  }

  if (mermaidFences.length) {
    const primary = mermaidFences[mermaidFences.length - 1]
    return {
      kind: 'mermaid',
      language: 'mermaid',
      content: primary.content,
      title: inferArtifactTitle(primary.content, 'mermaid', 'mermaid', primary.info),
    }
  }

  if (markdownFences.length) {
    const primary = markdownFences[markdownFences.length - 1]
    return {
      kind: 'markdown',
      language: 'markdown',
      content: primary.content,
      title: inferArtifactTitle(primary.content, 'markdown', 'markdown', primary.info),
    }
  }

  const codeFences = fences.filter((fence) => {
    return mapLanguageToKind(fence.language, fence.content) === 'code' && isSubstantialCode(fence.content)
  })
  if (codeFences.length === 1) {
    const primary = codeFences[0]
    const language = primary.language || 'text'
    return {
      kind: 'code',
      language,
      content: primary.content,
      title: inferArtifactTitle(primary.content, 'code', language, primary.info),
    }
  }

  return undefined
}

export function isContainRenderableCode(markdown: string): boolean {
  return Boolean(detectMessageArtifact(markdown, { allowOpen: true }))
}

function wrapHtmlForPreview(html: string): string {
  const trimmed = html.trim()
  if (!trimmed) return ''
  const hasDocument = /<!doctype/i.test(trimmed) || /<html[\s>]/i.test(trimmed)
  if (hasDocument) return trimmed
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<script src="https://cdn.tailwindcss.com?plugins=forms,typography,aspect-ratio,line-clamp,container-queries"></script>
</head>
<body>
${trimmed}
</body>
</html>`
}

export function buildHtmlPreviewDocument(content: string): string {
  const trimmed = content.trim()
  if (!trimmed) return ''
  if (trimmed.includes('```')) {
    const detected = detectMessageArtifact(content)
    if (detected?.kind === 'html') {
      return wrapHtmlForPreview(detected.content)
    }
    const extracted = extractCombinedHtml(parseFencedBlocks(content))
    if (extracted) return wrapHtmlForPreview(extracted)
  }
  return wrapHtmlForPreview(content)
}

export function buildSvgPreviewDocument(content: string): string {
  let svg = content.trim()
  if (svg.includes('```')) {
    const detected = detectMessageArtifact(content)
    if (detected?.kind === 'svg') {
      svg = detected.content.trim()
    } else {
      const fence = parseFencedBlocks(content).find(
        (block) => mapLanguageToKind(block.language, block.content) === 'svg'
      )
      if (fence) svg = fence.content.trim()
    }
  }
  if (!svg.includes('xmlns="http://www.w3.org/2000/svg"')) {
    svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')
  }
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  html, body {
    margin: 0;
    min-height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #fff;
  }
  svg { max-width: 100%; height: auto; }
</style>
</head>
<body>
${svg}
</body>
</html>`
}

export function buildVersionChain<T extends ArtifactVersionLike>(current: T, all: T[]): T[] {
  const byId = new Map(all.map((item) => [item.id, item]))
  if (!byId.has(current.id)) {
    byId.set(current.id, current)
  }

  const seen = new Set<string>()
  const backward: T[] = []
  let node: T | undefined = byId.get(current.id) ?? current
  while (node && !seen.has(node.id)) {
    seen.add(node.id)
    backward.unshift(node)
    node = node.previousVersionId ? byId.get(node.previousVersionId) : undefined
  }

  const children = new Map<string, T[]>()
  for (const item of byId.values()) {
    if (!item.previousVersionId) continue
    const list = children.get(item.previousVersionId) ?? []
    list.push(item)
    children.set(item.previousVersionId, list)
  }

  const chain = [...backward]
  const queue = [...(children.get(current.id) ?? [])]
  while (queue.length) {
    const next = queue.shift()
    if (!next || seen.has(next.id)) continue
    seen.add(next.id)
    chain.push(next)
    queue.push(...(children.get(next.id) ?? []))
  }

  return chain
}

export function collectArtifactVersions<T extends ArtifactVersionLike>(current: T, all: T[]): T[] {
  const chained = buildVersionChain(current, all)
  if (chained.length > 1) return chained
  if (all.length > 1) {
    return all.some((item) => item.id === current.id) ? all : [...all, current]
  }
  return chained
}

export function deriveMessageArtifacts(
  messageContent: string,
  options?: {
    existingArtifacts?: MessageArtifact[]
    previousArtifact?: MessageArtifact
  }
): MessageArtifact[] | undefined {
  const detected = detectMessageArtifact(messageContent)
  if (!detected) {
    return undefined
  }

  const existingArtifact = options?.existingArtifacts?.[0]
  const previousArtifact = options?.previousArtifact
  const resolvedTitle = isLegacyDefaultTitle(existingArtifact?.title)
    ? detected.title
    : (existingArtifact?.title ?? detected.title)
  const sameContent =
    existingArtifact && (existingArtifact.content === detected.content || existingArtifact.content === messageContent)

  if (
    existingArtifact &&
    sameContent &&
    existingArtifact.type === detected.kind &&
    existingArtifact.language === detected.language &&
    existingArtifact.title === resolvedTitle &&
    !isLegacyDefaultTitle(existingArtifact.title)
  ) {
    return options?.existingArtifacts
  }

  return [
    {
      id: existingArtifact?.id ?? uuidv4(),
      type: detected.kind,
      title: resolvedTitle,
      language: detected.language,
      content: detected.content,
      version: existingArtifact?.version ?? (previousArtifact?.version ?? 0) + 1,
      previousVersionId: existingArtifact?.previousVersionId ?? previousArtifact?.id,
      timestamp: existingArtifact?.timestamp ?? Date.now(),
    },
  ]
}
