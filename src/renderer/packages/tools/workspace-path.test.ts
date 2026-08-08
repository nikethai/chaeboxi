import { describe, expect, it } from 'vitest'
import { resolveWorkspaceCwd, resolveWorkspacePath } from './workspace-path'

describe('resolveWorkspacePath', () => {
  const root = '/Users/dev/project'

  it('joins relative paths under the root', () => {
    const result = resolveWorkspacePath(root, 'src/App.tsx')
    expect(result).toEqual({ ok: true, absolutePath: '/Users/dev/project/src/App.tsx' })
  })

  it('allows absolute paths inside the root', () => {
    const result = resolveWorkspacePath(root, '/Users/dev/project/package.json')
    expect(result).toEqual({ ok: true, absolutePath: '/Users/dev/project/package.json' })
  })

  it('rejects path traversal outside the root', () => {
    const result = resolveWorkspacePath(root, '../secrets.txt')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/escape|outside/i)
    }
  })

  it('rejects absolute paths outside the root', () => {
    const result = resolveWorkspacePath(root, '/etc/passwd')
    expect(result.ok).toBe(false)
  })

  it('normalizes . and .. inside the root', () => {
    const result = resolveWorkspacePath(root, 'src/../src/./index.ts')
    expect(result).toEqual({ ok: true, absolutePath: '/Users/dev/project/src/index.ts' })
  })

  it('rejects empty path and empty root', () => {
    expect(resolveWorkspacePath('', 'a').ok).toBe(false)
    expect(resolveWorkspacePath(root, '  ').ok).toBe(false)
  })

  it('rejects relative workspace root', () => {
    expect(resolveWorkspacePath('relative/root', 'a').ok).toBe(false)
  })

  it('handles Windows-style roots and relative paths', () => {
    const winRoot = 'C:\\Users\\dev\\project'
    const result = resolveWorkspacePath(winRoot, 'src\\main.ts')
    expect(result).toEqual({ ok: true, absolutePath: 'C:/Users/dev/project/src/main.ts' })
  })

  it('rejects Windows path on different drive', () => {
    const result = resolveWorkspacePath('C:/Users/dev/project', 'D:/other/file.txt')
    expect(result.ok).toBe(false)
  })
})

describe('resolveWorkspaceCwd', () => {
  it('defaults to workspace root when cwd omitted', () => {
    expect(resolveWorkspaceCwd('/tmp/ws')).toEqual({ ok: true, absolutePath: '/tmp/ws' })
  })

  it('resolves nested cwd under workspace', () => {
    expect(resolveWorkspaceCwd('/tmp/ws', 'apps/web')).toEqual({
      ok: true,
      absolutePath: '/tmp/ws/apps/web',
    })
  })
})
