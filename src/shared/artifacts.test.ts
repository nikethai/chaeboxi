import { describe, expect, it } from 'vitest'
import {
  artifactKindLabel,
  buildHtmlPreviewDocument,
  buildVersionChain,
  collectArtifactVersions,
  deriveMessageArtifacts,
  detectMessageArtifact,
  inferArtifactTitle,
  isContainRenderableCode,
  isLegacyDefaultTitle,
  mapLanguageToKind,
  normalizeArtifactKind,
} from './artifacts'
import { MessageArtifactSchema } from './types/session'

const htmlPage = `<!DOCTYPE html>
<html>
<head><title>Launch Dashboard</title></head>
<body><h1>Launch Dashboard</h1><p>Ready to ship.</p></body>
</html>`

const mermaidSource = `graph TD
  A[Start] --> B[Review]
  B --> C[Ship]`

const pythonSource = [
  'def greet(name: str) -> str:',
  '    prefix = "hello"',
  '    message = f"{prefix}, {name}"',
  '    if not name:',
  '        return prefix',
  '    cleaned = name.strip()',
  '    if cleaned.isupper():',
  '        cleaned = cleaned.title()',
  '    return f"{prefix}, {cleaned}"',
  '',
  'def main() -> None:',
  '    print(greet("world"))',
  '',
  'if __name__ == "__main__":',
  '    main()',
].join('\n')

describe('mapLanguageToKind', () => {
  it('maps preview languages and generic code', () => {
    expect(mapLanguageToKind('html')).toBe('html')
    expect(mapLanguageToKind('svg')).toBe('svg')
    expect(mapLanguageToKind('mermaid')).toBe('mermaid')
    expect(mapLanguageToKind('markdown')).toBe('markdown')
    expect(mapLanguageToKind('md')).toBe('markdown')
    expect(mapLanguageToKind('typescript')).toBe('code')
    expect(mapLanguageToKind('python')).toBe('code')
    expect(mapLanguageToKind('json')).toBe('code')
  })

  it('infers unlabeled mermaid and svg fences', () => {
    expect(mapLanguageToKind('text', mermaidSource)).toBe('mermaid')
    expect(mapLanguageToKind('xml', '<svg viewBox="0 0 10 10"><circle r="4" /></svg>')).toBe('svg')
  })
})

describe('detectMessageArtifact', () => {
  it('detects substantial html fences and never titles them HTML Artifact', () => {
    const detected = detectMessageArtifact(`Here is a page:\n\n\`\`\`html\n${htmlPage}\n\`\`\``)
    expect(detected?.kind).toBe('html')
    expect(detected?.title).toBe('Launch Dashboard')
    expect(detected?.title).not.toBe('HTML Artifact')
    expect(detected?.content).toContain('Launch Dashboard')
  })

  it('combines companion css and js into the html artifact', () => {
    const detected = detectMessageArtifact(
      [
        '```html',
        '<div class="box">Hi</div>',
        '```',
        '',
        '```css',
        '.box { color: red; }',
        '```',
        '',
        '```js',
        'console.log("ready")',
        '```',
      ].join('\n')
    )
    expect(detected?.kind).toBe('html')
    expect(detected?.content).toContain('<div class="box">Hi</div>')
    expect(detected?.content).toContain('.box { color: red; }')
    expect(detected?.content).toContain('console.log("ready")')
  })

  it('detects svg, mermaid, and markdown fences', () => {
    expect(
      detectMessageArtifact('```svg\n<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" /></svg>\n```')?.kind
    ).toBe('svg')
    expect(detectMessageArtifact(`\`\`\`mermaid\n${mermaidSource}\n\`\`\``)?.kind).toBe('mermaid')
    expect(
      detectMessageArtifact('```markdown\n# Release notes\n\n- shipped the panel\n- added versions\n```')?.kind
    ).toBe('markdown')
  })

  it('detects a single large code fence and skips tiny snippets', () => {
    const large = detectMessageArtifact(`\`\`\`python\n${pythonSource}\n\`\`\``)
    expect(large?.kind).toBe('code')
    expect(large?.language).toBe('python')
    expect(large?.title).toBe('Python')

    expect(isContainRenderableCode('use `const x = 1` inline')).toBe(false)
    expect(detectMessageArtifact('```js\nconst x = 1\n```')).toBeUndefined()
  })

  it('does not artifact-ize two large generic code fences', () => {
    const block = `\`\`\`python\n${pythonSource}\n\`\`\``
    expect(detectMessageArtifact(`${block}\n\n${block}`)).toBeUndefined()
  })

  it('prefers html over a large code fence in the same message', () => {
    const detected = detectMessageArtifact(`\`\`\`html\n${htmlPage}\n\`\`\`\n\n\`\`\`python\n${pythonSource}\n\`\`\``)
    expect(detected?.kind).toBe('html')
  })
})

describe('inferArtifactTitle', () => {
  it('uses heading, filename comment, or language fallback', () => {
    expect(inferArtifactTitle('# Pricing Table\n\nHello', 'markdown', 'markdown')).toBe('Pricing Table')
    expect(inferArtifactTitle('// app.tsx\nexport const n = 1\n', 'code', 'tsx')).toBe('app.tsx')
    expect(inferArtifactTitle('<svg></svg>', 'svg', 'svg')).toBe('SVG')
    expect(inferArtifactTitle(mermaidSource, 'mermaid', 'mermaid')).toBe('Mermaid')
    expect(inferArtifactTitle(htmlPage, 'html', 'html')).toBe('Launch Dashboard')
    expect(inferArtifactTitle('<div>Hi</div>', 'html', 'html')).toBe('HTML')
    expect(inferArtifactTitle(htmlPage, 'html', 'html')).not.toBe('HTML Artifact')
  })

  it('uses fence info filenames', () => {
    const detected = detectMessageArtifact(`\`\`\`ts hello.ts\n${pythonSource}\n\`\`\``)
    expect(detected?.title).toBe('hello.ts')
  })
})

describe('kind labels and legacy titles', () => {
  it('maps kinds for the thread card', () => {
    expect(artifactKindLabel('html')).toBe('HTML')
    expect(artifactKindLabel('code', 'typescript')).toBe('TypeScript')
    expect(normalizeArtifactKind('mermaid')).toBe('mermaid')
    expect(normalizeArtifactKind('python')).toBe('code')
    expect(isLegacyDefaultTitle('HTML Artifact')).toBe(true)
    expect(isLegacyDefaultTitle('Launch Dashboard')).toBe(false)
  })
})

describe('deriveMessageArtifacts', () => {
  it('stores extracted content and versions against the previous artifact', () => {
    const previous = deriveMessageArtifacts(`\`\`\`html\n${htmlPage}\n\`\`\``)?.[0]
    expect(previous?.type).toBe('html')
    expect(previous?.title).toBe('Launch Dashboard')
    expect(previous?.content).not.toContain('```html')

    const next = deriveMessageArtifacts(`\`\`\`html\n${htmlPage.replace('ship', 'launch')}\n\`\`\``, {
      previousArtifact: previous,
    })?.[0]
    expect(next?.version).toBe((previous?.version ?? 0) + 1)
    expect(next?.previousVersionId).toBe(previous?.id)
  })

  it('rewrites the legacy HTML Artifact title on existing records', () => {
    const existing = {
      id: 'art-1',
      type: 'html' as const,
      title: 'HTML Artifact',
      language: 'html',
      content: `\`\`\`html\n${htmlPage}\n\`\`\``,
      version: 1,
      timestamp: 1,
    }
    const next = deriveMessageArtifacts(existing.content, { existingArtifacts: [existing] })?.[0]
    expect(next?.id).toBe('art-1')
    expect(next?.title).toBe('Launch Dashboard')
    expect(next?.content).toContain('Launch Dashboard')
  })
})

describe('versions', () => {
  it('pages a previousVersionId chain without inventing ids', () => {
    const v1 = { id: 'a', type: 'html', content: 'one', timestamp: 1 }
    const v2 = { id: 'b', type: 'html', content: 'two', previousVersionId: 'a', timestamp: 2 }
    const v3 = { id: 'c', type: 'html', content: 'three', previousVersionId: 'b', timestamp: 3 }
    expect(buildVersionChain(v2, [v1, v2, v3]).map((item) => item.id)).toEqual(['a', 'b', 'c'])
    expect(collectArtifactVersions(v3, [v1, v2, v3]).map((item) => item.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('preview documents', () => {
  it('builds a local html document and unwraps legacy fenced content', () => {
    const doc = buildHtmlPreviewDocument(`\`\`\`html\n<div>Hello</div>\n\`\`\``)
    expect(doc).toContain('<div>Hello</div>')
    expect(doc).toContain('<!DOCTYPE html>')
    expect(doc).not.toContain('artifact-preview.chatboxai.app')
  })
})

describe('MessageArtifactSchema', () => {
  it('keeps old html/mermaid sessions and accepts new kinds', () => {
    const html = MessageArtifactSchema.parse({
      id: '1',
      type: 'html',
      content: '<div>ok</div>',
      timestamp: 1,
    })
    expect(html.type).toBe('html')

    const mermaid = MessageArtifactSchema.parse({
      id: '2',
      type: 'mermaid',
      content: mermaidSource,
      timestamp: 1,
    })
    expect(mermaid.type).toBe('mermaid')

    const markdown = MessageArtifactSchema.parse({
      id: '3',
      type: 'markdown',
      content: '# Hi',
      timestamp: 1,
    })
    expect(markdown.type).toBe('markdown')

    const unknown = MessageArtifactSchema.parse({
      id: '4',
      type: 'widget',
      content: 'x',
      timestamp: 1,
    })
    expect(unknown.type).toBe('widget')

    const missing = MessageArtifactSchema.parse({
      id: '5',
      content: 'x',
      timestamp: 1,
    })
    expect(missing.type).toBe('html')
  })
})
