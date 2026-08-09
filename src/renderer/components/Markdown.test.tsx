/**
 * @vitest-environment jsdom
 */

import { MantineProvider } from '@mantine/core'
import type { SearchCitation } from '@shared/types'
import { render, screen } from '@testing-library/react'
import Markdown from './Markdown'

vi.mock('@/platform', () => ({
  default: {
    openLink: vi.fn(),
  },
  platformCapabilities: {
    isMobileLayout: false,
    isAndroidRuntime: false,
    supportsMcpBootstrap: true,
    supportsMcpStdio: true,
    supportsKnowledgeBase: true,
    supportsDesktopOnlySettings: true,
    supportsAgentSkillScan: true,
  },
}))

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

describe('Markdown citation rendering', () => {
  const citations: SearchCitation[] = [
    {
      index: 1,
      url: 'https://example.com/gold',
      title: 'Gold price',
      source: 'builtin',
      accessedAt: Date.now(),
    },
  ]

  const renderMarkdown = (content: string) =>
    render(
      <MantineProvider>
        <Markdown citations={citations}>{content}</Markdown>
      </MantineProvider>
    )

  it('renders citation markers without crashing', () => {
    renderMarkdown('Gold pricing chart [1]')

    expect(screen.getByText('[1]')).not.toBeNull()
  })

  it('does not rewrite citation-like text inside markdown links', () => {
    const { container } = renderMarkdown('[Gold pricing chart [1]](https://charts.example.com)')

    const externalLink = container.querySelector('a[href="https://charts.example.com"]')

    expect(externalLink).not.toBeNull()
    expect(externalLink?.textContent).toBe('Gold pricing chart [1]')
    expect(container.querySelector('sup')).toBeNull()
  })
})
