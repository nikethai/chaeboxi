import { describe, expect, it } from 'vitest'
import {
  isProjectRelativePath,
  joinWorkspaceRoot,
  resolveAgentRootPathList,
  resolveAgentRootPaths,
} from './resolve-roots'

describe('joinWorkspaceRoot', () => {
  it('joins unix workspace with relative project path', () => {
    expect(joinWorkspaceRoot('/Users/me/repo', './.claude/skills')).toBe('/Users/me/repo/.claude/skills')
  })

  it('strips trailing slash on workspace', () => {
    expect(joinWorkspaceRoot('/Users/me/repo/', './.cursor/commands')).toBe(
      '/Users/me/repo/.cursor/commands'
    )
  })

  it('handles windows-style base', () => {
    expect(joinWorkspaceRoot('C:\\Users\\me\\repo', './.claude/hooks')).toBe(
      'C:\\Users\\me\\repo\\.claude\\hooks'
    )
  })
})

describe('resolveAgentRootPaths', () => {
  const specs = [
    { origin: 'project', path: './.claude/skills' },
    { origin: 'claude', path: '~/.claude/skills' },
    { origin: 'cursor', path: '~/.cursor/skills' },
  ]

  it('binds project roots to workspaceRoot when set', () => {
    const resolved = resolveAgentRootPaths(specs, { workspaceRoot: '/proj' })
    expect(resolved[0]).toEqual({
      origin: 'project',
      path: '/proj/.claude/skills',
      workspaceBound: true,
    })
    expect(resolved[1].path).toBe('~/.claude/skills')
    expect(resolved[1].workspaceBound).toBe(false)
  })

  it('leaves project-relative paths when no workspace (CWD fallback)', () => {
    const resolved = resolveAgentRootPaths(specs, {})
    expect(resolved[0]).toEqual({
      origin: 'project',
      path: './.claude/skills',
      workspaceBound: false,
    })
  })

  it('resolveAgentRootPathList returns path strings only', () => {
    const list = resolveAgentRootPathList(specs, { workspaceRoot: '/ws' })
    expect(list).toEqual(['/ws/.claude/skills', '~/.claude/skills', '~/.cursor/skills'])
  })
})

describe('isProjectRelativePath', () => {
  it('detects ./ paths', () => {
    expect(isProjectRelativePath('./.claude/skills')).toBe(true)
    expect(isProjectRelativePath('~/.claude/skills')).toBe(false)
  })
})
