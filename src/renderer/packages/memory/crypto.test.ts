import { describe, expect, it } from 'vitest'
import { decryptMemorySyncPayload, encryptMemorySyncPayload } from '@/packages/memory/crypto'

describe('memory sync crypto', () => {
  it('encrypts and decrypts a snapshot payload', async () => {
    const encrypted = await encryptMemorySyncPayload('correct horse battery staple', '{"schemaVersion":1}')
    const decrypted = await decryptMemorySyncPayload({
      passphrase: 'correct horse battery staple',
      payload: encrypted.payload,
      salt: encrypted.salt,
      iv: encrypted.iv,
    })

    expect(decrypted).toBe('{"schemaVersion":1}')
  })
})
