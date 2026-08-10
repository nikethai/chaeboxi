import type { Language } from '../../shared/types'

/** Language labels shown in Settings — English only (native names avoided for repo consistency). */
export const languageNameMap: Record<Language, string> = {
  en: 'English',
  'zh-Hans': 'Chinese (Simplified)',
  'zh-Hant': 'Chinese (Traditional)',
  ja: 'Japanese',
  ko: 'Korean',
  ru: 'Russian',
  de: 'German',
  fr: 'French',
  'pt-PT': 'Portuguese',
  es: 'Spanish',
  ar: 'Arabic',
  'it-IT': 'Italian',
  sv: 'Swedish',
  'nb-NO': 'Norwegian',
}

export const languages = Array.from(Object.keys(languageNameMap)) as Language[]
