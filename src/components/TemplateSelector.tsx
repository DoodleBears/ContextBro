import type { ContextBroTemplate } from '@/lib/types'

interface Props {
	templates: ContextBroTemplate[]
	selectedId: string
	onChange: (id: string) => void
}

export function TemplateSelector({ templates, selectedId, onChange }: Props) {
	return (
		<select
			value={selectedId}
			onChange={(e) => onChange(e.target.value)}
			className="w-full rounded border border-gray-200 bg-white px-2 py-1 text-sm focus:border-blue-400 focus:outline-none"
		>
			<option value="default">Default</option>
			{templates.map((t) => (
				<option key={t.id} value={t.id}>
					{t.name}
				</option>
			))}
		</select>
	)
}
