export type Theme = 'system' | 'light' | 'dark'

/**
 * Apply the selected theme to the document root element.
 * For 'system', respects the OS preference via matchMedia.
 */
export function applyTheme(theme: Theme): void {
	const root = document.documentElement

	if (theme === 'dark') {
		root.classList.add('dark')
	} else if (theme === 'light') {
		root.classList.remove('dark')
	} else {
		// system — follow OS preference
		const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
		root.classList.toggle('dark', prefersDark)
	}
}

/**
 * Watch for system theme changes and call onApply when it changes.
 * Returns a cleanup function to stop watching.
 */
export function watchSystemTheme(onApply: () => void): () => void {
	const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
	const handler = () => onApply()
	mediaQuery.addEventListener('change', handler)
	return () => mediaQuery.removeEventListener('change', handler)
}
