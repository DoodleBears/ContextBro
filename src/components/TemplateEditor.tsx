import { Plus, Trash2 } from 'lucide-react'
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
	}

	function updateTemplate(id: string, updates: Partial<ContextBroTemplate>) {
		onChange(templates.map((tmpl) => (tmpl.id === id ? { ...tmpl, ...updates } : tmpl)))
	}

	function removeTemplate(id: string) {
		onChange(templates.filter((tmpl) => tmpl.id !== id))
		if (editingId === id) setEditingId(null)
	}

	return (
		<div className="space-y-4">
			{templates.map((tmpl) => (
				<Card key={tmpl.id} className="p-4">
					<div className="flex items-center justify-between mb-3">
						{editingId === tmpl.id ? (
							<Input
								value={tmpl.name}
								onChange={(e) => updateTemplate(tmpl.id, { name: e.target.value })}
								placeholder={t('templates.name')}
								className="h-8 w-64 text-sm"
							/>
						) : (
							<button
								type="button"
								onClick={() => setEditingId(tmpl.id)}
								className="text-sm font-medium hover:text-primary transition-colors"
							>
								{tmpl.name || t('templates.unnamed')}
							</button>
						)}
						<Button
							variant="ghost"
							size="icon"
							className="h-7 w-7 text-muted-foreground hover:text-destructive"
							onClick={() => removeTemplate(tmpl.id)}
						>
							<Trash2 className="h-3.5 w-3.5" />
						</Button>
					</div>

					{editingId === tmpl.id && (
						<div className="space-y-3">
							<div>
								<Label className="text-xs text-muted-foreground">
									{t('templates.triggers')}
									<span className="ml-1 font-normal">({t('templates.triggersDesc')})</span>
								</Label>
								<Textarea
									value={(tmpl.triggers || []).join('\n')}
									onChange={(e) =>
										updateTemplate(tmpl.id, {
											triggers: e.target.value.split('\n').filter(Boolean),
										})
									}
									placeholder={t('templates.triggersPlaceholder')}
									rows={2}
									className="mt-1 font-mono text-xs"
								/>
							</div>

							<div>
								<Label className="text-xs text-muted-foreground">
									{t('templates.body')}
									<span className="ml-1 font-normal">({t('templates.bodyDesc')})</span>
								</Label>
								<Textarea
									value={tmpl.contentFormat}
									onChange={(e) => updateTemplate(tmpl.id, { contentFormat: e.target.value })}
									rows={12}
									className="mt-1 font-mono text-xs leading-relaxed"
								/>
							</div>

							<div className="rounded-md bg-muted p-3">
								<Label className="text-xs text-muted-foreground">{t('templates.variables')}</Label>
								<p className="mt-1 text-xs text-muted-foreground leading-relaxed">
									{'{{title}}'} {'{{url}}'} {'{{content}}'} {'{{author}}'} {'{{published}}'}{' '}
									{'{{domain}}'} {'{{description}}'} {'{{wordCount}}'} {'{{date}}'} {'{{time}}'}{' '}
									{'{{selection}}'} {'{{image}}'} {'{{favicon}}'} {'{{site}}'} {'{{fullHtml}}'}{' '}
									{'{{contentHtml}}'} {'{{selectionHtml}}'}
								</p>
							</div>

							<Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
								{t('common.done')}
							</Button>
						</div>
					)}
				</Card>
			))}

			{/* Add template actions */}
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
	)
}
