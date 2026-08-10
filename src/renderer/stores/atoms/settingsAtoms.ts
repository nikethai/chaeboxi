import { atom, type SetStateAction } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { focusAtom } from 'jotai-optics'
import { omit } from 'lodash'
import * as defaults from '../../../shared/defaults'
import {
  type SessionSettings,
  type Settings,
  SettingsSchema,
  type SettingWindowTab,
  Theme,
} from '../../../shared/types'
import platform from '../../platform'
import storage, { StorageKey } from '../../storage'

// settings
const _settingsAtom = atomWithStorage<Settings>(
  StorageKey.Settings,
  SettingsSchema.parse({
    ...defaults.settings(),
    theme: (() => {
      const initialTheme = localStorage.getItem('initial-theme')
      if (initialTheme === 'light') {
        return Theme.Light
      } else if (initialTheme === 'dark') {
        return Theme.Dark
      }
      return Theme.System
    })(),
  }),
  storage
)
export const settingsAtom = atom(
  (get) => {
    const _settings = get(_settingsAtom) as Settings
    // (legacy comment removed)
    const settings = Object.assign({}, defaults.settings(), _settings)
    settings.shortcuts = Object.assign({}, defaults.settings().shortcuts, _settings.shortcuts)
    settings.mcp = Object.assign({}, defaults.settings().mcp, _settings.mcp)
    // (legacy comment removed)
    return omit(settings, ['maxTokens', 'maxContextSize']) as Settings
  },
  (get, set, update: SetStateAction<Settings>) => {
    const settings = get(_settingsAtom) as Settings
    const newSettings = typeof update === 'function' ? update(settings) : update
    // (legacy comment removed)
    // if (!newSettings.apiHost) {
    //   newSettings.apiHost = defaults.settings().apiHost
    // }
    // (legacy comment removed)
    if (newSettings.shortcuts !== settings.shortcuts) {
      platform.ensureShortcutConfig(newSettings.shortcuts)
    }
    // (legacy comment removed)
    if (newSettings.proxy !== settings.proxy) {
      platform.ensureProxyConfig({ proxy: newSettings.proxy })
    }
    // (legacy comment removed)
    if (Boolean(newSettings.autoLaunch) !== Boolean(settings.autoLaunch)) {
      platform.ensureAutoLaunch(newSettings.autoLaunch)
    }
    set(_settingsAtom, newSettings)
  }
)

export const languageAtom = focusAtom(settingsAtom, (optic) => optic.prop('language'))
export const showWordCountAtom = focusAtom(settingsAtom, (optic) => optic.prop('showWordCount'))
export const showTokenCountAtom = focusAtom(settingsAtom, (optic) => optic.prop('showTokenCount'))
export const showTokenUsedAtom = focusAtom(settingsAtom, (optic) => optic.prop('showTokenUsed'))
export const showModelNameAtom = focusAtom(settingsAtom, (optic) => optic.prop('showModelName'))
export const showMessageTimestampAtom = focusAtom(settingsAtom, (optic) => optic.prop('showMessageTimestamp'))
export const showFirstTokenLatencyAtom = focusAtom(settingsAtom, (optic) => optic.prop('showFirstTokenLatency'))
export const showTokenSpeedAtom = focusAtom(settingsAtom, (optic) => optic.prop('showTokenSpeed'))
export const userAvatarKeyAtom = focusAtom(settingsAtom, (optic) => optic.prop('userAvatarKey'))
export const defaultAssistantAvatarKeyAtom = focusAtom(settingsAtom, (optic) => optic.prop('defaultAssistantAvatarKey'))
export const themeAtom = focusAtom(settingsAtom, (optic) => optic.prop('theme'))
export const fontSizeAtom = focusAtom(settingsAtom, (optic) => optic.prop('fontSize'))
export const spellCheckAtom = focusAtom(settingsAtom, (optic) => optic.prop('spellCheck'))
export const allowReportingAndTrackingAtom = focusAtom(settingsAtom, (optic) => optic.prop('allowReportingAndTracking'))
export const enableMarkdownRenderingAtom = focusAtom(settingsAtom, (optic) => optic.prop('enableMarkdownRendering'))
export const enableLaTeXRenderingAtom = focusAtom(settingsAtom, (optic) => optic.prop('enableLaTeXRendering'))
export const enableMermaidRenderingAtom = focusAtom(settingsAtom, (optic) => optic.prop('enableMermaidRendering'))
// export const selectedCustomProviderIdAtom = focusAtom(settingsAtom, (optic) => optic.prop('selectedCustomProviderId'))
export const autoPreviewArtifactsAtom = focusAtom(settingsAtom, (optic) => optic.prop('autoPreviewArtifacts'))
export const autoGenerateTitleAtom = focusAtom(settingsAtom, (optic) => optic.prop('autoGenerateTitle'))
export const autoCollapseCodeBlockAtom = focusAtom(settingsAtom, (optic) => optic.prop('autoCollapseCodeBlock'))
export const shortcutsAtom = focusAtom(settingsAtom, (optic) => optic.prop('shortcuts'))
export const pasteLongTextAsAFileAtom = focusAtom(settingsAtom, (optic) => optic.prop('pasteLongTextAsAFile'))
// export const licenseDetailAtom = focusAtom(settingsAtom, (optic) => optic.prop('licenseDetail'))

// Related UI state, moved here for proximity to settings
export const openSettingDialogAtom = atom<SettingWindowTab | null>(null)

// SessionSettings localStorage
export const chatSessionSettingsAtom = atomWithStorage<SessionSettings>(StorageKey.ChatSessionSettings, {}, storage)
export const pictureSessionSettingsAtom = atomWithStorage<SessionSettings>(
  StorageKey.PictureSessionSettings,
  {},
  storage
)

export const knowledgeBaseSettingsAtom = focusAtom(settingsAtom, (optic) =>
  optic.prop('extension').prop('knowledgeBase')
)
