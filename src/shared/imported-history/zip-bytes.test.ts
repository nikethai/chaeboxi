import { deflateRawSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { buildPublishedSource, publishImportedSource } from './publish'
import { buildStoreZip, inspectImportedArchiveBytes } from './zip-bytes'

const encoder = new TextEncoder()

const linearJson = JSON.stringify([
  {
    id: 'conv-1',
    title: 'T',
    current_node: 'm1',
    mapping: {
      m1: {
        parent: null,
        message: { id: 'm1', author: { role: 'user' }, content: { content_type: 'text', parts: ['needle'] } },
      },
    },
  },
])

describe('inspectImportedArchiveBytes', () => {
  it('extracts allowlisted conversations.json', async () => {
    const zip = buildStoreZip([{ name: 'conversations.json', data: encoder.encode(linearJson) }])
    const result = await inspectImportedArchiveBytes(zip)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.jsonEntries[0].name).toBe('conversations.json')
      const published = buildPublishedSource({ originalFilename: 'export.zip', jsonEntries: result.jsonEntries })
      expect(published.status).toBe('published')
      expect(published.importedCount).toBe(1)
    }
  })

  it('inflates DEFLATE conversations.json used by ChatGPT export zips', async () => {
    const zip = buildStoreZip([{ name: 'conversations.json', data: encoder.encode(linearJson) }], deflateRawSync)
    expect(zip[8]).toBe(8)
    const result = await inspectImportedArchiveBytes(zip)
    expect(result.ok).toBe(true)
    if (!result.ok) {
      throw new Error(result.message)
    }
    expect(result.jsonEntries).toHaveLength(1)
    expect(result.jsonEntries[0].text).toContain('needle')
    const published = buildPublishedSource({ originalFilename: 'chatgpt.zip', jsonEntries: result.jsonEntries })
    expect(published.importedCount).toBe(1)
    expect(published.conversations).toHaveLength(1)
  })

  it('extracts numbered json files', async () => {
    const zip = buildStoreZip([{ name: '0.json', data: encoder.encode(linearJson) }])
    const result = await inspectImportedArchiveBytes(zip)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.jsonEntries[0].name).toBe('0.json')
    }
  })

  it('rejects zip-slip paths without publishing', async () => {
    const zip = buildStoreZip([{ name: '../evil.json', data: encoder.encode(linearJson) }])
    const result = await inspectImportedArchiveBytes(zip)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('zip_slip')
    }
  })

  it('rejects nested zip entries', async () => {
    const zip = buildStoreZip([{ name: 'payload.zip', data: encoder.encode('PK') }])
    const result = await inspectImportedArchiveBytes(zip)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('nested_archive')
    }
  })

  it('treats truncated conversations.json as a failed record, not a complete source', async () => {
    const zip = buildStoreZip([{ name: 'conversations.json', data: encoder.encode('{"id":') }])
    const result = await inspectImportedArchiveBytes(zip)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const source = buildPublishedSource({ originalFilename: 'bad.zip', jsonEntries: result.jsonEntries })
      expect(source.failedCount).toBeGreaterThan(0)
      expect(source.conversations).toHaveLength(0)
      const published = publishImportedSource({ sources: [] }, source)
      expect(published.source.failedCount).toBe(source.failedCount)
    }
  })
})
