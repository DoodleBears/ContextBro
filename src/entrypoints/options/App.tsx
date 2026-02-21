import '@/assets/tailwind.css'
import { Check, Crosshair, Globe, Keyboard, Workflow } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { EndpointEditor } from '@/components/EndpointEditor'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { SiteRuleEditor } from '@/components/SiteRuleEditor'
import { TemplateEditor } from '@/components/TemplateEditor'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useLocale } from '@/lib/i18n'
import type { ContextBroTemplate, Endpoint, GlobalSettings, SiteRule } from '@/lib/types'

const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
	locale: 'en',
}

export default function App() {
	const { t } = useLocale()
	const [siteRules, setSiteRules] = useState<SiteRule[]>([])
	const [endpoints, setEndpoints] = useState<Endpoint[]>([])
	const [templates, setTemplates] = useState<ContextBroTemplate[]>([])
	const [globalSettings, setGlobalSettings] = useState<GlobalSettings>(DEFAULT_GLOBAL_SETTINGS)
	const [saved, setSaved] = useState(false)
	const [activeTab, setActiveTab] = useState('sites')

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
	}, [])

	useEffect(() => {
		loadSettings()
	}, [loadSettings])

	async function save() {
		await browser.storage.local.set({ siteRules, endpoints, templates, globalSettings })

		// Notify background to sync scheduler
		browser.runtime.sendMessage({ action: 'updateSiteRules', siteRules })
		browser.runtime.sendMessage({ action: 'updateGlobalSettings', globalSettings })

		setSaved(true)
		setTimeout(() => setSaved(false), 2000)
	}

	return (
		<div className="mx-auto min-h-screen max-w-4xl bg-background p-6 pb-20">
			{/* Header */}
			<div className="mb-6 flex items-center justify-between">
				<h1 className="text-xl font-bold text-foreground">{t('settings.title')}</h1>
				<LanguageSwitcher />
			</div>

			{/* Tabs */}
			<Tabs value={activeTab} onValueChange={setActiveTab}>
				<TabsList className="mb-6">
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
					<p className="mb-4 text-sm text-muted-foreground">{t('sites.description')}</p>
					<SiteRuleEditor
						siteRules={siteRules}
						endpoints={endpoints}
						templates={templates}
						onRulesChange={setSiteRules}
						onNavigateToTab={setActiveTab}
					/>
				</TabsContent>

				<TabsContent value="endpoints">
					<p className="mb-4 text-sm text-muted-foreground">{t('endpoints.description')}</p>
					<EndpointEditor endpoints={endpoints} onChange={setEndpoints} />
				</TabsContent>

				<TabsContent value="templates">
					<p className="mb-4 text-sm text-muted-foreground">{t('templates.description')}</p>
					<TemplateEditor templates={templates} onChange={setTemplates} />
				</TabsContent>

				<TabsContent value="general">
					<div className="space-y-4">
						<div className="rounded-lg border p-4">
							<div className="flex items-center gap-2 mb-2">
								<Keyboard className="h-4 w-4 text-muted-foreground" />
								<h3 className="text-sm font-medium">{t('general.keyboard')}</h3>
							</div>
							<p className="text-sm text-muted-foreground">
								{t('general.keyboardDesc', { shortcut: 'Ctrl+Shift+K / Cmd+Shift+K' })}
							</p>
							<p className="mt-2 text-xs text-muted-foreground">{t('general.keyboardCustomize')}</p>
						</div>

						<div className="rounded-lg border p-4">
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

			{/* Sticky save bar */}
			<div className="fixed bottom-0 left-0 right-0 z-20 border-t bg-background/80 backdrop-blur-sm">
				<div className="mx-auto flex max-w-4xl items-center justify-end px-6 py-3">
					<Button onClick={save} size="sm">
						{saved ? (
							<>
								<Check className="h-4 w-4" />
								{t('settings.saved')}
							</>
						) : (
							t('settings.save')
						)}
					</Button>
				</div>
			</div>
		</div>
	)
}
