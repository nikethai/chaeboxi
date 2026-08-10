import { StorageKeyGenerator } from '@/storage/StoreStorage'
import storage from '@/storage'

export async function saveImage(category: string, picBase64: string) {
  const storageKey = StorageKeyGenerator.picture(category)
  // (legacy comment)
  await storage.setBlob(storageKey, picBase64)
  return storageKey
}
