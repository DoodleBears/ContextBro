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

	const siteRules: SiteRule[] = (scheduleConfig.allowlist || []).map((entry) => ({
		id: crypto.randomUUID(),
		pattern: entry.pattern,
		enabled: entry.enabled,
		templateId: entry.templateId,
		endpointIds: enabledEndpointIds,
		autoShare: scheduleConfig.enabled,
		intervalMinutes: scheduleConfig.intervalMinutes,
	}))

	const globalSettings: GlobalSettings = {
		scheduleMode: scheduleConfig.mode || 'focused',
		locale: 'en',
	}

	await browser.storage.local.set({ siteRules, globalSettings })

	console.debug(`[migration] V1→V2: migrated ${siteRules.length} site rules`)
	return true
}
