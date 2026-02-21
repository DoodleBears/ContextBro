import type { ScheduleConfig } from '@/lib/types'

interface Props {
	config: ScheduleConfig
	onChange: (config: ScheduleConfig) => void
}

const INTERVAL_OPTIONS = [
	{ value: 5, label: '5 min' },
	{ value: 10, label: '10 min' },
	{ value: 15, label: '15 min' },
	{ value: 30, label: '30 min' },
	{ value: 60, label: '1 hour' },
	{ value: 120, label: '2 hours' },
]

export function ScheduleEditor({ config, onChange }: Props) {
	function update(updates: Partial<ScheduleConfig>) {
		onChange({ ...config, ...updates })
	}

	return (
		<div className="space-y-5">
			<div className="flex items-center justify-between">
				<div>
					<span className="block text-sm font-medium">Auto-share</span>
					<span className="text-xs text-gray-500">
						Automatically share page context on a schedule
					</span>
				</div>
				<button
					type="button"
					onClick={() => update({ enabled: !config.enabled })}
					className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
						config.enabled ? 'bg-blue-600' : 'bg-gray-300'
					}`}
					role="switch"
					aria-checked={config.enabled}
				>
					<span
						className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
							config.enabled ? 'translate-x-6' : 'translate-x-1'
						}`}
					/>
				</button>
			</div>

			<div className={config.enabled ? '' : 'pointer-events-none opacity-50'}>
				<div className="space-y-4">
					<div>
						<span className="mb-1 block text-sm font-medium">Interval</span>
						<select
							value={config.intervalMinutes}
							onChange={(e) => update({ intervalMinutes: Number(e.target.value) })}
							className="w-full rounded border border-gray-200 px-3 py-2 text-sm"
						>
							{INTERVAL_OPTIONS.map((opt) => (
								<option key={opt.value} value={opt.value}>
									{opt.label}
								</option>
							))}
						</select>
					</div>

					<div>
						<span className="mb-1 block text-sm font-medium">Mode</span>
						<div className="space-y-2">
							<label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3">
								<input
									type="radio"
									name="schedule-mode"
									value="focused"
									checked={config.mode === 'focused'}
									onChange={() => update({ mode: 'focused' })}
									className="mt-0.5"
								/>
								<div>
									<span className="block text-sm font-medium">Focused tab</span>
									<span className="text-xs text-gray-500">
										Only share the active tab in the current window
									</span>
								</div>
							</label>
							<label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3">
								<input
									type="radio"
									name="schedule-mode"
									value="all_allowed"
									checked={config.mode === 'all_allowed'}
									onChange={() => update({ mode: 'all_allowed' })}
									className="mt-0.5"
								/>
								<div>
									<span className="block text-sm font-medium">All allowed tabs</span>
									<span className="text-xs text-gray-500">
										Share all open tabs that match the allowlist
									</span>
								</div>
							</label>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
