import { describe, expect, it } from 'vitest'
import { SettingsSchema, Theme } from '@shared/types/settings'

describe('memory sync config schema', () => {
  it('accepts memorySync extension settings', () => {
    const parsed = SettingsSchema.parse({
      theme: Theme.Dark,
      language: 'en',
      shortcuts: {
        quickToggle: '',
        quickAttachOrOpen: '',
        quickOpen: '',
        screenshotToChat: '',
        inputBoxFocus: 'mod+i',
        inputBoxWebBrowsingMode: 'mod+e',
        newChat: 'mod+n',
        newPictureChat: 'mod+shift+n',
        sessionListNavNext: 'mod+tab',
        sessionListNavPrev: 'mod+shift+tab',
        sessionListNavTargetIndex: 'mod',
        messageListRefreshContext: 'mod+r',
        dialogOpenSearch: 'mod+k',
        optionNavUp: 'up',
        optionNavDown: 'down',
        optionSelect: 'enter',
        inputBoxSendMessage: 'Enter',
        inputBoxSendMessageWithoutResponse: 'Ctrl+Enter',
      },
      extension: {
        webSearch: {
          provider: 'bing',
        },
        memorySync: {
          enabled: true,
          endpoint: 'http://127.0.0.1:8788',
          token: 'secret',
          autoSync: true,
          intervalSeconds: 60,
        },
      },
      mcp: {
        servers: [],
        enabledBuiltinServers: [],
      },
      openclaw: {},
      userPersonalInfo: {},
    })

    expect(parsed.extension.memorySync?.enabled).toBe(true)
    expect(parsed.extension.memorySync?.endpoint).toBe('http://127.0.0.1:8788')
    expect(parsed.extension.memorySync?.token).toBe('secret')
    expect(parsed.extension.memorySync?.autoSync).toBe(true)
    expect(parsed.extension.memorySync?.intervalSeconds).toBe(60)
  })
})
