import '@/assets/tailwind.css'
import { useCallback, useEffect, useState } from 'react'
import { AllowlistEditor } from '@/components/AllowlistEditor'
import { EndpointEditor } from '@/components/EndpointEditor'
import { ScheduleEditor } from '@/components/ScheduleEditor'
import { TemplateEditor } from '@/components/TemplateEditor'
import type { ContextBroTemplate, Endpoint, ScheduleConfig } from '@/lib/types'

type Tab = 'endpoints' | 'templates' | 'allowlist' | 'schedule' | 'general'

const DEFAULT_SCHEDULE_CONFIG: ScheduleConfig = {
	enabled: false,
	intervalMinutes: 15,
	mode: 'focused',
	allowlist: [],
}

export default function App() {
	const [activeTab, setActiveTab] = useState<Tab>('endpoints')
	const [endpoints, setEndpoints] = useState<Endpoint[]>([])
	const [templates, setTemplates] = useState<ContextBroTemplate[]>([])
	const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>(DEFAULT_SCHEDULE_CONFIG)
	const [saved, setSaved] = useState(false)

	const loadSettings = useCallback(async () => {
		const result = await browser.storage.local.get(['endpoints', 'templates', 'scheduleConfig'])
		setEndpoints((result.endpoints as Endpoint[]) || [])
		setTemplates((result.templates as ContextBroTemplate[]) || [])
		setScheduleConfig((result.scheduleConfig as ScheduleConfig) || DEFAULT_SCHEDULE_CONFIG)
	}, [])

	useEffect(() => {
		loadSettings()
	}, [loadSettings])

	async function save() {
		await browser.storage.local.set({ endpoints, templates, scheduleConfig })

		// Notify background to sync the alarm
		browser.runtime.sendMessage({ action: 'updateSchedule', config: scheduleConfig })

		setSaved(true)
		setTimeout(() => setSaved(false), 2000)
	}

	function updateAllowlist(allowlist: ScheduleConfig['allowlist']) {
		setScheduleConfig({ ...scheduleConfig, allowlist })
	}

	const tabs: { id: Tab; label: string }[] = [
		{ id: 'endpoints', label: 'Endpoints' },
		{ id: 'templates', label: 'Templates' },
		{ id: 'allowlist', label: 'Allowlist' },
		{ id: 'schedule', label: 'Schedule' },
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

			{activeTab === 'allowlist' && (
				<div>
					<p className="mb-4 text-sm text-gray-500">
						Domains in the allowlist can be automatically shared on a schedule. Manual clip and
						selection sharing work on all domains.
					</p>
					<AllowlistEditor
						allowlist={scheduleConfig.allowlist}
						templates={templates}
						onChange={updateAllowlist}
					/>
				</div>
			)}

			{activeTab === 'schedule' && (
				<div>
					<p className="mb-4 text-sm text-gray-500">
						Configure automatic sharing of allowlisted pages at regular intervals.
					</p>
					<ScheduleEditor config={scheduleConfig} onChange={setScheduleConfig} />
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
						<p className="mt-2">
							<a
								href={browser.runtime.getURL('/privacy.html' as '/options.html')}
								target="_blank"
								rel="noreferrer"
								className="text-xs text-blue-600 hover:underline"
							>
								Privacy Policy
							</a>
						</p>
					</div>
				</div>
			)}
		</div>
	)
}
