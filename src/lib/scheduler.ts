import { matchesSiteRules } from '@/lib/allowlist'
import { sendToEndpoint } from '@/lib/api/send'
import { buildVariables, extractPageContent } from '@/lib/content-extractor'
import { hasContentChanged } from '@/lib/dedup'
import {
	getGlobalSettings,
	getLastSharedAt,
	getSiteRules,
	setGlobalSettings as saveGlobalSettings,
	setLastSharedAt,
	setSiteRules,
} from '@/lib/storage'
import { compileTemplate } from '@/lib/template-engine/compiler'
import type { ContextBroTemplate, Endpoint, GlobalSettings, SiteRule } from '@/lib/types'

const ALARM_NAME = 'context-bro-schedule'

/**
 * Initialize the scheduler — call once from the background service worker.
 * Sets up alarm listener and restores config from storage.
 */
export function initScheduler(deps: {
	ensureContentScript: (tabId: number) => Promise<void>
	getEndpoints: () => Promise<Endpoint[]>
	getTemplate: (templateId?: string) => Promise<ContextBroTemplate>
}): void {
	browser.alarms.onAlarm.addListener(async (alarm) => {
		if (alarm.name !== ALARM_NAME) return
		await runScheduledExtraction(deps)
	})

	// Restore alarm on service worker startup
	getSiteRules().then((rules) => {
		syncAlarm(rules)
	})
}

/**
 * Update site rules and sync the alarm.
 */
export async function updateSiteRules(rules: SiteRule[]): Promise<void> {
	await setSiteRules(rules)
	await syncAlarm(rules)
}

/**
 * Update global settings.
 */
export async function updateGlobalSettings(settings: GlobalSettings): Promise<void> {
	await saveGlobalSettings(settings)
}

/**
 * Create or update the Chrome alarm based on the minimum interval across all active auto-share rules.
 */
async function syncAlarm(rules: SiteRule[]): Promise<void> {
	const activeRules = rules.filter((r) => r.enabled && r.autoShare)

	if (activeRules.length === 0) {
		await browser.alarms.clear(ALARM_NAME)
		return
	}

	const minInterval = Math.max(1, Math.min(...activeRules.map((r) => r.intervalMinutes)))

	await browser.alarms.clear(ALARM_NAME)
	browser.alarms.create(ALARM_NAME, {
		periodInMinutes: minInterval,
	})
}

/**
 * Core scheduled extraction logic.
 * Queries tabs → matches site rules → checks per-rule interval → dedup → extract → compile → POST to all configured endpoints.
 */
async function runScheduledExtraction(deps: {
	ensureContentScript: (tabId: number) => Promise<void>
	getEndpoints: () => Promise<Endpoint[]>
	getTemplate: (templateId?: string) => Promise<ContextBroTemplate>
}): Promise<void> {
	const rules = await getSiteRules()
	const activeRules = rules.filter((r) => r.enabled && r.autoShare)
	if (activeRules.length === 0) return

	const globalSettings = await getGlobalSettings()
	const allEndpoints = await deps.getEndpoints()
	const lastSharedAt = await getLastSharedAt()
	const now = Date.now()

	// Query tabs based on global schedule mode
	const tabs =
		globalSettings.scheduleMode === 'focused'
			? await browser.tabs.query({ active: true, currentWindow: true })
			: await browser.tabs.query({})

	let lastSharedUpdated = false

	for (const tab of tabs) {
		if (!tab.id || !tab.url) continue
		if (!tab.url.startsWith('http://') && !tab.url.startsWith('https://')) continue

		// Check if tab matches any active site rule
		const matchedRule = matchesSiteRules(tab.url, activeRules)
		if (!matchedRule) continue

		// Check per-rule interval
		const lastTime = lastSharedAt[matchedRule.pattern] || 0
		if (now - lastTime < matchedRule.intervalMinutes * 60_000) continue

		// Resolve target endpoints
		const targetEndpoints =
			matchedRule.endpointIds.length > 0
				? allEndpoints.filter((e) => e.enabled && matchedRule.endpointIds.includes(e.id))
				: allEndpoints.filter((e) => e.enabled).slice(0, 1)

		if (targetEndpoints.length === 0) {
			console.debug(`[scheduler] No endpoints for rule: ${matchedRule.pattern}`)
			continue
		}

		try {
			await deps.ensureContentScript(tab.id)
			const response = await extractPageContent(tab.id)
			if (!response) continue

			// Dedup — skip if page content hasn't changed
			const contentKey = response.content || response.fullHtml || ''
			const changed = await hasContentChanged(tab.url, contentKey)
			if (!changed) {
				console.debug(`[scheduler] Skipping unchanged: ${tab.url}`)
				continue
			}

			const variables = buildVariables(response, tab.url)
			const template = await deps.getTemplate(matchedRule.templateId)
			const compiled = await compileTemplate(tab.id, template.contentFormat, variables, tab.url)

			// Send to all configured endpoints (partial failure tolerant)
			const results = await Promise.allSettled(
				targetEndpoints.map((ep) => sendToEndpoint(ep, compiled)),
			)

			for (let i = 0; i < results.length; i++) {
				const r = results[i]
				if (r.status === 'fulfilled' && r.value.ok) {
					console.debug(`[scheduler] Sent ${tab.url} → ${targetEndpoints[i].name}`)
				} else {
					const reason =
						r.status === 'rejected' ? r.reason : `${r.value.status} ${r.value.statusText}`
					console.error(`[scheduler] Failed ${tab.url} → ${targetEndpoints[i].name}: ${reason}`)
				}
			}

			// Mark as shared if at least one endpoint succeeded
			const anySuccess = results.some((r) => r.status === 'fulfilled' && r.value.ok)
			if (anySuccess) {
				lastSharedAt[matchedRule.pattern] = now
				lastSharedUpdated = true
			}
		} catch (error) {
			console.error(`[scheduler] Error processing ${tab.url}:`, error)
		}
	}

	if (lastSharedUpdated) {
		await setLastSharedAt(lastSharedAt)
	}
}
