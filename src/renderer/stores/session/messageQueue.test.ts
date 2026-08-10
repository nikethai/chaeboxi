import { createMessage } from '@shared/types'
import { beforeEach, describe, expect, test } from 'vitest'
import { messageQueueStore } from './messageQueue'

describe('messageQueueStore', () => {
  beforeEach(() => {
    messageQueueStore.getState().clearSessionQueue('s1')
  })

  test('enqueue marks userAlreadyInserted for optimistic thread inserts', () => {
    const msg = createMessage('user', 'hello again')
    messageQueueStore.getState().enqueueMessage('s1', msg, true, { userAlreadyInserted: true })
    const entries = messageQueueStore.getState().messageQueue.get('s1')
    expect(entries).toHaveLength(1)
    expect(entries?.[0].userAlreadyInserted).toBe(true)
    expect(entries?.[0].needGenerating).toBe(true)

    const next = messageQueueStore.getState().dequeueMessage('s1')
    expect(next?.userAlreadyInserted).toBe(true)
    expect(messageQueueStore.getState().getQueuedCount('s1')).toBe(0)
  })
})
