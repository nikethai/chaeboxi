import { describe, expect, it } from 'vitest'
import { validatePaths } from './pathValidator'

describe('validatePaths', () => {
  describe('safe paths', () => {
    it('allows commands with no paths', () => {
      const result = validatePaths('echo hello')
      expect(result.safe).toBe(true)
    })

    it('allows commands in user home directories', () => {
      const result = validatePaths('ls /home/user/projects')
      expect(result.safe).toBe(true)
    })

    it('allows commands with relative paths', () => {
      const result = validatePaths('cat ./src/index.ts')
      expect(result.safe).toBe(true)
    })

    it('allows safe cwd', () => {
      const result = validatePaths('ls', '/home/user/projects')
      expect(result.safe).toBe(true)
    })
  })

  describe('sensitive Unix paths', () => {
    it.each(['/etc', '/usr', '/bin', '/sbin', '/boot', '/dev', '/proc', '/sys', '/var/log', '/root'])(
      'rejects commands referencing %s',
      (path) => {
        const result = validatePaths(`cat ${path}/config`)
        expect(result.safe).toBe(false)
        expect(result.reason).toContain(path)
      }
    )

    it('rejects /Library/System', () => {
      const result = validatePaths('ls /Library/System/Extensions')
      expect(result.safe).toBe(false)
    })

    it('rejects /System', () => {
      const result = validatePaths('cat /System/Library/file')
      expect(result.safe).toBe(false)
    })
  })

  describe('sensitive Windows paths', () => {
    it('rejects C:\\Windows', () => {
      const result = validatePaths('dir C:\\Windows\\System32')
      expect(result.safe).toBe(false)
    })

    it('rejects C:\\Program Files', () => {
      const result = validatePaths('ls "C:\\Program Files\\App"')
      expect(result.safe).toBe(false)
    })
  })

  describe('sensitive path patterns', () => {
    it('rejects .ssh paths', () => {
      const result = validatePaths('cat /home/user/.ssh/id_rsa')
      expect(result.safe).toBe(false)
    })

    it('rejects .gnupg paths', () => {
      const result = validatePaths('ls /home/user/.gnupg/')
      expect(result.safe).toBe(false)
    })

    it('rejects .aws paths', () => {
      const result = validatePaths('cat /home/user/.aws/credentials')
      expect(result.safe).toBe(false)
    })

    it('rejects .kube paths', () => {
      const result = validatePaths('cat /home/user/.kube/config')
      expect(result.safe).toBe(false)
    })

    it('rejects .env files', () => {
      const result = validatePaths('cat /project/.env')
      expect(result.safe).toBe(false)
    })

    it('rejects .pem files', () => {
      const result = validatePaths('cat cert.pem')
      expect(result.safe).toBe(false)
    })

    it('rejects .key files', () => {
      const result = validatePaths('cat private.key')
      expect(result.safe).toBe(false)
    })

    it('rejects id_rsa references', () => {
      const result = validatePaths('cat id_rsa')
      expect(result.safe).toBe(false)
    })

    it('rejects id_ed25519 references', () => {
      const result = validatePaths('cat id_ed25519')
      expect(result.safe).toBe(false)
    })

    it('rejects .docker paths', () => {
      const result = validatePaths('cat /home/user/.docker/config.json')
      expect(result.safe).toBe(false)
    })

    it('rejects gcloud config paths', () => {
      const result = validatePaths('cat /home/user/.config/gcloud/credentials')
      expect(result.safe).toBe(false)
    })
  })

  describe('working directory validation', () => {
    it('rejects sensitive cwd', () => {
      const result = validatePaths('ls', '/etc/nginx')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('/etc')
    })

    it('rejects cwd inside system path', () => {
      const result = validatePaths('ls', '/usr/local/bin')
      expect(result.safe).toBe(false)
    })

    it('allows cwd in safe location', () => {
      const result = validatePaths('ls', '/home/user/project')
      expect(result.safe).toBe(true)
    })
  })

  describe('quoted paths', () => {
    it('detects paths in double quotes', () => {
      const result = validatePaths('cat "/etc/passwd"')
      expect(result.safe).toBe(false)
    })

    it('detects paths in single quotes', () => {
      const result = validatePaths("cat '/etc/shadow'")
      expect(result.safe).toBe(false)
    })
  })
})
