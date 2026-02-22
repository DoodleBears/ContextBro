import { matchesPattern } from '@/lib/allowlist'
import { sendToEndpoint } from '@/lib/api/send'
import { buildVariables, extractPageContent } from '@/lib/content-extractor'
import { hasContentChanged } from '@/lib/dedup'
import {
	appendSendHistory,
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
 * Create or update the Chrome alarm based on the minimum interval across active any_tab rules.
 * Focused-mode rules are event-driven and don't need alarms.
 */
async function syncAlarm(rules: SiteRule[]): Promise<void> {
	const anyTabRules = rules.filter((r) => r.enabled && r.autoShare && r.scheduleMode === 'any_tab')

	if (anyTabRules.length === 0) {
		await browser.alarms.clear(ALARM_NAME)
		return
	}

	const minInterval = Math.max(1, Math.min(...anyTabRules.map((r) => r.intervalMinutes)))

	await browser.alarms.clear(ALARM_NAME)
	browser.alarms.create(ALARM_NAME, {
		periodInMinutes: minInterval,
	})
}

/**
 * Core scheduled extraction logic.
 * Iterates active rules → per-rule scheduleMode determines candidate tabs →
 * checks per-rule interval → dedup → extract → compile → POST to configured endpoints.
 */
async function runScheduledExtraction(deps: {
	ensureContentScript: (tabId: number) => Promise<void>
	getEndpoints: () => Promise<Endpoint[]>
	getTemplate: (templateId?: string) => Promise<ContextBroTemplate>
}): Promise<void> {
	const rules = await getSiteRules()
	const activeRules = rules.filter((r) => r.enabled && r.autoShare && r.scheduleMode === 'any_tab')
	if (activeRules.length === 0) return

	const allEndpoints = await deps.getEndpoints()
	const lastSharedAt = await getLastSharedAt()
	const now = Date.now()

	const allTabs = await browser.tabs.query({})

	let lastSharedUpdated = false
	const processedTabs = new Set<string>() // track rule+tab combos to avoid duplicates

	for (const rule of activeRules) {
		// Check per-rule interval
		const lastTime = lastSharedAt[rule.pattern] || 0
		if (now - lastTime < rule.intervalMinutes * 60_000) continue

		const candidateTabs = allTabs

		// Resolve target endpoints
		const targetEndpoints =
			rule.endpointIds.length > 0
				? allEndpoints.filter((e) => e.enabled && rule.endpointIds.includes(e.id))
				: allEndpoints.filter((e) => e.enabled).slice(0, 1)

		if (targetEndpoints.length === 0) {
			console.debug(`[scheduler] No endpoints for rule: ${rule.pattern}`)
			continue
		}

		for (const tab of candidateTabs) {
			if (!tab.id || !tab.url) continue
			if (!tab.url.startsWith('http://') && !tab.url.startsWith('https://')) continue

			// Check if this tab matches this specific rule's pattern
			let hostname: string
			try {
				hostname = new URL(tab.url).hostname
			} catch {
				continue
			}
			if (!matchesPattern(hostname, rule.pattern)) continue

			// Avoid processing the same rule+tab combo
			const comboKey = `${rule.pattern}::${tab.id}`
			if (processedTabs.has(comboKey)) continue
			processedTabs.add(comboKey)

			try {
				await deps.ensureContentScript(tab.id)
				const response = await extractPageContent(tab.id)
				if (!response) continue

				// Dedup — skip if page content hasn't changed
				const contentKey = response.content || response.fullHtml || ''
				const changed = await hasContentChanged(
					tab.url,
					contentKey,
					rule.dedupEnabled ? rule.dedupWindowSeconds : 0,
				)
				if (!changed) {
					console.debug(`[scheduler] Skipping unchanged: ${tab.url}`)
					continue
				}

				const variables = buildVariables(response, tab.url)
				const template = await deps.getTemplate(rule.templateId)
				const compiled = await compileTemplate(tab.id, template.contentFormat, variables, tab.url)

				// Send to all configured endpoints (partial failure tolerant)
				const results = await Promise.allSettled(
					targetEndpoints.map((ep) => sendToEndpoint(ep, compiled)),
				)

				for (let i = 0; i < results.length; i++) {
					const r = results[i]
					const ok = r.status === 'fulfilled' && r.value.ok
					const status = r.status === 'fulfilled' ? r.value.status : 0
					const statusText = r.status === 'fulfilled' ? r.value.statusText : String(r.reason)

					if (ok) {
						console.debug(`[scheduler] Sent ${tab.url} → ${targetEndpoints[i].name}`)
					} else {
						console.error(
							`[scheduler] Failed ${tab.url} → ${targetEndpoints[i].name}: ${status} ${statusText}`,
						)
					}

					await appendSendHistory({
						id: crypto.randomUUID(),
						timestamp: now,
						url: tab.url,
						endpointName: targetEndpoints[i].name,
						rulePattern: rule.pattern,
						trigger: 'scheduler',
						ok,
						status,
						statusText,
					})
				}

				// Mark as shared if at least one endpoint succeeded
				const anySuccess = results.some((r) => r.status === 'fulfilled' && r.value.ok)
				if (anySuccess) {
					lastSharedAt[rule.pattern] = now
					lastSharedUpdated = true
				}
			} catch (error) {
				console.error(`[scheduler] Error processing ${tab.url}:`, error)
			}
		}
	}

	if (lastSharedUpdated) {
		await setLastSharedAt(lastSharedAt)
	}
}
