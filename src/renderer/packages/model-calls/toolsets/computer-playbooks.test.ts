import { describe, expect, it } from 'vitest'
import {
  buildSmsUri,
  buildWhatsAppSendUri,
  extractPhoneCandidate,
  formatPlaybookInstructions,
  isAllowedOpenUri,
  matchPlaybook,
} from './computer-playbooks'

describe('matchPlaybook', () => {
  it('matches apps', () => {
    expect(matchPlaybook('WhatsApp')?.id).toBe('whatsapp')
    expect(matchPlaybook('Calculator')?.id).toBe('calculator')
    expect(matchPlaybook('Slack')?.id).toBe('slack')
    expect(matchPlaybook('Chrome')).toBeUndefined()
  })
})

describe('extractPhoneCandidate', () => {
  it('parses + and bare phones', () => {
    expect(extractPhoneCandidate('message +84901234567 hi')).toBe('84901234567')
    expect(extractPhoneCandidate('phone: 8490-123-4567')).toBe('84901234567')
    expect(extractPhoneCandidate('call 0912345678 please')).toBe('0912345678')
    expect(extractPhoneCandidate('no phone here')).toBeUndefined()
  })
})

describe('deep links', () => {
  it('builds whatsapp uri', () => {
    expect(buildWhatsAppSendUri({ phone: '+84 90', text: 'hi' })).toBeNull()
    expect(buildWhatsAppSendUri({ phone: '84901234567', text: 'hi there' })).toBe(
      'whatsapp://send?phone=84901234567&text=hi+there'
    )
  })
  it('builds sms uri', () => {
    expect(buildSmsUri({ phone: '84901234567', text: 'x' })).toContain('sms:84901234567')
  })
  it('allowlists schemes', () => {
    expect(isAllowedOpenUri('whatsapp://send?phone=1')).toBe(true)
    expect(isAllowedOpenUri('https://web.whatsapp.com')).toBe(true)
    expect(isAllowedOpenUri('file:///etc/passwd')).toBe(false)
    expect(isAllowedOpenUri('javascript:alert(1)')).toBe(false)
  })
})

describe('formatPlaybookInstructions', () => {
  it('includes skill steps', () => {
    const t = formatPlaybookInstructions('WhatsApp', 'text +84901234567 hello')
    expect(t).toContain('whatsapp')
    expect(t).toContain('84901234567')
    expect(t).toContain('computer_open_uri')
    expect(t).toContain('computer_focus_search')
  })

  it('calculator playbook prefers AX press', () => {
    const t = formatPlaybookInstructions('Calculator')
    expect(t).toContain('calculator')
    expect(t).toContain('computer_ax_press')
  })
})
