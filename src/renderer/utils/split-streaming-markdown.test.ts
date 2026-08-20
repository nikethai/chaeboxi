import { describe, expect, it } from 'vitest'
import { nextFrozenMarkdownSplit, splitStreamingMarkdown } from './split-streaming-markdown'

describe('splitStreamingMarkdown', () => {
  it('returns no settled part when there is no blank line yet', () => {
    expect(splitStreamingMarkdown('hello world')).toEqual({ settled: '', tail: 'hello world' })
  })

  it('splits at the last blank line, keeping the in-progress tail', () => {
    expect(splitStreamingMarkdown('alpha\n\nbeta\n\ngam')).toEqual({
      settled: 'alpha\n\nbeta\n\n',
      tail: 'gam',
    })
  })

  it('never splits inside an open code fence', () => {
    const text = 'intro\n\n```js\nconst a = 1\n\nconst b = 2'
    expect(splitStreamingMarkdown(text)).toEqual({
      settled: 'intro\n\n',
      tail: '```js\nconst a = 1\n\nconst b = 2',
    })
  })

  it('settles a closed code fence once a blank line follows it', () => {
    const text = 'intro\n\n```js\nconst a = 1\n\nconst b = 2\n```\n\nafter'
    expect(splitStreamingMarkdown(text)).toEqual({
      settled: 'intro\n\n```js\nconst a = 1\n\nconst b = 2\n```\n\n',
      tail: 'after',
    })
  })

  it('never splits inside a display-math block', () => {
    const text = 'intro\n\n$$\nx^2\n\ny^2'
    expect(splitStreamingMarkdown(text)).toEqual({
      settled: 'intro\n\n',
      tail: '$$\nx^2\n\ny^2',
    })
  })

  it('keeps the whole thing as tail when the only blank line is trailing', () => {
    // "abc\n\n" → the final blank line is the last line, so nothing safe to settle past it
    const { settled, tail } = splitStreamingMarkdown('abc\n\n')
    expect(settled + tail).toBe('abc\n\n')
  })

  it('settled + tail always reconstruct the original text', () => {
    const samples = [
      '',
      'no breaks at all',
      'a\n\nb',
      '# Title\n\n- one\n- two\n\npara **bold** `code`\n\n```py\nx=1\n\ny=2\n```\n\ndone',
      '$$\nE=mc^2\n$$\n\nafter',
    ]
    for (const s of samples) {
      const { settled, tail } = splitStreamingMarkdown(s)
      expect(settled + tail).toBe(s)
    }
  })
})

describe('nextFrozenMarkdownSplit', () => {
  it('freezes the live split after generating ends so settled blocks stay mounted', () => {
    const text = 'alpha\n\nbeta'
    const live = nextFrozenMarkdownSplit(text, true, null)
    expect(live).toEqual({ settled: 'alpha\n\n', tail: 'beta', source: text })
    expect(nextFrozenMarkdownSplit(text, false, live)).toEqual(live)
  })

  it('does not freeze short answers with no block boundary', () => {
    expect(nextFrozenMarkdownSplit('hello', true, null)).toBeNull()
    expect(nextFrozenMarkdownSplit('hello', false, null)).toBeNull()
  })

  it('drops the freeze if the finished text changed after settle', () => {
    const live = nextFrozenMarkdownSplit('alpha\n\nbeta', true, null)
    expect(nextFrozenMarkdownSplit('alpha\n\nbeta extra', false, live)).toBeNull()
  })
})
