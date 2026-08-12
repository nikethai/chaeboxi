#!/usr/bin/env node
/**
 * Chaeboxi browser host — JSON-RPC over stdio (newline-delimited JSON).
 * Protocol:
 *   request:  { id, method, params }
 *   response: { id, result } | { id, error: { code, message } }
 *   event:    { event, payload }
 */
import { createInterface } from 'node:readline'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

const SNAPSHOT_MAX_CHARS = 180_000
const ACTION_TIMEOUT_MS = 30_000

/** @type {import('playwright').Browser | null} */
let browser = null
/** @type {import('playwright').BrowserContext | null} */
let context = null
/** @type {Map<string, import('playwright').Page>} */
const pages = new Map()
/** @type {Map<string, import('playwright').ElementHandle>} */
const refs = new Map()
let activePageId = null
let userDataDir = null
let headless = false
let downloadDir = null
let downloadsEnabled = false
let allowlist = [] // empty = off
let refCounter = 0

function send(obj) {
  process.stdout.write(`${JSON.stringify(obj)}\n`)
}

function ok(id, result) {
  send({ id, result })
}

function fail(id, code, message) {
  send({ id, error: { code, message } })
}

function emit(event, payload) {
  send({ event, payload })
}

function nextRef() {
  refCounter += 1
  return `e${refCounter}`
}

function clearRefs() {
  for (const handle of refs.values()) {
    handle.dispose().catch(() => {})
  }
  refs.clear()
}

function assertHttpUrl(url) {
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    throw Object.assign(new Error('Invalid URL'), { code: 'SECURITY_BLOCKED' })
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw Object.assign(new Error('Only http(s) URLs are allowed'), { code: 'SECURITY_BLOCKED' })
  }
  if (allowlist.length > 0) {
    const host = parsed.hostname.toLowerCase()
    const allowed = allowlist.some((entry) => {
      const e = String(entry).toLowerCase().replace(/^https?:\/\//, '').split('/')[0]
      return host === e || host.endsWith(`.${e}`)
    })
    if (!allowed) {
      throw Object.assign(new Error(`Host not in allowlist: ${host}`), { code: 'SECURITY_BLOCKED' })
    }
  }
  return parsed.toString()
}

async function getPlaywright() {
  try {
    return await import('playwright')
  } catch (err) {
    throw Object.assign(
      new Error(
        'Playwright is not installed for browser-host. Run: cd src-tauri/sidecars/browser-host && npm install'
      ),
      { code: 'DEPENDENCY_MISSING', cause: err }
    )
  }
}

async function launchBrowser(params) {
  await stopBrowser()
  userDataDir = params.userDataDir
  headless = Boolean(params.headless)
  downloadDir = params.downloadDir || null
  downloadsEnabled = Boolean(params.downloadsEnabled && downloadDir)
  allowlist = Array.isArray(params.allowlist) ? params.allowlist : []
  refCounter = 0

  if (!userDataDir) {
    throw Object.assign(new Error('userDataDir required'), { code: 'INVALID_ARGS' })
  }
  mkdirSync(userDataDir, { recursive: true })
  if (downloadDir) mkdirSync(downloadDir, { recursive: true })

  const pw = await getPlaywright()
  const channel = params.channel || undefined // 'chrome' | 'msedge' | undefined
  const launchOpts = {
    headless,
    viewport: params.viewport || { width: 1280, height: 800 },
    acceptDownloads: downloadsEnabled,
    args: ['--disable-blink-features=AutomationControlled'],
  }

  // Prefer system Chrome/Edge via channel; fall back to bundled Chromium.
  try {
    if (channel) {
      context = await pw.chromium.launchPersistentContext(userDataDir, {
        ...launchOpts,
        channel,
      })
    } else {
      // Try chrome, then msedge, then bundled
      try {
        context = await pw.chromium.launchPersistentContext(userDataDir, {
          ...launchOpts,
          channel: 'chrome',
        })
      } catch {
        try {
          context = await pw.chromium.launchPersistentContext(userDataDir, {
            ...launchOpts,
            channel: 'msedge',
          })
        } catch {
          context = await pw.chromium.launchPersistentContext(userDataDir, launchOpts)
        }
      }
    }
  } catch (err) {
    throw Object.assign(new Error(`Failed to launch browser: ${err.message || err}`), {
      code: 'LAUNCH_FAILED',
    })
  }

  browser = context.browser()
  context.setDefaultTimeout(ACTION_TIMEOUT_MS)

  if (downloadsEnabled && downloadDir) {
    context.on('page', (page) => {
      page.on('download', async (download) => {
        try {
          const suggested = download.suggestedFilename() || `download-${Date.now()}`
          const target = join(downloadDir, suggested)
          await download.saveAs(target)
          emit('download', { path: target, suggestedFilename: suggested })
        } catch (err) {
          emit('download-error', { message: String(err?.message || err) })
        }
      })
    })
  } else {
    context.on('page', (page) => {
      page.on('download', async (download) => {
        try {
          await download.cancel()
        } catch {
          /* ignore */
        }
        emit('download-blocked', {
          message: 'Downloads require a session workspace. Set a workspace folder first.',
        })
      })
    })
  }

  const page = context.pages()[0] || (await context.newPage())
  const pageId = 'tab-1'
  pages.clear()
  pages.set(pageId, page)
  activePageId = pageId
  clearRefs()

  return {
    pageId,
    headless,
    userDataDir,
    downloadsEnabled,
  }
}

async function stopBrowser() {
  clearRefs()
  pages.clear()
  activePageId = null
  try {
    if (context) await context.close()
  } catch {
    /* ignore */
  }
  context = null
  browser = null
  return { stopped: true }
}

function getActivePage() {
  if (!activePageId || !pages.has(activePageId)) {
    throw Object.assign(new Error('No active browser page'), { code: 'SESSION_NOT_FOUND' })
  }
  return pages.get(activePageId)
}

const REF_MARK_ATTR = 'data-chaeboxi-ref'

async function settlePage(page, ms = 150) {
  await page.waitForLoadState('domcontentloaded', { timeout: ACTION_TIMEOUT_MS }).catch(() => {})
  if (ms > 0) {
    await page.waitForTimeout(ms).catch(() => {})
  }
}

async function navigate(params) {
  const url = assertHttpUrl(params.url)
  const page = getActivePage()
  clearRefs()
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: ACTION_TIMEOUT_MS })
  await settlePage(page, 200)
  const shot = await snapshot({ interestingOnly: true })
  return {
    url: page.url(),
    title: await page.title(),
    ...shot,
    nextAction: 'Use refs from the attached snapshot for click/type. Snapshot was auto-attached after navigate.',
  }
}

function truncate(text, max = SNAPSHOT_MAX_CHARS) {
  if (text.length <= max) return { text, truncated: false }
  return {
    text: `${text.slice(0, max)}\n… [snapshot truncated at ${max} chars]`,
    truncated: true,
  }
}

async function snapshot(params) {
  const page = getActivePage()
  clearRefs()
  const interestingOnly = params?.interestingOnly !== false

  // Single-pass: mark each included element in the DOM, then resolve handles by mark.
  // Avoids dual-traversal ref/handle mismatch (previous bug).
  await page.evaluate((attr) => {
    document.querySelectorAll(`[${attr}]`).forEach((el) => el.removeAttribute(attr))
  }, REF_MARK_ATTR)

  const tree = await page.evaluate(
    ({ interesting, attr, maxWalk }) => {
      const INTERESTING = new Set([
        'a',
        'button',
        'input',
        'textarea',
        'select',
        'summary',
        'label',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'img',
        'nav',
        'main',
        'form',
        'table',
        'th',
        'td',
        'li',
      ])

      function isVisible(el) {
        const style = window.getComputedStyle(el)
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false
        const rect = el.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0
      }

      function roleOf(el) {
        return el.getAttribute('role') || el.tagName.toLowerCase()
      }

      function nameOf(el) {
        const aria = el.getAttribute('aria-label')
        if (aria) return aria.slice(0, 120)
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          return (el.getAttribute('placeholder') || el.getAttribute('name') || el.getAttribute('type') || '').slice(
            0,
            120
          )
        }
        const text = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim()
        return text.slice(0, 120)
      }

      const nodes = []
      const root = document.body || document.documentElement
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT)
      let node = walker.currentNode
      let walked = 0
      while (node && walked < maxWalk && nodes.length < 400) {
        const el = /** @type {Element} */ (node)
        const tag = el.tagName.toLowerCase()
        const role = roleOf(el)
        const interestingTag =
          INTERESTING.has(tag) || el.hasAttribute('role') || el.hasAttribute('contenteditable')
        if ((!interesting || interestingTag) && isVisible(el)) {
          const markId = String(nodes.length)
          el.setAttribute(attr, markId)
          const type = el.getAttribute('type') || undefined
          const isPassword = type === 'password'
          nodes.push({
            markId,
            tag,
            role,
            name: isPassword ? '[password]' : nameOf(el),
            href: tag === 'a' ? el.getAttribute('href') || undefined : undefined,
            type: isPassword ? 'password' : type,
            value: isPassword
              ? undefined
              : tag === 'input'
                ? String(/** @type {HTMLInputElement} */ (el).value || '').slice(0, 80)
                : undefined,
          })
        }
        node = walker.nextNode()
        walked += 1
      }
      return {
        url: location.href,
        title: document.title,
        nodes,
        walked,
      }
    },
    { interesting: interestingOnly, attr: REF_MARK_ATTR, maxWalk: 2500 }
  )

  const lines = [`url: ${tree.url}`, `title: ${tree.title}`, '']
  for (const n of tree.nodes) {
    const handle = await page.$(`[${REF_MARK_ATTR}="${n.markId}"]`).catch(() => null)
    if (!handle) continue
    const ref = nextRef()
    refs.set(ref, handle)
    const bits = [`[${ref}]`, n.role || n.tag]
    if (n.name) bits.push(`"${n.name}"`)
    if (n.href) bits.push(`href=${n.href}`)
    if (n.type) bits.push(`type=${n.type}`)
    if (n.value) bits.push(`value=${n.value}`)
    lines.push(bits.join(' '))
  }

  const raw = lines.join('\n')
  const { text, truncated } = truncate(raw)
  return {
    url: tree.url,
    title: tree.title,
    snapshot: text,
    truncated,
    refCount: refs.size,
    snapshotEpoch: refCounter,
  }
}

async function withPostActionSnapshot(result) {
  const page = getActivePage()
  await settlePage(page, 180)
  const shot = await snapshot({ interestingOnly: true })
  return {
    ...result,
    ...shot,
    nextAction:
      'Fresh snapshot auto-attached. Use only the new refs for the next click/type. Previous refs are invalid.',
  }
}

async function staleRefResult(ref) {
  const shot = await snapshot({ interestingOnly: true }).catch(() => ({}))
  return {
    error: 'REF_INVALID',
    message: `Invalid or stale ref: ${ref}. Fresh snapshot attached — pick a new ref.`,
    ...shot,
    nextAction: 'Do not reuse the old ref. Choose a ref from this snapshot and retry the action.',
  }
}

async function act(params) {
  const page = getActivePage()
  const action = params.action
  if (action === 'click') {
    const ref = params.ref
    const handle = refs.get(ref)
    if (!handle) {
      return staleRefResult(ref)
    }
    await handle.click({ button: params.button || 'left', timeout: ACTION_TIMEOUT_MS })
    return withPostActionSnapshot({ ok: true, action: 'click', ref })
  }
  if (action === 'type') {
    const text = String(params.text ?? '')
    if (params.ref) {
      const handle = refs.get(params.ref)
      if (!handle) {
        return staleRefResult(params.ref)
      }
      await handle.click({ timeout: ACTION_TIMEOUT_MS })
      await handle.fill(text).catch(async () => {
        await handle.type(text, { delay: 10 })
      })
    } else {
      await page.keyboard.type(text, { delay: 10 })
    }
    if (params.submit) {
      await page.keyboard.press('Enter')
    }
    return withPostActionSnapshot({ ok: true, action: 'type', ref: params.ref || null })
  }
  if (action === 'scroll') {
    const amount = Number(params.amount) || 600
    const direction = params.direction === 'up' ? -1 : 1
    if (params.ref) {
      const handle = refs.get(params.ref)
      if (!handle) {
        return staleRefResult(params.ref)
      }
      await handle.evaluate((el, delta) => {
        el.scrollBy(0, delta)
      }, direction * amount)
    } else {
      await page.mouse.wheel(0, direction * amount)
    }
    return withPostActionSnapshot({ ok: true, action: 'scroll' })
  }
  throw Object.assign(new Error(`Unknown action: ${action}`), { code: 'INVALID_ARGS' })
}

async function tabs(params) {
  if (!context) {
    throw Object.assign(new Error('Browser not started'), { code: 'SESSION_NOT_FOUND' })
  }
  const op = params.op || params.action
  if (op === 'list') {
    const list = []
    for (const [id, page] of pages.entries()) {
      list.push({
        tabId: id,
        url: page.url(),
        title: await page.title().catch(() => ''),
        active: id === activePageId,
      })
    }
    return { tabs: list }
  }
  if (op === 'new') {
    const page = await context.newPage()
    if (params.url) {
      const url = assertHttpUrl(params.url)
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: ACTION_TIMEOUT_MS })
    }
    const id = `tab-${pages.size + 1}`
    pages.set(id, page)
    activePageId = id
    clearRefs()
    return { tabId: id, url: page.url() }
  }
  if (op === 'select') {
    if (!params.tabId || !pages.has(params.tabId)) {
      throw Object.assign(new Error('tabId not found'), { code: 'SESSION_NOT_FOUND' })
    }
    activePageId = params.tabId
    clearRefs()
    const page = pages.get(activePageId)
    await page.bringToFront().catch(() => {})
    return { tabId: activePageId, url: page.url() }
  }
  if (op === 'close') {
    const id = params.tabId || activePageId
    if (!id || !pages.has(id)) {
      throw Object.assign(new Error('tabId not found'), { code: 'SESSION_NOT_FOUND' })
    }
    const page = pages.get(id)
    await page.close().catch(() => {})
    pages.delete(id)
    if (activePageId === id) {
      activePageId = pages.keys().next().value || null
      clearRefs()
    }
    return { closed: id, activePageId }
  }
  throw Object.assign(new Error(`Unknown tabs op: ${op}`), { code: 'INVALID_ARGS' })
}

async function screenshot() {
  const page = getActivePage()
  // JPEG keeps multimodal context smaller on long browser loops.
  const buffer = await page.screenshot({ type: 'jpeg', quality: 72, fullPage: false })
  return {
    mimeType: 'image/jpeg',
    base64: buffer.toString('base64'),
    url: page.url(),
  }
}

async function status() {
  return {
    running: Boolean(context),
    activePageId,
    tabCount: pages.size,
    url: activePageId && pages.has(activePageId) ? pages.get(activePageId).url() : null,
    headless,
    downloadsEnabled,
  }
}

const handlers = {
  'session.start': launchBrowser,
  'session.stop': stopBrowser,
  'session.status': status,
  navigate,
  snapshot,
  act,
  tabs,
  screenshot,
  ping: async () => ({ pong: true }),
}

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity })

rl.on('line', async (line) => {
  const trimmed = line.trim()
  if (!trimmed) return
  let msg
  try {
    msg = JSON.parse(trimmed)
  } catch {
    return
  }
  const { id, method, params } = msg
  if (id == null || !method) return
  const handler = handlers[method]
  if (!handler) {
    fail(id, 'METHOD_NOT_FOUND', `Unknown method: ${method}`)
    return
  }
  try {
    const result = await handler(params || {})
    ok(id, result)
  } catch (err) {
    fail(id, err?.code || 'ACTION_ERROR', err?.message || String(err))
  }
})

process.on('SIGTERM', async () => {
  await stopBrowser()
  process.exit(0)
})
process.on('SIGINT', async () => {
  await stopBrowser()
  process.exit(0)
})

// Ready signal
emit('ready', { version: '0.1.0' })
