import { matchesPattern } from '@/lib/allowlist'
import { sendToEndpoint } from '@/lib/api/send'
import { buildVariables, extractPageContent } from '@/lib/content-extractor'
import { hasContentChanged } from '@/lib/dedup'
import { appendSendHistory, getLastSharedAt, getSiteRules, setLastSharedAt } from '@/lib/storage'
import { compileTemplate } from '@/lib/template-engine/compiler'
import type { ContextBroTemplate, Endpoint, SiteRule } from '@/lib/types'

const DWELL_TIME_MS = 10_000 // 10 seconds

interface FocusedModeDeps {
	ensureContentScript: (tabId: number) => Promise<void>
	getEndpoints: () => Promise<Endpoint[]>
	getTemplate: (templateId?: string) => Promise<ContextBroTemplate>
}

let dwellTimer: ReturnType<typeof setTimeout> | null = null
const refetchTimers = new Map<string, ReturnType<typeof setInterval>>()

/**
 * Initialize focused-mode event listeners.
 * Call once from the background service worker.
 */
export function initFocusedMode(deps: FocusedModeDeps): void {
	// Tab activated (user switched tabs)
	browser.tabs.onActivated.addListener((activeInfo) => {
		handleTabFocus(activeInfo.tabId, deps)
	})

	// URL changed in the same tab (navigation completed)
	browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
		if (changeInfo.status === 'complete' && tab.active) {
			handleTabFocus(tabId, deps)
		}
	})

	// Window focus changed
	browser.windows.onFocusChanged.addListener(async (windowId) => {
		if (windowId === browser.windows.WINDOW_ID_NONE) {
			cancelDwell()
			cancelRefetch()
			return
		}
		try {
			const [tab] = await browser.tabs.query({ active: true, windowId })
			if (tab?.id) {
				handleTabFocus(tab.id, deps)
			}
		} catch {
			// Window may have been closed
		}
	})
}

function cancelDwell(): void {
	if (dwellTimer !== null) {
		clearTimeout(dwellTimer)
		dwellTimer = null
	}
}

function cancelRefetch(): void {
	for (const timer of refetchTimers.values()) {
		clearInterval(timer)
	}
	refetchTimers.clear()
}

function startRefetch(
	tabId: number,
	url: string,
	rule: SiteRule,
	deps: FocusedModeDeps,
): void {
	if (!rule.refetchEnabled || rule.refetchIntervalSeconds <= 0) return

	const timer = setInterval(async () => {
		// Verify the tab is still active
		try {
			const [currentTab] = await browser.tabs.query({ active: true, currentWindow: true })
			if (!currentTab || currentTab.id !== tabId) {
				cancelRefetch()
				return
			}
		} catch {
			cancelRefetch()
			return
		}

		await extractForFocusedRules(tabId, url, [rule], deps)
	}, rule.refetchIntervalSeconds * 1000)

	refetchTimers.set(rule.id, timer)
}

async function handleTabFocus(tabId: number, deps: FocusedModeDeps): Promise<void> {
	// Cancel any pending dwell timer and active refetch timers
	cancelDwell()
	cancelRefetch()

	// Get tab info — use query to get full tab object with url
	const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
	if (!tab || tab.id !== tabId) return

	if (!tab.url || (!tab.url.startsWith('http://') && !tab.url.startsWith('https://'))) {
		return
	}

	let hostname: string
	try {
		hostname = new URL(tab.url).hostname
	} catch {
		return
	}

	// Find matching focused-mode rules
	const rules = await getSiteRules()
	const matchingRules = rules.filter(
		(r) =>
			r.enabled &&
			r.autoShare &&
			r.scheduleMode === 'focused' &&
			r.patterns.some((p) => matchesPattern(hostname, p)),
	)

	if (matchingRules.length === 0) return

	// Start dwell timer
	const capturedTabId = tabId
	const capturedUrl = tab.url

	dwellTimer = setTimeout(async () => {
		// Verify the tab is still active after dwell time
		try {
			const [currentTab] = await browser.tabs.query({ active: true, currentWindow: true })
			if (!currentTab || currentTab.id !== capturedTabId) return
		} catch {
			return
		}

		await extractForFocusedRules(capturedTabId, capturedUrl, matchingRules, deps)

		// Start refetch timers for rules that have it enabled
		for (const rule of matchingRules) {
			startRefetch(capturedTabId, capturedUrl, rule, deps)
		}
	}, DWELL_TIME_MS)
}

async function extractForFocusedRules(
	tabId: number,
	url: string,
	rules: SiteRule[],
	deps: FocusedModeDeps,
): Promise<void> {
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

			const contentKey = response.content || response.fullHtml || ''
			const changed = await hasContentChanged(
				url,
				contentKey,
				rule.dedupEnabled ? rule.dedupWindowSeconds : 0,
			)
			if (!changed) {
				console.debug(`[focused-mode] Skipping unchanged: ${url}`)
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
					console.debug(`[focused-mode] Sent ${url} → ${targetEndpoints[i].name}`)
				} else {
					console.error(
						`[focused-mode] Failed ${url} → ${targetEndpoints[i].name}: ${status} ${statusText}`,
					)
				}

				await appendSendHistory({
					id: crypto.randomUUID(),
					timestamp: now,
					url,
					endpointName: targetEndpoints[i].name,
					ruleName: rule.name,
					trigger: 'focused',
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
			console.error(`[focused-mode] Error processing ${url}:`, error)
		}
	}

	if (lastSharedUpdated) {
		await setLastSharedAt(lastSharedAt)
	}
}
