import { describe, expect, it } from 'vitest'
import {
  clampWaitSeconds,
  frontmostMatchesTarget,
  isBlockedMessagingOpenApp,
  isMessagingTargetApp,
  isSpotlightLikeKey,
  pruneOldImageParts,
  shouldForceComputerScreenshot,
} from './computer-harness'

describe('computer-harness messaging guards', () => {
  it('detects messaging apps', () => {
    expect(isMessagingTargetApp('WhatsApp')).toBe(true)
    expect(isMessagingTargetApp('Telegram')).toBe(true)
    expect(isMessagingTargetApp('Calculator')).toBe(false)
  })

  it('blocks Finder for messaging diversion', () => {
    expect(isBlockedMessagingOpenApp('Finder')).toBe(true)
    expect(isBlockedMessagingOpenApp('Finder.app')).toBe(true)
    expect(isBlockedMessagingOpenApp('WhatsApp')).toBe(false)
  })

  it('detects Spotlight chords', () => {
    expect(isSpotlightLikeKey('cmd+space')).toBe(true)
    expect(isSpotlightLikeKey('Command + Space')).toBe(true)
    expect(isSpotlightLikeKey('meta+f')).toBe(false)
    expect(isSpotlightLikeKey('enter')).toBe(false)
  })
})

describe('frontmostMatchesTarget', () => {
  it('matches loosely', () => {
    expect(frontmostMatchesTarget('WhatsApp', 'WhatsApp')).toBe(true)
    expect(frontmostMatchesTarget('WhatsApp Helper', 'WhatsApp')).toBe(true)
    expect(frontmostMatchesTarget('Finder', 'WhatsApp')).toBe(false)
    expect(frontmostMatchesTarget('', 'WhatsApp')).toBe(true)
  })
})

describe('shouldForceComputerScreenshot', () => {
  it('forces after open when no embed', () => {
    expect(shouldForceComputerScreenshot('computer_open_app', false)).toBe(true)
    expect(shouldForceComputerScreenshot('computer_open_app', true)).toBe(false)
    expect(shouldForceComputerScreenshot('computer_click', false)).toBe(true)
    expect(shouldForceComputerScreenshot('computer_screenshot', false)).toBe(false)
  })
})

describe('pruneOldImageParts', () => {
  it('keeps last N images', () => {
    const messages = [
      {
        role: 'user',
        content: [
          { type: 'image-data', data: 'a', mediaType: 'image/jpeg' },
          { type: 'image-data', data: 'b', mediaType: 'image/jpeg' },
          { type: 'image-data', data: 'c', mediaType: 'image/jpeg' },
          { type: 'image-data', data: 'd', mediaType: 'image/jpeg' },
        ],
      },
    ]
    const out = pruneOldImageParts(messages, { keepN: 2 })
    const parts = out[0].content as Array<{ type: string; data?: string; text?: string }>
    expect(parts[0].type).toBe('text')
    expect(parts[1].type).toBe('text')
    expect(parts[2].data).toBe('c')
    expect(parts[3].data).toBe('d')
  })
})

describe('clampWaitSeconds', () => {
  it('clamps range', () => {
    expect(clampWaitSeconds(0.1)).toBe(0.3)
    expect(clampWaitSeconds(5)).toBe(2)
    expect(clampWaitSeconds(1)).toBe(1)
  })
})
