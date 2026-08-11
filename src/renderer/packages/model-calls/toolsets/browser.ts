import type { ToolSet } from 'ai'
import { tool } from 'ai'
import z from 'zod'
import { acquireBrowserLock, releaseBrowserLock } from '@/packages/browser/lock'
import { assertBrowserUrl, workspaceBrowserDownloadsDir } from '@/packages/browser/url-policy'
import platform from '@/platform'
import { settingsStore } from '@/stores/settingsStore'
import { browserAgentUiStore } from '@/stores/browserAgentUiStore'

const SNAPSHOT_MAX = 180_000

export type BrowserAgentToolOptions = {
  sessionId: string
  runId?: string
  workspaceRoot?: string
  /** Room policy already validated by caller */
  headless?: boolean
  allowlist?: string[]
}

function browserSettings() {
  const ext = settingsStore.getState().getSettings()?.extension?.browserAgent
  return {
    enabled: Boolean(ext?.enabled),
    headless: Boolean(ext?.headless),
    allowlist: Array.isArray(ext?.allowlist) ? ext!.allowlist! : [],
    maxStepsPerTurn: ext?.maxStepsPerTurn ?? 12,
  }
}

async function ensureSession(opts: BrowserAgentToolOptions) {
  if (platform.type !== 'desktop') {
    return { error: 'UNSUPPORTED_PLATFORM', message: 'Browser agent is only available on the desktop app.' }
  }
  if (!platform.browserSessionStart) {
    return { error: 'NOT_IMPLEMENTED', message: 'Browser controller is not available.' }
  }
  const settings = browserSettings()
  if (!settings.enabled) {
    return {
      error: 'NOT_ENABLED',
      message: 'Browser agent is disabled. Enable it in Settings → Browser Agent, then arm this chat.',
    }
  }

  const runId = opts.runId || `run-${opts.sessionId}`
  const lock = acquireBrowserLock(opts.sessionId, runId)
  if (!lock.ok) {
    return { error: 'BROWSER_BUSY', message: lock.error }
  }

  const downloadDir = workspaceBrowserDownloadsDir(opts.workspaceRoot)
  const downloadsEnabled = Boolean(downloadDir)

  try {
    const status = await platform.browserSessionStatus?.(opts.sessionId)
    if (!status?.running) {
      await platform.browserSessionStart({
        sessionId: opts.sessionId,
        headless: opts.headless ?? settings.headless,
        downloadsEnabled,
        downloadDir: downloadDir || undefined,
        allowlist: opts.allowlist ?? settings.allowlist,
      })
      browserAgentUiStore.getState().setStatus(opts.sessionId, {
        running: true,
        url: null,
        lastTool: 'session:start',
        error: null,
      })
    }
    return { ok: true as const, downloadsEnabled, downloadDir }
  } catch (err) {
    releaseBrowserLock(opts.sessionId, runId)
    return {
      error: 'LAUNCH_FAILED',
      message: err instanceof Error ? err.message : String(err),
    }
  }
}

function setUi(sessionId: string, patch: { lastTool?: string; url?: string | null; error?: string | null }) {
  try {
    browserAgentUiStore.getState().patchStatus(sessionId, patch)
  } catch {
    /* store may be absent in unit tests */
  }
}

export function browserToolSetDescription(): string {
  return `
# Chaeboxi Browser (isolated)

Use these tools to drive a **Chaeboxi-managed isolated browser** (not the user's personal Chrome profile).

## When to use
1. Prefer \`web_search\` / \`parse_link\` for simple Q&A.
2. Use browser for multi-step interactive web (forms, docs navigation, UI flows).
3. Always \`browser_snapshot\` before click/type so refs are fresh.
4. Stop and ask the user on auth walls, payments, or captchas.

## Tools
- browser_navigate { url }
- browser_snapshot — a11y/ref tree (primary perception)
- browser_click { ref }
- browser_type { text, ref?, submit? }
- browser_scroll { direction, amount?, ref? }
- browser_tabs { action: list|select|new|close, tabId?, url? }
- browser_screenshot — secondary; prefer snapshot

Refs invalidate after navigation. Only http(s). Downloads need a session workspace folder.
`
}

export function createBrowserToolSet(opts: BrowserAgentToolOptions): { description: string; tools: ToolSet } {
  const allowlist = () => opts.allowlist ?? browserSettings().allowlist

  const browser_navigate = tool({
    description: 'Navigate the isolated Chaeboxi browser to an http(s) URL.',
    inputSchema: z.object({
      url: z.string().describe('http(s) URL to open'),
    }),
    execute: async (input: { url: string }) => {
      const check = assertBrowserUrl(input.url, allowlist())
      if (!check.ok) {
        setUi(opts.sessionId, { lastTool: 'browser_navigate', error: check.error })
        return { error: check.code, message: check.error }
      }
      const ready = await ensureSession(opts)
      if ('error' in ready && ready.error) return ready
      try {
        const result = await platform.browserNavigate!(opts.sessionId, check.url)
        setUi(opts.sessionId, { lastTool: 'browser_navigate', url: check.url, error: null })
        return result
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        setUi(opts.sessionId, { lastTool: 'browser_navigate', error: message })
        return { error: 'ACTION_ERROR', message }
      }
    },
  })

  const browser_snapshot = tool({
    description: 'Capture accessibility/ref snapshot of the current page. Call before click/type.',
    inputSchema: z.object({
      interestingOnly: z.boolean().optional().describe('Focus interactive/heading elements. Default true.'),
    }),
    execute: async (input: { interestingOnly?: boolean }) => {
      const ready = await ensureSession(opts)
      if ('error' in ready && ready.error) return ready
      try {
        const result = (await platform.browserSnapshot!(opts.sessionId, {
          interestingOnly: input.interestingOnly,
        })) as { snapshot?: string; url?: string; title?: string; truncated?: boolean }
        let snapshot = result?.snapshot || ''
        let truncated = Boolean(result?.truncated)
        if (snapshot.length > SNAPSHOT_MAX) {
          snapshot = `${snapshot.slice(0, SNAPSHOT_MAX)}\n… [snapshot truncated]`
          truncated = true
        }
        setUi(opts.sessionId, { lastTool: 'browser_snapshot', url: result?.url ?? null, error: null })
        return { ...result, snapshot, truncated }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        setUi(opts.sessionId, { lastTool: 'browser_snapshot', error: message })
        return { error: 'ACTION_ERROR', message }
      }
    },
  })

  const browser_click = tool({
    description: 'Click an element by snapshot ref (e.g. e12). Snapshot first. May submit forms.',
    inputSchema: z.object({
      ref: z.string().describe('Element ref from browser_snapshot'),
      button: z.enum(['left', 'right']).optional(),
    }),
    execute: async (input: { ref: string; button?: 'left' | 'right' }) => {
      const ready = await ensureSession(opts)
      if ('error' in ready && ready.error) return ready
      try {
        const result = await platform.browserAct!(opts.sessionId, {
          action: 'click',
          ref: input.ref,
          button: input.button,
        })
        setUi(opts.sessionId, { lastTool: `browser_click:${input.ref}`, error: null })
        return result
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        setUi(opts.sessionId, { lastTool: 'browser_click', error: message })
        return { error: message.includes('REF_INVALID') ? 'REF_INVALID' : 'ACTION_ERROR', message }
      }
    },
  })

  const browser_type = tool({
    description: 'Type text into a ref or focused element. Never log passwords. May submit forms if submit=true.',
    inputSchema: z.object({
      text: z.string(),
      ref: z.string().optional(),
      submit: z.boolean().optional(),
    }),
    execute: async (input: { text: string; ref?: string; submit?: boolean }) => {
      const ready = await ensureSession(opts)
      if ('error' in ready && ready.error) return ready
      try {
        const result = await platform.browserAct!(opts.sessionId, {
          action: 'type',
          text: input.text,
          ref: input.ref,
          submit: input.submit,
        })
        setUi(opts.sessionId, { lastTool: 'browser_type', error: null })
        // Redact typed text from return if it looks like a password field use
        return { ok: true, ref: input.ref, submitted: Boolean(input.submit), result }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        setUi(opts.sessionId, { lastTool: 'browser_type', error: message })
        return { error: 'ACTION_ERROR', message }
      }
    },
  })

  const browser_scroll = tool({
    description: 'Scroll the page or an element.',
    inputSchema: z.object({
      direction: z.enum(['up', 'down']),
      amount: z.number().optional(),
      ref: z.string().optional(),
    }),
    execute: async (input: { direction: 'up' | 'down'; amount?: number; ref?: string }) => {
      const ready = await ensureSession(opts)
      if ('error' in ready && ready.error) return ready
      try {
        const result = await platform.browserAct!(opts.sessionId, {
          action: 'scroll',
          direction: input.direction,
          amount: input.amount,
          ref: input.ref,
        })
        setUi(opts.sessionId, { lastTool: 'browser_scroll', error: null })
        return result
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return { error: 'ACTION_ERROR', message }
      }
    },
  })

  const browser_tabs = tool({
    description: 'List, select, open, or close browser tabs in the isolated session.',
    inputSchema: z.object({
      action: z.enum(['list', 'select', 'new', 'close']),
      tabId: z.string().optional(),
      url: z.string().optional(),
    }),
    execute: async (input: { action: 'list' | 'select' | 'new' | 'close'; tabId?: string; url?: string }) => {
      if (input.url) {
        const check = assertBrowserUrl(input.url, allowlist())
        if (!check.ok) return { error: check.code, message: check.error }
      }
      const ready = await ensureSession(opts)
      if ('error' in ready && ready.error) return ready
      try {
        const result = await platform.browserTabs!(opts.sessionId, {
          op: input.action,
          tabId: input.tabId,
          url: input.url,
        })
        setUi(opts.sessionId, { lastTool: `browser_tabs:${input.action}`, error: null })
        return result
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return { error: 'ACTION_ERROR', message }
      }
    },
  })

  const browser_screenshot = tool({
    description: 'Capture a screenshot of the current page (secondary; prefer browser_snapshot).',
    inputSchema: z.object({}),
    execute: async () => {
      const ready = await ensureSession(opts)
      if ('error' in ready && ready.error) return ready
      try {
        const result = await platform.browserScreenshot!(opts.sessionId)
        setUi(opts.sessionId, { lastTool: 'browser_screenshot', error: null })
        return result
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return { error: 'ACTION_ERROR', message }
      }
    },
    // Avoid base64-as-JSON text (Gemini 1M token cap); send multimodal image-data.
    toModelOutput: ({ output }: { output: any }) => {
      if (output?.error) {
        return {
          type: 'error-text' as const,
          value: `${output.error}${output.message ? `: ${output.message}` : ''}`,
        }
      }
      const base64 = output?.base64 as string | undefined
      if (!base64) {
        return { type: 'json' as const, value: output ?? {} }
      }
      const mediaType = (output?.mimeType as string) || 'image/png'
      return {
        type: 'content' as const,
        value: [
          { type: 'text' as const, text: `Browser screenshot (${mediaType}).` },
          { type: 'image-data' as const, data: base64, mediaType },
        ],
      }
    },
  })

  return {
    description: browserToolSetDescription(),
    tools: {
      browser_navigate,
      browser_snapshot,
      browser_click,
      browser_type,
      browser_scroll,
      browser_tabs,
      browser_screenshot,
    } as ToolSet,
  }
}

export async function stopBrowserSession(sessionId: string, runId?: string) {
  releaseBrowserLock(sessionId, runId)
  try {
    await platform.browserSessionStop?.(sessionId)
    browserAgentUiStore.getState().setStatus(sessionId, {
      running: false,
      url: null,
      lastTool: 'session:stop',
      error: null,
    })
  } catch {
    /* ignore */
  }
}
