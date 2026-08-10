import type { Language } from '../../shared/types'

/**
 * Map desktop `getLocale` / browser `navigator.language` to app Language codes.
 * Comments and identifiers are English-only.
 */
export function parseLocale(locale: string): Language {
  if (
    locale === 'zh' ||
    locale.startsWith('zh_CN') ||
    locale.startsWith('zh-CN') ||
    locale.startsWith('zh_Hans') ||
    locale.startsWith('zh-Hans')
  ) {
    return 'zh-Hans'
  }
  if (
    locale.startsWith('zh_HK') ||
    locale.startsWith('zh-HK') ||
    locale.startsWith('zh_TW') ||
    locale.startsWith('zh-TW') ||
    locale.startsWith('zh_Hant') ||
    locale.startsWith('zh-Hant')
  ) {
    return 'zh-Hant'
  }
  if (locale.startsWith('ja')) {
    return 'ja'
  }
  if (locale.startsWith('ko')) {
    return 'ko'
  }
  if (locale.startsWith('ru')) {
    return 'ru'
  }
  if (locale.startsWith('de')) {
    return 'de'
  }
  if (locale.startsWith('fr')) {
    return 'fr'
  }
  if (locale.startsWith('pt')) {
    // Portugal and Brazil both map to pt-PT for now.
    return 'pt-PT'
  }
  if (locale.startsWith('es')) {
    return 'es'
  }
  if (locale.startsWith('ar')) {
    return 'ar'
  }
  if (locale.startsWith('it')) {
    return 'it-IT'
  }
  if (locale.startsWith('sv')) {
    return 'sv'
  }
  if (locale.startsWith('nb')) {
    return 'nb-NO'
  }
  return 'en'
}
