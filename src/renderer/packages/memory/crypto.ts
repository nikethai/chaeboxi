const ITERATIONS = 310_000

const encoder = new TextEncoder()
const decoder = new TextDecoder()

/**
 * Derive an AES-GCM key from a passphrase using PBKDF2-HMAC-SHA-256.
 * Minimum 310,000 iterations per the memory sync spec.
 */
export async function deriveMemorySyncKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey'])
  return await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export interface MemorySyncEncryptedPayload {
  payload: string
  salt: string
  iv: string
  alg: 'AES-GCM'
  kdf: 'PBKDF2-SHA-256'
}

/**
 * Encrypt a plaintext snapshot string with a passphrase-derived key.
 * A fresh random salt and IV are generated unless a salt is supplied.
 */
export async function encryptMemorySyncPayload(
  passphrase: string,
  plaintext: string,
  salt?: Uint8Array
): Promise<MemorySyncEncryptedPayload> {
  const saltBytes = salt ?? crypto.getRandomValues(new Uint8Array(16))
  const key = await deriveMemorySyncKey(passphrase, saltBytes)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(plaintext))
  return {
    payload: toBase64(new Uint8Array(ciphertext)),
    salt: toBase64(saltBytes),
    iv: toBase64(iv),
    alg: 'AES-GCM',
    kdf: 'PBKDF2-SHA-256',
  }
}

/** Decrypt a payload produced by {@link encryptMemorySyncPayload}. */
export async function decryptMemorySyncPayload(input: {
  passphrase: string
  payload: string
  salt: string
  iv: string
}): Promise<string> {
  const key = await deriveMemorySyncKey(input.passphrase, fromBase64(input.salt))
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(input.iv) },
    key,
    fromBase64(input.payload)
  )
  return decoder.decode(plaintext)
}
