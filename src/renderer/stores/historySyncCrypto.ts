/** Client-side AES-GCM for self-host history sync. Server stores this envelope as an opaque blob. */

export const HISTORY_SYNC_ENC_V = 1 as const
export const HISTORY_SYNC_ALG = 'AES-GCM' as const
export const HISTORY_SYNC_KDF = 'PBKDF2-SHA256' as const
export const HISTORY_SYNC_ITER = 210_000

export type EncryptedHistoryEnvelope = {
  v: typeof HISTORY_SYNC_ENC_V
  alg: typeof HISTORY_SYNC_ALG
  kdf: typeof HISTORY_SYNC_KDF
  iter: number
  salt: string
  iv: string
  ciphertext: string
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const step = 0x8000
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step))
  }
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i)
  }
  return out
}

function requireCrypto(): Crypto {
  const cryptoRef = globalThis.crypto
  if (!cryptoRef?.subtle) {
    throw new Error('Web Crypto is required to encrypt history sync')
  }
  return cryptoRef
}

async function deriveAesKey(passphrase: string, salt: Uint8Array, iter: number, usages: KeyUsage[]): Promise<CryptoKey> {
  const cryptoRef = requireCrypto()
  const material = await cryptoRef.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, [
    'deriveKey',
  ])
  return cryptoRef.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: iter,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    usages
  )
}

export function isEncryptedHistoryEnvelope(value: unknown): value is EncryptedHistoryEnvelope {
  if (!value || typeof value !== 'object') {
    return false
  }
  const envelope = value as Record<string, unknown>
  return (
    envelope.v === HISTORY_SYNC_ENC_V &&
    envelope.alg === HISTORY_SYNC_ALG &&
    envelope.kdf === HISTORY_SYNC_KDF &&
    typeof envelope.iter === 'number' &&
    Number.isFinite(envelope.iter) &&
    envelope.iter > 0 &&
    typeof envelope.salt === 'string' &&
    envelope.salt.length > 0 &&
    typeof envelope.iv === 'string' &&
    envelope.iv.length > 0 &&
    typeof envelope.ciphertext === 'string' &&
    envelope.ciphertext.length > 0
  )
}

export async function encryptHistoryPayload(plaintext: unknown, passphrase: string): Promise<EncryptedHistoryEnvelope> {
  const trimmed = passphrase.trim()
  if (!trimmed) {
    throw new Error('History sync passphrase is required')
  }
  const cryptoRef = requireCrypto()
  const salt = cryptoRef.getRandomValues(new Uint8Array(16))
  const iv = cryptoRef.getRandomValues(new Uint8Array(12))
  const key = await deriveAesKey(trimmed, salt, HISTORY_SYNC_ITER, ['encrypt'])
  const encoded = new TextEncoder().encode(JSON.stringify(plaintext))
  const ciphertext = await cryptoRef.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
  return {
    v: HISTORY_SYNC_ENC_V,
    alg: HISTORY_SYNC_ALG,
    kdf: HISTORY_SYNC_KDF,
    iter: HISTORY_SYNC_ITER,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  }
}

export async function decryptHistoryPayload(envelope: EncryptedHistoryEnvelope, passphrase: string): Promise<unknown> {
  const trimmed = passphrase.trim()
  if (!trimmed) {
    throw new Error('History sync passphrase is required')
  }
  if (!isEncryptedHistoryEnvelope(envelope)) {
    throw new Error('Invalid encrypted history envelope')
  }
  try {
    const cryptoRef = requireCrypto()
    const salt = base64ToBytes(envelope.salt)
    const iv = base64ToBytes(envelope.iv)
    const key = await deriveAesKey(trimmed, salt, envelope.iter, ['decrypt'])
    const decrypted = await cryptoRef.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      base64ToBytes(envelope.ciphertext) as BufferSource
    )
    return JSON.parse(new TextDecoder().decode(decrypted))
  } catch {
    throw new Error('Wrong passphrase; history was not merged')
  }
}
