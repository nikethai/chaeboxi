import { describe, expect, it } from 'vitest'
import {
  brewCandidatePaths,
  installerLabel,
  parseYtDlpVersion,
  pathPrefixForShell,
  ytDlpCandidatePaths,
} from './yt-dlp-install'

describe('yt-dlp-install helpers', () => {
  it('parses version strings from yt-dlp --version', () => {
    expect(parseYtDlpVersion('2024.08.06')).toBe('2024.08.06')
    expect(parseYtDlpVersion('yt-dlp 2024.08.06\n')).toBe('2024.08.06')
    expect(parseYtDlpVersion('2025.01.15.1')).toBe('2025.01.15.1')
  })

  it('lists mac homebrew candidates', () => {
    const paths = ytDlpCandidatePaths('Mac')
    expect(paths.some((p) => p.includes('homebrew'))).toBe(true)
    expect(brewCandidatePaths()[0]).toContain('homebrew')
  })

  it('prefixes PATH for mac shell probes', () => {
    const prefix = pathPrefixForShell('Mac')
    expect(prefix).toContain('/opt/homebrew/bin')
    expect(prefix).toContain('export PATH')
  })

  it('labels installers for UI', () => {
    expect(installerLabel('brew')).toBe('Homebrew')
    expect(installerLabel('winget')).toBe('winget')
    expect(installerLabel('pipx')).toBe('pipx')
  })
})
