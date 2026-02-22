import '@/assets/tailwind.css'

import { Crosshair, Globe, Keyboard, Workflow } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import logoDark from '@/assets/logo-dark.svg'
import logoLight from '@/assets/logo-light.svg'
import { EndpointEditor } from '@/components/EndpointEditor'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { SendHistoryPanel } from '@/components/SendHistoryPanel'
import { SiteRuleEditor } from '@/components/SiteRuleEditor'
import { TemplateEditor } from '@/components/TemplateEditor'
import { ThemeSwitcher } from '@/components/ThemeSwitcher'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useLocale } from '@/lib/i18n'
import { applyTheme, type Theme, watchSystemTheme } from '@/lib/theme'
import type { ContextBroTemplate, Endpoint, GlobalSettings, SiteRule } from '@/lib/types'

const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
	locale: 'en',
	theme: 'system',
}

export default function App() {
	const { t } = useLocale()
	const [siteRules, setSiteRules] = useState<SiteRule[]>([])
	const [endpoints, setEndpoints] = useState<Endpoint[]>([])
	const [templates, setTemplates] = useState<ContextBroTemplate[]>([])
	const [globalSettings, setGlobalSettings] = useState<GlobalSettings>(DEFAULT_GLOBAL_SETTINGS)
	const [activeTab, setActiveTab] = useState('sites')

	// Auto-save: skip saving until initial load completes
	const loaded = useRef(false)
	const saveTimer = useRef<ReturnType<typeof setTimeout>>(null)

	const loadSettings = useCallback(async () => {
		const result = await browser.storage.local.get([
			'siteRules',
			'endpoints',
			'templates',
			'globalSettings',
		])
		setSiteRules((result.siteRules as SiteRule[]) || [])
		setEndpoints((result.endpoints as Endpoint[]) || [])
		setTemplates((result.templates as ContextBroTemplate[]) || [])
		setGlobalSettings((result.globalSettings as GlobalSettings) || DEFAULT_GLOBAL_SETTINGS)
		// Mark loaded after a tick so the auto-save effect doesn't fire for the initial set
		requestAnimationFrame(() => {
			loaded.current = true
		})
	}, [])

	useEffect(() => {
		loadSettings()
	}, [loadSettings])

	// Auto-save: debounce writes to storage whenever state changes
	useEffect(() => {
		if (!loaded.current) return

		if (saveTimer.current) clearTimeout(saveTimer.current)
		saveTimer.current = setTimeout(async () => {
			await browser.storage.local.set({ siteRules, endpoints, templates, globalSettings })
			browser.runtime.sendMessage({ action: 'updateSiteRules', siteRules })
			browser.runtime.sendMessage({ action: 'updateGlobalSettings', globalSettings })
		}, 500)

		return () => {
			if (saveTimer.current) clearTimeout(saveTimer.current)
		}
	}, [siteRules, endpoints, templates, globalSettings])

	// Apply theme and watch for system changes; inform background of resolved theme
	useEffect(() => {
		const sendResolvedTheme = () => {
			const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
			browser.runtime.sendMessage({ action: 'resolveSystemTheme', isDark })
		}

		applyTheme(globalSettings.theme)
		sendResolvedTheme()
		const cleanup = watchSystemTheme(() => {
			if (globalSettings.theme === 'system') {
				applyTheme('system')
			}
			sendResolvedTheme()
		})
		return cleanup
	}, [globalSettings.theme])

	function handleThemeChange(theme: Theme) {
		setGlobalSettings((prev) => ({ ...prev, theme }))
		applyTheme(theme)
	}

	return (
		<div className="mx-auto min-h-screen max-w-4xl bg-background p-8">
			{/* Header */}
			<div className="mb-8 flex items-center justify-between">
				<div className="flex items-center gap-2">
					<img src={logoLight} alt="" className="h-7 w-7 dark:hidden" />
					<img src={logoDark} alt="" className="hidden h-7 w-7 dark:block" />
					<h1 className="text-xl font-bold text-foreground">{t('settings.title')}</h1>
				</div>
				<div className="flex items-center gap-2">
					<ThemeSwitcher theme={globalSettings.theme} onChange={handleThemeChange} />
					<LanguageSwitcher />
				</div>
			</div>

			{/* Tabs */}
			<Tabs value={activeTab} onValueChange={setActiveTab}>
				<TabsList className="mb-8">
					<TabsTrigger value="sites">
						<Globe className="h-3.5 w-3.5 mr-1.5" />
						{t('tabs.sites')}
					</TabsTrigger>
					<TabsTrigger value="endpoints">
						<Crosshair className="h-3.5 w-3.5 mr-1.5" />
						{t('tabs.endpoints')}
					</TabsTrigger>
					<TabsTrigger value="templates">
						<Workflow className="h-3.5 w-3.5 mr-1.5" />
						{t('tabs.templates')}
					</TabsTrigger>
					<TabsTrigger value="general">{t('tabs.general')}</TabsTrigger>
				</TabsList>

				<TabsContent value="sites">
					<p className="mb-5 text-sm text-muted-foreground">{t('sites.description')}</p>
					<SiteRuleEditor
						siteRules={siteRules}
						endpoints={endpoints}
						templates={templates}
						onRulesChange={setSiteRules}
						onNavigateToTab={setActiveTab}
					/>
				</TabsContent>

				<TabsContent value="endpoints">
					<p className="mb-5 text-sm text-muted-foreground">{t('endpoints.description')}</p>
					<EndpointEditor endpoints={endpoints} onChange={setEndpoints} />
				</TabsContent>

				<TabsContent value="templates">
					<p className="mb-5 text-sm text-muted-foreground">{t('templates.description')}</p>
					<TemplateEditor templates={templates} onChange={setTemplates} />
				</TabsContent>

				<TabsContent value="general">
					<div className="space-y-5">
						<div className="rounded-lg border p-5">
							<div className="flex items-center gap-2 mb-2">
								<Keyboard className="h-4 w-4 text-muted-foreground" />
								<h3 className="text-sm font-medium">{t('general.keyboard')}</h3>
							</div>
							<p className="text-sm text-muted-foreground">
								{t('general.keyboardDesc', { shortcut: 'Ctrl+Shift+K / Cmd+Shift+K' })}
							</p>
							<p className="mt-2 text-xs text-muted-foreground">{t('general.keyboardCustomize')}</p>
						</div>

						<SendHistoryPanel />

						<div className="rounded-lg border p-5">
							<h3 className="mb-2 text-sm font-medium">{t('general.about')}</h3>
							<p className="text-sm text-muted-foreground">{t('general.aboutDesc')}</p>
							<p className="mt-1 text-xs text-muted-foreground">{t('general.aboutTagline')}</p>
							<p className="mt-2">
								<a
									href={browser.runtime.getURL('/privacy.html' as '/options.html')}
									target="_blank"
									rel="noreferrer"
									className="text-xs text-primary hover:underline"
								>
									{t('general.privacy')}
								</a>
							</p>
						</div>
					</div>
				</TabsContent>
			</Tabs>
		</div>
	)
}
