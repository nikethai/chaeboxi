import { describe, expect, it } from 'vitest'
import { parseClaudeSettingsHooks } from './parse-claude-settings'

describe('parseClaudeSettingsHooks', () => {
  it('parses PreToolUse command hooks', () => {
    const json = JSON.stringify({
      hooks: {
        PreToolUse: [
          {
            matcher: 'Bash',
            hooks: [{ type: 'command', command: 'echo check', timeout: 5 }],
          },
        ],
      },
    })
    const hooks = parseClaudeSettingsHooks(json, {
      origin: 'claude',
      originPath: '~/.claude/settings.json',
    })
    expect(hooks).toHaveLength(1)
    expect(hooks[0].event).toBe('PreToolUse')
    expect(hooks[0].kind).toBe('command')
    expect(hooks[0].matcher).toBe('Bash')
    expect(hooks[0].command).toBe('echo check')
  })

  it('returns empty on invalid json', () => {
    expect(parseClaudeSettingsHooks('not-json', { origin: 'claude', originPath: 'x' })).toEqual([])
  })
})
