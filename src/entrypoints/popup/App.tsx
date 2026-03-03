import '@/assets/tailwind.css'

import { BookOpen, Send, Settings } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import logoDark from '@/assets/logo-dark.svg'
import logoLight from '@/assets/logo-light.svg'
import { EndpointSelector } from '@/components/EndpointSelector'
import { JsonPreview } from '@/components/JsonPreview'
import { TemplateSelector } from '@/components/TemplateSelector'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { matchesSiteRules } from '@/lib/allowlist'
import { useLocale } from '@/lib/i18n'
import { applyTheme, watchSystemTheme } from '@/lib/theme'
import type { ContextBroTemplate, Endpoint, GlobalSettings, SiteRule } from '@/lib/types'

interface PageInfo {
	title: string
	url: string
	domain: string
}

type ShareStatus = 'idle' | 'loading' | 'success' | 'error'
interface DebugQualityInfo {
	ok: boolean
	score: number
	reason: string
	textLength: number
	wordCount: number
}
interface DebugPayload {
	contentQuality: DebugQualityInfo
	devMode: boolean
	markdownLinkPolicy: 'keep' | 'text_only' | 'domain_only'
	markdownLength?: {
		raw: number
		cleaned: number
	}
}

export default function App() {
	const { t, locale } = useLocale()
	const [endpoints, setEndpoints] = useState<Endpoint[]>([])
	const [templates, setTemplates] = useState<ContextBroTemplate[]>([])
	const [selectedEndpoint, setSelectedEndpoint] = useState('')
	const [selectedTemplate, setSelectedTemplate] = useState('default')
	const [pageInfo, setPageInfo] = useState<PageInfo | null>(null)
	const [matchedRules, setMatchedRules] = useState<SiteRule[]>([])
	const [preview, setPreview] = useState('')
	const [previewError, setPreviewError] = useState('')
	const [previewLoading, setPreviewLoading] = useState(true)
	const [shareStatus, setShareStatus] = useState<ShareStatus>('idle')
	const [shareMessage, setShareMessage] = useState('')
	const [devMode, setDevMode] = useState(false)
	const [debugQuality, setDebugQuality] = useState<DebugQualityInfo | null>(null)
	const [debugMeta, setDebugMeta] = useState<DebugPayload | null>(null)
	const [showDevInfo, setShowDevInfo] = useState(false)

	const hasMatchedRules = matchedRules.length > 0

	const loadPreview = useCallback(
		async (tabId?: number) => {
			if (!tabId) {
				const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
				tabId = tab?.id
			}
			if (!tabId) return

			setPreviewLoading(true)
			setPreviewError('')

			const result = await browser.runtime.sendMessage({
				action: 'compilePreview',
				tabId,
				templateId: selectedTemplate,
			})

			setPreviewLoading(false)
			if (result?.error) {
				setPreviewError(result.error)
			} else {
				setPreview(result?.compiled || '')
				const debug = (result?.debug as DebugPayload | undefined) || null
				setDebugMeta(debug)
				setDebugQuality(debug?.contentQuality || null)
			}
		},
		[selectedTemplate],
	)

	// Apply theme on mount and inform background of resolved system theme
	useEffect(() => {
		let cleanup: (() => void) | undefined

		const sendResolvedTheme = () => {
			const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
			browser.runtime.sendMessage({ action: 'resolveSystemTheme', isDark })
		}

		browser.storage.local.get('globalSettings').then((result) => {
			const settings = result.globalSettings as GlobalSettings | undefined
			const theme = settings?.theme || 'system'
			setDevMode(settings?.devMode ?? false)
			applyTheme(theme)
			sendResolvedTheme()
			cleanup = watchSystemTheme(() => {
				if (theme === 'system') applyTheme('system')
				sendResolvedTheme()
			})
		})

		return () => cleanup?.()
	}, [])

	// Load settings and page data on mount
	useEffect(() => {
		async function init() {
			const result = await browser.storage.local.get(['endpoints', 'templates', 'siteRules'])
			const eps = (result.endpoints as Endpoint[]) || []
			const tpls = (result.templates as ContextBroTemplate[]) || []
			const rules = (result.siteRules as SiteRule[]) || []
			setEndpoints(eps)
			setTemplates(tpls)

			const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
			if (!tab?.id) return

			setPageInfo({
				title: tab.title || '',
				url: tab.url || '',
				domain: tab.url ? new URL(tab.url).hostname : '',
			})

			// Auto-detect matching site rules
			const matched = tab.url ? matchesSiteRules(tab.url, rules) : []
			setMatchedRules(matched)
			if (matched.length > 0) {
				const first = matched[0]
				if (first.templateId) setSelectedTemplate(first.templateId)
			} else {
				const firstEnabled = eps.find((e) => e.enabled)
				if (firstEnabled) setSelectedEndpoint(firstEnabled.id)
			}

			loadPreview(tab.id)
		}

		init()
	}, [loadPreview])

	// Re-compile preview when template changes
	useEffect(() => {
		loadPreview()
	}, [loadPreview])

	// Re-compile once dev mode is loaded/toggled to avoid timing gaps.
	useEffect(() => {
		loadPreview()
	}, [devMode, loadPreview])

	async function handleShare() {
		const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
		if (!tab?.id) return

		setShareStatus('loading')
		setShareMessage('')

		if (hasMatchedRules) {
			// Use shareAll — background handles multi-rule/multi-endpoint routing
			const result = await browser.runtime.sendMessage({
				action: 'shareAll',
				tabId: tab.id,
			})

			if (result?.ok) {
				setShareStatus('success')
				setShareMessage(t('popup.sent', { status: '200' }))
				setTimeout(() => setShareStatus('idle'), 2000)
			} else {
				setShareStatus('error')
				setShareMessage(result?.error || 'Failed')
			}
		} else {
			// Manual share with selected endpoint/template
			const result = await browser.runtime.sendMessage({
				action: 'share',
				tabId: tab.id,
				endpointId: selectedEndpoint,
				templateId: selectedTemplate,
			})

			if (result?.ok) {
				setShareStatus('success')
				setShareMessage(t('popup.sent', { status: String(result.status) }))
				setTimeout(() => setShareStatus('idle'), 2000)
			} else {
				setShareStatus('error')
				setShareMessage(result?.error || result?.statusText || 'Failed')
			}
		}
	}

	async function handleCopy() {
		try {
			await navigator.clipboard.writeText(preview)
		} catch {
			// Fallback for contexts where clipboard API is unavailable
		}
	}

	function openOptions() {
		browser.runtime.openOptionsPage()
	}

	function getEndpointNames(rule: SiteRule): string {
		const names = rule.endpointIds
			.map((id) => endpoints.find((e) => e.id === id))
			.filter((e): e is Endpoint => e !== undefined)
			.map((e) => e.name || t('endpoints.unnamed'))
		if (names.length === 0) {
			const first = endpoints.find((e) => e.enabled)
			return first ? first.name || t('endpoints.unnamed') : t('popup.noEndpoints')
		}
		return names.join(', ')
	}

	function getTemplateName(rule: SiteRule): string {
		if (!rule.templateId || rule.templateId === 'default') return t('sites.defaultTemplate')
		const tmpl = templates.find((t) => t.id === rule.templateId)
		return tmpl?.name || t('templates.unnamed')
	}

	return (
		<div className="w-96 bg-background">
			{/* Header */}
			<div className="flex items-center justify-between border-b px-4 py-3">
				<div className="flex items-center gap-1.5">
					<img src={logoLight} alt="" className="h-5 w-5 dark:hidden" />
					<img src={logoDark} alt="" className="hidden h-5 w-5 dark:block" />
					<h1 className="text-sm font-semibold text-foreground">Context Bro</h1>
				</div>
				<div className="flex items-center gap-0.5">
					<Button
						variant="ghost"
						size="icon"
						className="h-7 w-7"
						onClick={() =>
							window.open(
								`https://contextbro.app/${locale === 'en' ? '' : `${locale}/`}guides/allowlist-schedule/`,
								'_blank',
							)
						}
						title={t('general.guide')}
					>
						<BookOpen className="h-4 w-4" />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						className="h-7 w-7"
						onClick={openOptions}
						title="Settings"
					>
						<Settings className="h-4 w-4" />
					</Button>
				</div>
			</div>

			<div className="space-y-3 p-4 max-h-[560px] overflow-y-auto">
				{/* Page Info */}
				{pageInfo && (
					<div className="rounded-md border bg-muted/50 p-2">
						<p className="truncate text-sm font-medium text-foreground" title={pageInfo.title}>
							{pageInfo.title || 'Untitled'}
						</p>
						<p className="truncate text-xs text-muted-foreground" title={pageInfo.url}>
							{pageInfo.domain}
						</p>
					</div>
				)}

				{/* Matched Rules Section */}
				{hasMatchedRules ? (
					<div className="space-y-1.5">
						<span className="block text-xs font-medium text-muted-foreground">
							{t('popup.matchedRules')}
						</span>
						<div className="space-y-1">
							{matchedRules.map((rule) => (
								<div
									key={rule.id}
									className="flex items-center gap-2 rounded border bg-muted/30 px-2.5 py-1.5 text-xs"
								>
									<Badge variant="secondary" className="text-[10px] shrink-0 px-1.5">
										{rule.name}
									</Badge>
									<span className="text-muted-foreground">
										<Send className="inline h-2.5 w-2.5 mr-0.5" />
										{getEndpointNames(rule)}
									</span>
									<span className="text-muted-foreground ml-auto shrink-0">
										{getTemplateName(rule)}
									</span>
								</div>
							))}
						</div>
					</div>
				) : (
					<div className="grid grid-cols-2 gap-2">
						<div>
							<span className="mb-1 block text-xs font-medium text-muted-foreground">
								{t('popup.endpoint')}
							</span>
							<EndpointSelector
								endpoints={endpoints}
								selectedId={selectedEndpoint}
								onChange={setSelectedEndpoint}
							/>
						</div>
						<div>
							<span className="mb-1 block text-xs font-medium text-muted-foreground">
								{t('popup.template')}
							</span>
							<TemplateSelector
								templates={templates}
								selectedId={selectedTemplate}
								onChange={setSelectedTemplate}
							/>
						</div>
					</div>
				)}

				{/* Preview */}
				<div>
					<span className="mb-1 block text-xs font-medium text-muted-foreground">
						{t('popup.preview')}
					</span>
					<JsonPreview content={preview} error={previewError} loading={previewLoading} />
				</div>

				{/* Actions */}
				<div className="flex gap-2">
					<Button
						className="flex-1"
						onClick={handleShare}
						disabled={
							shareStatus === 'loading' ||
							(!hasMatchedRules && (!selectedEndpoint || endpoints.length === 0))
						}
					>
						{shareStatus === 'loading' ? t('popup.sending') : t('popup.share')}
					</Button>
					<Button variant="outline" onClick={handleCopy} disabled={!preview}>
						{t('popup.copy')}
					</Button>
				</div>

				{/* Status message */}
				{shareMessage && (
					<p
						className={`text-center text-xs ${shareStatus === 'success' ? 'text-success' : 'text-destructive'}`}
					>
						{shareMessage}
					</p>
				)}

				{/* Dev diagnostics (bottom section) */}
				{devMode && (
					<div className="space-y-1.5 border-t pt-2">
						<Button
							variant="ghost"
							size="sm"
							className="h-7 px-0 text-xs text-muted-foreground hover:text-foreground"
							onClick={() => setShowDevInfo((v) => !v)}
						>
							{t('popup.devInfo')} {showDevInfo ? '▲' : '▼'}
						</Button>
						{showDevInfo && (debugQuality ? (
							<div className="rounded-md border bg-muted/20 p-2 text-xs">
								<div className="grid grid-cols-2 gap-x-3 gap-y-1 text-muted-foreground">
									<span>quality.ok</span>
									<span className="text-foreground">{String(debugQuality.ok)}</span>
									<span>quality.score</span>
									<span className="text-foreground">{debugQuality.score}</span>
									<span>quality.reason</span>
									<span className="text-foreground">{debugQuality.reason}</span>
									<span>textLength / wordCount</span>
									<span className="text-foreground">
										{debugQuality.textLength} / {debugQuality.wordCount}
									</span>
									{debugMeta && (
										<>
											<span>linkPolicy</span>
											<span className="text-foreground">{debugMeta.markdownLinkPolicy}</span>
										</>
									)}
									{debugMeta?.markdownLength && (
										<>
											<span>md(raw→cleaned)</span>
											<span className="text-foreground">
												{debugMeta.markdownLength.raw} → {debugMeta.markdownLength.cleaned}
											</span>
										</>
									)}
								</div>
							</div>
						) : (
							<p className="text-xs text-muted-foreground">{t('popup.devEmpty')}</p>
						))}
					</div>
				)}
			</div>
		</div>
	)
}
