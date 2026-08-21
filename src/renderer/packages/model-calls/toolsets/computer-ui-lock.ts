import type { ToolSet } from 'ai'

/**
 * When Computer Use is armed, lock the agent into desktop UI space so it does not
 * mis-route "find contact / open app" into workspace search, Finder, or Spotlight.
 *
 * KISS: strip the highest-collision tools + inject a hard policy string.
 * Workspace write/terminal stay available only when agent coding is also on.
 */

/** Always strip while computer space is locked — name collides with "find". */
export const COMPUTER_UI_ALWAYS_STRIP = new Set(['search_file_content'])

/**
 * Browser tools share the turn with Computer Use → model thrash between DOM refs and pixels.
 * Exclusive lease: desktop computer owns the interaction space when armed.
 */
export const COMPUTER_UI_BROWSER_STRIP_PREFIX = 'browser_'

/** Strip unless agent coding is enabled for this turn. */
export const COMPUTER_UI_CODING_ONLY = new Set([
  'create_file',
  'edit_file',
  'delete_file',
  'terminal',
])

const lastTargetAppBySession = new Map<string, string>()

export function setComputerUiTargetApp(sessionId: string, name: string) {
  const n = name.trim()
  if (!sessionId || !n) return
  lastTargetAppBySession.set(sessionId, n)
}

export function getComputerUiTargetApp(sessionId: string): string | undefined {
  return lastTargetAppBySession.get(sessionId)
}

export function clearComputerUiTargetApp(sessionId: string) {
  lastTargetAppBySession.delete(sessionId)
}

export type ComputerUiLockOptions = {
  /** Agent coding tools also active this turn (workspace write/terminal allowed). */
  agentCodingEnabled?: boolean
  sessionId?: string
}

/**
 * Remove tools that pull the model out of desktop UI control.
 */
export function filterToolsForComputerUiSpace(tools: ToolSet, opts: ComputerUiLockOptions = {}): ToolSet {
  const coding = Boolean(opts.agentCodingEnabled)
  return Object.fromEntries(
    Object.entries(tools).filter(([name]) => {
      if (COMPUTER_UI_ALWAYS_STRIP.has(name)) return false
      if (name.startsWith(COMPUTER_UI_BROWSER_STRIP_PREFIX)) return false
      if (!coding && COMPUTER_UI_CODING_ONLY.has(name)) return false
      return true
    })
  ) as ToolSet
}

/**
 * System / tool-set instructions injected when computer tools are active.
 */
export function computerUiSpaceLockInstructions(opts: ComputerUiLockOptions = {}): string {
  const target = opts.sessionId ? getComputerUiTargetApp(opts.sessionId) : undefined
  const targetLine = target
    ? `Active computer target app: **${target}**. Stay inside that app's UI until the user goal is done or you open a different app on purpose.`
    : 'After computer_open_app, that app becomes the active target — stay in its UI.'

  return `
# Computer UI space LOCK (active)

You are locked into **desktop UI control** for this turn. Desktop goals use computer_* tools only.

${targetLine}

## Allowed for desktop goals
- computer_screenshot, computer_wait, computer_frontmost, computer_ax_query, computer_focus_search, computer_ax_press, computer_open_app, computer_open_uri, computer_click, computer_type, computer_key, computer_scroll, computer_mouse_move

## FORBIDDEN while Computer Use owns this turn
- Do NOT use browser_* tools (stripped). Prefer computer_* for desktop apps; use a Browser-only arm for pure web.
- Do NOT use search_file_content, workspace files, terminal, or web_search to find people.
- Do NOT open **Finder**.
- Do NOT use Spotlight (\`cmd+space\` / \`command+space\`) to find people or chats.
- Do NOT open a different app unless the user asked for it.

## Correct in-app find (WhatsApp / Telegram / Messages / Slack)
1. computer_open_app(target) — host attaches verification image; confirm app UI.
2. Optional computer_wait(0.5) if UI still loading.
3. computer_focus_search (AX). If fallback=vision, click the app's search field from the image — never Finder.
4. computer_type the name → read verification image → click the matching row.
5. Type message → send (enter or send button) → confirm from verification image.

## App playbooks (follow when target matches)
- **WhatsApp:** open → verify → computer_focus_search (or click search) → type contact → click chat → type message → send.
- **Calculator:** open → verify → computer_ax_press keypad names (7, +, 8, =). Vision click if AX empty.

## Keys
- \`meta+f\` / in-app Find: only after a screenshot shows the target app is focused.
- \`cmd+space\`: only if the user explicitly asked for Spotlight / launch something not available via computer_open_app.

${opts.agentCodingEnabled ? '- Agent coding is also on: workspace write/terminal allowed for code tasks only, never for finding contacts.\n' : '- Workspace write/terminal tools are unavailable while Computer Use owns this turn.\n'}
`.trim()
}
