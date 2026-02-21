import { Plus, Trash2 } from 'lucide-react'
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
import type { ContextBroTemplate, Endpoint, GlobalSettings, SiteRule } from '@/lib/types'

const INTERVAL_OPTIONS = [
	{ value: 5, key: 'interval.5min' },
	{ value: 10, key: 'interval.10min' },
	{ value: 15, key: 'interval.15min' },
	{ value: 30, key: 'interval.30min' },
	{ value: 60, key: 'interval.1hour' },
	{ value: 120, key: 'interval.2hours' },
]

interface Props {
	siteRules: SiteRule[]
	endpoints: Endpoint[]
	templates: ContextBroTemplate[]
	globalSettings: GlobalSettings
	onRulesChange: (rules: SiteRule[]) => void
	onSettingsChange: (settings: GlobalSettings) => void
}

export function SiteRuleEditor({
	siteRules,
	endpoints,
	templates,
	globalSettings,
	onRulesChange,
	onSettingsChange,
}: Props) {
	const { t } = useLocale()
	const [newPattern, setNewPattern] = useState('')

	function addRule(pattern: string) {
		const trimmed = pattern.trim().toLowerCase()
		if (!trimmed) return
		if (siteRules.some((r) => r.pattern === trimmed)) return

		const enabledEndpointIds = endpoints.filter((e) => e.enabled).map((e) => e.id)

		onRulesChange([
			...siteRules,
			{
				id: crypto.randomUUID(),
				pattern: trimmed,
				enabled: true,
				endpointIds: enabledEndpointIds,
				autoShare: false,
				intervalMinutes: 15,
			},
		])
		setNewPattern('')
	}

	function removeRule(id: string) {
		onRulesChange(siteRules.filter((r) => r.id !== id))
	}

	function updateRule(id: string, updates: Partial<SiteRule>) {
		onRulesChange(siteRules.map((r) => (r.id === id ? { ...r, ...updates } : r)))
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
			}))

		if (newRules.length > 0) {
			onRulesChange([...siteRules, ...newRules])
		}
	}

	const enabledEndpoints = endpoints.filter((e) => e.enabled)

	return (
		<div className="space-y-6">
			{/* Schedule mode */}
			<div className="rounded-lg border bg-muted/30 p-4 space-y-3">
				<Label className="text-sm font-medium">{t('sites.scheduleMode')}</Label>
				<div className="grid grid-cols-2 gap-3">
					<label
						className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${globalSettings.scheduleMode === 'focused' ? 'border-primary bg-primary/5' : 'border-border'}`}
					>
						<input
							type="radio"
							name="schedule-mode"
							value="focused"
							checked={globalSettings.scheduleMode === 'focused'}
							onChange={() => onSettingsChange({ ...globalSettings, scheduleMode: 'focused' })}
							className="mt-0.5"
						/>
						<div>
							<span className="block text-sm font-medium">{t('sites.focusedTab')}</span>
							<span className="text-xs text-muted-foreground">{t('sites.focusedTabDesc')}</span>
						</div>
					</label>
					<label
						className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${globalSettings.scheduleMode === 'all_allowed' ? 'border-primary bg-primary/5' : 'border-border'}`}
					>
						<input
							type="radio"
							name="schedule-mode"
							value="all_allowed"
							checked={globalSettings.scheduleMode === 'all_allowed'}
							onChange={() => onSettingsChange({ ...globalSettings, scheduleMode: 'all_allowed' })}
							className="mt-0.5"
						/>
						<div>
							<span className="block text-sm font-medium">{t('sites.allAllowed')}</span>
							<span className="text-xs text-muted-foreground">{t('sites.allAllowedDesc')}</span>
						</div>
					</label>
				</div>
			</div>

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
						className={`p-4 transition-opacity ${!rule.enabled ? 'opacity-50' : ''}`}
					>
						<div className="space-y-3">
							{/* Row 1: Enable + Pattern + Remove */}
							<div className="flex items-center gap-3">
								<Switch
									checked={rule.enabled}
									onCheckedChange={(checked) => updateRule(rule.id, { enabled: checked })}
								/>
								<code className="flex-1 text-sm font-mono bg-muted px-2 py-1 rounded">
									{rule.pattern}
								</code>
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
											<span className="text-xs text-muted-foreground">
												{t('popup.noEndpoints')}
											</span>
										)}
									</div>
								</div>
							</div>

							{/* Row 3: Auto-share + Interval */}
							<div className="flex items-center gap-4 pt-1 border-t border-border/50">
								<div className="flex items-center gap-2">
									<Switch
										checked={rule.autoShare}
										onCheckedChange={(checked) => updateRule(rule.id, { autoShare: checked })}
									/>
									<Label className="text-xs">{t('sites.autoShare')}</Label>
								</div>
								{rule.autoShare && (
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
							</div>
						</div>
					</Card>
				))}
			</div>

			{/* Add site */}
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

			{/* Empty state */}
			{siteRules.length === 0 && (
				<p className="text-center text-sm text-muted-foreground py-8">{t('sites.empty')}</p>
			)}
		</div>
	)
}
