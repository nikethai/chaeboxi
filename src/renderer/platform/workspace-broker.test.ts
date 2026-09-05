import { describe, expect, it } from 'vitest'
import { unwrapWorkspaceBroker } from './workspace-broker'

describe('workspace broker envelope', () => {
  it('returns the inner value on ok', () => {
    expect(unwrapWorkspaceBroker({ ok: true, value: { revision: 'abc' } })).toEqual({ revision: 'abc' })
  })

  it('rejects apply without a valid native ticket using the shipped envelope', () => {
    expect(() =>
      unwrapWorkspaceBroker({
        ok: false,
        error: { code: 'APPLY_TICKET_INVALID', message: 'Apply ticket is invalid, expired, or already used' },
      })
    ).toThrow(/APPLY_TICKET_INVALID/)
  })
})
