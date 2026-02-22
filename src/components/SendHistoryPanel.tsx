import { History, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useLocale } from '@/lib/i18n'
import { clearSendHistory, getSendHistory } from '@/lib/storage'
import type { SendHistoryEntry } from '@/lib/types'

function relativeTime(timestamp: number): string {
	const diff = Date.now() - timestamp
	const seconds = Math.floor(diff / 1000)
	if (seconds < 60) return `${seconds}s`
	const minutes = Math.floor(seconds / 60)
	if (minutes < 60) return `${minutes}m`
	const hours = Math.floor(minutes / 60)
	if (hours < 24) return `${hours}h`
	const days = Math.floor(hours / 24)
	return `${days}d`
}

export function SendHistoryPanel() {
	const { t } = useLocale()
	const [history, setHistory] = useState<SendHistoryEntry[]>([])

	useEffect(() => {
		getSendHistory().then(setHistory)
	}, [])

	async function handleClear() {
		await clearSendHistory()
		setHistory([])
	}

	return (
		<div className="rounded-lg border p-4">
			<div className="flex items-center justify-between mb-2">
				<div className="flex items-center gap-2">
					<History className="h-4 w-4 text-muted-foreground" />
					<h3 className="text-sm font-medium">{t('general.history')}</h3>
					{history.length > 0 && (
						<span className="text-xs text-muted-foreground">({history.length})</span>
					)}
				</div>
				{history.length > 0 && (
					<Button
						variant="ghost"
						size="sm"
						className="h-7 text-xs text-muted-foreground hover:text-destructive"
						onClick={handleClear}
					>
						<Trash2 className="h-3 w-3 mr-1" />
						{t('general.historyClear')}
					</Button>
				)}
			</div>

			{history.length === 0 ? (
				<p className="text-sm text-muted-foreground">{t('general.historyEmpty')}</p>
			) : (
				<div className="max-h-64 overflow-auto space-y-1">
					{history.map((entry) => (
						<div
							key={entry.id}
							className="flex items-center gap-2 text-xs py-1 border-b border-border/50 last:border-0"
						>
							<span className="w-8 shrink-0 text-muted-foreground text-right">
								{relativeTime(entry.timestamp)}
							</span>
							<Badge
								variant={entry.ok ? 'secondary' : 'destructive'}
								className="shrink-0 px-1.5 py-0 text-[10px]"
							>
								{entry.ok ? entry.status : 'ERR'}
							</Badge>
							<span className="truncate flex-1 font-mono" title={entry.url}>
								{(() => {
									try {
										return new URL(entry.url).hostname + new URL(entry.url).pathname
									} catch {
										return entry.url
									}
								})()}
							</span>
							<span className="shrink-0 text-muted-foreground" title={entry.endpointName}>
								→ {entry.endpointName}
							</span>
							<span className="shrink-0 text-muted-foreground capitalize">{entry.trigger}</span>
						</div>
					))}
				</div>
			)}
		</div>
	)
}
