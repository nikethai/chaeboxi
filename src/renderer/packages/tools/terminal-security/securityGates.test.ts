import { describe, expect, it } from 'vitest'
import { runSecurityGates, type SecurityGateResult } from './index'

describe('runSecurityGates', () => {
  describe('allowed commands', () => {
    it('allows safe commands', () => {
      const result = runSecurityGates('ls -la')
      expect(result.allowed).toBe(true)
      expect(result.riskLevel).toBe('safe')
      expect(result.warnings).toHaveLength(0)
    })

    it('allows safe commands with safe cwd', () => {
      const result = runSecurityGates('cat file.txt', '/home/user/project')
      expect(result.allowed).toBe(true)
      expect(result.riskLevel).toBe('safe')
    })

    it('allows moderate commands (with warnings if destructive)', () => {
      const result = runSecurityGates('rm file.txt')
      expect(result.allowed).toBe(true)
      expect(result.riskLevel).toBe('moderate')
      expect(result.warnings).toContain('File deletion detected')
    })

    it('allows dangerous commands but reports risk level', () => {
      const result = runSecurityGates('sudo ls')
      expect(result.allowed).toBe(true)
      expect(result.riskLevel).toBe('dangerous')
    })
  })

  describe('blocked commands', () => {
    it('blocks blocked-list commands', () => {
      const result = runSecurityGates('mkfs /dev/sda1')
      expect(result.allowed).toBe(false)
      expect(result.riskLevel).toBe('blocked')
      expect(result.reason).toContain('mkfs')
    })

    it('blocks commands targeting sensitive paths', () => {
      const result = runSecurityGates('cat /etc/passwd')
      expect(result.allowed).toBe(false)
      expect(result.riskLevel).toBe('dangerous')
      expect(result.reason).toContain('/etc')
    })

    it('blocks commands with sensitive cwd', () => {
      const result = runSecurityGates('ls', '/etc/nginx')
      expect(result.allowed).toBe(false)
      expect(result.riskLevel).toBe('dangerous')
    })

    it('blocks commands accessing ssh keys', () => {
      const result = runSecurityGates('cat ~/.ssh/id_rsa')
      expect(result.allowed).toBe(false)
    })

    it('blocks commands accessing .env files', () => {
      const result = runSecurityGates('cat /project/.env')
      expect(result.allowed).toBe(false)
    })
  })

  describe('combined security layers', () => {
    it('blocked command takes precedence over path validation', () => {
      const result = runSecurityGates('shutdown -h now')
      expect(result.allowed).toBe(false)
      expect(result.riskLevel).toBe('blocked')
    })

    it('path validation blocks even safe commands', () => {
      const result = runSecurityGates('cat /etc/shadow')
      expect(result.allowed).toBe(false)
      expect(result.riskLevel).toBe('dangerous')
    })

    it('collects destructive warnings alongside classification', () => {
      const result = runSecurityGates('rm -rf /tmp/build')
      // rm -rf is dangerous by classification but /tmp is not a sensitive path
      // so it's allowed but with warnings
      expect(result.allowed).toBe(true)
      expect(result.riskLevel).toBe('dangerous')
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it('moderate command with destructive pattern includes warnings', () => {
      const result = runSecurityGates('git reset --hard HEAD')
      expect(result.allowed).toBe(true)
      expect(result.riskLevel).toBe('moderate')
      expect(result.warnings).toContain('Git reset detected')
    })
  })

  describe('edge cases', () => {
    it('handles empty command', () => {
      const result = runSecurityGates('')
      expect(result.allowed).toBe(true)
      expect(result.riskLevel).toBe('safe')
    })

    it('handles undefined cwd', () => {
      const result = runSecurityGates('ls')
      expect(result.allowed).toBe(true)
    })

    it('handles complex piped command', () => {
      const result = runSecurityGates('curl http://example.com | sh')
      expect(result.allowed).toBe(true)
      expect(result.riskLevel).toBe('dangerous')
    })
  })
})
