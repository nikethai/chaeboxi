import type { MessageContentParts } from '@shared/types'
import { describe, expect, it } from 'vitest'
import taskTrackingToolSet from '@/packages/model-calls/toolsets/task-tracking'
import {
  contentPartsHaveTaskTools,
  isTaskTrackingTool,
  normalizeTaskToolName,
  snapshotTasksFromContentParts,
} from './task-tools'

describe('task-tools helpers', () => {
  it('detects task tool names', () => {
    expect(isTaskTrackingTool('create_task')).toBe(true)
    expect(isTaskTrackingTool('update_task')).toBe(true)
    expect(isTaskTrackingTool('list_tasks')).toBe(true)
    expect(isTaskTrackingTool('web_search')).toBe(false)
  })

  it('normalizes provider-namespaced task tools', () => {
    expect(normalizeTaskToolName('google:tasks:create_task')).toBe('create_task')
    expect(normalizeTaskToolName('mcp__google__create_task')).toBe('create_task')
    expect(isTaskTrackingTool('google:tasks:update_task')).toBe(true)
    expect(isTaskTrackingTool('mcp__google__list_tasks')).toBe(true)
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
    expect(snapshot).toHaveLength(1)
    expect(snapshot.find((t) => t.id === 't1')?.status).toBe('done')
    expect(snapshot.find((t) => t.id === 't2')).toBeUndefined()
  })

  it('does not mix leftover session board from create_task payload', () => {
    const parts: MessageContentParts = [
      {
        type: 'tool-call',
        state: 'result',
        toolCallId: '1',
        toolName: 'create_task',
        args: { title: 'Write HTML' },
        result: {
          id: 'new-1',
          title: 'Write HTML',
          status: 'pending',
          task: { id: 'new-1', title: 'Write HTML', status: 'pending' },
          tasks: [
            { id: 'old-whatsapp', title: 'Open WhatsApp application', status: 'pending' },
            { id: 'new-1', title: 'Write HTML', status: 'pending' },
          ],
        },
      },
    ]
    const snapshot = snapshotTasksFromContentParts(parts)
    expect(snapshot.map((t) => t.id)).toEqual(['new-1'])
  })

  it('uses list_tasks only when the turn did not create or update', () => {
    const parts: MessageContentParts = [
      {
        type: 'tool-call',
        state: 'result',
        toolCallId: '1',
        toolName: 'list_tasks',
        args: {},
        result: {
          tasks: [{ id: 'board-1', title: 'Only listed', status: 'pending' }],
        },
      },
    ]
    expect(snapshotTasksFromContentParts(parts)).toEqual([
      { id: 'board-1', title: 'Only listed', status: 'pending' },
    ])
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

  it('live task toolset only advertises canonical names', () => {
    expect(Object.keys(taskTrackingToolSet.tools).sort()).toEqual(['create_task', 'list_tasks', 'update_task'])
  })
})
