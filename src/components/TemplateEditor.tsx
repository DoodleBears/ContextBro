import { ChevronDown, ChevronRight, Copy, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useLocale } from '@/lib/i18n'
import { TEMPLATE_PRESETS } from '@/lib/template-presets'
import type { ContextBroTemplate } from '@/lib/types'

interface Props {
	templates: ContextBroTemplate[]
	onChange: (templates: ContextBroTemplate[]) => void
}

export function TemplateEditor({ templates, onChange }: Props) {
	const { t } = useLocale()
	const [editingId, setEditingId] = useState<string | null>(null)

	function addBlankTemplate() {
		const tmpl: ContextBroTemplate = {
			id: crypto.randomUUID(),
			name: '',
			contentFormat: TEMPLATE_PRESETS[0].contentFormat,
			triggers: [],
		}
		onChange([...templates, tmpl])
		setEditingId(tmpl.id)

		requestAnimationFrame(() => {
			document
				.getElementById(`template-${tmpl.id}`)
				?.scrollIntoView({ behavior: 'smooth', block: 'center' })
		})
	}

	function addFromPreset(index: number) {
		const preset = TEMPLATE_PRESETS[index]
		const tmpl: ContextBroTemplate = {
			id: crypto.randomUUID(),
			name: preset.name,
			contentFormat: preset.contentFormat,
			triggers: preset.triggers ? [...preset.triggers] : [],
		}
		onChange([...templates, tmpl])
		setEditingId(tmpl.id)

		requestAnimationFrame(() => {
			document
				.getElementById(`template-${tmpl.id}`)
				?.scrollIntoView({ behavior: 'smooth', block: 'center' })
		})
	}

	function cloneTemplate(tmpl: ContextBroTemplate) {
		const clone: ContextBroTemplate = {
			...tmpl,
			id: crypto.randomUUID(),
			name: `${tmpl.name} (Copy)`,
			triggers: tmpl.triggers ? [...tmpl.triggers] : [],
		}
		onChange([...templates, clone])
		setEditingId(clone.id)

		requestAnimationFrame(() => {
			document
				.getElementById(`template-${clone.id}`)
				?.scrollIntoView({ behavior: 'smooth', block: 'center' })
		})
	}

	function updateTemplate(id: string, updates: Partial<ContextBroTemplate>) {
		onChange(templates.map((tmpl) => (tmpl.id === id ? { ...tmpl, ...updates } : tmpl)))
	}

	function removeTemplate(id: string) {
		onChange(templates.filter((tmpl) => tmpl.id !== id))
		if (editingId === id) setEditingId(null)
	}

	function toggleEditing(id: string) {
		setEditingId(editingId === id ? null : id)
	}

	return (
		<div className="space-y-3">
			{templates.map((tmpl) => {
				const open = editingId === tmpl.id
				return (
					<Card key={tmpl.id} id={`template-${tmpl.id}`} className="overflow-hidden">
						{/* biome-ignore lint: header row acts as toggle with embedded interactive children */}
						<div
							className="flex items-center gap-3 p-4 cursor-pointer transition-colors hover:bg-accent/50"
							onClick={() => toggleEditing(tmpl.id)}
							onKeyDown={(e) => e.key === 'Enter' && toggleEditing(tmpl.id)}
						>
							<div className="flex-1 min-w-0">
								{open ? (
									<Input
										value={tmpl.name}
										onChange={(e) => updateTemplate(tmpl.id, { name: e.target.value })}
										placeholder={t('templates.name')}
										className="h-8 w-64 text-sm"
										onClick={(e) => e.stopPropagation()}
									/>
								) : (
									<span className="text-sm font-medium truncate block">
										{tmpl.name || t('templates.unnamed')}
									</span>
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
									onClick={() => cloneTemplate(tmpl)}
									title={t('common.clone')}
								>
									<Copy className="h-3.5 w-3.5" />
								</Button>
								<Button
									variant="ghost"
									size="icon"
									className="h-7 w-7 text-muted-foreground hover:text-destructive"
									onClick={() => removeTemplate(tmpl.id)}
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
									<Label className="text-xs text-muted-foreground">
										{t('templates.body')}
										<span className="ml-1 font-normal">({t('templates.bodyDesc')})</span>
									</Label>
									<Textarea
										value={tmpl.contentFormat}
										onChange={(e) => updateTemplate(tmpl.id, { contentFormat: e.target.value })}
										rows={12}
										className="mt-1.5 font-mono text-xs leading-relaxed"
									/>
								</div>

								<div className="rounded-md bg-muted p-3">
									<Label className="text-xs text-muted-foreground">
										{t('templates.variables')}
									</Label>
									<p className="mt-1 text-xs text-muted-foreground leading-relaxed">
										{'{{title}}'} {'{{url}}'} {'{{content}}'} {'{{author}}'} {'{{published}}'}{' '}
										{'{{domain}}'} {'{{description}}'} {'{{wordCount}}'} {'{{date}}'} {'{{time}}'}{' '}
										{'{{selection}}'} {'{{image}}'} {'{{favicon}}'} {'{{site}}'} {'{{fullHtml}}'}{' '}
										{'{{contentHtml}}'} {'{{selectionHtml}}'}
									</p>
								</div>
							</div>
						)}
					</Card>
				)
			})}

			{/* Add template */}
			<div className="sticky bottom-0 z-10 -mx-1 rounded-lg border bg-background/80 p-3 backdrop-blur-sm">
				<div className="flex gap-2">
					<Button variant="outline" className="flex-1 border-dashed" onClick={addBlankTemplate}>
						<Plus className="h-4 w-4" />
						{t('templates.addBlank')}
					</Button>
					<Select
						value=""
						onValueChange={(v) => {
							const idx = Number(v)
							if (!Number.isNaN(idx)) addFromPreset(idx)
						}}
					>
						<SelectTrigger className="flex-1 border-dashed text-muted-foreground">
							<SelectValue placeholder={t('templates.fromPreset')} />
						</SelectTrigger>
						<SelectContent>
							{TEMPLATE_PRESETS.map((p, i) => (
								<SelectItem key={p.name} value={String(i)}>
									{p.name}
									{p.triggers?.length ? ` (${p.triggers[0]})` : ''}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</div>
		</div>
	)
}
