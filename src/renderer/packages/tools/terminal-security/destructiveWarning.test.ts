import { describe, expect, it } from 'vitest'
import { checkDestructive } from './destructiveWarning'

describe('checkDestructive', () => {
  describe('non-destructive commands', () => {
    it('returns no warnings for ls', () => {
      const result = checkDestructive('ls -la')
      expect(result.isDestructive).toBe(false)
      expect(result.warnings).toHaveLength(0)
    })

    it('returns no warnings for cat', () => {
      const result = checkDestructive('cat file.txt')
      expect(result.isDestructive).toBe(false)
      expect(result.warnings).toHaveLength(0)
    })

    it('returns no warnings for echo', () => {
      const result = checkDestructive('echo hello')
      expect(result.isDestructive).toBe(false)
      expect(result.warnings).toHaveLength(0)
    })

    it('returns no warnings for grep', () => {
      const result = checkDestructive('grep -r "pattern" src/')
      expect(result.isDestructive).toBe(false)
      expect(result.warnings).toHaveLength(0)
    })
  })

  describe('file deletion', () => {
    it('warns on rm', () => {
      const result = checkDestructive('rm file.txt')
      expect(result.isDestructive).toBe(true)
      expect(result.warnings).toContain('File deletion detected')
    })

    it('warns on rmdir', () => {
      const result = checkDestructive('rmdir empty_dir')
      expect(result.isDestructive).toBe(true)
      expect(result.warnings).toContain('Directory removal detected')
    })

    it('warns on shred', () => {
      const result = checkDestructive('shred -u file.txt')
      expect(result.isDestructive).toBe(true)
      expect(result.warnings).toContain('Secure file deletion detected')
    })
  })

  describe('file overwrite', () => {
    it('warns on redirect overwrite', () => {
      const result = checkDestructive('echo data > output.txt')
      expect(result.isDestructive).toBe(true)
      expect(result.warnings).toContain('File overwrite via redirect detected')
    })

    it('warns on truncate', () => {
      const result = checkDestructive('truncate -s 0 logfile.log')
      expect(result.isDestructive).toBe(true)
      expect(result.warnings).toContain('File truncation detected')
    })
  })

  describe('database operations', () => {
    it('warns on DROP TABLE', () => {
      const result = checkDestructive('mysql -e "DROP TABLE users"')
      expect(result.isDestructive).toBe(true)
      expect(result.warnings).toContain('Database drop operation detected')
    })

    it('warns on DROP DATABASE (case insensitive)', () => {
      const result = checkDestructive('psql -c "drop database mydb"')
      expect(result.isDestructive).toBe(true)
      expect(result.warnings).toContain('Database drop operation detected')
    })

    it('warns on DELETE FROM', () => {
      const result = checkDestructive('mysql -e "DELETE FROM users WHERE id > 0"')
      expect(result.isDestructive).toBe(true)
      expect(result.warnings).toContain('Database delete operation detected')
    })
  })

  describe('git destructive operations', () => {
    it('warns on git reset', () => {
      const result = checkDestructive('git reset --hard HEAD~1')
      expect(result.isDestructive).toBe(true)
      expect(result.warnings).toContain('Git reset detected')
    })

    it('warns on git clean', () => {
      const result = checkDestructive('git clean -fd')
      expect(result.isDestructive).toBe(true)
      expect(result.warnings).toContain('Git clean detected')
    })

    it('warns on git checkout -- file', () => {
      const result = checkDestructive('git checkout -- src/index.ts')
      expect(result.isDestructive).toBe(true)
      expect(result.warnings).toContain('Git file discard detected')
    })

    it('warns on git push --force', () => {
      const result = checkDestructive('git push origin main --force')
      expect(result.isDestructive).toBe(true)
      expect(result.warnings).toContain('Git force push detected')
    })
  })

  describe('disk operations', () => {
    it('warns on wipe', () => {
      const result = checkDestructive('wipe /dev/sda')
      expect(result.isDestructive).toBe(true)
      expect(result.warnings).toContain('Disk wipe detected')
    })

    it('warns on format', () => {
      const result = checkDestructive('format C:')
      expect(result.isDestructive).toBe(true)
      expect(result.warnings).toContain('Format operation detected')
    })
  })

  describe('multiple warnings', () => {
    it('collects multiple warnings for compound destructive command', () => {
      // rm triggers file deletion, > triggers file overwrite
      const result = checkDestructive('rm old.txt && echo "done" > log.txt')
      expect(result.isDestructive).toBe(true)
      expect(result.warnings.length).toBeGreaterThanOrEqual(2)
    })
  })
})
