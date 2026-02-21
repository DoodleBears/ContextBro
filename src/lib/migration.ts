import type { Endpoint, GlobalSettings, ScheduleConfig, SiteRule } from '@/lib/types'

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
	const newMode: SiteRule['scheduleMode'] = oldMode === 'all_allowed' ? 'any_tab' : 'focused'

	const siteRules: SiteRule[] = (scheduleConfig.allowlist || []).map((entry) => ({
		id: crypto.randomUUID(),
		pattern: entry.pattern,
		enabled: entry.enabled,
		templateId: entry.templateId,
		endpointIds: enabledEndpointIds,
		autoShare: scheduleConfig.enabled,
		intervalMinutes: scheduleConfig.intervalMinutes,
		scheduleMode: newMode,
	}))

	const globalSettings: GlobalSettings = {
		locale: 'en',
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
	const newMode: SiteRule['scheduleMode'] = oldMode === 'all_allowed' ? 'any_tab' : 'focused'

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
