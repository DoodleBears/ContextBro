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

export interface RealtimeTriggers {
	onLoad: boolean
	onSpaNavigation: boolean
	onVisibilityChange: boolean
}

export interface SiteRule {
	id: string
	name: string
	patterns: string[]
	enabled: boolean
	templateId?: string
	endpointIds: string[]
	autoShare: boolean
	intervalMinutes: number
	scheduleMode: 'focused' | 'any_tab' | 'realtime'
	dwellSeconds: number
	refetchEnabled: boolean
	refetchIntervalSeconds: number
	dedupEnabled: boolean
	dedupWindowSeconds: number
	realtimeDebounceMs: number
	realtimeTriggers: RealtimeTriggers
	/** When true, this rule matches any http/https URL not covered by other rules. */
	catchAll?: boolean
}

export interface GlobalSettings {
	locale: 'en' | 'zh' | 'ja'
	theme: 'system' | 'light' | 'dark'
	devMode: boolean
	contentQuality: {
		minTextLength: number
		minWordCount: number
		minScore: number
	}
	contentCleaning: {
		markdownLinkPolicy: 'keep' | 'text_only' | 'domain_only'
	}
}

export interface LiveStreamConfig {
	youtube: { enabled: boolean; chat: boolean; transcript: boolean }
	twitch: { enabled: boolean; chat: boolean }
	endpointIds: string[]
	chatBodyTemplate: string
	transcriptBodyTemplate: string
	flush: {
		mode: 'immediate' | 'batched'
		debounceMs: number
		maxWaitMs: number
	}
	sampling: {
		maxMessagesPerBatch: number
	}
	dedup: {
		enabled: boolean
		windowMs: number
		aggregateSpam: boolean
	}
	transcript: {
		pollIntervalMs: number
		progressThresholdS: number
	}
}

export interface SendHistoryEntry {
	id: string
	timestamp: number
	url: string
	endpointName: string
	ruleName?: string
	trigger: 'scheduler' | 'focused' | 'manual' | 'livestream' | 'realtime'
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
