export interface ContextBroTemplate {
	id: string
	name: string
	contentFormat: string
	triggers?: string[]
}

export interface Endpoint {
	id: string
	name: string
	url: string
	headers: Record<string, string>
	enabled: boolean
}

export type FilterFunction = (value: string, param?: string) => string | any[]

export interface Property {
	id?: string
	name: string
	value: string
	type?: string
}

export interface SiteRule {
	id: string
	pattern: string
	enabled: boolean
	templateId?: string
	endpointIds: string[]
	autoShare: boolean
	intervalMinutes: number
	scheduleMode: 'focused' | 'any_tab'
	dedupEnabled: boolean
	dedupWindowSeconds: number
}

export interface GlobalSettings {
	locale: 'en' | 'zh' | 'ja'
	theme: 'system' | 'light' | 'dark'
}

export interface SendHistoryEntry {
	id: string
	timestamp: number
	url: string
	endpointName: string
	rulePattern?: string
	trigger: 'scheduler' | 'focused' | 'manual'
	ok: boolean
	status: number
	statusText: string
}

/** @deprecated Use SiteRule instead */
export interface AllowlistEntry {
	pattern: string
	enabled: boolean
	templateId?: string
}

/** @deprecated Use SiteRule[] + GlobalSettings instead */
export interface ScheduleConfig {
	enabled: boolean
	intervalMinutes: number
	mode: 'focused' | 'all_allowed'
	allowlist: AllowlistEntry[]
}
