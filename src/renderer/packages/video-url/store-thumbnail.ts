import storage from '@/storage'
import { StorageKeyGenerator } from '@/storage/StoreStorage'
import { fetchArrayBuffer } from './http'

/**
 * Download a remote image (OG/thumbnail) into blob storage for composer UI.
 * Returns storage key or undefined on failure.
 */
export async function storeRemoteThumbnail(
  imageUrl: string | undefined,
  options?: { signal?: AbortSignal; timeoutMs?: number }
): Promise<string | undefined> {
  const raw = imageUrl?.trim()
  if (!raw || !/^https?:\/\//i.test(raw)) return undefined

  try {
    // Decode common HTML entities in OG URLs
    const cleaned = raw
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")

    const buf = await fetchArrayBuffer(cleaned, {
      signal: options?.signal,
      timeout: options?.timeoutMs ?? 15_000,
      headers: {
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
    })

    if (!buf || buf.byteLength < 32 || buf.byteLength > 8 * 1024 * 1024) {
      return undefined
    }

    const bytes = new Uint8Array(buf)
    const mime = sniffImageMime(bytes) || 'image/jpeg'
    let binary = ''
    const chunk = 0x8000
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
    }
    const dataUrl = `data:${mime};base64,${btoa(binary)}`
    const key = StorageKeyGenerator.picture('link-thumb')
    await storage.setBlob(key, dataUrl)
    return key
  } catch {
    return undefined
  }
}

function sniffImageMime(bytes: Uint8Array): string | undefined {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'image/png'
  }
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'image/gif'
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp'
  }
  return undefined
}
