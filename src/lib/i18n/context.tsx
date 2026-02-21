import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react'
import en from './locales/en.json'
import ja from './locales/ja.json'
import zh from './locales/zh.json'

export type Locale = 'en' | 'zh' | 'ja'

const locales: Record<Locale, Record<string, string>> = { en, zh, ja }

interface I18nContextValue {
	locale: Locale
	t: (key: string, params?: Record<string, string>) => string
	setLocale: (locale: Locale) => void
}

const I18nContext = createContext<I18nContextValue>({
	locale: 'en',
	t: (key) => key,
	setLocale: () => {},
})

export function LocaleProvider({ children }: { children: ReactNode }) {
	const [locale, setLocaleState] = useState<Locale>('en')

	useEffect(() => {
		browser.storage.local.get('globalSettings').then((result) => {
			const settings = result.globalSettings as { locale?: Locale } | undefined
			if (settings?.locale && locales[settings.locale]) {
				setLocaleState(settings.locale)
			}
		})
	}, [])

	const setLocale = useCallback((newLocale: Locale) => {
		setLocaleState(newLocale)
		browser.storage.local.get('globalSettings').then((result) => {
			const settings = (result.globalSettings as Record<string, unknown>) || {}
			browser.storage.local.set({
				globalSettings: { ...settings, locale: newLocale },
			})
		})
	}, [])

	const t = useCallback(
		(key: string, params?: Record<string, string>): string => {
			let value = locales[locale]?.[key] || locales.en[key] || key
			if (params) {
				for (const [k, v] of Object.entries(params)) {
					value = value.replace(`{${k}}`, v)
				}
			}
			return value
		},
		[locale],
	)

	return <I18nContext.Provider value={{ locale, t, setLocale }}>{children}</I18nContext.Provider>
}

export function useLocale() {
	return useContext(I18nContext)
}
