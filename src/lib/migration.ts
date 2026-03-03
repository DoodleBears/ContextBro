import {
	DEFAULT_GLOBAL_SETTINGS,
	DEFAULT_CHAT_BODY_TEMPLATE,
	DEFAULT_LIVE_STREAM_CONFIG,
	DEFAULT_TRANSCRIPT_BODY_TEMPLATE,
} from '@/lib/storage'
import type { Endpoint, GlobalSettings, ScheduleConfig } from '@/lib/types'

/**
 * Migrate from v1 (AllowlistEntry[] inside ScheduleConfig) to v2 (SiteRule[] + GlobalSettings).
 * Runs once on startup. Idempotent — skips if siteRules already exists.
 */
export async function migrateV1ToV2(): Promise<boolean> {
	const result = await browser.storage.local.get(['siteRules', 'scheduleConfig', 'endpoints'])

	// Already migrated or fresh install
	if (result.siteRules !== undefined) return false

	const scheduleConfig = result.scheduleConfig as ScheduleConfig | undefined
	if (!scheduleConfig) return false

	const endpoints = (result.endpoints as Endpoint[]) || []
	const enabledEndpointIds = endpoints.filter((e) => e.enabled).map((e) => e.id)

	const oldMode = scheduleConfig.mode || 'focused'
	const newMode = oldMode === 'all_allowed' ? ('any_tab' as const) : ('focused' as const)

	// Produces v4 format (pattern: string). V4→V5 migration converts to name+patterns.
	const siteRules = (scheduleConfig.allowlist || []).map((entry) => ({
		id: crypto.randomUUID(),
		pattern: entry.pattern,
		enabled: entry.enabled,
		templateId: entry.templateId,
		endpointIds: enabledEndpointIds,
		autoShare: scheduleConfig.enabled,
		intervalMinutes: scheduleConfig.intervalMinutes,
		scheduleMode: newMode,
		dedupEnabled: true,
		dedupWindowSeconds: 900,
	}))

	const globalSettings: GlobalSettings = {
		...DEFAULT_GLOBAL_SETTINGS,
	}

	await browser.storage.local.set({ siteRules, globalSettings })

	console.debug(`[migration] V1→V2: migrated ${siteRules.length} site rules`)
	return true
}

/**
 * Migrate from v2 (scheduleMode on GlobalSettings) to v3 (scheduleMode on each SiteRule).
 * Runs once on startup. Idempotent — skips if rules already have scheduleMode.
 */
export async function migrateV2ToV3(): Promise<boolean> {
	const result = await browser.storage.local.get(['siteRules', 'globalSettings'])
	const siteRules = (result.siteRules as Record<string, unknown>[]) || []
	const globalSettings = (result.globalSettings as Record<string, unknown>) || {}

	// Skip if no rules, or if first rule already has scheduleMode
	if (siteRules.length === 0) return false
	if (siteRules[0].scheduleMode) return false

	const oldMode = (globalSettings.scheduleMode as string) || 'focused'
	const newMode = oldMode === 'all_allowed' ? ('any_tab' as const) : ('focused' as const)

	const updatedRules = siteRules.map((r) => ({
		...r,
		scheduleMode: newMode,
	}))

	// Remove scheduleMode from globalSettings
	const { scheduleMode: _, ...restSettings } = globalSettings

	await browser.storage.local.set({
		siteRules: updatedRules,
		globalSettings: restSettings,
	})

	console.debug(`[migration] V2→V3: moved scheduleMode to ${updatedRules.length} site rules`)
	return true
}

/**
 * Migrate from v3 to v4:
 * - Add `dedupEnabled` + `dedupWindowSeconds` to SiteRule
 * - Convert `dedupWindowMinutes` → `dedupWindowSeconds` if present
 * - Add `theme` to GlobalSettings (default 'system')
 * Idempotent — skips fields that already exist.
 */
export async function migrateV3ToV4(): Promise<boolean> {
	const result = await browser.storage.local.get(['siteRules', 'globalSettings'])
	const siteRules = (result.siteRules as Record<string, unknown>[]) || []
	const globalSettings = (result.globalSettings as Record<string, unknown>) || {}

	let migrated = false

	// Add dedupEnabled + dedupWindowSeconds to rules
	if (siteRules.length > 0 && siteRules[0].dedupEnabled === undefined) {
		const updatedRules = siteRules.map((r) => {
			const oldMinutes = (r.dedupWindowMinutes as number) ?? 15
			const { dedupWindowMinutes: _, ...rest } = r as Record<string, unknown>
			return {
				...rest,
				dedupEnabled: oldMinutes > 0,
				dedupWindowSeconds: oldMinutes > 0 ? oldMinutes * 60 : 900,
			}
		})
		await browser.storage.local.set({ siteRules: updatedRules })
		migrated = true
	}

	// Add theme to globalSettings if missing
	if (globalSettings.theme === undefined) {
		await browser.storage.local.set({
			globalSettings: { ...globalSettings, theme: 'system' },
		})
		migrated = true
	}

	if (migrated) {
		console.debug('[migration] V3→V4: added dedupEnabled/dedupWindowSeconds and theme')
	}
	return migrated
}

/**
 * Migrate from v4 to v5:
 * - Convert `pattern: string` → `name: string` + `patterns: string[]`
 * - Re-key `lastSharedAt` from pattern → rule.id
 * - Convert `SendHistoryEntry.rulePattern` → `ruleName`
 * Idempotent — skips if rules already have `patterns` array.
 */
export async function migrateV4ToV5(): Promise<boolean> {
	const result = await browser.storage.local.get(['siteRules', 'lastSharedAt', 'sendHistory'])
	const siteRules = (result.siteRules as Record<string, unknown>[]) || []

	// Skip if no rules or already migrated (has `patterns` array)
	if (siteRules.length === 0) return false
	if (Array.isArray(siteRules[0].patterns)) return false

	// Migrate rules: pattern → name + patterns
	const updatedRules = siteRules.map((r) => {
		const pattern = r.pattern as string
		const id = r.id as string
		const { pattern: _, ...rest } = r
		return { ...rest, id, name: pattern, patterns: [pattern] }
	})

	// Re-key lastSharedAt: pattern → rule.id
	const oldLastShared = (result.lastSharedAt as Record<string, number>) || {}
	const newLastShared: Record<string, number> = {}
	for (const rule of updatedRules) {
		for (const p of rule.patterns) {
			if (oldLastShared[p] !== undefined) {
				newLastShared[rule.id] = Math.max(newLastShared[rule.id] || 0, oldLastShared[p])
			}
		}
	}

	// Migrate sendHistory: rulePattern → ruleName
	const history = (result.sendHistory as Record<string, unknown>[]) || []
	const updatedHistory = history.map((h) => {
		const { rulePattern, ...rest } = h
		return { ...rest, ruleName: rulePattern }
	})

	await browser.storage.local.set({
		siteRules: updatedRules,
		lastSharedAt: newLastShared,
		sendHistory: updatedHistory,
	})

	console.debug(`[migration] V4→V5: converted ${updatedRules.length} rules to multi-pattern`)
	return true
}

/**
 * Migrate from v5 to v6:
 * - Add `refetchEnabled` + `refetchIntervalSeconds` to SiteRule
 * Idempotent — skips if rules already have `refetchEnabled`.
 */
export async function migrateV5ToV6(): Promise<boolean> {
	const result = await browser.storage.local.get(['siteRules'])
	const siteRules = (result.siteRules as Record<string, unknown>[]) || []

	if (siteRules.length === 0) return false
	if (siteRules[0].refetchEnabled !== undefined) return false

	const updatedRules = siteRules.map((r) => ({
		...r,
		refetchEnabled: false,
		refetchIntervalSeconds: 60,
	}))

	await browser.storage.local.set({ siteRules: updatedRules })
	console.debug(`[migration] V5→V6: added refetch fields to ${updatedRules.length} rules`)
	return true
}

/**
 * Migrate from v6 to v7:
 * - Add `dwellSeconds` to SiteRule (default 10 — preserves existing behavior)
 * Idempotent — skips if rules already have `dwellSeconds`.
 */
export async function migrateV6ToV7(): Promise<boolean> {
	const result = await browser.storage.local.get(['siteRules'])
	const siteRules = (result.siteRules as Record<string, unknown>[]) || []

	if (siteRules.length === 0) return false
	if (siteRules[0].dwellSeconds !== undefined) return false

	const updatedRules = siteRules.map((r) => ({
		...r,
		dwellSeconds: 10,
	}))

	await browser.storage.local.set({ siteRules: updatedRules })
	console.debug(`[migration] V6→V7: added dwellSeconds to ${updatedRules.length} rules`)
	return true
}

/**
 * Migrate from v7 to v8:
 * - Add `liveStreamConfig` to storage with defaults
 * Idempotent — skips if liveStreamConfig already exists.
 */
export async function migrateV7ToV8(): Promise<boolean> {
	const result = await browser.storage.local.get(['liveStreamConfig'])

	if (result.liveStreamConfig !== undefined) return false

	await browser.storage.local.set({ liveStreamConfig: DEFAULT_LIVE_STREAM_CONFIG })
	console.debug('[migration] V7→V8: added liveStreamConfig defaults')
	return true
}

/**
 * Migrate from v8 to v9:
 * - Add `endpointIds`, `chatBodyTemplate`, `transcriptBodyTemplate` to liveStreamConfig
 * Idempotent — skips if endpointIds already exists.
 */
export async function migrateV8ToV9(): Promise<boolean> {
	const result = await browser.storage.local.get(['liveStreamConfig'])
	const config = result.liveStreamConfig as Record<string, unknown> | undefined

	if (!config) return false
	if (config.endpointIds !== undefined) return false

	await browser.storage.local.set({
		liveStreamConfig: {
			...config,
			endpointIds: [],
			chatBodyTemplate: DEFAULT_CHAT_BODY_TEMPLATE,
			transcriptBodyTemplate: DEFAULT_TRANSCRIPT_BODY_TEMPLATE,
		},
	})
	console.debug('[migration] V8→V9: added endpoint/template fields to liveStreamConfig')
	return true
}

/**
 * Migrate from v10 to v11:
 * - Add `realtimeDebounceMs` + `realtimeTriggers` to SiteRule
 * Idempotent — skips if rules already have `realtimeDebounceMs`.
 */
export async function migrateV10ToV11(): Promise<boolean> {
	const result = await browser.storage.local.get(['siteRules'])
	const siteRules = (result.siteRules as Record<string, unknown>[]) || []

	if (siteRules.length === 0) return false
	if (siteRules[0].realtimeDebounceMs !== undefined) return false

	const updatedRules = siteRules.map((r) => ({
		...r,
		realtimeDebounceMs: 2000,
		realtimeTriggers: {
			onLoad: true,
			onSpaNavigation: true,
			onVisibilityChange: false,
		},
	}))

	await browser.storage.local.set({ siteRules: updatedRules })
	console.debug(`[migration] V10→V11: added realtime fields to ${updatedRules.length} rules`)
	return true
}

/**
 * Migrate from v11 to v12:
 * - Extend globalSettings with dev/contentQuality/contentCleaning defaults
 * Idempotent — skips if all fields already exist.
 */
export async function migrateV11ToV12(): Promise<boolean> {
	const result = await browser.storage.local.get(['globalSettings'])
	const current = (result.globalSettings as Record<string, unknown> | undefined) || {}

	const hasDevMode = current.devMode !== undefined
	const hasQuality = current.contentQuality !== undefined
	const hasCleaning = current.contentCleaning !== undefined
	if (hasDevMode && hasQuality && hasCleaning) return false

	await browser.storage.local.set({
		globalSettings: {
			...DEFAULT_GLOBAL_SETTINGS,
			...current,
			contentQuality: {
				...DEFAULT_GLOBAL_SETTINGS.contentQuality,
				...(current.contentQuality as Record<string, unknown> | undefined),
			},
			contentCleaning: {
				...DEFAULT_GLOBAL_SETTINGS.contentCleaning,
				...(current.contentCleaning as Record<string, unknown> | undefined),
			},
		},
	})
	console.debug('[migration] V11→V12: extended globalSettings defaults')
	return true
}

/**
 * Migrate from v9 to v10:
 * - Add `flush.mode` to liveStreamConfig (default 'batched')
 * Idempotent — skips if flush.mode already exists.
 */
export async function migrateV9ToV10(): Promise<boolean> {
	const result = await browser.storage.local.get(['liveStreamConfig'])
	const config = result.liveStreamConfig as Record<string, unknown> | undefined

	if (!config) return false
	const flush = config.flush as Record<string, unknown> | undefined
	if (!flush || flush.mode !== undefined) return false

	await browser.storage.local.set({
		liveStreamConfig: {
			...config,
			flush: { ...flush, mode: 'batched' },
		},
	})
	console.debug('[migration] V9→V10: added flush.mode to liveStreamConfig')
	return true
}
