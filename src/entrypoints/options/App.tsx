import '@/assets/tailwind.css'

import { BookOpen, Crosshair, ExternalLink, Globe, Keyboard, Radio, Workflow } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import logoDark from '@/assets/logo-dark.svg'
import logoLight from '@/assets/logo-light.svg'
import { EndpointEditor } from '@/components/EndpointEditor'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { LiveStreamEditor } from '@/components/LiveStreamEditor'
import { SendHistoryPanel } from '@/components/SendHistoryPanel'
import { SiteRuleEditor } from '@/components/SiteRuleEditor'
import { TemplateEditor } from '@/components/TemplateEditor'
import { ThemeSwitcher } from '@/components/ThemeSwitcher'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useLocale } from '@/lib/i18n'
import { DEFAULT_GLOBAL_SETTINGS, DEFAULT_LIVE_STREAM_CONFIG } from '@/lib/storage'
import { applyTheme, type Theme, watchSystemTheme } from '@/lib/theme'
import type {
	ContextBroTemplate,
	Endpoint,
	GlobalSettings,
	LiveStreamConfig,
	SiteRule,
} from '@/lib/types'

export default function App() {
	const { t, locale } = useLocale()
	const [siteRules, setSiteRules] = useState<SiteRule[]>([])
	const [endpoints, setEndpoints] = useState<Endpoint[]>([])
	const [templates, setTemplates] = useState<ContextBroTemplate[]>([])
	const [globalSettings, setGlobalSettings] = useState<GlobalSettings>(DEFAULT_GLOBAL_SETTINGS)
	const [liveStreamConfig, setLiveStreamConfig] = useState<LiveStreamConfig>(
		DEFAULT_LIVE_STREAM_CONFIG,
	)
	const [activeTab, setActiveTab] = useState('sites')
	const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)

	// Auto-save: skip saving until initial load completes
	const loaded = useRef(false)
	const saveTimer = useRef<ReturnType<typeof setTimeout>>(null)

	const loadSettings = useCallback(async () => {
		const result = await browser.storage.local.get([
			'siteRules',
			'endpoints',
			'templates',
			'globalSettings',
			'liveStreamConfig',
		])
		setSiteRules((result.siteRules as SiteRule[]) || [])
		setEndpoints((result.endpoints as Endpoint[]) || [])
		setTemplates((result.templates as ContextBroTemplate[]) || [])
		const storedGlobal = (result.globalSettings as Partial<GlobalSettings>) || {}
		setGlobalSettings({
			...DEFAULT_GLOBAL_SETTINGS,
			...storedGlobal,
			contentQuality: {
				...DEFAULT_GLOBAL_SETTINGS.contentQuality,
				...storedGlobal.contentQuality,
			},
			contentCleaning: {
				...DEFAULT_GLOBAL_SETTINGS.contentCleaning,
				...storedGlobal.contentCleaning,
			},
		})
		const storedLs = (result.liveStreamConfig as Partial<LiveStreamConfig>) || {}
		setLiveStreamConfig({
			...DEFAULT_LIVE_STREAM_CONFIG,
			...storedLs,
			youtube: { ...DEFAULT_LIVE_STREAM_CONFIG.youtube, ...storedLs.youtube },
			twitch: { ...DEFAULT_LIVE_STREAM_CONFIG.twitch, ...storedLs.twitch },
			flush: { ...DEFAULT_LIVE_STREAM_CONFIG.flush, ...storedLs.flush },
			sampling: { ...DEFAULT_LIVE_STREAM_CONFIG.sampling, ...storedLs.sampling },
			dedup: { ...DEFAULT_LIVE_STREAM_CONFIG.dedup, ...storedLs.dedup },
			transcript: { ...DEFAULT_LIVE_STREAM_CONFIG.transcript, ...storedLs.transcript },
		})
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
			await browser.storage.local.set({
				siteRules,
				endpoints,
				templates,
				globalSettings,
				liveStreamConfig,
			})
			browser.runtime.sendMessage({ action: 'updateSiteRules', siteRules })
			browser.runtime.sendMessage({ action: 'updateGlobalSettings', globalSettings })
		}, 500)

		return () => {
			if (saveTimer.current) clearTimeout(saveTimer.current)
		}
	}, [siteRules, endpoints, templates, globalSettings, liveStreamConfig])

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

	const guideUrl = `https://contextbro.app/${locale === 'en' ? '' : `${locale}/`}guides/allowlist-schedule/`

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
				<div className="mb-8 flex items-center justify-between">
					<TabsList>
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
						<TabsTrigger value="livestream">
							<Radio className="h-3.5 w-3.5 mr-1.5" />
							{t('tabs.livestream')}
						</TabsTrigger>
						<TabsTrigger value="general">{t('tabs.general')}</TabsTrigger>
					</TabsList>
					<a
						href={guideUrl}
						target="_blank"
						rel="noreferrer"
						className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-primary"
					>
						<BookOpen className="h-3.5 w-3.5" />
						{t('general.guideLink')}
						<ExternalLink className="h-3 w-3" />
					</a>
				</div>

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

				<TabsContent value="livestream">
					<p className="mb-5 text-sm text-muted-foreground">{t('livestream.description')}</p>
					<LiveStreamEditor
						config={liveStreamConfig}
						endpoints={endpoints}
						onChange={setLiveStreamConfig}
						onNavigateToTab={setActiveTab}
					/>
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

						<div className="rounded-lg border p-5">
							<div className="flex items-center justify-between">
								<div>
									<h3 className="text-sm font-medium">{t('general.advanced')}</h3>
									<p className="text-xs text-muted-foreground mt-1">
										{t('general.advancedToggleDesc')}
									</p>
								</div>
								<Switch
									checked={showAdvancedSettings}
									onCheckedChange={setShowAdvancedSettings}
								/>
							</div>
						</div>

						{showAdvancedSettings && (
							<div className="rounded-lg border p-5 space-y-4">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-sm font-medium">{t('general.devMode')}</p>
										<p className="text-xs text-muted-foreground">{t('general.devModeDesc')}</p>
									</div>
									<Switch
										checked={globalSettings.devMode}
										onCheckedChange={(checked) =>
											setGlobalSettings((prev) => ({ ...prev, devMode: checked }))
										}
									/>
								</div>

								<div className="space-y-2">
									<Label className="text-xs text-muted-foreground">
										{t('general.markdownLinkPolicy')}
									</Label>
									<Select
										value={globalSettings.contentCleaning.markdownLinkPolicy}
										onValueChange={(value) =>
											setGlobalSettings((prev) => ({
												...prev,
												contentCleaning: {
													...prev.contentCleaning,
													markdownLinkPolicy:
														value as GlobalSettings['contentCleaning']['markdownLinkPolicy'],
												},
											}))
										}
									>
										<SelectTrigger className="h-8 text-xs w-[220px]">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="text_only">{t('general.linkPolicyTextOnly')}</SelectItem>
											<SelectItem value="domain_only">{t('general.linkPolicyDomainOnly')}</SelectItem>
											<SelectItem value="keep">{t('general.linkPolicyKeep')}</SelectItem>
										</SelectContent>
									</Select>
								</div>

								<div className="space-y-2">
									<p className="text-sm font-medium">{t('general.qualityThresholds')}</p>
									<div className="flex items-center gap-3">
										<div className="space-y-1">
											<Label className="text-xs text-muted-foreground">
												{t('general.minTextLength')}
											</Label>
											<Input
												type="number"
												min={20}
												value={globalSettings.contentQuality.minTextLength}
												onChange={(e) => {
													const value = Number.parseInt(e.target.value, 10)
													if (!Number.isNaN(value) && value >= 20) {
														setGlobalSettings((prev) => ({
															...prev,
															contentQuality: { ...prev.contentQuality, minTextLength: value },
														}))
													}
												}}
												className="h-8 w-24 text-xs"
											/>
										</div>
										<div className="space-y-1">
											<Label className="text-xs text-muted-foreground">
												{t('general.minWordCount')}
											</Label>
											<Input
												type="number"
												min={1}
												value={globalSettings.contentQuality.minWordCount}
												onChange={(e) => {
													const value = Number.parseInt(e.target.value, 10)
													if (!Number.isNaN(value) && value >= 1) {
														setGlobalSettings((prev) => ({
															...prev,
															contentQuality: { ...prev.contentQuality, minWordCount: value },
														}))
													}
												}}
												className="h-8 w-24 text-xs"
											/>
										</div>
										<div className="space-y-1">
											<Label className="text-xs text-muted-foreground">
												{t('general.minQualityScore')}
											</Label>
											<Input
												type="number"
												min={1}
												max={10}
												value={globalSettings.contentQuality.minScore}
												onChange={(e) => {
													const value = Number.parseInt(e.target.value, 10)
													if (!Number.isNaN(value) && value >= 1 && value <= 10) {
														setGlobalSettings((prev) => ({
															...prev,
															contentQuality: { ...prev.contentQuality, minScore: value },
														}))
													}
												}}
												className="h-8 w-24 text-xs"
											/>
										</div>
									</div>
								</div>
							</div>
						)}
					</div>
				</TabsContent>
			</Tabs>
		</div>
	)
}
