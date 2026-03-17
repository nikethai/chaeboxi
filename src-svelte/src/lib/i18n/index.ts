// i18n initialization for Svelte - simplified version
// Full i18next integration will be added later
import { browser } from '$app/environment'

// Simple i18n using the locale files
// Use direct relative imports that Vite can resolve

type TranslationKey = string
type Translations = Record<TranslationKey, string>

let translations: Translations = {}
let currentLanguage = 'en'

// Map of locale codes to locale paths - use relative imports from this file
const localeMap: Record<string, () => Promise<{ default: Translations }>> = {
	en: () => import('./locales/en/translation.json'),
	'zh-Hans': () => import('./locales/zh-Hans/translation.json'),
	'zh-Hant': () => import('./locales/zh-Hant/translation.json'),
	ja: () => import('./locales/ja/translation.json'),
	ko: () => import('./locales/ko/translation.json'),
	fr: () => import('./locales/fr/translation.json'),
	de: () => import('./locales/de/translation.json'),
	es: () => import('./locales/es/translation.json'),
	'it-IT': () => import('./locales/it-IT/translation.json'),
	'pt-PT': () => import('./locales/pt-PT/translation.json'),
	ru: () => import('./locales/ru/translation.json'),
	ar: () => import('./locales/ar/translation.json'),
	sv: () => import('./locales/sv/translation.json'),
	'nb-NO': () => import('./locales/nb-NO/translation.json'),
}

export const initI18n = async (lng = 'en') => {
	currentLanguage = lng

	// Try to load the locale dynamically
	const loader = localeMap[lng]
	if (loader) {
		try {
			const module = await loader()
			translations = module.default
		} catch (e) {
			console.warn(`Failed to load locale ${lng}, using empty translations:`, e)
			translations = {}
		}
	}

	// Try to load from localStorage as fallback
	if (browser) {
		const saved = localStorage.getItem('i18n-translations')
		if (saved) {
			try {
				translations = { ...translations, ...JSON.parse(saved) }
			} catch (e) {
				// ignore
			}
		}
	}

	return currentLanguage
}

export const changeLanguage = async (lng: string) => {
	await initI18n(lng)
}

export const t = (key: string, options?: Record<string, unknown>): string => {
	let value = translations[key]

	if (value === undefined) {
		return key
	}

	// Simple interpolation
	if (options) {
		for (const [k, v] of Object.entries(options)) {
			value = value.replace(new RegExp(`{{${k}}}`, 'g'), String(v))
		}
	}

	return value
}

export const getCurrentLanguage = () => currentLanguage

export const getTranslations = () => translations

export const supportedLanguages = [
	{ code: 'en', name: 'English' },
	{ code: 'zh-Hans', name: '简体中文' },
	{ code: 'zh-Hant', name: '繁體中文' },
	{ code: 'ja', name: '日本語' },
	{ code: 'ko', name: '한국어' },
	{ code: 'fr', name: 'Français' },
	{ code: 'de', name: 'Deutsch' },
	{ code: 'es', name: 'Español' },
	{ code: 'it-IT', name: 'Italiano' },
	{ code: 'pt-PT', name: 'Português' },
	{ code: 'ru', name: 'Русский' },
	{ code: 'ar', name: 'العربية' },
	{ code: 'sv', name: 'Svenska' },
	{ code: 'nb-NO', name: 'Norsk' },
]
