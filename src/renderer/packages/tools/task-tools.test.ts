import { describe, expect, it } from 'vitest'
import type { MessageContentParts } from '@shared/types'
import {
  contentPartsHaveTaskTools,
  isTaskTrackingTool,
  snapshotTasksFromContentParts,
} from './task-tools'

describe('task-tools helpers', () => {
  it('detects task tool names', () => {
    expect(isTaskTrackingTool('create_task')).toBe(true)
    expect(isTaskTrackingTool('update_task')).toBe(true)
    expect(isTaskTrackingTool('list_tasks')).toBe(true)
    expect(isTaskTrackingTool('web_search')).toBe(false)
  })

  it('builds snapshot from create/update/list results', () => {
    const parts: MessageContentParts = [
      {
        type: 'tool-call',
        state: 'result',
        toolCallId: '1',
        toolName: 'create_task',
        args: { title: 'A' },
        result: {
          id: 't1',
          title: 'A',
          status: 'pending',
          task: { id: 't1', title: 'A', status: 'pending' },
        },
      },
      {
        type: 'tool-call',
        state: 'result',
        toolCallId: '2',
        toolName: 'update_task',
        args: { id: 't1', status: 'done' },
        result: {
          task: { id: 't1', title: 'A', status: 'done' },
        },
      },
      {
        type: 'tool-call',
        state: 'result',
        toolCallId: '3',
        toolName: 'list_tasks',
        args: {},
        result: {
          tasks: [
            { id: 't1', title: 'A', status: 'done' },
            { id: 't2', title: 'B', status: 'in-progress', progress: 40 },
          ],
        },
      },
    ]

    expect(contentPartsHaveTaskTools(parts)).toBe(true)
    const snapshot = snapshotTasksFromContentParts(parts)
    expect(snapshot).toHaveLength(2)
    expect(snapshot.find((t) => t.id === 't1')?.status).toBe('done')
    expect(snapshot.find((t) => t.id === 't2')?.progress).toBe(40)
  })

  it('returns empty when no task tools', () => {
    const parts: MessageContentParts = [
      {
        type: 'tool-call',
        state: 'result',
        toolCallId: '1',
        toolName: 'web_search',
        args: { query: 'x' },
        result: { query: 'x', searchResults: [] },
      },
    ]
    expect(contentPartsHaveTaskTools(parts)).toBe(false)
    expect(snapshotTasksFromContentParts(parts)).toEqual([])
  })
})
