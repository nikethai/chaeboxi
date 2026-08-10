import type { Message } from '@shared/types'
import { getMessageText } from '@shared/utils/message'
import { describe, expect, test } from 'vitest'
import { sequenceMessages } from '../../shared/utils/message'

describe('SequenceMessages', () => {
  // Each test case
  const cases: {
    name: string
    input: Message[]
    expected: Message[]
  }[] = [
    {
      name: 'should sequence messages correctly',
      input: [
        { id: '', role: 'system', contentParts: [{ type: 'text', text: 'S1' }] },
        { id: '', role: 'user', contentParts: [{ type: 'text', text: 'U1' }] },
        { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'A1' }] },
        { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'A2' }] },
        { id: '', role: 'user', contentParts: [{ type: 'text', text: 'U2' }] },
        { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'A3' }] },
        { id: '', role: 'system', contentParts: [{ type: 'text', text: 'S2' }] },
      ],
      expected: [
        {
          id: '',
          role: 'system',
          contentParts: [
            { type: 'text', text: 'S1' },
            { type: 'text', text: 'S2' },
          ],
        },
        { id: '', role: 'user', contentParts: [{ type: 'text', text: 'U1' }] },
        {
          id: '',
          role: 'assistant',
          contentParts: [
            { type: 'text', text: 'A1' },
            { type: 'text', text: 'A2' },
          ],
        },
        { id: '', role: 'user', contentParts: [{ type: 'text', text: 'U2' }] },
        { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'A3' }] },
      ],
    },
    {
      name: 'assistant before user',
      input: [
        { id: '', role: 'system', contentParts: [{ type: 'text', text: 'S1' }] },
        {
          id: '',
          role: 'assistant',
          contentParts: [
            {
              type: 'text',
              text: `L1
L2
L3

`,
            },
          ],
        },
        { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'A2' }] },
        { id: '', role: 'user', contentParts: [{ type: 'text', text: 'U1' }] },
        { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'A3' }] },
      ],
      expected: [
        { id: '', role: 'system', contentParts: [{ type: 'text', text: 'S1' }] },
        {
          id: '',
          role: 'user',
          contentParts: [
            {
              type: 'text',
              text: `> L1
> L2
> L3
> 

`,
            },
          ],
        },
        { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'A2' }] },
        { id: '', role: 'user', contentParts: [{ type: 'text', text: 'U1' }] },
        { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'A3' }] },
      ],
    },
    {
      name: 'no system message',
      input: [
        { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'A1' }] },
        { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'A2' }] },
        { id: '', role: 'user', contentParts: [{ type: 'text', text: 'U1' }] },
        { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'A3' }] },
      ],
      expected: [
        { id: '', role: 'user', contentParts: [{ type: 'text', text: '> A1\n' }] },
        { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'A2' }] },
        { id: '', role: 'user', contentParts: [{ type: 'text', text: 'U1' }] },
        { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'A3' }] },
      ],
    },
    {
      name: 'no system message 2',
      input: [
        { id: '', role: 'user', contentParts: [{ type: 'text', text: 'U1' }] },
        { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'A1' }] },
        { id: '', role: 'user', contentParts: [{ type: 'text', text: 'U2' }] },
        { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'A2' }] },
      ],
      expected: [
        { id: '', role: 'user', contentParts: [{ type: 'text', text: 'U1' }] },
        { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'A1' }] },
        { id: '', role: 'user', contentParts: [{ type: 'text', text: 'U2' }] },
        { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'A2' }] },
      ],
    },
    {
      name: 'remove empty messages',
      input: [
        { id: '', role: 'system', contentParts: [{ type: 'text', text: '' }] },
        { id: '', role: 'user', contentParts: [{ type: 'text', text: '' }] },
        { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'A1' }] },
        { id: '', role: 'user', contentParts: [{ type: 'text', text: '' }] },
        { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'A2' }] },
        { id: '', role: 'user', contentParts: [{ type: 'text', text: 'U1' }] },
        { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'A3' }] },
      ],
      expected: [
        { id: '', role: 'user', contentParts: [{ type: 'text', text: '> A1\n' }] },
        { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'A2' }] },
        { id: '', role: 'user', contentParts: [{ type: 'text', text: 'U1' }] },
        { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'A3' }] },
      ],
    },
    {
      name: 'only user messages',
      input: [
        { id: '', role: 'user', contentParts: [{ type: 'text', text: 'U1' }] },
        { id: '', role: 'user', contentParts: [{ type: 'text', text: 'U2' }] },
      ],
      expected: [
        {
          id: '',
          role: 'user',
          contentParts: [
            { type: 'text', text: 'U1' },
            { type: 'text', text: 'U2' },
          ],
        },
      ],
    },
    {
      name: 'only assistant messages',
      input: [
        { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'A1' }] },
        { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'A2' }] },
      ],
      expected: [
        { id: '', role: 'user', contentParts: [{ type: 'text', text: '> A1\n' }] },
        { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'A2' }] },
      ],
    },
    {
      name: 'single assistant message becomes user',
      input: [{ id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'A1' }] }],
      expected: [{ id: '', role: 'user', contentParts: [{ type: 'text', text: '> A1\n' }] }],
    },
    {
      name: 'non-empty assistant becomes user',
      input: [
        { id: '', role: 'user', contentParts: [{ type: 'text', text: '' }] },
        { id: '', role: 'assistant', contentParts: [{ type: 'text', text: 'A1' }] },
        { id: '', role: 'user', contentParts: [{ type: 'text', text: '' }] },
      ],
      expected: [{ id: '', role: 'user', contentParts: [{ type: 'text', text: '> A1\n' }] }],
    },
    {
      name: 'single system message becomes user',
      input: [{ id: '', role: 'system', contentParts: [{ type: 'text', text: 'S1' }] }],
      expected: [{ id: '', role: 'user', contentParts: [{ type: 'text', text: 'S1' }] }],
    },
    {
      name: 'non-empty system becomes user',
      input: [
        { id: '', role: 'system', contentParts: [{ type: 'text', text: '' }] },
        { id: '', role: 'user', contentParts: [{ type: 'text', text: '' }] },
        { id: '', role: 'system', contentParts: [{ type: 'text', text: 'S1' }] },
        { id: '', role: 'user', contentParts: [{ type: 'text', text: '' }] },
        { id: '', role: 'user', contentParts: [{ type: 'text', text: '' }] },
        { id: '', role: 'assistant', contentParts: [{ type: 'text', text: '' }] },
      ],
      expected: [
        {
          id: '',
          role: 'user',
          contentParts: [
            { type: 'text', text: '' },
            { type: 'text', text: 'S1' },
          ],
        },
      ],
    },
    {
      name: 'merge images',
      input: [
        { id: '', role: 'user', contentParts: [{ type: 'text', text: 'U1' }] },
        {
          id: '',
          role: 'user',
          contentParts: [
            { type: 'text', text: 'U2' },
            { type: 'image', storageKey: 'url1' },
          ],
        },
        {
          id: '',
          role: 'user',
          contentParts: [
            { type: 'text', text: 'U3' },
            { type: 'image', storageKey: 'url2' },
          ],
        },
        { id: '', role: 'user', contentParts: [{ type: 'text', text: 'U4' }] },
      ],
      expected: [
        {
          id: '',
          role: 'user',
          contentParts: [
            { type: 'text', text: 'U1' },
            { type: 'text', text: 'U2' },
            { type: 'image', storageKey: 'url1' },
            { type: 'text', text: 'U3' },
            { type: 'image', storageKey: 'url2' },
            { type: 'text', text: 'U4' },
          ],
        },
      ],
    },
  ]
  cases.forEach(({ name, input, expected }) => {
    test(name, () => {
      const got = sequenceMessages(input)

      expect(got.length).toBe(expected.length)

      got.forEach((gotMessage, index) => {
        const expectedMessage = expected[index]
        // If you have an isEqual method, you can use it here, or manually compare properties like this:
        expect(gotMessage).toEqual(expectedMessage)
      })
    })
  })

  test('keeps multi-agent assistant turns separate with bridge', () => {
    const input: Message[] = [
      { id: 'u1', role: 'user', contentParts: [{ type: 'text', text: 'Discuss API design' }] },
      {
        id: 'a1',
        role: 'assistant',
        name: 'Code Assistant',
        agentId: 'builtin:code-assistant',
        contentParts: [{ type: 'text', text: 'Use REST' }],
      },
      {
        id: 'a2',
        role: 'assistant',
        name: 'Deep Researcher',
        agentId: 'builtin:deep-researcher',
        contentParts: [{ type: 'text', text: 'Consider GraphQL' }],
      },
    ]
    const got = sequenceMessages(input)
    // user + assistant A + bridge user + assistant B (not merged into one assistant)
    expect(got.map((m) => m.role)).toEqual(['user', 'assistant', 'user', 'assistant'])
    expect(got[1].name).toBe('Code Assistant')
    expect(getMessageText(got[1])).toBe('Use REST')
    expect(got[3].name).toBe('Deep Researcher')
    expect(getMessageText(got[3])).toBe('Consider GraphQL')
  })

  test('three multi-agent speakers stay separate with bridges between each', () => {
    const input: Message[] = [
      { id: 'u1', role: 'user', contentParts: [{ type: 'text', text: 'Plan auth' }] },
      {
        id: 'a1',
        role: 'assistant',
        name: 'Code Assistant',
        agentId: 'ca',
        contentParts: [{ type: 'text', text: 'Use OAuth' }],
      },
      {
        id: 'a2',
        role: 'assistant',
        name: 'IT Expert',
        agentId: 'it',
        contentParts: [{ type: 'text', text: 'Watch SSO costs' }],
      },
      {
        id: 'a3',
        role: 'assistant',
        name: 'Product Manager',
        agentId: 'pm',
        contentParts: [{ type: 'text', text: 'Prefer simpler sign-in' }],
      },
    ]
    const got = sequenceMessages(input)
    expect(got.map((m) => m.role)).toEqual([
      'user',
      'assistant',
      'user',
      'assistant',
      'user',
      'assistant',
    ])
    expect(got[1].name).toBe('Code Assistant')
    expect(got[3].name).toBe('IT Expert')
    expect(got[5].name).toBe('Product Manager')
  })

  test('multiple calls should not accumulate quote prefixes', () => {
    const originalMessages: Message[] = [
      { id: '1', role: 'assistant', contentParts: [{ type: 'text', text: 'Hello' }] },
      { id: '2', role: 'user', contentParts: [{ type: 'text', text: 'Hi' }] },
    ]

    // First call
    const result1 = sequenceMessages(originalMessages)
    expect(result1[0].contentParts[0]).toEqual({ type: 'text', text: '> Hello\n' })

    // Second call with same original messages should produce same result
    const result2 = sequenceMessages(originalMessages)
    expect(result2[0].contentParts[0]).toEqual({ type: 'text', text: '> Hello\n' })

    // Original messages should not be mutated
    expect(originalMessages[0].contentParts[0]).toEqual({ type: 'text', text: 'Hello' })

    // Third call should still produce same result
    const result3 = sequenceMessages(originalMessages)
    expect(result3[0].contentParts[0]).toEqual({ type: 'text', text: '> Hello\n' })
  })
})
