import { useState } from 'react'
import type { Endpoint } from '@/lib/types'

interface Props {
	endpoints: Endpoint[]
	onChange: (endpoints: Endpoint[]) => void
}

function createId(): string {
	return crypto.randomUUID()
}

function createEndpoint(): Endpoint {
	return { id: createId(), name: '', url: '', headers: {}, enabled: true }
}

export function EndpointEditor({ endpoints, onChange }: Props) {
	const [editingId, setEditingId] = useState<string | null>(null)
	const [testStatus, setTestStatus] = useState<Record<string, string>>({})

	function addEndpoint() {
		const ep = createEndpoint()
		onChange([...endpoints, ep])
		setEditingId(ep.id)
	}

	function updateEndpoint(id: string, updates: Partial<Endpoint>) {
		onChange(endpoints.map((ep) => (ep.id === id ? { ...ep, ...updates } : ep)))
	}

	function removeEndpoint(id: string) {
		onChange(endpoints.filter((ep) => ep.id !== id))
		if (editingId === id) setEditingId(null)
	}

	function updateHeader(endpointId: string, oldKey: string, newKey: string, value: string) {
		const ep = endpoints.find((e) => e.id === endpointId)
		if (!ep) return
		const headers = { ...ep.headers }
		if (oldKey !== newKey) delete headers[oldKey]
		headers[newKey] = value
		updateEndpoint(endpointId, { headers })
	}

	function addHeader(endpointId: string) {
		const ep = endpoints.find((e) => e.id === endpointId)
		if (!ep) return
		const headers = { ...ep.headers, '': '' }
		updateEndpoint(endpointId, { headers })
	}

	function removeHeader(endpointId: string, key: string) {
		const ep = endpoints.find((e) => e.id === endpointId)
		if (!ep) return
		const headers = { ...ep.headers }
		delete headers[key]
		updateEndpoint(endpointId, { headers })
	}

	async function testEndpoint(ep: Endpoint) {
		setTestStatus({ ...testStatus, [ep.id]: 'testing...' })
		try {
			const response = await fetch(ep.url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', ...ep.headers },
				body: JSON.stringify({ test: true, source: 'Context Bro' }),
			})
			setTestStatus({
				...testStatus,
				[ep.id]: response.ok ? `OK (${response.status})` : `Error (${response.status})`,
			})
		} catch (error) {
			setTestStatus({
				...testStatus,
				[ep.id]: error instanceof Error ? error.message : 'Network error',
			})
		}
	}

	return (
		<div className="space-y-4">
			{endpoints.map((ep) => (
				<div key={ep.id} className="rounded-lg border border-gray-200 p-4">
					<div className="mb-3 flex items-center justify-between">
						<div className="flex items-center gap-2">
							<input
								type="checkbox"
								checked={ep.enabled}
								onChange={(e) => updateEndpoint(ep.id, { enabled: e.target.checked })}
								className="rounded"
							/>
							{editingId === ep.id ? (
								<input
									type="text"
									value={ep.name}
									onChange={(e) => updateEndpoint(ep.id, { name: e.target.value })}
									placeholder="Endpoint name"
									className="rounded border border-gray-200 px-2 py-1 text-sm"
								/>
							) : (
								<button
									type="button"
									onClick={() => setEditingId(ep.id)}
									className="text-sm font-medium"
								>
									{ep.name || 'Unnamed endpoint'}
								</button>
							)}
						</div>
						<button
							type="button"
							onClick={() => removeEndpoint(ep.id)}
							className="text-xs text-red-500 hover:text-red-700"
						>
							Remove
						</button>
					</div>

					{editingId === ep.id && (
						<div className="space-y-3">
							<div>
								<span className="mb-1 block text-xs font-medium text-gray-500">URL</span>
								<input
									type="url"
									value={ep.url}
									onChange={(e) => updateEndpoint(ep.id, { url: e.target.value })}
									placeholder="https://api.example.com/context"
									className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm"
								/>
							</div>

							<div>
								<div className="mb-1 flex items-center justify-between">
									<span className="text-xs font-medium text-gray-500">Headers</span>
									<button
										type="button"
										onClick={() => addHeader(ep.id)}
										className="text-xs text-blue-600 hover:text-blue-800"
									>
										+ Add header
									</button>
								</div>
								{Object.entries(ep.headers).map(([key, value]) => (
									<div key={key} className="mb-1 flex gap-1">
										<input
											type="text"
											value={key}
											onChange={(e) => updateHeader(ep.id, key, e.target.value, value)}
											placeholder="Header name"
											className="w-1/3 rounded border border-gray-200 px-2 py-1 text-xs"
										/>
										<input
											type="text"
											value={value}
											onChange={(e) => updateHeader(ep.id, key, key, e.target.value)}
											placeholder="Value"
											className="flex-1 rounded border border-gray-200 px-2 py-1 text-xs"
										/>
										<button
											type="button"
											onClick={() => removeHeader(ep.id, key)}
											className="px-1 text-xs text-red-400 hover:text-red-600"
										>
											x
										</button>
									</div>
								))}
							</div>

							<div className="flex items-center gap-2">
								<button
									type="button"
									onClick={() => testEndpoint(ep)}
									disabled={!ep.url}
									className="rounded border border-gray-200 px-3 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
								>
									Test
								</button>
								{testStatus[ep.id] && (
									<span className="text-xs text-gray-500">{testStatus[ep.id]}</span>
								)}
								<button
									type="button"
									onClick={() => setEditingId(null)}
									className="ml-auto text-xs text-gray-500 hover:text-gray-700"
								>
									Done
								</button>
							</div>
						</div>
					)}
				</div>
			))}

			<button
				type="button"
				onClick={addEndpoint}
				className="w-full rounded-lg border-2 border-dashed border-gray-200 py-3 text-sm text-gray-400 hover:border-gray-300 hover:text-gray-500"
			>
				+ Add endpoint
			</button>
		</div>
	)
}
