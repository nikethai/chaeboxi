import { type ArchivePolicyError, classifyZipEntry, MAX_COMPRESSED_BYTES, MAX_ZIP_ENTRIES } from './archive-policy'

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[i] = c >>> 0
  }
  return table
})()

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function writeU16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true)
}

function writeU32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value, true)
}

function readU16(view: DataView, offset: number) {
  return view.getUint16(offset, true)
}

function readU32(view: DataView, offset: number) {
  return view.getUint32(offset, true)
}

export function buildStoreZip(
  files: { name: string; data: Uint8Array }[],
  compress?: (data: Uint8Array) => Uint8Array
): Uint8Array {
  const encoder = new TextEncoder()
  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0
  for (const file of files) {
    const nameBytes = encoder.encode(file.name)
    const payload = compress ? compress(file.data) : file.data
    const method = compress ? 8 : 0
    const crc = crc32(file.data)
    const local = new Uint8Array(30 + nameBytes.length + payload.length)
    const localView = new DataView(local.buffer)
    writeU32(localView, 0, 0x04034b50)
    writeU16(localView, 4, 20)
    writeU16(localView, 6, 0)
    writeU16(localView, 8, method)
    writeU16(localView, 10, 0)
    writeU16(localView, 12, 0)
    writeU32(localView, 14, crc)
    writeU32(localView, 18, payload.length)
    writeU32(localView, 22, file.data.length)
    writeU16(localView, 26, nameBytes.length)
    writeU16(localView, 28, 0)
    local.set(nameBytes, 30)
    local.set(payload, 30 + nameBytes.length)
    locals.push(local)

    const central = new Uint8Array(46 + nameBytes.length)
    const centralView = new DataView(central.buffer)
    writeU32(centralView, 0, 0x02014b50)
    writeU16(centralView, 4, 20)
    writeU16(centralView, 6, 20)
    writeU16(centralView, 8, 0)
    writeU16(centralView, 10, method)
    writeU16(centralView, 12, 0)
    writeU16(centralView, 14, 0)
    writeU32(centralView, 16, crc)
    writeU32(centralView, 20, payload.length)
    writeU32(centralView, 24, file.data.length)
    writeU16(centralView, 28, nameBytes.length)
    writeU16(centralView, 30, 0)
    writeU16(centralView, 32, 0)
    writeU16(centralView, 34, 0)
    writeU16(centralView, 36, 0)
    writeU32(centralView, 38, 0)
    writeU32(centralView, 42, offset)
    central.set(nameBytes, 46)
    centrals.push(central)
    offset += local.length
  }
  const centralStart = offset
  const centralSize = centrals.reduce((sum, c) => sum + c.length, 0)
  const eocd = new Uint8Array(22)
  const eocdView = new DataView(eocd.buffer)
  writeU32(eocdView, 0, 0x06054b50)
  writeU16(eocdView, 4, 0)
  writeU16(eocdView, 6, 0)
  writeU16(eocdView, 8, files.length)
  writeU16(eocdView, 10, files.length)
  writeU32(eocdView, 12, centralSize)
  writeU32(eocdView, 16, centralStart)
  writeU16(eocdView, 20, 0)
  const total = offset + centralSize + eocd.length
  const out = new Uint8Array(total)
  let cursor = 0
  for (const part of locals) {
    out.set(part, cursor)
    cursor += part.length
  }
  for (const part of centrals) {
    out.set(part, cursor)
    cursor += part.length
  }
  out.set(eocd, cursor)
  return out
}

export type InspectedJsonEntry = {
  name: string
  text: string
}

export type ArchiveInspectOk = {
  ok: true
  jsonEntries: InspectedJsonEntry[]
  skipped: string[]
}

export type ArchiveInspectFail = {
  ok: false
  code: ArchivePolicyError | 'truncated' | 'unsupported_compression'
  message: string
}

export type ArchiveInspectResult = ArchiveInspectOk | ArchiveInspectFail

function findEocdOffset(bytes: Uint8Array): number {
  const min = Math.max(0, bytes.length - 22 - 65535)
  for (let i = bytes.length - 22; i >= min; i--) {
    if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) {
      return i
    }
  }
  return -1
}

async function inflateRawDeflate(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'function') {
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
    return new Uint8Array(await new Response(stream).arrayBuffer())
  }
  const zlib = await import('node:zlib')
  return zlib.inflateRawSync(data)
}

export async function inspectImportedArchiveBytes(bytes: Uint8Array): Promise<ArchiveInspectResult> {
  if (bytes.length < 22 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    return { ok: false, code: 'not_zip', message: 'not a zip archive' }
  }
  if (bytes.length > MAX_COMPRESSED_BYTES) {
    return { ok: false, code: 'oversize', message: 'compressed archive exceeds limit' }
  }
  const eocdOffset = findEocdOffset(bytes)
  if (eocdOffset < 0) {
    return { ok: false, code: 'truncated', message: 'missing zip central directory' }
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const entryCount = readU16(view, eocdOffset + 10)
  const centralSize = readU32(view, eocdOffset + 12)
  const centralOffset = readU32(view, eocdOffset + 16)
  if (entryCount > MAX_ZIP_ENTRIES) {
    return { ok: false, code: 'too_many_entries', message: 'too many zip entries' }
  }
  if (centralOffset + centralSize > bytes.length) {
    return { ok: false, code: 'truncated', message: 'truncated central directory' }
  }
  const decoder = new TextDecoder('utf-8')
  const jsonEntries: InspectedJsonEntry[] = []
  const skipped: string[] = []
  let cursor = centralOffset
  for (let i = 0; i < entryCount; i++) {
    if (cursor + 46 > bytes.length || readU32(view, cursor) !== 0x02014b50) {
      return { ok: false, code: 'truncated', message: 'truncated zip entry' }
    }
    const method = readU16(view, cursor + 10)
    const compressedSize = readU32(view, cursor + 20)
    const uncompressedSize = readU32(view, cursor + 24)
    const nameLen = readU16(view, cursor + 28)
    const extraLen = readU16(view, cursor + 30)
    const commentLen = readU16(view, cursor + 32)
    const localOffset = readU32(view, cursor + 42)
    const nameBytes = bytes.slice(cursor + 46, cursor + 46 + nameLen)
    const name = decoder.decode(nameBytes)
    const classified = classifyZipEntry(name, uncompressedSize, compressedSize)
    if (classified === 'zip_slip' || classified === 'oversize' || classified === 'nested_archive') {
      return { ok: false, code: classified, message: `${classified}:${name}` }
    }
    if (
      classified === 'skip' ||
      classified === 'unsafe_name' ||
      classified === 'too_many_entries' ||
      classified === 'not_zip'
    ) {
      skipped.push(`${classified}:${name}`)
      cursor += 46 + nameLen + extraLen + commentLen
      continue
    }
    const localNameLen = readU16(view, localOffset + 26)
    const localExtraLen = readU16(view, localOffset + 28)
    const dataStart = localOffset + 30 + localNameLen + localExtraLen
    const dataEnd = dataStart + compressedSize
    if (dataEnd > bytes.length) {
      return { ok: false, code: 'truncated', message: `truncated payload:${name}` }
    }
    const raw = bytes.slice(dataStart, dataEnd)
    let data: Uint8Array
    if (method === 0) {
      data = raw
    } else if (method === 8) {
      try {
        data = await inflateRawDeflate(raw)
      } catch {
        return { ok: false, code: 'truncated', message: `deflate_failed:${name}` }
      }
    } else {
      return { ok: false, code: 'unsupported_compression', message: `unsupported_method:${name}` }
    }
    jsonEntries.push({ name, text: decoder.decode(data) })
    cursor += 46 + nameLen + extraLen + commentLen
  }
  return { ok: true, jsonEntries, skipped }
}
