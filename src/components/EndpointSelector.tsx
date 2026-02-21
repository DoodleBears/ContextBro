import type { Endpoint } from '@/lib/types'

interface Props {
	endpoints: Endpoint[]
	selectedId: string
	onChange: (id: string) => void
}

export function EndpointSelector({ endpoints, selectedId, onChange }: Props) {
	const enabled = endpoints.filter((e) => e.enabled)

	if (enabled.length === 0) {
		return <span className="text-xs text-gray-400 italic">No endpoints configured</span>
	}

	return (
		<select
			value={selectedId}
			onChange={(e) => onChange(e.target.value)}
			className="w-full rounded border border-gray-200 bg-white px-2 py-1 text-sm focus:border-blue-400 focus:outline-none"
		>
			{enabled.map((ep) => (
				<option key={ep.id} value={ep.id}>
					{ep.name}
				</option>
			))}
		</select>
	)
}
