import { isMatchedByPatternRules, matchesPattern } from '@/lib/allowlist'
import { sendToEndpoint } from '@/lib/api/send'
import { evaluateContentQuality } from '@/lib/content-quality'
import { buildVariables, extractPageContent } from '@/lib/content-extractor'
import { hasContentChanged } from '@/lib/dedup'
import { appendSendHistory, getLastSharedAt, getSiteRules, setLastSharedAt } from '@/lib/storage'
import { compileTemplate } from '@/lib/template-engine/compiler'
import type { ContextBroTemplate, Endpoint, SiteRule } from '@/lib/types'

type RealtimeEvent = 'load' | 'spa_navigation' | 'visibility_change'

interface RealtimeModeDeps {
	ensureContentScript: (tabId: number) => Promise<void>
	getEndpoints: () => Promise<Endpoint[]>
	getTemplate: (templateId?: string) => Promise<ContextBroTemplate>
}

let deps: RealtimeModeDeps | null = null

/** Per-URL debounce timers keyed by `tabId::url` */
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>()

/**
 * Initialize realtime-mode. Call once from the background service worker.
 */
export function initRealtimeMode(injectedDeps: RealtimeModeDeps): void {
	deps = injectedDeps
}

/**
 * Handle a "contentReady" signal from a content script.
 * Matches against realtime site rules, debounces per-URL, then
 * triggers the standard extraction pipeline.
 */
export async function handleContentReady(
	tabId: number,
	url: string,
	event: RealtimeEvent,
): Promise<void> {
	if (!deps) return

	let hostname: string
	try {
		hostname = new URL(url).hostname
	} catch {
		return
	}

	const rules = await getSiteRules()
	const realtimeRules = rules.filter(
		(r) => r.enabled && r.autoShare && r.scheduleMode === 'realtime',
	)

	const patternMatches = realtimeRules.filter(
		(r) => !r.catchAll && r.patterns.some((p) => matchesPattern(hostname, p)) && isEventEnabled(r, event),
	)

	// Fall back to catchAll rules only when no pattern-based rules match this hostname
	const matchingRules =
		patternMatches.length > 0
			? patternMatches
			: !isMatchedByPatternRules(hostname, rules)
				? realtimeRules.filter((r) => r.catchAll && isEventEnabled(r, event))
				: []

	if (matchingRules.length === 0) return

	// Group by debounce time — use the minimum debounce across matching rules
	const minDebounce = Math.min(...matchingRules.map((r) => r.realtimeDebounceMs ?? 2000))
	const timerKey = `${tabId}::${url}`

	// Clear existing debounce for this tab+url
	const existing = debounceTimers.get(timerKey)
	if (existing) clearTimeout(existing)

	const timer = setTimeout(async () => {
		debounceTimers.delete(timerKey)
		await extractForRealtimeRules(tabId, url, matchingRules)
	}, minDebounce)

	debounceTimers.set(timerKey, timer)
}

/**
 * Check if the given event type is enabled for a rule's realtime triggers.
 */
function isEventEnabled(rule: SiteRule, event: RealtimeEvent): boolean {
	const triggers = rule.realtimeTriggers ?? {
		onLoad: true,
		onSpaNavigation: true,
		onVisibilityChange: false,
	}

	switch (event) {
		case 'load':
			return triggers.onLoad
		case 'spa_navigation':
			return triggers.onSpaNavigation
		case 'visibility_change':
			return triggers.onVisibilityChange
		default:
			return false
	}
}

/**
 * Run the extraction pipeline for matching realtime rules.
 * Reuses the same pattern as focused-mode: extract → dedup → compile → send.
 */
async function extractForRealtimeRules(
	tabId: number,
	url: string,
	rules: SiteRule[],
): Promise<void> {
	if (!deps) return

	const allEndpoints = await deps.getEndpoints()
	const lastSharedAt = await getLastSharedAt()
	const now = Date.now()
	let lastSharedUpdated = false

	for (const rule of rules) {
		const targetEndpoints =
			rule.endpointIds.length > 0
				? allEndpoints.filter((e) => e.enabled && rule.endpointIds.includes(e.id))
				: allEndpoints.filter((e) => e.enabled).slice(0, 1)

		if (targetEndpoints.length === 0) continue

		try {
			await deps.ensureContentScript(tabId)
			const response = await extractPageContent(tabId)
			if (!response) continue

			// CatchAll rule should be conservative: only auto-send valuable page content.
			if (rule.catchAll) {
				const quality = evaluateContentQuality(response)
				if (!quality.ok) {
					console.debug(
						`[realtime-mode] Skipping low-value catchAll content: ${url} (${quality.reason}, score=${quality.score}, chars=${quality.textLength})`,
					)
					continue
				}
			}

			const contentKey = response.content || response.fullHtml || ''
			const changed = await hasContentChanged(
				url,
				contentKey,
				rule.dedupEnabled ? rule.dedupWindowSeconds : 0,
			)
			if (!changed) {
				console.debug(`[realtime-mode] Skipping unchanged: ${url}`)
				continue
			}

			const variables = buildVariables(response, url)
			const template = await deps.getTemplate(rule.templateId)
			const compiled = await compileTemplate(tabId, template.contentFormat, variables, url)

			const results = await Promise.allSettled(
				targetEndpoints.map((ep) => sendToEndpoint(ep, compiled)),
			)

			for (let i = 0; i < results.length; i++) {
				const r = results[i]
				const ok = r.status === 'fulfilled' && r.value.ok
				const status = r.status === 'fulfilled' ? r.value.status : 0
				const statusText = r.status === 'fulfilled' ? r.value.statusText : String(r.reason)

				if (ok) {
					console.debug(`[realtime-mode] Sent ${url} → ${targetEndpoints[i].name}`)
				} else {
					console.error(
						`[realtime-mode] Failed ${url} → ${targetEndpoints[i].name}: ${status} ${statusText}`,
					)
				}

				await appendSendHistory({
					id: crypto.randomUUID(),
					timestamp: now,
					url,
					endpointName: targetEndpoints[i].name,
					ruleName: rule.name,
					trigger: 'realtime',
					ok,
					status,
					statusText,
				})
			}

			const anySuccess = results.some((r) => r.status === 'fulfilled' && r.value.ok)
			if (anySuccess) {
				lastSharedAt[rule.id] = now
				lastSharedUpdated = true
			}
		} catch (error) {
			console.error(`[realtime-mode] Error processing ${url}:`, error)
		}
	}

	if (lastSharedUpdated) {
		await setLastSharedAt(lastSharedAt)
	}
}
