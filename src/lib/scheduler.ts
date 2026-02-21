import { matchesAllowlist } from '@/lib/allowlist'
import { sendToEndpoint } from '@/lib/api/send'
import { buildVariables, extractPageContent } from '@/lib/content-extractor'
import { hasContentChanged } from '@/lib/dedup'
import { compileTemplate } from '@/lib/template-engine/compiler'
import type { ContextBroTemplate, Endpoint, ScheduleConfig } from '@/lib/types'

const ALARM_NAME = 'context-bro-schedule'
const SCHEDULE_STORAGE_KEY = 'scheduleConfig'

/**
 * Initialize the scheduler — call once from the background service worker.
 * Sets up alarm listener and restores config from storage.
 */
export function initScheduler(deps: {
	ensureContentScript: (tabId: number) => Promise<void>
	getEndpoints: () => Promise<Endpoint[]>
	getTemplate: (templateId?: string) => Promise<ContextBroTemplate>
}): void {
	// Listen for alarm ticks
	browser.alarms.onAlarm.addListener(async (alarm) => {
		if (alarm.name !== ALARM_NAME) return
		await runScheduledExtraction(deps)
	})

	// Restore alarm on service worker startup (alarms persist across restarts)
	getScheduleConfig().then((config) => {
		if (config?.enabled) {
			syncAlarm(config)
		}
	})
}

/**
 * Update the schedule config and sync the alarm.
 */
export async function updateScheduleConfig(config: ScheduleConfig): Promise<void> {
	await browser.storage.local.set({ [SCHEDULE_STORAGE_KEY]: config })

	if (config.enabled) {
		await syncAlarm(config)
	} else {
		await browser.alarms.clear(ALARM_NAME)
	}
}

/**
 * Get the current schedule config from storage.
 */
export async function getScheduleConfig(): Promise<ScheduleConfig | null> {
	const result = await browser.storage.local.get(SCHEDULE_STORAGE_KEY)
	return (result[SCHEDULE_STORAGE_KEY] as ScheduleConfig) || null
}

/**
 * Create or update the Chrome alarm to match the config interval.
 */
async function syncAlarm(config: ScheduleConfig): Promise<void> {
	await browser.alarms.clear(ALARM_NAME)
	browser.alarms.create(ALARM_NAME, {
		periodInMinutes: config.intervalMinutes,
	})
}

/**
 * Core scheduled extraction logic.
 * Queries tabs → filters by allowlist → dedup → extract → compile → POST.
 */
async function runScheduledExtraction(deps: {
	ensureContentScript: (tabId: number) => Promise<void>
	getEndpoints: () => Promise<Endpoint[]>
	getTemplate: (templateId?: string) => Promise<ContextBroTemplate>
}): Promise<void> {
	const config = await getScheduleConfig()
	if (!config?.enabled || config.allowlist.length === 0) return

	const endpoints = await deps.getEndpoints()
	const defaultEndpoint = endpoints.find((e) => e.enabled)
	if (!defaultEndpoint) {
		console.debug('[scheduler] No enabled endpoint, skipping')
		return
	}

	// Query tabs based on mode
	const tabs =
		config.mode === 'focused'
			? await browser.tabs.query({ active: true, currentWindow: true })
			: await browser.tabs.query({})

	for (const tab of tabs) {
		if (!tab.id || !tab.url) continue

		// Skip non-http(s) tabs (chrome://, about://, etc.)
		if (!tab.url.startsWith('http://') && !tab.url.startsWith('https://')) continue

		// Check allowlist
		const match = matchesAllowlist(tab.url, config.allowlist)
		if (!match) continue

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

			// Use allowlist-bound template, or find by trigger, or default
			const template = await deps.getTemplate(match.templateId)
			const compiled = await compileTemplate(tab.id, template.contentFormat, variables, tab.url)

			const result = await sendToEndpoint(defaultEndpoint, compiled)
			if (result.ok) {
				console.debug(`[scheduler] Sent: ${tab.url}`)
			} else {
				console.error(`[scheduler] Failed ${tab.url}: ${result.status} ${result.statusText}`)
			}
		} catch (error) {
			console.error(`[scheduler] Error processing ${tab.url}:`, error)
		}
	}
}
