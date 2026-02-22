import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useLocale } from '@/lib/i18n'
import { DEFAULT_CHAT_BODY_TEMPLATE, DEFAULT_TRANSCRIPT_BODY_TEMPLATE } from '@/lib/storage'
import type { Endpoint, LiveStreamConfig } from '@/lib/types'

const CHAT_VARS = [
	'platform',
	'channel',
	'title',
	'category',
	'viewers',
	'isLive',
	'totalMessages',
	'sampledMessages',
	'messages',
	'donations',
	'memberships',
	'timestamp',
	'url',
]

const TRANSCRIPT_VARS = [
	'platform',
	'videoId',
	'title',
	'channel',
	'text',
	'currentTime',
	'duration',
	'timestamp',
	'url',
]

interface Props {
	config: LiveStreamConfig
	endpoints: Endpoint[]
	onChange: (config: LiveStreamConfig) => void
	onNavigateToTab?: (tab: string) => void
}

export function LiveStreamEditor({ config, endpoints, onChange, onNavigateToTab }: Props) {
	const { t } = useLocale()

	const enabledEndpoints = endpoints.filter((e) => e.enabled)

	type ObjectSections = {
		[K in keyof LiveStreamConfig]: LiveStreamConfig[K] extends Record<string, unknown> ? K : never
	}[keyof LiveStreamConfig]

	function update<K extends ObjectSections>(
		section: K,
		field: keyof LiveStreamConfig[K],
		value: LiveStreamConfig[K][typeof field],
	) {
		onChange({
			...config,
			[section]: { ...(config[section] as Record<string, unknown>), [field]: value },
		})
	}

	function numChange(
		section: ObjectSections,
		field: string,
		raw: string,
		min: number,
		max: number,
	) {
		const num = Number.parseInt(raw, 10)
		if (Number.isNaN(num)) return
		const clamped = Math.max(min, Math.min(max, num))
		onChange({
			...config,
			[section]: { ...(config[section] as Record<string, unknown>), [field]: clamped },
		})
	}

	const selectedEndpointIds = config.endpointIds || []

	function toggleEndpoint(endpointId: string) {
		const ids = selectedEndpointIds.includes(endpointId)
			? selectedEndpointIds.filter((id) => id !== endpointId)
			: [...selectedEndpointIds, endpointId]
		onChange({ ...config, endpointIds: ids })
	}

	return (
		<div className="space-y-5">
			{/* ── Platform toggles ── */}
			<section className="space-y-3">
				<div className="rounded-lg border border-border/60 p-4 space-y-3">
					<div className="flex items-center justify-between">
						<span className="text-sm font-medium">{t('livestream.youtube')}</span>
						<Switch
							checked={config.youtube.enabled}
							onCheckedChange={(v) => update('youtube', 'enabled', v)}
						/>
					</div>
					{config.youtube.enabled && (
						<div className="flex gap-4 pl-1">
							<label className="flex items-center gap-1.5 text-xs">
								<Checkbox
									checked={config.youtube.chat}
									onCheckedChange={(v) => update('youtube', 'chat', !!v)}
								/>
								{t('livestream.chat')}
							</label>
							<label className="flex items-center gap-1.5 text-xs">
								<Checkbox
									checked={config.youtube.transcript}
									onCheckedChange={(v) => update('youtube', 'transcript', !!v)}
								/>
								{t('livestream.transcript')}
							</label>
						</div>
					)}
				</div>

				<div className="rounded-lg border border-border/60 p-4">
					<div className="flex items-center justify-between">
						<span className="text-sm font-medium">{t('livestream.twitch')}</span>
						<Switch
							checked={config.twitch.enabled}
							onCheckedChange={(v) => update('twitch', 'enabled', v)}
						/>
					</div>
					{config.twitch.enabled && (
						<div className="flex gap-4 pl-1 pt-3">
							<label className="flex items-center gap-1.5 text-xs">
								<Checkbox
									checked={config.twitch.chat}
									onCheckedChange={(v) => update('twitch', 'chat', !!v)}
								/>
								{t('livestream.chat')}
							</label>
						</div>
					)}
				</div>
			</section>

			{/* ── Delivery ── */}
			<section className="rounded-lg border border-border/60 p-4 space-y-4">
				<div>
					<h3 className="text-sm font-medium">{t('livestream.delivery')}</h3>
					<p className="text-[11px] text-muted-foreground">{t('livestream.deliveryDesc')}</p>
				</div>

				{/* Endpoint selection */}
				<div className="space-y-1">
					<Label className="text-xs">{t('sites.endpoints')}</Label>
					<div className="flex flex-wrap gap-x-3 gap-y-1">
						{enabledEndpoints.length > 0 ? (
							<>
								{enabledEndpoints.map((ep) => (
									<label key={ep.id} className="flex items-center gap-1.5 text-xs">
										<Checkbox
											checked={selectedEndpointIds.includes(ep.id)}
											onCheckedChange={() => toggleEndpoint(ep.id)}
										/>
										{ep.name || t('endpoints.unnamed')}
									</label>
								))}
								{selectedEndpointIds.length === 0 && (
									<span className="text-[10px] text-muted-foreground">
										{t('livestream.endpointsNone')}
									</span>
								)}
							</>
						) : (
							<span className="flex items-center gap-1 text-xs text-muted-foreground">
								{t('popup.noEndpoints')}
								{onNavigateToTab && (
									<Button
										variant="ghost"
										size="sm"
										className="h-5 px-1 text-xs text-muted-foreground hover:text-primary"
										onClick={() => onNavigateToTab('endpoints')}
									>
										+
									</Button>
								)}
							</span>
						)}
					</div>
				</div>

				{/* Chat body template */}
				<div className="space-y-1.5">
					<div className="flex items-center justify-between">
						<Label className="text-xs">{t('livestream.chatTemplate')}</Label>
						{config.chatBodyTemplate !== DEFAULT_CHAT_BODY_TEMPLATE && (
							<Button
								variant="ghost"
								size="sm"
								className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-primary"
								onClick={() =>
									onChange({ ...config, chatBodyTemplate: DEFAULT_CHAT_BODY_TEMPLATE })
								}
							>
								{t('livestream.resetTemplate')}
							</Button>
						)}
					</div>
					<p className="text-[10px] text-muted-foreground">{t('livestream.chatTemplateDesc')}</p>
					<Textarea
						value={config.chatBodyTemplate}
						onChange={(e) => onChange({ ...config, chatBodyTemplate: e.target.value })}
						className="font-mono text-[11px] leading-relaxed"
						rows={8}
					/>
					<details className="text-[10px] text-muted-foreground">
						<summary className="cursor-pointer hover:text-foreground">
							{t('livestream.templateVars')}
						</summary>
						<div className="mt-1 flex flex-wrap gap-1">
							{CHAT_VARS.map((v) => (
								<code key={v} className="rounded bg-muted px-1 py-0.5">{`{{${v}}}`}</code>
							))}
						</div>
					</details>
				</div>

				{/* Transcript body template */}
				<div className="space-y-1.5">
					<div className="flex items-center justify-between">
						<Label className="text-xs">{t('livestream.transcriptTemplate')}</Label>
						{config.transcriptBodyTemplate !== DEFAULT_TRANSCRIPT_BODY_TEMPLATE && (
							<Button
								variant="ghost"
								size="sm"
								className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-primary"
								onClick={() =>
									onChange({
										...config,
										transcriptBodyTemplate: DEFAULT_TRANSCRIPT_BODY_TEMPLATE,
									})
								}
							>
								{t('livestream.resetTemplate')}
							</Button>
						)}
					</div>
					<p className="text-[10px] text-muted-foreground">
						{t('livestream.transcriptTemplateDesc')}
					</p>
					<Textarea
						value={config.transcriptBodyTemplate}
						onChange={(e) => onChange({ ...config, transcriptBodyTemplate: e.target.value })}
						className="font-mono text-[11px] leading-relaxed"
						rows={6}
					/>
					<details className="text-[10px] text-muted-foreground">
						<summary className="cursor-pointer hover:text-foreground">
							{t('livestream.templateVars')}
						</summary>
						<div className="mt-1 flex flex-wrap gap-1">
							{TRANSCRIPT_VARS.map((v) => (
								<code key={v} className="rounded bg-muted px-1 py-0.5">{`{{${v}}}`}</code>
							))}
						</div>
					</details>
				</div>
			</section>

			{/* ── Send Strategy ── */}
			<section className="rounded-lg border border-border/60 p-4 space-y-3">
				<div>
					<h3 className="text-sm font-medium">{t('livestream.sendStrategy')}</h3>
					<p className="text-[11px] text-muted-foreground">
						{t('livestream.sendStrategyDesc')}
					</p>
				</div>
				<div className="space-y-2">
					<label className="flex items-start gap-2 cursor-pointer">
						<input
							type="radio"
							name="flushMode"
							checked={config.flush.mode === 'immediate'}
							onChange={() => update('flush', 'mode', 'immediate')}
							className="mt-0.5"
						/>
						<div>
							<span className="text-xs font-medium">
								{t('livestream.modeImmediate')}
							</span>
							<p className="text-[10px] text-muted-foreground">
								{t('livestream.modeImmediateDesc')}
							</p>
						</div>
					</label>
					<label className="flex items-start gap-2 cursor-pointer">
						<input
							type="radio"
							name="flushMode"
							checked={config.flush.mode === 'batched'}
							onChange={() => update('flush', 'mode', 'batched')}
							className="mt-0.5"
						/>
						<div>
							<span className="text-xs font-medium">
								{t('livestream.modeBatched')}
							</span>
							<p className="text-[10px] text-muted-foreground">
								{t('livestream.modeBatchedDesc')}
							</p>
						</div>
					</label>
				</div>
				{config.flush.mode === 'batched' && (
					<div className="grid grid-cols-2 gap-3 pl-5">
						<div className="space-y-1">
							<Label className="text-xs">{t('livestream.quietPeriod')}</Label>
							<div className="flex items-center gap-1.5">
								<Input
									type="number"
									min={500}
									max={30000}
									value={config.flush.debounceMs}
									onChange={(e) =>
										numChange('flush', 'debounceMs', e.target.value, 500, 30000)
									}
									className="h-7 w-20 text-xs text-center"
								/>
								<span className="text-xs text-muted-foreground">ms</span>
							</div>
							<p className="text-[10px] text-muted-foreground">
								{t('livestream.quietPeriodHint')}
							</p>
						</div>
						<div className="space-y-1">
							<Label className="text-xs">{t('livestream.maxDelay')}</Label>
							<div className="flex items-center gap-1.5">
								<Input
									type="number"
									min={1000}
									max={120000}
									value={config.flush.maxWaitMs}
									onChange={(e) =>
										numChange('flush', 'maxWaitMs', e.target.value, 1000, 120000)
									}
									className="h-7 w-20 text-xs text-center"
								/>
								<span className="text-xs text-muted-foreground">ms</span>
							</div>
							<p className="text-[10px] text-muted-foreground">
								{t('livestream.maxDelayHint')}
							</p>
						</div>
					</div>
				)}
			</section>

			{/* ── Sampling ── */}
			<section className="rounded-lg border border-border/60 p-4 space-y-3">
				<div>
					<h3 className="text-sm font-medium">{t('livestream.sampling')}</h3>
					<p className="text-[11px] text-muted-foreground">{t('livestream.samplingHint')}</p>
				</div>
				<div className="space-y-1">
					<Label className="text-xs">{t('livestream.maxMessages')}</Label>
					<Input
						type="number"
						min={10}
						max={1000}
						value={config.sampling.maxMessagesPerBatch}
						onChange={(e) => numChange('sampling', 'maxMessagesPerBatch', e.target.value, 10, 1000)}
						className="h-7 w-20 text-xs text-center"
					/>
				</div>
			</section>

			{/* ── Spam Dedup ── */}
			<section className="rounded-lg border border-border/60 p-4 space-y-3">
				<div className="flex items-center justify-between">
					<div>
						<h3 className="text-sm font-medium">{t('livestream.dedup')}</h3>
					</div>
					<Switch
						checked={config.dedup.enabled}
						onCheckedChange={(v) => update('dedup', 'enabled', v)}
					/>
				</div>
				{config.dedup.enabled && (
					<div className="space-y-3">
						<div className="space-y-1">
							<Label className="text-xs">{t('livestream.dedupWindow')}</Label>
							<div className="flex items-center gap-1.5">
								<Input
									type="number"
									min={1000}
									max={60000}
									value={config.dedup.windowMs}
									onChange={(e) => numChange('dedup', 'windowMs', e.target.value, 1000, 60000)}
									className="h-7 w-20 text-xs text-center"
								/>
								<span className="text-xs text-muted-foreground">ms</span>
							</div>
						</div>
						<label className="flex items-center gap-2">
							<Checkbox
								checked={config.dedup.aggregateSpam}
								onCheckedChange={(v) => update('dedup', 'aggregateSpam', !!v)}
							/>
							<div>
								<span className="text-xs">{t('livestream.aggregateSpam')}</span>
								<p className="text-[10px] text-muted-foreground">
									{t('livestream.aggregateSpamHint')}
								</p>
							</div>
						</label>
					</div>
				)}
			</section>

			{/* ── Transcript ── */}
			<section className="rounded-lg border border-border/60 p-4 space-y-3">
				<div>
					<h3 className="text-sm font-medium">{t('livestream.transcriptSection')}</h3>
					<p className="text-[11px] text-muted-foreground">{t('livestream.transcriptHint')}</p>
				</div>
				<div className="grid grid-cols-2 gap-3">
					<div className="space-y-1">
						<Label className="text-xs">{t('livestream.checkEvery')}</Label>
						<div className="flex items-center gap-1.5">
							<Input
								type="number"
								min={1000}
								max={30000}
								value={config.transcript.pollIntervalMs}
								onChange={(e) =>
									numChange('transcript', 'pollIntervalMs', e.target.value, 1000, 30000)
								}
								className="h-7 w-20 text-xs text-center"
							/>
							<span className="text-xs text-muted-foreground">ms</span>
						</div>
						<p className="text-[10px] text-muted-foreground">
							{t('livestream.checkEveryHint')}
						</p>
					</div>
					<div className="space-y-1">
						<Label className="text-xs">{t('livestream.progressThreshold')}</Label>
						<div className="flex items-center gap-1.5">
							<Input
								type="number"
								min={1}
								max={30}
								value={config.transcript.progressThresholdS}
								onChange={(e) =>
									numChange('transcript', 'progressThresholdS', e.target.value, 1, 30)
								}
								className="h-7 w-20 text-xs text-center"
							/>
							<span className="text-xs text-muted-foreground">s</span>
						</div>
					</div>
				</div>
			</section>
		</div>
	)
}
