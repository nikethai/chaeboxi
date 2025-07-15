import type { BrowserWindow } from 'electron'
import log from 'electron-log/main'

export function handleDeepLink(mainWindow: BrowserWindow, link: string) {
  log.info('handleDeepLink', link)
  const url = new URL(link)

  // handle `chatbox://mcp/install?server=`
  if (url.hostname === 'mcp' && url.pathname === '/install') {
    const encodedConfig = url.searchParams.get('server') || ''
    mainWindow.webContents.send('navigate-to', `/settings/mcp?install=${encodeURIComponent(encodedConfig)}`)
  }
}
