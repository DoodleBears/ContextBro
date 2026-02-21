import { useState } from 'react'
import type { ContextBroTemplate } from '@/lib/types'

interface Props {
	templates: ContextBroTemplate[]
	onChange: (templates: ContextBroTemplate[]) => void
}

function createId(): string {
	return crypto.randomUUID()
}

const DEFAULT_CONTENT_FORMAT = `{
  "title": "{{title}}",
  "url": "{{url}}",
  "content": "{{content}}",
  "author": "{{author}}",
  "published": "{{published}}",
  "domain": "{{domain}}",
  "description": "{{description}}",
  "wordCount": {{wordCount}},
  "clippedAt": "{{date}} {{time}}"
}`

export function TemplateEditor({ templates, onChange }: Props) {
	const [editingId, setEditingId] = useState<string | null>(null)

	function addTemplate() {
		const t: ContextBroTemplate = {
			id: createId(),
			name: '',
			contentFormat: DEFAULT_CONTENT_FORMAT,
			triggers: [],
		}
		onChange([...templates, t])
		setEditingId(t.id)
	}

	function updateTemplate(id: string, updates: Partial<ContextBroTemplate>) {
		onChange(templates.map((t) => (t.id === id ? { ...t, ...updates } : t)))
	}

	function removeTemplate(id: string) {
		onChange(templates.filter((t) => t.id !== id))
		if (editingId === id) setEditingId(null)
	}

	return (
		<div className="space-y-4">
			{templates.map((t) => (
				<div key={t.id} className="rounded-lg border border-gray-200 p-4">
					<div className="mb-3 flex items-center justify-between">
						{editingId === t.id ? (
							<input
								type="text"
								value={t.name}
								onChange={(e) => updateTemplate(t.id, { name: e.target.value })}
								placeholder="Template name"
								className="rounded border border-gray-200 px-2 py-1 text-sm"
							/>
						) : (
							<button
								type="button"
								onClick={() => setEditingId(t.id)}
								className="text-sm font-medium"
							>
								{t.name || 'Unnamed template'}
							</button>
						)}
						<button
							type="button"
							onClick={() => removeTemplate(t.id)}
							className="text-xs text-red-500 hover:text-red-700"
						>
							Remove
						</button>
					</div>

					{editingId === t.id && (
						<div className="space-y-3">
							<div>
								<span className="mb-1 block text-xs font-medium text-gray-500">
									Trigger patterns (URL patterns, one per line)
								</span>
								<textarea
									value={(t.triggers || []).join('\n')}
									onChange={(e) =>
										updateTemplate(t.id, {
											triggers: e.target.value.split('\n').filter(Boolean),
										})
									}
									placeholder="e.g. github.com/*"
									rows={2}
									className="w-full rounded border border-gray-200 px-2 py-1.5 font-mono text-xs"
								/>
							</div>

							<div>
								<span className="mb-1 block text-xs font-medium text-gray-500">
									Template body (JSON with {'{{variables}}'})
								</span>
								<textarea
									value={t.contentFormat}
									onChange={(e) => updateTemplate(t.id, { contentFormat: e.target.value })}
									rows={12}
									className="w-full rounded border border-gray-200 px-2 py-1.5 font-mono text-xs leading-relaxed"
								/>
							</div>

							<div className="rounded bg-gray-50 p-2">
								<span className="mb-1 block text-xs font-medium text-gray-400">
									Available variables
								</span>
								<p className="text-xs text-gray-400 leading-relaxed">
									{'{{title}}'} {'{{url}}'} {'{{content}}'} {'{{author}}'} {'{{published}}'}{' '}
									{'{{domain}}'} {'{{description}}'} {'{{wordCount}}'} {'{{date}}'} {'{{time}}'}{' '}
									{'{{selection}}'} {'{{image}}'} {'{{favicon}}'} {'{{site}}'} {'{{fullHtml}}'}{' '}
									{'{{contentHtml}}'} {'{{selectionHtml}}'}
								</p>
							</div>

							<button
								type="button"
								onClick={() => setEditingId(null)}
								className="text-xs text-gray-500 hover:text-gray-700"
							>
								Done
							</button>
						</div>
					)}
				</div>
			))}

			<button
				type="button"
				onClick={addTemplate}
				className="w-full rounded-lg border-2 border-dashed border-gray-200 py-3 text-sm text-gray-400 hover:border-gray-300 hover:text-gray-500"
			>
				+ Add template
			</button>
		</div>
	)
}
