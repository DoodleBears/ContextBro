import { ChevronDown, ChevronRight, Copy, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useLocale } from '@/lib/i18n'
import type { Endpoint } from '@/lib/types'

interface Props {
	endpoints: Endpoint[]
	onChange: (endpoints: Endpoint[]) => void
}

function createEndpoint(): Endpoint {
	return { id: crypto.randomUUID(), name: '', url: '', headers: {}, enabled: true }
}

export function EndpointEditor({ endpoints, onChange }: Props) {
	const { t } = useLocale()
	const [editingId, setEditingId] = useState<string | null>(null)
	const [testStatus, setTestStatus] = useState<Record<string, string>>({})

	function addEndpoint() {
		const ep = createEndpoint()
		onChange([...endpoints, ep])
		setEditingId(ep.id)

		requestAnimationFrame(() => {
			document
				.getElementById(`endpoint-${ep.id}`)
				?.scrollIntoView({ behavior: 'smooth', block: 'center' })
		})
	}

	function cloneEndpoint(ep: Endpoint) {
		const clone: Endpoint = {
			...ep,
			id: crypto.randomUUID(),
			name: `${ep.name} (Copy)`,
			headers: { ...ep.headers },
		}
		onChange([...endpoints, clone])
		setEditingId(clone.id)

		requestAnimationFrame(() => {
			document
				.getElementById(`endpoint-${clone.id}`)
				?.scrollIntoView({ behavior: 'smooth', block: 'center' })
		})
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
		updateEndpoint(endpointId, { headers: { ...ep.headers, '': '' } })
	}

	function removeHeader(endpointId: string, key: string) {
		const ep = endpoints.find((e) => e.id === endpointId)
		if (!ep) return
		const headers = { ...ep.headers }
		delete headers[key]
		updateEndpoint(endpointId, { headers })
	}

	async function testEndpoint(ep: Endpoint) {
		setTestStatus({ ...testStatus, [ep.id]: t('endpoints.testing') })
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

	function toggleEditing(id: string) {
		setEditingId(editingId === id ? null : id)
	}

	return (
		<div className="space-y-3">
			{endpoints.map((ep) => {
				const open = editingId === ep.id
				return (
					<Card key={ep.id} id={`endpoint-${ep.id}`} className="overflow-hidden">
						{/* biome-ignore lint: header row acts as toggle with embedded interactive children */}
						<div
							className="flex items-center gap-3 p-4 cursor-pointer transition-colors hover:bg-accent/50"
							onClick={() => toggleEditing(ep.id)}
							onKeyDown={(e) => e.key === 'Enter' && toggleEditing(ep.id)}
						>
							{/* biome-ignore lint: stop header click propagation */}
							<div onClick={(e) => e.stopPropagation()}>
								<Switch
									checked={ep.enabled}
									onCheckedChange={(checked) => updateEndpoint(ep.id, { enabled: checked })}
								/>
							</div>

							<div className="flex-1 min-w-0">
								{open ? (
									<Input
										value={ep.name}
										onChange={(e) => updateEndpoint(ep.id, { name: e.target.value })}
										placeholder={t('endpoints.name')}
										className="h-8 w-64 text-sm"
										onClick={(e) => e.stopPropagation()}
									/>
								) : (
									<div className="flex items-center gap-3 min-w-0">
										<span className="text-sm font-medium truncate">
											{ep.name || t('endpoints.unnamed')}
										</span>
										{ep.url && (
											<span className="text-xs text-muted-foreground truncate hidden sm:inline">
												{ep.url}
											</span>
										)}
									</div>
								)}
							</div>

							{/* biome-ignore lint: stop header click propagation */}
							<div
								className="flex items-center gap-1 shrink-0"
								onClick={(e) => e.stopPropagation()}
							>
								<Button
									variant="ghost"
									size="icon"
									className="h-7 w-7 text-muted-foreground hover:text-foreground"
									onClick={() => cloneEndpoint(ep)}
									title={t('common.clone')}
								>
									<Copy className="h-3.5 w-3.5" />
								</Button>
								<Button
									variant="ghost"
									size="icon"
									className="h-7 w-7 text-muted-foreground hover:text-destructive"
									onClick={() => removeEndpoint(ep.id)}
								>
									<Trash2 className="h-3.5 w-3.5" />
								</Button>
							</div>

							{open ? (
								<ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
							) : (
								<ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
							)}
						</div>

						{/* Expanded edit form */}
						{open && (
							<div className="px-5 pb-5 space-y-4">
								<div className="border-t border-border/50" />
								<div>
									<Label className="text-xs text-muted-foreground">{t('endpoints.url')}</Label>
									<Input
										type="url"
										value={ep.url}
										onChange={(e) => updateEndpoint(ep.id, { url: e.target.value })}
										placeholder={t('endpoints.urlPlaceholder')}
										className="mt-1.5 text-sm"
									/>
								</div>

								<div>
									<div className="flex items-center justify-between mb-1.5">
										<Label className="text-xs text-muted-foreground">
											{t('endpoints.headers')}
										</Label>
										<Button
											variant="ghost"
											size="sm"
											className="h-6 text-xs"
											onClick={() => addHeader(ep.id)}
										>
											<Plus className="h-3 w-3" />
											{t('endpoints.addHeader')}
										</Button>
									</div>
									{Object.entries(ep.headers).map(([key, value]) => (
										<div key={key} className="mb-1.5 flex gap-1.5">
											<Input
												value={key}
												onChange={(e) => updateHeader(ep.id, key, e.target.value, value)}
												placeholder={t('endpoints.headerName')}
												className="w-1/3 h-8 text-xs"
											/>
											<Input
												value={value}
												onChange={(e) => updateHeader(ep.id, key, key, e.target.value)}
												placeholder={t('endpoints.headerValue')}
												className="flex-1 h-8 text-xs"
											/>
											<Button
												variant="ghost"
												size="icon"
												className="h-8 w-8 text-muted-foreground hover:text-destructive"
												onClick={() => removeHeader(ep.id, key)}
											>
												<X className="h-3 w-3" />
											</Button>
										</div>
									))}
								</div>

								<div className="flex items-center gap-2">
									<Button
										variant="outline"
										size="sm"
										onClick={() => testEndpoint(ep)}
										disabled={!ep.url}
									>
										{t('endpoints.test')}
									</Button>
									{testStatus[ep.id] && (
										<span className="text-xs text-muted-foreground">{testStatus[ep.id]}</span>
									)}
								</div>
							</div>
						)}
					</Card>
				)
			})}

			{/* Add endpoint */}
			<div className="sticky bottom-0 z-10 -mx-1 rounded-lg border bg-background/80 p-3 backdrop-blur-sm">
				<Button variant="outline" className="w-full border-dashed" onClick={addEndpoint}>
					<Plus className="h-4 w-4" />
					{t('endpoints.add')}
				</Button>
			</div>
		</div>
	)
}
