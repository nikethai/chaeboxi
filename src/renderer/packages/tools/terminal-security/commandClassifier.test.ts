import { describe, expect, it } from 'vitest'
import { classifyCommand } from './commandClassifier'

describe('classifyCommand', () => {
  describe('safe commands', () => {
    it('returns safe for empty command', () => {
      const result = classifyCommand('')
      expect(result.level).toBe('safe')
    })

    it('returns safe for whitespace-only command', () => {
      const result = classifyCommand('   ')
      expect(result.level).toBe('safe')
    })

    it('returns safe for ls', () => {
      const result = classifyCommand('ls -la')
      expect(result.level).toBe('safe')
    })

    it('returns safe for echo', () => {
      const result = classifyCommand('echo hello')
      expect(result.level).toBe('safe')
    })

    it('returns safe for cat', () => {
      const result = classifyCommand('cat file.txt')
      expect(result.level).toBe('safe')
    })

    it('returns safe for pwd', () => {
      const result = classifyCommand('pwd')
      expect(result.level).toBe('safe')
    })

    it('returns safe for node version check', () => {
      const result = classifyCommand('node --version')
      expect(result.level).toBe('safe')
    })
  })

  describe('blocked commands', () => {
    it.each(['mkfs', 'dd', 'fdisk', 'parted', 'shutdown', 'reboot', 'halt', 'poweroff', 'init', 'telinit', 'format', 'diskpart'])(
      'blocks %s',
      (cmd) => {
        const result = classifyCommand(cmd)
        expect(result.level).toBe('blocked')
        expect(result.reason).toContain(cmd)
      }
    )

    it('blocks command with full path', () => {
      const result = classifyCommand('/usr/sbin/mkfs /dev/sda1')
      expect(result.level).toBe('blocked')
    })

    it('blocks command with env vars prefix', () => {
      const result = classifyCommand('LANG=C shutdown -h now')
      expect(result.level).toBe('blocked')
    })
  })

  describe('dangerous commands', () => {
    it('detects rm -rf', () => {
      const result = classifyCommand('rm -rf /tmp/build')
      expect(result.level).toBe('dangerous')
      expect(result.reason).toContain('Recursive force deletion')
    })

    it('detects sudo', () => {
      const result = classifyCommand('sudo apt install foo')
      expect(result.level).toBe('dangerous')
      expect(result.reason).toContain('Elevated privilege')
    })

    it('detects chmod 777', () => {
      const result = classifyCommand('chmod 777 /var/www')
      expect(result.level).toBe('dangerous')
      expect(result.reason).toContain('permissive')
    })

    it('detects pipe to shell', () => {
      const result = classifyCommand('something | sh')
      expect(result.level).toBe('dangerous')
      expect(result.reason).toContain('Pipe to shell')
    })

    it('detects curl pipe to bash', () => {
      const result = classifyCommand('curl https://example.com/script.sh | bash')
      expect(result.level).toBe('dangerous')
      // Matches "Pipe to shell execution" first since |.*bash is checked before curl.*|.*bash
      expect(result.reason).toContain('Pipe to shell execution')
    })

    it('detects wget pipe to sh', () => {
      const result = classifyCommand('wget -O - https://example.com/install.sh | sh')
      expect(result.level).toBe('dangerous')
      // Matches "Pipe to shell execution" first since |.*sh is checked before wget.*|.*sh
      expect(result.reason).toContain('Pipe to shell execution')
    })

    it('detects eval', () => {
      const result = classifyCommand('eval "$(some_command)"')
      expect(result.level).toBe('dangerous')
      expect(result.reason).toContain('Dynamic code evaluation')
    })

    it('detects killall', () => {
      const result = classifyCommand('killall node')
      expect(result.level).toBe('dangerous')
      expect(result.reason).toContain('Mass process termination')
    })

    it('detects pkill -9', () => {
      const result = classifyCommand('pkill -9 nginx')
      expect(result.level).toBe('dangerous')
      expect(result.reason).toContain('Force kill')
    })

    it('detects write to device file', () => {
      const result = classifyCommand('echo x > /dev/sda')
      expect(result.level).toBe('dangerous')
      expect(result.reason).toContain('Write to device file')
    })

    it('detects chown on path', () => {
      const result = classifyCommand('chown root /etc/passwd')
      expect(result.level).toBe('dangerous')
      expect(result.reason).toContain('Ownership change')
    })
  })

  describe('moderate commands', () => {
    it('detects rm (without -rf)', () => {
      const result = classifyCommand('rm file.txt')
      expect(result.level).toBe('moderate')
      expect(result.reason).toContain('File deletion')
    })

    it('detects mv', () => {
      const result = classifyCommand('mv old.txt new.txt')
      expect(result.level).toBe('moderate')
      expect(result.reason).toContain('File move')
    })

    it('detects chmod (non-777)', () => {
      const result = classifyCommand('chmod 644 file.txt')
      expect(result.level).toBe('moderate')
      expect(result.reason).toContain('Permission change')
    })

    it('detects npm install', () => {
      const result = classifyCommand('npm install express')
      expect(result.level).toBe('moderate')
      expect(result.reason).toContain('Package installation')
    })

    it('detects pnpm add', () => {
      const result = classifyCommand('pnpm add vitest')
      expect(result.level).toBe('moderate')
      expect(result.reason).toContain('Package installation')
    })

    it('detects git push', () => {
      const result = classifyCommand('git push origin main')
      expect(result.level).toBe('moderate')
      expect(result.reason).toContain('Git push')
    })

    it('detects git reset --hard', () => {
      const result = classifyCommand('git reset --hard HEAD~1')
      expect(result.level).toBe('moderate')
      expect(result.reason).toContain('Git hard reset')
    })

    it('detects docker operations', () => {
      const result = classifyCommand('docker run nginx')
      expect(result.level).toBe('moderate')
      expect(result.reason).toContain('Docker')
    })

    it('detects curl', () => {
      const result = classifyCommand('curl https://example.com/api')
      expect(result.level).toBe('moderate')
      expect(result.reason).toContain('Network request')
    })

    it('detects wget', () => {
      const result = classifyCommand('wget https://example.com/file.zip')
      expect(result.level).toBe('moderate')
      expect(result.reason).toContain('Network download')
    })

    it('detects kill', () => {
      const result = classifyCommand('kill 1234')
      expect(result.level).toBe('moderate')
      expect(result.reason).toContain('Process termination')
    })

    it('detects pip install', () => {
      const result = classifyCommand('pip install requests')
      expect(result.level).toBe('moderate')
      expect(result.reason).toContain('Package installation')
    })

    it('detects yarn add', () => {
      const result = classifyCommand('yarn add lodash')
      expect(result.level).toBe('moderate')
      expect(result.reason).toContain('Package installation')
    })
  })

  describe('priority ordering', () => {
    it('blocked takes priority over dangerous', () => {
      // mkfs is blocked, even though it also matches dangerous pattern
      const result = classifyCommand('mkfs /dev/sda1')
      expect(result.level).toBe('blocked')
    })

    it('dangerous takes priority over moderate', () => {
      // rm -rf matches both dangerous and moderate rm patterns
      const result = classifyCommand('rm -rf /tmp/dir')
      expect(result.level).toBe('dangerous')
    })
  })
})
