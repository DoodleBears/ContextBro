import type {
	ContextBroTemplate,
	Endpoint,
	GlobalSettings,
	LiveStreamConfig,
	SendHistoryEntry,
	SiteRule,
} from '@/lib/types'

const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
	locale: 'en',
	theme: 'system',
}

export const DEFAULT_CHAT_BODY_TEMPLATE = `{
  "event_type": "live_stream",
  "platform": {{platform|json_stringify}},
  "channel": {{channel|json_stringify}},
  "title": {{title|json_stringify}},
  "category": {{category|json_stringify}},
  "viewers": {{viewers}},
  "isLive": {{isLive}},
  "totalMessages": {{totalMessages}},
  "sampledMessages": {{sampledMessages}},
  "messages": {{messages}},
  "donations": {{donations}},
  "memberships": {{memberships}},
  "timestamp": {{timestamp|json_stringify}}
}`

export const DEFAULT_TRANSCRIPT_BODY_TEMPLATE = `{
  "event_type": "transcript",
  "platform": {{platform|json_stringify}},
  "videoId": {{videoId|json_stringify}},
  "title": {{title|json_stringify}},
  "channel": {{channel|json_stringify}},
  "text": {{text|json_stringify}},
  "currentTime": {{currentTime}},
  "duration": {{duration}},
  "timestamp": {{timestamp|json_stringify}}
}`

export const DEFAULT_LIVE_STREAM_CONFIG: LiveStreamConfig = {
	youtube: { enabled: true, chat: true, transcript: true },
	twitch: { enabled: true, chat: true },
	endpointIds: [],
	chatBodyTemplate: DEFAULT_CHAT_BODY_TEMPLATE,
	transcriptBodyTemplate: DEFAULT_TRANSCRIPT_BODY_TEMPLATE,
	flush: { mode: 'batched', debounceMs: 3000, maxWaitMs: 15000 },
	sampling: { maxMessagesPerBatch: 100 },
	dedup: { enabled: true, windowMs: 10000, aggregateSpam: false },
	transcript: { pollIntervalMs: 5000, progressThresholdS: 1 },
}

export async function getLiveStreamConfig(): Promise<LiveStreamConfig> {
	const result = await browser.storage.local.get('liveStreamConfig')
	return (result.liveStreamConfig as LiveStreamConfig) || DEFAULT_LIVE_STREAM_CONFIG
}

export async function setLiveStreamConfig(config: LiveStreamConfig): Promise<void> {
	await browser.storage.local.set({ liveStreamConfig: config })
}

export async function getSiteRules(): Promise<SiteRule[]> {
	const result = await browser.storage.local.get('siteRules')
	return (result.siteRules as SiteRule[]) || []
}

export async function setSiteRules(rules: SiteRule[]): Promise<void> {
	await browser.storage.local.set({ siteRules: rules })
}

export async function getGlobalSettings(): Promise<GlobalSettings> {
	const result = await browser.storage.local.get('globalSettings')
	return (result.globalSettings as GlobalSettings) || DEFAULT_GLOBAL_SETTINGS
}

export async function setGlobalSettings(settings: GlobalSettings): Promise<void> {
	await browser.storage.local.set({ globalSettings: settings })
}

export async function getEndpoints(): Promise<Endpoint[]> {
	const result = await browser.storage.local.get('endpoints')
	return (result.endpoints as Endpoint[]) || []
}

export async function setEndpoints(endpoints: Endpoint[]): Promise<void> {
	await browser.storage.local.set({ endpoints })
}

export async function getTemplates(): Promise<ContextBroTemplate[]> {
	const result = await browser.storage.local.get('templates')
	return (result.templates as ContextBroTemplate[]) || []
}

export async function setTemplates(templates: ContextBroTemplate[]): Promise<void> {
	await browser.storage.local.set({ templates })
}

export async function getLastSharedAt(): Promise<Record<string, number>> {
	const result = await browser.storage.local.get('lastSharedAt')
	return (result.lastSharedAt as Record<string, number>) || {}
}

export async function setLastSharedAt(map: Record<string, number>): Promise<void> {
	await browser.storage.local.set({ lastSharedAt: map })
}

const MAX_SEND_HISTORY = 100

export async function getSendHistory(): Promise<SendHistoryEntry[]> {
	const result = await browser.storage.local.get('sendHistory')
	return (result.sendHistory as SendHistoryEntry[]) || []
}

export async function appendSendHistory(entry: SendHistoryEntry): Promise<void> {
	const history = await getSendHistory()
	history.unshift(entry)
	await browser.storage.local.set({ sendHistory: history.slice(0, MAX_SEND_HISTORY) })
}

export async function clearSendHistory(): Promise<void> {
	await browser.storage.local.remove('sendHistory')
}
