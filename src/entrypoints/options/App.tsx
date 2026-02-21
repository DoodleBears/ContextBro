import '@/assets/tailwind.css'
import { useCallback, useEffect, useState } from 'react'
import { EndpointEditor } from '@/components/EndpointEditor'
import { TemplateEditor } from '@/components/TemplateEditor'
import type { ContextBroTemplate, Endpoint } from '@/lib/types'

type Tab = 'endpoints' | 'templates' | 'general'

export default function App() {
	const [activeTab, setActiveTab] = useState<Tab>('endpoints')
	const [endpoints, setEndpoints] = useState<Endpoint[]>([])
	const [templates, setTemplates] = useState<ContextBroTemplate[]>([])
	const [saved, setSaved] = useState(false)

	const loadSettings = useCallback(async () => {
		const result = await browser.storage.local.get(['endpoints', 'templates'])
		setEndpoints((result.endpoints as Endpoint[]) || [])
		setTemplates((result.templates as ContextBroTemplate[]) || [])
	}, [])

	useEffect(() => {
		loadSettings()
	}, [loadSettings])

	async function save() {
		await browser.storage.local.set({ endpoints, templates })
		setSaved(true)
		setTimeout(() => setSaved(false), 2000)
	}

	const tabs: { id: Tab; label: string }[] = [
		{ id: 'endpoints', label: 'Endpoints' },
		{ id: 'templates', label: 'Templates' },
		{ id: 'general', label: 'General' },
	]

	return (
		<div className="mx-auto max-w-2xl p-6">
			<div className="mb-6 flex items-center justify-between">
				<h1 className="text-xl font-bold text-gray-900">Context Bro Settings</h1>
				<div className="flex items-center gap-2">
					{saved && <span className="text-xs text-green-600">Saved</span>}
					<button
						type="button"
						onClick={save}
						className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
					>
						Save
					</button>
				</div>
			</div>

			{/* Tab navigation */}
			<div className="mb-6 border-b border-gray-200">
				<nav className="-mb-px flex gap-6">
					{tabs.map((tab) => (
						<button
							key={tab.id}
							type="button"
							onClick={() => setActiveTab(tab.id)}
							className={`border-b-2 pb-2 text-sm font-medium ${
								activeTab === tab.id
									? 'border-blue-600 text-blue-600'
									: 'border-transparent text-gray-500 hover:text-gray-700'
							}`}
						>
							{tab.label}
						</button>
					))}
				</nav>
			</div>

			{/* Tab content */}
			{activeTab === 'endpoints' && (
				<div>
					<p className="mb-4 text-sm text-gray-500">
						Configure API endpoints where page context will be sent.
					</p>
					<EndpointEditor endpoints={endpoints} onChange={setEndpoints} />
				</div>
			)}

			{activeTab === 'templates' && (
				<div>
					<p className="mb-4 text-sm text-gray-500">
						Define templates that control the JSON payload shape. Use {'{{variables}}'} for dynamic
						values.
					</p>
					<TemplateEditor templates={templates} onChange={setTemplates} />
				</div>
			)}

			{activeTab === 'general' && (
				<div className="space-y-4">
					<div className="rounded-lg border border-gray-200 p-4">
						<h3 className="mb-2 text-sm font-medium text-gray-900">Keyboard shortcut</h3>
						<p className="text-sm text-gray-500">
							Press <kbd className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">Ctrl+Shift+K</kbd>{' '}
							(or <kbd className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">Cmd+Shift+K</kbd> on
							Mac) to share the current selection.
						</p>
						<p className="mt-2 text-xs text-gray-400">
							You can customize this shortcut in your browser&apos;s extension settings.
						</p>
					</div>

					<div className="rounded-lg border border-gray-200 p-4">
						<h3 className="mb-2 text-sm font-medium text-gray-900">About</h3>
						<p className="text-sm text-gray-500">Context Bro — Web Clipper for AI Agents.</p>
						<p className="mt-1 text-xs text-gray-400">Your AI&apos;s eyes on the web.</p>
					</div>
				</div>
			)}
		</div>
	)
}
