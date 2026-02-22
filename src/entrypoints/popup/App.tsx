import '@/assets/tailwind.css'
import { Send, Settings } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
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

export default function App() {
	const { t } = useLocale()
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
			}
		},
		[selectedTemplate],
	)

	// Apply theme on mount
	useEffect(() => {
		let cleanup: (() => void) | undefined

		browser.storage.local.get('globalSettings').then((result) => {
			const settings = result.globalSettings as GlobalSettings | undefined
			const theme = settings?.theme || 'system'
			applyTheme(theme)
			cleanup = watchSystemTheme(() => {
				if (theme === 'system') applyTheme('system')
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
				<h1 className="text-sm font-semibold text-foreground">Context Bro</h1>
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

			<div className="space-y-3 p-4">
				{/* Page Info */}
				{pageInfo && (
					<div className="rounded-md border bg-muted/50 p-2">
						<p
							className="truncate text-sm font-medium text-foreground"
							title={pageInfo.title}
						>
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
			</div>
		</div>
	)
}
