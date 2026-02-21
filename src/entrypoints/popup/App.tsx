import '@/assets/tailwind.css'
import { useCallback, useEffect, useState } from 'react'
import { EndpointSelector } from '@/components/EndpointSelector'
import { JsonPreview } from '@/components/JsonPreview'
import { TemplateSelector } from '@/components/TemplateSelector'
import type { ContextBroTemplate, Endpoint } from '@/lib/types'

interface PageInfo {
	title: string
	url: string
	domain: string
}

type ShareStatus = 'idle' | 'loading' | 'success' | 'error'

export default function App() {
	const [endpoints, setEndpoints] = useState<Endpoint[]>([])
	const [templates, setTemplates] = useState<ContextBroTemplate[]>([])
	const [selectedEndpoint, setSelectedEndpoint] = useState('')
	const [selectedTemplate, setSelectedTemplate] = useState('default')
	const [pageInfo, setPageInfo] = useState<PageInfo | null>(null)
	const [preview, setPreview] = useState('')
	const [previewError, setPreviewError] = useState('')
	const [previewLoading, setPreviewLoading] = useState(true)
	const [shareStatus, setShareStatus] = useState<ShareStatus>('idle')
	const [shareMessage, setShareMessage] = useState('')

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

	// Load settings and page data on mount
	useEffect(() => {
		async function loadSettings() {
			const result = await browser.storage.local.get(['endpoints', 'templates'])
			const eps = (result.endpoints as Endpoint[]) || []
			const tpls = (result.templates as ContextBroTemplate[]) || []
			setEndpoints(eps)
			setTemplates(tpls)
			const firstEnabled = eps.find((e) => e.enabled)
			if (firstEnabled) setSelectedEndpoint(firstEnabled.id)
		}

		async function loadPageData() {
			const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
			if (!tab?.id) return
			setPageInfo({
				title: tab.title || '',
				url: tab.url || '',
				domain: tab.url ? new URL(tab.url).hostname : '',
			})
			loadPreview(tab.id)
		}

		loadSettings()
		loadPageData()
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

		const result = await browser.runtime.sendMessage({
			action: 'share',
			tabId: tab.id,
			endpointId: selectedEndpoint,
			templateId: selectedTemplate,
		})

		if (result?.ok) {
			setShareStatus('success')
			setShareMessage(`Sent (${result.status})`)
			setTimeout(() => setShareStatus('idle'), 2000)
		} else {
			setShareStatus('error')
			setShareMessage(result?.error || result?.statusText || 'Failed')
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

	return (
		<div className="w-96 bg-white">
			{/* Header */}
			<div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
				<h1 className="text-sm font-semibold text-gray-900">Context Bro</h1>
				<button
					type="button"
					onClick={openOptions}
					className="text-gray-400 hover:text-gray-600"
					title="Settings"
				>
					<svg
						className="h-4 w-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						role="img"
						aria-label="Settings"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
						/>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
						/>
					</svg>
				</button>
			</div>

			<div className="space-y-3 p-4">
				{/* Endpoint & Template selectors */}
				<div className="grid grid-cols-2 gap-2">
					<div>
						<span className="mb-1 block text-xs font-medium text-gray-500">Endpoint</span>
						<EndpointSelector
							endpoints={endpoints}
							selectedId={selectedEndpoint}
							onChange={setSelectedEndpoint}
						/>
					</div>
					<div>
						<span className="mb-1 block text-xs font-medium text-gray-500">Template</span>
						<TemplateSelector
							templates={templates}
							selectedId={selectedTemplate}
							onChange={setSelectedTemplate}
						/>
					</div>
				</div>

				{/* Page Info */}
				{pageInfo && (
					<div className="rounded border border-gray-100 bg-gray-50 p-2">
						<p className="truncate text-sm font-medium text-gray-800" title={pageInfo.title}>
							{pageInfo.title || 'Untitled'}
						</p>
						<p className="truncate text-xs text-gray-400" title={pageInfo.url}>
							{pageInfo.domain}
						</p>
					</div>
				)}

				{/* Preview */}
				<div>
					<span className="mb-1 block text-xs font-medium text-gray-500">Preview</span>
					<JsonPreview content={preview} error={previewError} loading={previewLoading} />
				</div>

				{/* Actions */}
				<div className="flex gap-2">
					<button
						type="button"
						onClick={handleShare}
						disabled={shareStatus === 'loading' || !selectedEndpoint || endpoints.length === 0}
						className="flex-1 rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{shareStatus === 'loading' ? 'Sending...' : 'Share'}
					</button>
					<button
						type="button"
						onClick={handleCopy}
						disabled={!preview}
						className="rounded border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
					>
						Copy
					</button>
				</div>

				{/* Status message */}
				{shareMessage && (
					<p
						className={`text-center text-xs ${shareStatus === 'success' ? 'text-green-600' : 'text-red-600'}`}
					>
						{shareMessage}
					</p>
				)}
			</div>
		</div>
	)
}
