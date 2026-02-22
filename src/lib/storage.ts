import type {
	ContextBroTemplate,
	Endpoint,
	GlobalSettings,
	SendHistoryEntry,
	SiteRule,
} from '@/lib/types'

const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
	locale: 'en',
	theme: 'system',
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
