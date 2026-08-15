import { describe, expect, it } from 'vitest'
import {
  isLocalKnowledgeBaseModel,
  LOCAL_E5_SMALL_MODEL,
  parseKnowledgeBaseModelString,
} from './knowledge-base-model-parser'

describe('parseKnowledgeBaseModelString', () => {
  it('parses local:multilingual-e5-small', () => {
    expect(parseKnowledgeBaseModelString(LOCAL_E5_SMALL_MODEL)).toEqual({
      providerId: 'local',
      modelId: 'multilingual-e5-small',
    })
    expect(isLocalKnowledgeBaseModel(LOCAL_E5_SMALL_MODEL)).toBe(true)
  })

  it('parses provider ids when the model id contains a colon', () => {
    expect(parseKnowledgeBaseModelString('ollama:nomic-embed-text:latest')).toEqual({
      providerId: 'ollama',
      modelId: 'nomic-embed-text:latest',
    })
    expect(isLocalKnowledgeBaseModel('ollama:nomic-embed-text')).toBe(false)
  })
})
