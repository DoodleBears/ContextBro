import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useLocale } from '@/lib/i18n'
import type { LiveStreamConfig } from '@/lib/types'

interface Props {
	config: LiveStreamConfig
	onChange: (config: LiveStreamConfig) => void
}

export function LiveStreamEditor({ config, onChange }: Props) {
	const { t } = useLocale()

	function update<K extends keyof LiveStreamConfig>(
		section: K,
		field: keyof LiveStreamConfig[K],
		value: LiveStreamConfig[K][typeof field],
	) {
		onChange({
			...config,
			[section]: { ...config[section], [field]: value },
		})
	}

	function numChange(
		section: keyof LiveStreamConfig,
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
			[section]: { ...config[section], [field]: clamped },
		})
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

			{/* ── Flush Strategy ── */}
			<section className="rounded-lg border border-border/60 p-4 space-y-3">
				<div>
					<h3 className="text-sm font-medium">{t('livestream.flush')}</h3>
					<p className="text-[11px] text-muted-foreground">{t('livestream.flushDesc')}</p>
				</div>
				<div className="grid grid-cols-2 gap-3">
					<div className="space-y-1">
						<Label className="text-xs">{t('livestream.debounce')}</Label>
						<div className="flex items-center gap-1.5">
							<Input
								type="number"
								min={500}
								max={30000}
								value={config.flush.debounceMs}
								onChange={(e) => numChange('flush', 'debounceMs', e.target.value, 500, 30000)}
								className="h-7 w-20 text-xs text-center"
							/>
							<span className="text-xs text-muted-foreground">ms</span>
						</div>
						<p className="text-[10px] text-muted-foreground">{t('livestream.debounceHint')}</p>
					</div>
					<div className="space-y-1">
						<Label className="text-xs">{t('livestream.maxWait')}</Label>
						<div className="flex items-center gap-1.5">
							<Input
								type="number"
								min={1000}
								max={120000}
								value={config.flush.maxWaitMs}
								onChange={(e) => numChange('flush', 'maxWaitMs', e.target.value, 1000, 120000)}
								className="h-7 w-20 text-xs text-center"
							/>
							<span className="text-xs text-muted-foreground">ms</span>
						</div>
						<p className="text-[10px] text-muted-foreground">{t('livestream.maxWaitHint')}</p>
					</div>
				</div>
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
						<Label className="text-xs">{t('livestream.pollInterval')}</Label>
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
