#!/usr/bin/env node
/**
 * macOS-aware `tauri dev` wrapper:
 * After the debug binary is (re)built, re-sign with a stable identifier so
 * Screen Recording / Accessibility TCC grants are less likely to evaporate
 * on every cargo rebuild (ad-hoc CDHash churn).
 */
import { spawn } from 'node:child_process'
import { existsSync, statSync, watch } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const bin = join(root, 'src-tauri/target/debug/chaeboxi')
const signScript = join(root, 'scripts/macos-sign-dev-binary.sh')
const isMac = process.platform === 'darwin'

let lastSignedMtime = 0
let signTimer = null
let signing = false

function mtimeMs(path) {
  try {
    return statSync(path).mtimeMs
  } catch {
    return 0
  }
}

function signDevBinary(reason) {
  if (!isMac || !existsSync(bin)) return
  const mt = mtimeMs(bin)
  if (mt && mt === lastSignedMtime) return
  if (signing) return
  signing = true
  const child = spawn('bash', [signScript], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  })
  child.on('exit', (code) => {
    signing = false
    if (code === 0) {
      lastSignedMtime = mtimeMs(bin)
      console.log(`[dev-sign] signed (${reason})`)
    } else {
      console.warn(`[dev-sign] failed with code ${code} (${reason})`)
    }
  })
}

function scheduleSign(reason) {
  if (!isMac) return
  clearTimeout(signTimer)
  signTimer = setTimeout(() => signDevBinary(reason), 400)
}

const tauriArgs = process.argv.slice(2)
const tauri = spawn(
  process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
  ['exec', 'tauri', 'dev', ...tauriArgs],
  {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  }
)

if (isMac) {
  // Poll + directory watch: cargo replaces the binary atomically.
  const debugDir = join(root, 'src-tauri/target/debug')
  try {
    watch(debugDir, { persistent: true }, (_event, filename) => {
      if (!filename || filename === 'chaeboxi' || String(filename).startsWith('chaeboxi')) {
        scheduleSign('watch')
      }
    })
  } catch {
    // ignore missing dir at startup
  }
  setInterval(() => {
    if (existsSync(bin) && mtimeMs(bin) !== lastSignedMtime) {
      scheduleSign('poll')
    }
  }, 2000)
  // Initial attempt if binary already present.
  scheduleSign('startup')
}

tauri.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 1)
})
