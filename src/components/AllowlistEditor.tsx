import { useState } from 'react'
import { ALLOWLIST_PRESETS } from '@/lib/allowlist'
import type { AllowlistEntry, ContextBroTemplate } from '@/lib/types'

interface Props {
	allowlist: AllowlistEntry[]
	templates: ContextBroTemplate[]
	onChange: (allowlist: AllowlistEntry[]) => void
}

export function AllowlistEditor({ allowlist, templates, onChange }: Props) {
	const [newPattern, setNewPattern] = useState('')

	function addEntry(pattern: string) {
		const trimmed = pattern.trim().toLowerCase()
		if (!trimmed) return
		if (allowlist.some((e) => e.pattern === trimmed)) return

		onChange([...allowlist, { pattern: trimmed, enabled: true }])
		setNewPattern('')
	}

	function removeEntry(pattern: string) {
		onChange(allowlist.filter((e) => e.pattern !== pattern))
	}

	function toggleEntry(pattern: string) {
		onChange(allowlist.map((e) => (e.pattern === pattern ? { ...e, enabled: !e.enabled } : e)))
	}

	function setTemplate(pattern: string, templateId: string) {
		const value = templateId === '' ? undefined : templateId
		onChange(allowlist.map((e) => (e.pattern === pattern ? { ...e, templateId: value } : e)))
	}

	function addPreset(key: string) {
		const preset = ALLOWLIST_PRESETS[key]
		if (!preset) return

		const existing = new Set(allowlist.map((e) => e.pattern))
		const newEntries: AllowlistEntry[] = preset.patterns
			.filter((p) => !existing.has(p))
			.map((pattern) => ({ pattern, enabled: true }))

		if (newEntries.length > 0) {
			onChange([...allowlist, ...newEntries])
		}
	}

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap gap-2">
				{Object.entries(ALLOWLIST_PRESETS).map(([key, preset]) => (
					<button
						key={key}
						type="button"
						onClick={() => addPreset(key)}
						className="rounded-full border border-gray-200 px-3 py-1 text-xs hover:bg-gray-50"
					>
						+ {preset.label}
					</button>
				))}
			</div>

			<div className="space-y-2">
				{allowlist.map((entry) => (
					<div
						key={entry.pattern}
						className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2"
					>
						<input
							type="checkbox"
							checked={entry.enabled}
							onChange={() => toggleEntry(entry.pattern)}
							className="rounded"
						/>
						<span className="flex-1 font-mono text-sm">{entry.pattern}</span>
						<select
							value={entry.templateId || ''}
							onChange={(e) => setTemplate(entry.pattern, e.target.value)}
							className="rounded border border-gray-200 px-2 py-1 text-xs"
						>
							<option value="">Default template</option>
							{templates.map((t) => (
								<option key={t.id} value={t.id}>
									{t.name}
								</option>
							))}
						</select>
						<button
							type="button"
							onClick={() => removeEntry(entry.pattern)}
							className="text-xs text-red-400 hover:text-red-600"
						>
							x
						</button>
					</div>
				))}
			</div>

			<div className="flex gap-2">
				<input
					type="text"
					value={newPattern}
					onChange={(e) => setNewPattern(e.target.value)}
					onKeyDown={(e) => e.key === 'Enter' && addEntry(newPattern)}
					placeholder="github.com or *.reddit.com"
					className="flex-1 rounded border border-gray-200 px-3 py-2 text-sm"
				/>
				<button
					type="button"
					onClick={() => addEntry(newPattern)}
					disabled={!newPattern.trim()}
					className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
				>
					Add
				</button>
			</div>

			{allowlist.length === 0 && (
				<p className="text-center text-sm text-gray-400">
					No domains in allowlist. Add domains or use a preset to enable scheduled sharing.
				</p>
			)}
		</div>
	)
}
