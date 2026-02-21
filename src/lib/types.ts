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
}

export interface GlobalSettings {
	scheduleMode: 'focused' | 'all_allowed'
	locale: 'en' | 'zh' | 'ja'
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
