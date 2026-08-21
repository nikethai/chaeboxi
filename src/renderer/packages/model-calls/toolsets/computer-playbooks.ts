/**
 * Static app playbooks + deep-link builders for Computer Use (Phase 3 residual).
 */

export type AppPlaybookId = 'whatsapp' | 'calculator' | 'telegram' | 'messages' | 'slack' | 'generic'

export type AppPlaybook = {
  id: AppPlaybookId
  /** Match computer_open_app / target names */
  match: RegExp
  steps: string[]
}

export const APP_PLAYBOOKS: AppPlaybook[] = [
  {
    id: 'whatsapp',
    match: /whatsapp/i,
    steps: [
      'computer_open_app("WhatsApp") — host attaches verification image',
      'If phone known: prefer computer_open_uri(whatsapp://send?phone=…&text=…) then verify',
      'Else: computer_focus_search (AX). If fallback=vision, click the left/top search field from the image — never Finder',
      'computer_type contact name → verification → click matching chat row (or computer_ax_press the row if listed)',
      'computer_type message → enter or click Send → verification',
    ],
  },
  {
    id: 'calculator',
    match: /calculator/i,
    steps: [
      'computer_open_app("Calculator") → verification image',
      'Prefer computer_ax_press name=7 / + / 8 / = (AX buttons). If fallback=vision, click the keypad from the image',
      'Never Spotlight. Read the result from the verification image after =',
    ],
  },
  {
    id: 'telegram',
    match: /telegram/i,
    steps: [
      'computer_open_app("Telegram") → verify',
      'Click in-app search → type contact → open chat → type message',
    ],
  },
  {
    id: 'messages',
    match: /^(messages|imessage)$/i,
    steps: [
      'computer_open_app("Messages") → verify',
      'If phone known: computer_open_uri(sms:…) may work',
      'Else: new message / search conversation in-app only',
    ],
  },
  {
    id: 'slack',
    match: /slack/i,
    steps: [
      'computer_open_app("Slack") → verify',
      'Cmd+K / in-app quick switcher for people/channels — not Spotlight',
      'Type message in composer → send',
    ],
  },
]

export function matchPlaybook(appName: string | undefined | null): AppPlaybook | undefined {
  if (!appName?.trim()) return undefined
  const n = appName.trim()
  return APP_PLAYBOOKS.find((p) => p.match.test(n))
}

/** Digits-only E.164-ish phone (8–15 digits). Strips spaces, dashes, leading +. */
export function extractPhoneCandidate(text: string): string | undefined {
  if (!text) return undefined
  // Prefer explicit +cc patterns
  const plus = text.match(/\+(\d{8,15})\b/)
  if (plus) return plus[1]
  // "phone 8490…" / bare long digit runs
  const labeled = text.match(/(?:phone|tel|mobile|wa)[:\s]+[+]?(\d[\d\s-]{7,18}\d)/i)
  if (labeled) {
    const digits = labeled[1].replace(/\D/g, '')
    if (digits.length >= 8 && digits.length <= 15) return digits
  }
  const bare = text.match(/(?<![\w.])(\d{10,15})(?![\w.])/)
  if (bare) return bare[1]
  return undefined
}

export function buildWhatsAppSendUri(opts: { phone?: string; text?: string }): string | null {
  const phone = opts.phone?.replace(/\D/g, '')
  if (!phone || phone.length < 8) return null
  const params = new URLSearchParams()
  params.set('phone', phone)
  if (opts.text?.trim()) params.set('text', opts.text.trim())
  return `whatsapp://send?${params.toString()}`
}

export function buildSmsUri(opts: { phone?: string; text?: string }): string | null {
  const phone = opts.phone?.replace(/\D/g, '')
  if (!phone || phone.length < 8) return null
  const body = opts.text?.trim() ? `?body=${encodeURIComponent(opts.text.trim())}` : ''
  return `sms:${phone}${body}`
}

/** Allowed URI schemes for computer_open_uri */
export const OPEN_URI_ALLOWED_SCHEMES = new Set([
  'whatsapp',
  'sms',
  'imessage',
  'http',
  'https',
  'mailto',
])

export function isAllowedOpenUri(uri: string): boolean {
  const t = uri.trim()
  if (!t || t.length > 2048) return false
  if (/[\n\r;|`]/.test(t)) return false
  const m = t.match(/^([a-z][a-z0-9+.-]*):/i)
  if (!m) return false
  return OPEN_URI_ALLOWED_SCHEMES.has(m[1].toLowerCase())
}

/**
 * Playbook block for system / tool instructions.
 */
export function formatPlaybookInstructions(targetApp?: string | null, userText?: string): string {
  const pb = matchPlaybook(targetApp || '')
  const phone = userText ? extractPhoneCandidate(userText) : undefined
  const lines: string[] = ['## App playbook (active skills)']

  if (pb) {
    lines.push(`Target skill: **${pb.id}** (${targetApp})`)
    for (const s of pb.steps) lines.push(`- ${s}`)
  } else if (targetApp) {
    lines.push(`Target app: **${targetApp}** — stay in its UI; use in-app search, not Finder.`)
  } else {
    lines.push('No target app yet. computer_open_app the app the user named, then follow that app’s playbook.')
  }

  if (phone) {
    lines.push(
      `Detected phone digits: ${phone}. Prefer computer_open_uri with whatsapp://send?phone=${phone} (or sms:) when messaging, then verify with the auto-screenshot.`
    )
  }

  lines.push(
    'Deep links skip contact search when phone is known. Name-only contacts: computer_focus_search then type. AX fallback=vision means click from the screenshot. Never Finder.'
  )
  return lines.join('\n')
}
