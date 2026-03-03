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
import { Textarea } from '@/components/ui/textarea'
import { ALLOWLIST_PRESETS } from '@/lib/allowlist'
import { useLocale } from '@/lib/i18n'
import type { ContextBroTemplate, Endpoint, RealtimeTriggers, SiteRule } from '@/lib/types'

const DEFAULT_REALTIME_TRIGGERS: RealtimeTriggers = {
	onLoad: true,
	onSpaNavigation: true,
	onVisibilityChange: false,
}

type IntervalUnit = 'minutes' | 'hours'

function toMinutes(value: number, unit: IntervalUnit): number {
	return unit === 'hours' ? value * 60 : value
}

function fromMinutes(minutes: number): { value: number; unit: IntervalUnit } {
	if (minutes >= 60 && minutes % 60 === 0) return { value: minutes / 60, unit: 'hours' }
	return { value: minutes, unit: 'minutes' }
}

type DedupUnit = 'seconds' | 'minutes' | 'hours'

function toSeconds(value: number, unit: DedupUnit): number {
	if (unit === 'hours') return value * 3600
	if (unit === 'minutes') return value * 60
	return value
}

function fromSeconds(seconds: number): { value: number; unit: DedupUnit } {
	if (seconds >= 3600 && seconds % 3600 === 0) return { value: seconds / 3600, unit: 'hours' }
	if (seconds >= 60 && seconds % 60 === 0) return { value: seconds / 60, unit: 'minutes' }
	return { value: seconds, unit: 'seconds' }
}

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
	const [newName, setNewName] = useState('')
	const [patternsText, setPatternsText] = useState<Record<string, string>>({})

	function addRule(name: string) {
		const trimmed = name.trim()
		if (!trimmed) return
		if (siteRules.some((r) => r.name.toLowerCase() === trimmed.toLowerCase())) return

		const enabledEndpointIds = endpoints.filter((e) => e.enabled).map((e) => e.id)
		const newId = crypto.randomUUID()

		onRulesChange([
			...siteRules,
			{
				id: newId,
				name: trimmed,
				patterns: [],
				enabled: true,
				endpointIds: enabledEndpointIds,
				autoShare: false,
				intervalMinutes: 15,
				scheduleMode: 'focused',
				dwellSeconds: 10,
				refetchEnabled: false,
				refetchIntervalSeconds: 60,
				dedupEnabled: true,
				dedupWindowSeconds: 900,
				realtimeDebounceMs: 2000,
				realtimeTriggers: { ...DEFAULT_REALTIME_TRIGGERS },
			},
		])
		setNewName('')

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
				name: `${rule.name} (copy)`,
				patterns: [...rule.patterns],
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

		// Check if a rule with this preset name already exists
		if (siteRules.some((r) => r.name.toLowerCase() === preset.label.toLowerCase())) return

		const enabledEndpointIds = endpoints.filter((e) => e.enabled).map((e) => e.id)

		const newRule: SiteRule = {
			id: crypto.randomUUID(),
			name: preset.label,
			patterns: [...preset.patterns],
			enabled: true,
			endpointIds: enabledEndpointIds,
			autoShare: false,
			intervalMinutes: 15,
			scheduleMode: 'focused',
			dwellSeconds: 10,
			refetchEnabled: false,
			refetchIntervalSeconds: 60,
			dedupEnabled: true,
			dedupWindowSeconds: 900,
			realtimeDebounceMs: 2000,
			realtimeTriggers: { ...DEFAULT_REALTIME_TRIGGERS },
		}

		onRulesChange([...siteRules, newRule])
	}

	const hasCatchAll = siteRules.some((r) => r.catchAll)

	function addCatchAllRule() {
		if (hasCatchAll) return

		const enabledEndpointIds = endpoints.filter((e) => e.enabled).map((e) => e.id)
		const newId = crypto.randomUUID()

		onRulesChange([
			...siteRules,
			{
				id: newId,
				name: t('sites.catchAllLabel'),
				patterns: [],
				enabled: true,
				endpointIds: enabledEndpointIds,
				autoShare: true,
				intervalMinutes: 15,
				scheduleMode: 'realtime',
				dwellSeconds: 10,
				refetchEnabled: false,
				refetchIntervalSeconds: 60,
				dedupEnabled: true,
				dedupWindowSeconds: 900,
				realtimeDebounceMs: 2000,
				realtimeTriggers: { ...DEFAULT_REALTIME_TRIGGERS },
				catchAll: true,
			},
		])

		requestAnimationFrame(() => {
			document
				.getElementById(`site-rule-${newId}`)
				?.scrollIntoView({ behavior: 'smooth', block: 'center' })
		})
	}

	function handlePatternsChange(ruleId: string, text: string) {
		setPatternsText((prev) => ({ ...prev, [ruleId]: text }))
	}

	function handlePatternsBlur(ruleId: string) {
		const text = patternsText[ruleId]
		if (text === undefined) return
		const patterns = text
			.split('\n')
			.map((line) => line.trim().toLowerCase())
			.filter(Boolean)
		updateRule(ruleId, { patterns })
		setPatternsText((prev) => {
			const { [ruleId]: _, ...rest } = prev
			return rest
		})
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
					<Button
						variant="outline"
						size="sm"
						onClick={addCatchAllRule}
						disabled={hasCatchAll}
						title={hasCatchAll ? t('sites.catchAllExists') : undefined}
					>
						<Plus className="h-3 w-3" />
						{t('sites.catchAllLabel')}
					</Button>
				</div>
			</div>

			{/* Site rules list */}
			<div className="space-y-3">
				{siteRules.map((rule) => (
					<Card
						key={rule.id}
						id={`site-rule-${rule.id}`}
						className={`p-5 transition-opacity ${!rule.enabled ? 'opacity-50' : ''}`}
					>
						<div className="space-y-3">
							{/* Row 1: Enable + Name + Clone + Remove */}
							<div className="flex items-center gap-3">
								<Switch
									checked={rule.enabled}
									onCheckedChange={(checked) => updateRule(rule.id, { enabled: checked })}
								/>
								<Input
									value={rule.name}
									onChange={(e) => updateRule(rule.id, { name: e.target.value })}
									onBlur={(e) => updateRule(rule.id, { name: e.target.value.trim() })}
									className="flex-1 text-sm font-medium h-8"
									placeholder={t('sites.namePlaceholder')}
									readOnly={rule.catchAll}
								/>
								{!rule.catchAll && (
									<Button
										variant="ghost"
										size="icon"
										className="h-7 w-7 text-muted-foreground hover:text-foreground"
										onClick={() => cloneRule(rule)}
										title={t('common.clone')}
									>
										<Copy className="h-3.5 w-3.5" />
									</Button>
								)}
								<Button
									variant="ghost"
									size="icon"
									className="h-7 w-7 text-muted-foreground hover:text-destructive"
									onClick={() => removeRule(rule.id)}
								>
									<Trash2 className="h-3.5 w-3.5" />
								</Button>
							</div>

							{/* Row 2: Patterns textarea or catchAll description */}
							{rule.catchAll ? (
								<p className="text-xs text-muted-foreground italic px-0.5">
									{t('sites.catchAllDesc')}
								</p>
							) : (
								<div className="space-y-1">
									<Label className="text-xs text-muted-foreground">
										{t('sites.patterns')}
									</Label>
									<Textarea
										value={patternsText[rule.id] ?? rule.patterns.join('\n')}
										onChange={(e) => handlePatternsChange(rule.id, e.target.value)}
										onBlur={() => handlePatternsBlur(rule.id)}
										className="font-mono text-xs min-h-[60px] resize-y"
										placeholder={t('sites.patternsPlaceholder')}
										rows={Math.max(2, rule.patterns.length + 1)}
									/>
								</div>
							)}

							{/* Row 3: Template + Endpoints */}
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

							{/* Row 4: Auto-capture + Schedule mode + Interval + Dedup */}
							<div className="flex flex-wrap items-center gap-3 pt-1 border-t border-border/50">
								<div className="flex items-center gap-2">
									<Switch
										checked={rule.autoShare}
										onCheckedChange={(checked) => updateRule(rule.id, { autoShare: checked })}
									/>
									<Label className="text-xs">{t('sites.autoCapture')}</Label>
								</div>
								{rule.autoShare && (
									<>
									<Select
										value={rule.scheduleMode || 'focused'}
										onValueChange={(v) =>
											updateRule(rule.id, {
												scheduleMode: v as SiteRule['scheduleMode'],
											})
										}
									>
										<SelectTrigger className="h-7 w-[160px] text-xs">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="realtime" textValue={t('sites.realtime')}>
												<div>
													<div>{t('sites.realtime')}</div>
													<div className="text-[10px] text-muted-foreground font-normal">
														{t('sites.realtimeDesc')}
													</div>
												</div>
											</SelectItem>
											<SelectItem value="focused" textValue={t('sites.focusedTab')}>
												<div>
													<div>{t('sites.focusedTab')}</div>
													<div className="text-[10px] text-muted-foreground font-normal">
														{t('sites.focusedTabDesc')}
													</div>
												</div>
											</SelectItem>
											<SelectItem value="any_tab" textValue={t('sites.anyTab')}>
												<div>
													<div>{t('sites.anyTab')}</div>
													<div className="text-[10px] text-muted-foreground font-normal">
														{t('sites.anyTabDesc')}
													</div>
												</div>
											</SelectItem>
										</SelectContent>
									</Select>

									{/* Interval — only for any_tab mode */}
									{rule.scheduleMode === 'any_tab' && (
										<div className="flex items-center gap-1.5">
											<span className="text-xs whitespace-nowrap">{t('sites.every')}</span>
											<Input
												type="number"
												min={1}
												value={fromMinutes(rule.intervalMinutes).value}
												onChange={(e) => {
													const num = Number.parseInt(e.target.value, 10)
													if (!Number.isNaN(num) && num > 0) {
														const unit = fromMinutes(rule.intervalMinutes).unit
														updateRule(rule.id, {
															intervalMinutes: Math.max(1, toMinutes(num, unit)),
														})
													}
												}}
												className="h-7 w-16 text-xs text-center"
											/>
											<Select
												value={fromMinutes(rule.intervalMinutes).unit}
												onValueChange={(newUnit) => {
													const { value } = fromMinutes(rule.intervalMinutes)
													updateRule(rule.id, {
														intervalMinutes: Math.max(
															1,
															toMinutes(value, newUnit as IntervalUnit),
														),
													})
												}}
											>
												<SelectTrigger className="h-7 w-[76px] text-xs">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="minutes">{t('sites.unitMinutes')}</SelectItem>
													<SelectItem value="hours">{t('sites.unitHours')}</SelectItem>
												</SelectContent>
											</Select>
										</div>
									)}

									{/* Realtime triggers + debounce */}
									{rule.scheduleMode === 'realtime' && (
										<>
											<div className="flex items-center gap-1.5">
												<span className="text-xs whitespace-nowrap">
													{t('sites.realtimeDebounce')}
												</span>
												<Input
													type="number"
													min={200}
													step={100}
													value={rule.realtimeDebounceMs ?? 2000}
													onChange={(e) => {
														const num = Number.parseInt(e.target.value, 10)
														if (!Number.isNaN(num) && num >= 200) {
															updateRule(rule.id, { realtimeDebounceMs: num })
														}
													}}
													className="h-7 w-20 text-xs text-center"
												/>
												<span className="text-xs text-muted-foreground">ms</span>
											</div>
											<div className="flex items-center gap-3">
												<label className="flex items-center gap-1.5 text-xs">
													<Checkbox
														checked={rule.realtimeTriggers?.onLoad ?? true}
														onCheckedChange={(checked) =>
															updateRule(rule.id, {
																realtimeTriggers: {
																	...(rule.realtimeTriggers ?? DEFAULT_REALTIME_TRIGGERS),
																	onLoad: !!checked,
																},
															})
														}
													/>
													{t('sites.triggerOnLoad')}
												</label>
												<label className="flex items-center gap-1.5 text-xs">
													<Checkbox
														checked={rule.realtimeTriggers?.onSpaNavigation ?? true}
														onCheckedChange={(checked) =>
															updateRule(rule.id, {
																realtimeTriggers: {
																	...(rule.realtimeTriggers ?? DEFAULT_REALTIME_TRIGGERS),
																	onSpaNavigation: !!checked,
																},
															})
														}
													/>
													{t('sites.triggerOnSpa')}
												</label>
												<label className="flex items-center gap-1.5 text-xs">
													<Checkbox
														checked={rule.realtimeTriggers?.onVisibilityChange ?? false}
														onCheckedChange={(checked) =>
															updateRule(rule.id, {
																realtimeTriggers: {
																	...(rule.realtimeTriggers ?? DEFAULT_REALTIME_TRIGGERS),
																	onVisibilityChange: !!checked,
																},
															})
														}
													/>
													{t('sites.triggerOnVisibility')}
												</label>
											</div>
										</>
									)}
								</>
							)}

								{/* Dwell time — only for focused mode */}
								{rule.autoShare && rule.scheduleMode === 'focused' && (
									<div className="flex items-center gap-1.5">
										{t('sites.dwellPrefix') && (
											<span className="text-xs whitespace-nowrap">
												{t('sites.dwellPrefix')}
											</span>
										)}
										<Input
											type="number"
											min={1}
											value={fromSeconds(rule.dwellSeconds ?? 10).value}
											onChange={(e) => {
												const num = Number.parseInt(e.target.value, 10)
												if (!Number.isNaN(num) && num > 0) {
													const unit = fromSeconds(rule.dwellSeconds ?? 10).unit
													updateRule(rule.id, {
														dwellSeconds: Math.max(1, toSeconds(num, unit)),
													})
												}
											}}
											className="h-7 w-16 text-xs text-center"
										/>
										<Select
											value={fromSeconds(rule.dwellSeconds ?? 10).unit}
											onValueChange={(newUnit) => {
												const { value } = fromSeconds(rule.dwellSeconds ?? 10)
												updateRule(rule.id, {
													dwellSeconds: Math.max(
														1,
														toSeconds(value, newUnit as DedupUnit),
													),
												})
											}}
										>
											<SelectTrigger className="h-7 w-[76px] text-xs">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="seconds">
													{t('sites.unitSeconds')}
												</SelectItem>
												<SelectItem value="minutes">
													{t('sites.unitMinutes')}
												</SelectItem>
											</SelectContent>
										</Select>
										<span className="text-xs whitespace-nowrap">
											{t('sites.dwellSuffix')}
										</span>
									</div>
								)}

								{/* Refetch — only for focused mode */}
								{rule.autoShare && rule.scheduleMode === 'focused' && (
									<div className="flex items-center gap-1.5">
										<Checkbox
											checked={rule.refetchEnabled}
											onCheckedChange={(checked) =>
												updateRule(rule.id, { refetchEnabled: !!checked })
											}
										/>
										<Label className="text-xs">{t('sites.refetch')}</Label>
										{rule.refetchEnabled && (
											<>
												<Input
													type="number"
													min={10}
													value={fromSeconds(rule.refetchIntervalSeconds ?? 60).value}
													onChange={(e) => {
														const num = Number.parseInt(e.target.value, 10)
														if (!Number.isNaN(num) && num > 0) {
															const unit = fromSeconds(
																rule.refetchIntervalSeconds ?? 60,
															).unit
															updateRule(rule.id, {
																refetchIntervalSeconds: Math.max(
																	10,
																	toSeconds(num, unit),
																),
															})
														}
													}}
													className="h-7 w-16 text-xs text-center"
												/>
												<Select
													value={fromSeconds(rule.refetchIntervalSeconds ?? 60).unit}
													onValueChange={(newUnit) => {
														const { value } = fromSeconds(
															rule.refetchIntervalSeconds ?? 60,
														)
														updateRule(rule.id, {
															refetchIntervalSeconds: Math.max(
																10,
																toSeconds(value, newUnit as DedupUnit),
															),
														})
													}}
												>
													<SelectTrigger className="h-7 w-[76px] text-xs">
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="seconds">
															{t('sites.unitSeconds')}
														</SelectItem>
														<SelectItem value="minutes">
															{t('sites.unitMinutes')}
														</SelectItem>
														<SelectItem value="hours">
															{t('sites.unitHours')}
														</SelectItem>
													</SelectContent>
												</Select>
											</>
										)}
									</div>
								)}

								{/* Dedup — toggle + number + unit */}
								<div className="flex items-center gap-1.5">
									<Checkbox
										checked={rule.dedupEnabled}
										onCheckedChange={(checked) => updateRule(rule.id, { dedupEnabled: !!checked })}
									/>
									<Label className="text-xs">{t('sites.dedup')}</Label>
									{rule.dedupEnabled && (
										<>
											<Input
												type="number"
												min={1}
												value={fromSeconds(rule.dedupWindowSeconds ?? 900).value}
												onChange={(e) => {
													const num = Number.parseInt(e.target.value, 10)
													if (!Number.isNaN(num) && num > 0) {
														const unit = fromSeconds(rule.dedupWindowSeconds ?? 900).unit
														updateRule(rule.id, {
															dedupWindowSeconds: toSeconds(num, unit),
														})
													}
												}}
												className="h-7 w-16 text-xs text-center"
											/>
											<Select
												value={fromSeconds(rule.dedupWindowSeconds ?? 900).unit}
												onValueChange={(newUnit) => {
													const { value } = fromSeconds(rule.dedupWindowSeconds ?? 900)
													updateRule(rule.id, {
														dedupWindowSeconds: toSeconds(value, newUnit as DedupUnit),
													})
												}}
											>
												<SelectTrigger className="h-7 w-[76px] text-xs">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="seconds">{t('sites.unitSeconds')}</SelectItem>
													<SelectItem value="minutes">{t('sites.unitMinutes')}</SelectItem>
													<SelectItem value="hours">{t('sites.unitHours')}</SelectItem>
												</SelectContent>
											</Select>
										</>
									)}
								</div>
							</div>
						</div>
					</Card>
				))}
			</div>

			{/* Add site */}
			<div className="sticky bottom-0 z-10 -mx-1 rounded-lg border bg-background/80 p-3 backdrop-blur-sm">
				<div className="flex gap-2">
					<Input
						value={newName}
						onChange={(e) => setNewName(e.target.value)}
						onKeyDown={(e) => e.key === 'Enter' && addRule(newName)}
						placeholder={t('sites.namePlaceholder')}
						className="flex-1 text-sm"
					/>
					<Button onClick={() => addRule(newName)} disabled={!newName.trim()}>
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
