import { Copy, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ALLOWLIST_PRESETS } from '@/lib/allowlist'
import { useLocale } from '@/lib/i18n'
import type { ContextBroTemplate, Endpoint, SiteRule } from '@/lib/types'

const INTERVAL_OPTIONS = [
	{ value: 1, key: 'interval.1min' },
	{ value: 2, key: 'interval.2min' },
	{ value: 5, key: 'interval.5min' },
	{ value: 10, key: 'interval.10min' },
	{ value: 15, key: 'interval.15min' },
	{ value: 30, key: 'interval.30min' },
	{ value: 60, key: 'interval.1hour' },
	{ value: 120, key: 'interval.2hours' },
]

const DEDUP_WINDOW_OPTIONS = [
	{ value: 0, key: 'dedup.disabled' },
	{ value: 5, key: 'dedup.5min' },
	{ value: 10, key: 'dedup.10min' },
	{ value: 15, key: 'dedup.15min' },
	{ value: 30, key: 'dedup.30min' },
	{ value: 60, key: 'dedup.1hour' },
]

interface Props {
	siteRules: SiteRule[]
	endpoints: Endpoint[]
	templates: ContextBroTemplate[]
	onRulesChange: (rules: SiteRule[]) => void
	onNavigateToTab?: (tab: string) => void
}

export function SiteRuleEditor({
	siteRules,
	endpoints,
	templates,
	onRulesChange,
	onNavigateToTab,
}: Props) {
	const { t } = useLocale()
	const [newPattern, setNewPattern] = useState('')

	function addRule(pattern: string) {
		const trimmed = pattern.trim().toLowerCase()
		if (!trimmed) return
		if (siteRules.some((r) => r.pattern === trimmed)) return

		const enabledEndpointIds = endpoints.filter((e) => e.enabled).map((e) => e.id)
		const newId = crypto.randomUUID()

		onRulesChange([
			...siteRules,
			{
				id: newId,
				pattern: trimmed,
				enabled: true,
				endpointIds: enabledEndpointIds,
				autoShare: false,
				intervalMinutes: 15,
				scheduleMode: 'focused',
				dedupWindowMinutes: 15,
			},
		])
		setNewPattern('')

		requestAnimationFrame(() => {
			document
				.getElementById(`site-rule-${newId}`)
				?.scrollIntoView({ behavior: 'smooth', block: 'center' })
		})
	}

	function removeRule(id: string) {
		onRulesChange(siteRules.filter((r) => r.id !== id))
	}

	function updateRule(id: string, updates: Partial<SiteRule>) {
		onRulesChange(siteRules.map((r) => (r.id === id ? { ...r, ...updates } : r)))
	}

	function cloneRule(rule: SiteRule) {
		const newId = crypto.randomUUID()
		onRulesChange([
			...siteRules,
			{
				...rule,
				id: newId,
				pattern: `${rule.pattern} (copy)`,
			},
		])

		requestAnimationFrame(() => {
			document
				.getElementById(`site-rule-${newId}`)
				?.scrollIntoView({ behavior: 'smooth', block: 'center' })
		})
	}

	function toggleEndpoint(ruleId: string, endpointId: string) {
		const rule = siteRules.find((r) => r.id === ruleId)
		if (!rule) return
		const ids = rule.endpointIds.includes(endpointId)
			? rule.endpointIds.filter((id) => id !== endpointId)
			: [...rule.endpointIds, endpointId]
		updateRule(ruleId, { endpointIds: ids })
	}

	function addPreset(key: string) {
		const preset = ALLOWLIST_PRESETS[key]
		if (!preset) return

		const existing = new Set(siteRules.map((r) => r.pattern))
		const enabledEndpointIds = endpoints.filter((e) => e.enabled).map((e) => e.id)

		const newRules: SiteRule[] = preset.patterns
			.filter((p) => !existing.has(p))
			.map((pattern) => ({
				id: crypto.randomUUID(),
				pattern,
				enabled: true,
				endpointIds: enabledEndpointIds,
				autoShare: false,
				intervalMinutes: 15,
				scheduleMode: 'focused' as const,
				dedupWindowMinutes: 15,
			}))

		if (newRules.length > 0) {
			onRulesChange([...siteRules, ...newRules])
		}
	}

	const enabledEndpoints = endpoints.filter((e) => e.enabled)

	return (
		<div className="space-y-6">
			{/* Presets */}
			<div className="space-y-2">
				<Label className="text-xs text-muted-foreground">{t('sites.presets')}</Label>
				<div className="flex flex-wrap gap-2">
					{Object.entries(ALLOWLIST_PRESETS).map(([key, preset]) => (
						<Button key={key} variant="outline" size="sm" onClick={() => addPreset(key)}>
							<Plus className="h-3 w-3" />
							{preset.label}
						</Button>
					))}
				</div>
			</div>

			{/* Site rules list */}
			<div className="space-y-3">
				{siteRules.map((rule) => (
					<Card
						key={rule.id}
						id={`site-rule-${rule.id}`}
						className={`p-4 transition-opacity ${!rule.enabled ? 'opacity-50' : ''}`}
					>
						<div className="space-y-3">
							{/* Row 1: Enable + Pattern (editable) + Clone + Remove */}
							<div className="flex items-center gap-3">
								<Switch
									checked={rule.enabled}
									onCheckedChange={(checked) => updateRule(rule.id, { enabled: checked })}
								/>
								<Input
									value={rule.pattern}
									onChange={(e) => updateRule(rule.id, { pattern: e.target.value.toLowerCase() })}
									onBlur={(e) =>
										updateRule(rule.id, { pattern: e.target.value.trim().toLowerCase() })
									}
									className="flex-1 text-sm font-mono h-8"
									placeholder={t('sites.patternPlaceholder')}
								/>
								<Button
									variant="ghost"
									size="icon"
									className="h-7 w-7 text-muted-foreground hover:text-foreground"
									onClick={() => cloneRule(rule)}
									title={t('common.clone')}
								>
									<Copy className="h-3.5 w-3.5" />
								</Button>
								<Button
									variant="ghost"
									size="icon"
									className="h-7 w-7 text-muted-foreground hover:text-destructive"
									onClick={() => removeRule(rule.id)}
								>
									<Trash2 className="h-3.5 w-3.5" />
								</Button>
							</div>

							{/* Row 2: Template + Endpoints */}
							<div className="grid grid-cols-2 gap-3">
								<div className="space-y-1">
									<Label className="text-xs text-muted-foreground">{t('sites.template')}</Label>
									<div className="flex items-center gap-1">
										<Select
											value={rule.templateId || 'default'}
											onValueChange={(v) =>
												updateRule(rule.id, { templateId: v === 'default' ? undefined : v })
											}
										>
											<SelectTrigger className="h-8 text-xs">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="default">{t('sites.defaultTemplate')}</SelectItem>
												{templates.map((tmpl) => (
													<SelectItem key={tmpl.id} value={tmpl.id}>
														{tmpl.name || t('templates.unnamed')}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										{templates.length === 0 && onNavigateToTab && (
											<Button
												variant="ghost"
												size="icon"
												className="h-8 w-8 shrink-0 text-muted-foreground hover:text-primary"
												onClick={() => onNavigateToTab('templates')}
												title={t('templates.addBlank')}
											>
												<Plus className="h-3.5 w-3.5" />
											</Button>
										)}
									</div>
								</div>

								<div className="space-y-1">
									<Label className="text-xs text-muted-foreground">{t('sites.endpoints')}</Label>
									<div className="flex flex-wrap gap-x-3 gap-y-1">
										{enabledEndpoints.length > 0 ? (
											enabledEndpoints.map((ep) => (
												<label key={ep.id} className="flex items-center gap-1.5 text-xs">
													<Checkbox
														checked={rule.endpointIds.includes(ep.id)}
														onCheckedChange={() => toggleEndpoint(rule.id, ep.id)}
													/>
													{ep.name || t('endpoints.unnamed')}
												</label>
											))
										) : (
											<span className="flex items-center gap-1 text-xs text-muted-foreground">
												{t('popup.noEndpoints')}
												{onNavigateToTab && (
													<Button
														variant="ghost"
														size="icon"
														className="h-5 w-5 text-muted-foreground hover:text-primary"
														onClick={() => onNavigateToTab('endpoints')}
													>
														<Plus className="h-3 w-3" />
													</Button>
												)}
											</span>
										)}
									</div>
								</div>
							</div>

							{/* Row 3: Auto-share + Schedule mode + Interval + Dedup */}
							<div className="flex flex-wrap items-center gap-3 pt-1 border-t border-border/50">
								<div className="flex items-center gap-2">
									<Switch
										checked={rule.autoShare}
										onCheckedChange={(checked) => updateRule(rule.id, { autoShare: checked })}
									/>
									<Label className="text-xs">{t('sites.autoShare')}</Label>
								</div>
								{rule.autoShare && (
									<>
										<Select
											value={rule.scheduleMode || 'focused'}
											onValueChange={(v) =>
												updateRule(rule.id, { scheduleMode: v as 'focused' | 'any_tab' })
											}
										>
											<SelectTrigger className="h-7 w-[130px] text-xs">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="focused">{t('sites.focusedTab')}</SelectItem>
												<SelectItem value="any_tab">{t('sites.anyTab')}</SelectItem>
											</SelectContent>
										</Select>

										{/* Interval — only for any_tab mode */}
										{rule.scheduleMode === 'any_tab' && (
											<Select
												value={String(rule.intervalMinutes)}
												onValueChange={(v) => updateRule(rule.id, { intervalMinutes: Number(v) })}
											>
												<SelectTrigger className="h-7 w-[100px] text-xs">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													{INTERVAL_OPTIONS.map((opt) => (
														<SelectItem key={opt.value} value={String(opt.value)}>
															{t(opt.key)}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										)}

										{/* Dedup window — both modes */}
										<Select
											value={String(rule.dedupWindowMinutes ?? 15)}
											onValueChange={(v) => updateRule(rule.id, { dedupWindowMinutes: Number(v) })}
										>
											<SelectTrigger className="h-7 w-[120px] text-xs">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{DEDUP_WINDOW_OPTIONS.map((opt) => (
													<SelectItem key={opt.value} value={String(opt.value)}>
														{t(opt.key)}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</>
								)}
							</div>
						</div>
					</Card>
				))}
			</div>

			{/* Add site — sticky above the save bar */}
			<div className="sticky bottom-16 z-10 -mx-1 rounded-lg border bg-background/80 p-3 backdrop-blur-sm">
				<div className="flex gap-2">
					<Input
						value={newPattern}
						onChange={(e) => setNewPattern(e.target.value)}
						onKeyDown={(e) => e.key === 'Enter' && addRule(newPattern)}
						placeholder={t('sites.patternPlaceholder')}
						className="flex-1 font-mono text-sm"
					/>
					<Button onClick={() => addRule(newPattern)} disabled={!newPattern.trim()}>
						<Plus className="h-4 w-4" />
						{t('sites.add')}
					</Button>
				</div>
			</div>

			{/* Empty state */}
			{siteRules.length === 0 && (
				<p className="text-center text-sm text-muted-foreground py-8">{t('sites.empty')}</p>
			)}
		</div>
	)
}
