import { describe, expect, it } from 'vitest'
import { decryptHistoryPayload, encryptHistoryPayload, isEncryptedHistoryEnvelope } from './historySyncCrypto'

const sample = {
  __type: 'chatbox-history-transfer',
  __version: 1,
  __exported_at: '2026-08-15T00:00:00.000Z',
  sessionMetaList: [{ id: 's1', name: 'Home' }],
  sessions: [{ id: 's1', name: 'Home', messages: [] }],
}

describe('historySyncCrypto', () => {
  it('roundtrips a transfer payload', async () => {
    const envelope = await encryptHistoryPayload(sample, 'correct horse')
    expect(isEncryptedHistoryEnvelope(envelope)).toBe(true)
    expect(JSON.stringify(envelope)).not.toContain('Home')
    const plain = await decryptHistoryPayload(envelope, 'correct horse')
    expect(plain).toEqual(sample)
  })

  it('fails closed on a wrong passphrase', async () => {
    const envelope = await encryptHistoryPayload(sample, 'correct horse')
    await expect(decryptHistoryPayload(envelope, 'wrong')).rejects.toThrow(/Wrong passphrase/)
  })

  it('rejects an empty passphrase', async () => {
    await expect(encryptHistoryPayload(sample, '   ')).rejects.toThrow(/passphrase is required/)
  })
})
