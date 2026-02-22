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
		locale: 'en',
		theme: 'system',
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
