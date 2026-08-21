import { describe, expect, it } from 'vitest'
import { buildUntrustedImportedContextBlock } from '../../renderer/packages/imported-context/untrusted-reference-block'
import { normalizeChatGptJson } from './chatgpt-normalize'

function linearMapping() {
  return {
    id: 'conv-linear',
    title: 'Linear chat',
    current_node: 'm2',
    mapping: {
      m1: {
        parent: null,
        message: {
          id: 'm1',
          author: { role: 'user' },
          content: { content_type: 'text', parts: ['Hello from ChatGPT export'] },
        },
      },
      m2: {
        parent: 'm1',
        message: {
          id: 'm2',
          author: { role: 'assistant' },
          content: { content_type: 'text', parts: ['Reply'] },
        },
      },
    },
  }
}

function branchedMapping() {
  return {
    id: 'conv-branch',
    title: 'Branched',
    current_node: 'leaf-b',
    mapping: {
      root: { parent: null, message: null },
      a: {
        parent: 'root',
        message: { id: 'a', author: { role: 'user' }, content: { content_type: 'text', parts: ['path A'] } },
      },
      'leaf-a': {
        parent: 'a',
        message: {
          id: 'leaf-a',
          author: { role: 'assistant' },
          content: { content_type: 'text', parts: ['stale branch'] },
        },
      },
      b: {
        parent: 'root',
        message: { id: 'b', author: { role: 'user' }, content: { content_type: 'text', parts: ['path B'] } },
      },
      'leaf-b': {
        parent: 'b',
        message: {
          id: 'leaf-b',
          author: { role: 'assistant' },
          content: { content_type: 'text', parts: ['current branch'] },
        },
      },
    },
  }
}

describe('normalizeChatGptJson', () => {
  it('imports a linear mapping and counts imported messages', () => {
    const report = normalizeChatGptJson(JSON.stringify([linearMapping()]))
    expect(report.failedCount).toBe(0)
    expect(report.conversations).toHaveLength(1)
    expect(report.conversations[0].messages.map((m) => m.text)).toEqual(['Hello from ChatGPT export', 'Reply'])
    expect(report.importedCount).toBe(2)
    expect(report.importedCount + report.skippedCount + report.failedCount).toBeGreaterThan(0)
  })

  it('resolves branched mapping via current_node', () => {
    const report = normalizeChatGptJson(JSON.stringify([branchedMapping()]))
    const texts = report.conversations[0].messages.map((m) => m.text)
    expect(texts).toContain('path B')
    expect(texts).toContain('current branch')
    expect(texts).not.toContain('stale branch')
  })

  it('accepts a numbered-file single conversation object', () => {
    const report = normalizeChatGptJson(JSON.stringify(linearMapping()), '0.json')
    expect(report.conversations[0].providerConversationId).toBe('conv-linear')
  })

  it('skips system/tool authors for imported counts and marks skip reasons', () => {
    const raw = {
      id: 'conv-roles',
      title: 'Roles',
      current_node: 'u1',
      mapping: {
        sys: {
          parent: null,
          message: {
            id: 'sys',
            author: { role: 'system' },
            content: { content_type: 'text', parts: ['You are ChatGPT'] },
          },
        },
        tool: {
          parent: 'sys',
          message: { id: 'tool', author: { role: 'tool' }, content: { content_type: 'text', parts: ['tool output'] } },
        },
        u1: {
          parent: 'tool',
          message: { id: 'u1', author: { role: 'user' }, content: { content_type: 'text', parts: ['ok'] } },
        },
      },
    }
    const report = normalizeChatGptJson(JSON.stringify([raw]))
    expect(report.skipReasons.some((r) => r.startsWith('skipped_role:system'))).toBe(true)
    expect(report.skipReasons.some((r) => r.startsWith('skipped_role:tool'))).toBe(true)
    const userTexts = report.conversations[0].messages.filter((m) => m.role === 'user' || m.role === 'assistant')
    expect(userTexts.map((m) => m.text)).toEqual(['ok'])
    const block = buildUntrustedImportedContextBlock({
      sourceProvider: 'chatgpt',
      excerpts: report.conversations[0].messages.map((m) => ({
        conversationTitle: 'Roles',
        messageId: m.id,
        role: m.role,
        text: m.text,
      })),
    })
    expect(block.role).toBe('user')
    expect(block.text).not.toContain('You are ChatGPT')
    expect(block.text).not.toContain('tool output')
  })

  it('records skipped attachments without importing bytes', () => {
    const raw = {
      id: 'conv-att',
      title: 'Att',
      current_node: 'u1',
      mapping: {
        u1: {
          parent: null,
          message: {
            id: 'u1',
            author: { role: 'user' },
            content: { content_type: 'multimodal_text', parts: ['see image', { asset_pointer: 'file_123' }] },
            metadata: { attachments: [{ id: 'file_123' }] },
          },
        },
      },
    }
    const report = normalizeChatGptJson(JSON.stringify([raw]))
    expect(report.conversations[0].messages[0].text).toBe('see image')
    expect(report.conversations[0].messages[0].skippedAttachmentCount).toBeGreaterThan(0)
    expect(report.skippedCount).toBeGreaterThan(0)
  })
})
