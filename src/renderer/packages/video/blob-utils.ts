/** Read a File/Blob as a data URL for string blob storage. */
export function readAsDataUrl(source: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('Failed to read blob as data URL'))
      }
    }
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read blob'))
    reader.readAsDataURL(source)
  })
}

/** Convert a data URL back to a Blob for HTMLVideoElement decoding. */
export function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',')
  if (comma < 0) {
    throw new Error('Invalid data URL')
  }
  const header = dataUrl.slice(0, comma)
  const data = dataUrl.slice(comma + 1)
  const mime = header.match(/data:([^;]+)/)?.[1] || 'application/octet-stream'
  const isBase64 = /;base64/i.test(header)
  if (!isBase64) {
    return new Blob([decodeURIComponent(data)], { type: mime })
  }
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: mime })
}
