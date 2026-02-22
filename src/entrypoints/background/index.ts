import type { ChatBatch, StreamInfo, TranscriptChunk } from '@/lib/adapters/types'
import { matchesSiteRules } from '@/lib/allowlist'
import { sendToEndpoint } from '@/lib/api/send'
import { buildVariables, extractPageContent } from '@/lib/content-extractor'
import { initFocusedMode } from '@/lib/focused-mode'
import {
	migrateV1ToV2,
	migrateV2ToV3,
	migrateV3ToV4,
	migrateV4ToV5,
	migrateV5ToV6,
	migrateV6ToV7,
	migrateV7ToV8,
	migrateV8ToV9,
	migrateV9ToV10,
} from '@/lib/migration'
import { initScheduler, updateGlobalSettings, updateSiteRules } from '@/lib/scheduler'
import {
	appendSendHistory,
	getEndpoints as getEndpointsFromStorage,
	getLiveStreamConfig,
	getSiteRules,
} from '@/lib/storage'
import { compileTemplate } from '@/lib/template-engine/compiler'
import type { ContextBroTemplate, Endpoint, GlobalSettings, SiteRule } from '@/lib/types'

const DEFAULT_TEMPLATE: ContextBroTemplate = {
	id: 'default',
	name: 'Default',
	contentFormat: `{
  "title": {{title|json_stringify}},
  "url": {{url|json_stringify}},
  "content": {{content|json_stringify}},
  "author": {{author|json_stringify}},
  "published": {{published|json_stringify}},
  "domain": {{domain|json_stringify}},
  "description": {{description|json_stringify}},
  "wordCount": {{wordCount}},
  "clippedAt": "{{date}} {{time}}"
}`,
}

/**
 * Set the toolbar icon to match the current theme (light or dark browser chrome).
 */
function setToolbarIcon(isDark: boolean): void {
	const variant = isDark ? 'dark' : 'light'
	browser.action.setIcon({
		path: {
			16: `icon-${variant}/16.png`,
			32: `icon-${variant}/32.png`,
			48: `icon-${variant}/48.png`,
			128: `icon-${variant}/128.png`,
		},
	})
}

/**
 * Read theme from storage and apply the toolbar icon.
 * For 'system' theme, resolvedDark can be provided by a UI page.
 */
async function applyToolbarIcon(resolvedDark?: boolean): Promise<void> {
	const result = await browser.storage.local.get('globalSettings')
	const settings = result.globalSettings as GlobalSettings | undefined
	const theme = settings?.theme || 'system'

	if (theme === 'dark') {
		setToolbarIcon(true)
	} else if (theme === 'light') {
		setToolbarIcon(false)
	} else {
		// 'system' — use resolved value if provided, otherwise default to light
		setToolbarIcon(resolvedDark ?? false)
	}
}

export default defineBackground(() => {
	console.log('Context Bro background service worker started')

	// Apply toolbar icon on startup
	applyToolbarIcon()

	// Run migrations before initializing scheduler
	migrateV1ToV2()
		.then((migrated) => {
			if (migrated) console.debug('[background] V1→V2 migration completed')
			return migrateV2ToV3()
		})
		.then((migrated) => {
			if (migrated) console.debug('[background] V2→V3 migration completed')
			return migrateV3ToV4()
		})
		.then((migrated) => {
			if (migrated) console.debug('[background] V3→V4 migration completed')
			return migrateV4ToV5()
		})
		.then((migrated) => {
			if (migrated) console.debug('[background] V4→V5 migration completed')
			return migrateV5ToV6()
		})
		.then((migrated) => {
			if (migrated) console.debug('[background] V5→V6 migration completed')
			return migrateV6ToV7()
		})
		.then((migrated) => {
			if (migrated) console.debug('[background] V6→V7 migration completed')
			return migrateV7ToV8()
		})
		.then((migrated) => {
			if (migrated) console.debug('[background] V7→V8 migration completed')
			return migrateV8ToV9()
		})
		.then((migrated) => {
			if (migrated) console.debug('[background] V8→V9 migration completed')
			return migrateV9ToV10()
		})
		.then((migrated) => {
			if (migrated) console.debug('[background] V9→V10 migration completed')
		})

	// Initialize the scheduled extraction system
	initScheduler({
		ensureContentScript,
		getEndpoints,
		getTemplate,
	})

	// Initialize event-driven focused-mode extraction
	initFocusedMode({
		ensureContentScript,
		getEndpoints,
		getTemplate,
	})

	// Set up context menus
	browser.runtime.onInstalled.addListener(() => {
		browser.contextMenus.create({
			id: 'share-page',
			title: 'Share page to Context Bro',
			contexts: ['page'],
		})
		browser.contextMenus.create({
			id: 'share-selection',
			title: 'Share selection to Context Bro',
			contexts: ['selection'],
		})
	})

	// Handle context menu clicks
	browser.contextMenus.onClicked.addListener(async (info, tab) => {
		if (!tab?.id) return

		if (info.menuItemId === 'share-page' || info.menuItemId === 'share-selection') {
			await shareFromTab(tab.id)
		}
	})

	// Handle keyboard shortcut
	browser.commands.onCommand.addListener(async (command) => {
		if (command === 'share-selection') {
			const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
			if (tab?.id) {
				await shareFromTab(tab.id)
			}
		}
	})

	// Handle messages from popup and other extension parts
	browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
		if (message.action === 'getPageData') {
			handleGetPageData(message.tabId).then(sendResponse)
			return true // async response
		}

		if (message.action === 'share') {
			handleShare(message.tabId, message.endpointId, message.templateId).then(sendResponse)
			return true
		}

		if (message.action === 'shareAll') {
			shareFromTab(message.tabId).then(
				() => sendResponse({ ok: true }),
				(err) => sendResponse({ ok: false, error: String(err) }),
			)
			return true
		}

		if (message.action === 'compilePreview') {
			handleCompilePreview(message.tabId, message.templateId).then(sendResponse)
			return true
		}

		if (message.action === 'updateSiteRules') {
			updateSiteRules(message.siteRules as SiteRule[]).then(sendResponse)
			return true
		}

		if (message.action === 'updateGlobalSettings') {
			updateGlobalSettings(message.globalSettings as GlobalSettings).then((res) => {
				applyToolbarIcon()
				sendResponse(res)
			})
			return true
		}

		if (message.action === 'resolveSystemTheme') {
			applyToolbarIcon(message.isDark as boolean)
			return false
		}

		// ── Adapter messages ──

		if (message.action === 'getStreamState') {
			const tabId = _sender.tab?.id
			if (tabId != null && tabId === focusedTabId) {
				const adapter = activeAdapters.get(tabId)
				if (adapter) {
					sendResponse({
						active: true,
						platform: adapter.platform,
						streamInfo: adapter.streamInfo,
						endpointNames: adapter.endpointNames,
						totalMessages: adapter.totalMessages,
						totalBatches: adapter.totalBatches,
					})
				} else {
					sendResponse({ active: false })
				}
			} else {
				sendResponse({ active: false })
			}
			return true
		}

		if (message.action === 'adapterActive') {
			const tabId = _sender.tab?.id
			if (tabId != null) handleAdapterActive(message.platform, message.streamInfo, tabId)
			return false
		}

		if (message.action === 'adapterInactive') {
			const tabId = _sender.tab?.id
			if (tabId != null) handleAdapterInactive(message.platform, tabId)
			return false
		}

		if (message.action === 'adapterChatBatch') {
			const tabId = _sender.tab?.id ?? -1
			handleChatBatch(message.batch, tabId).then(sendResponse)
			return true
		}

		if (message.action === 'adapterTranscript') {
			const tabId = _sender.tab?.id ?? -1
			handleTranscript(message.chunk, tabId).then(sendResponse)
			return true
		}
	})
})

/**
 * Extract page content, compile template, and send to configured endpoints.
 * Looks up matching SiteRule for multi-endpoint support, falls back to first enabled.
 */
async function shareFromTab(tabId: number): Promise<void> {
	try {
		await ensureContentScript(tabId)

		const tab = await browser.tabs.get(tabId)
		const url = tab.url || ''
		const endpoints = await getEndpoints()

		// Try matching a site rule for multi-endpoint
		const siteRules = await getSiteRules()
		const matchedRules = url ? matchesSiteRules(url, siteRules) : []
		const matchedRule = matchedRules[0]

		if (matchedRule && matchedRule.endpointIds.length > 0) {
			const targetEndpoints = endpoints.filter(
				(e) => e.enabled && matchedRule.endpointIds.includes(e.id),
			)
			if (targetEndpoints.length > 0) {
				const results = await Promise.allSettled(
					targetEndpoints.map((ep) => handleShare(tabId, ep.id, matchedRule.templateId)),
				)
				for (const r of results) {
					if (r.status === 'rejected') console.error('Share failed:', r.reason)
				}
				return
			}
		}

		// Fallback: send to first enabled endpoint
		const defaultEndpoint = endpoints.find((e) => e.enabled)
		if (!defaultEndpoint) {
			console.error('No enabled endpoint configured')
			return
		}

		const result = await handleShare(tabId, defaultEndpoint.id)
		if (!result?.ok) {
			console.error('Share failed:', result)
		}
	} catch (error) {
		console.error('Error sharing from tab:', error)
	}
}

/**
 * Get page data (variables) for the popup to display.
 */
async function handleGetPageData(tabId: number) {
	try {
		await ensureContentScript(tabId)
		const response = await extractPageContent(tabId)
		if (!response) return { error: 'Failed to extract page content' }

		const tab = await browser.tabs.get(tabId)
		const variables = buildVariables(response, tab.url || '')

		return { variables }
	} catch (error) {
		return { error: String(error) }
	}
}

/**
 * Compile a template and send to an endpoint.
 */
async function handleShare(tabId: number, endpointId?: string, templateId?: string) {
	try {
		await ensureContentScript(tabId)
		const response = await extractPageContent(tabId)
		if (!response) return { ok: false, error: 'Failed to extract page content' }

		const tab = await browser.tabs.get(tabId)
		const url = tab.url || ''
		const variables = buildVariables(response, url)

		const template = await getTemplate(templateId)
		const compiled = await compileTemplate(tabId, template.contentFormat, variables, url)

		const endpoints = await getEndpoints()
		const endpoint = endpointId
			? endpoints.find((e) => e.id === endpointId)
			: endpoints.find((e) => e.enabled)

		if (!endpoint) return { ok: false, error: 'No endpoint configured' }

		const result = await sendToEndpoint(endpoint, compiled)

		await appendSendHistory({
			id: crypto.randomUUID(),
			timestamp: Date.now(),
			url,
			endpointName: endpoint.name,
			trigger: 'manual',
			ok: result.ok,
			status: result.status,
			statusText: result.statusText,
		})

		return result
	} catch (error) {
		return { ok: false, error: String(error) }
	}
}

/**
 * Compile a template for preview (no sending).
 */
async function handleCompilePreview(tabId: number, templateId?: string) {
	try {
		await ensureContentScript(tabId)
		const response = await extractPageContent(tabId)
		if (!response) return { error: 'Failed to extract page content' }

		const tab = await browser.tabs.get(tabId)
		const url = tab.url || ''
		const variables = buildVariables(response, url)

		const template = await getTemplate(templateId)
		const compiled = await compileTemplate(tabId, template.contentFormat, variables, url)

		return { compiled }
	} catch (error) {
		return { error: String(error) }
	}
}

/**
 * Ensure the content script is injected in the given tab.
 */
async function ensureContentScript(tabId: number): Promise<void> {
	try {
		await browser.tabs.sendMessage(tabId, { action: 'ping' })
	} catch {
		// Content script not loaded — inject it
		await browser.scripting.executeScript({
			target: { tabId },
			files: ['/content-scripts/content.js'],
		})
	}
}

// --- Storage helpers ---

async function getEndpoints(): Promise<Endpoint[]> {
	return getEndpointsFromStorage()
}

async function getTemplate(templateId?: string): Promise<ContextBroTemplate> {
	if (!templateId || templateId === 'default') {
		return DEFAULT_TEMPLATE
	}

	const result = await browser.storage.local.get('templates')
	const templates = (result.templates as ContextBroTemplate[]) || []
	return templates.find((t) => t.id === templateId) || DEFAULT_TEMPLATE
}

// --- Adapter handlers ---

interface ActiveAdapter {
	tabId: number
	platform: string
	streamInfo: StreamInfo | null
	endpointNames: string[]
	totalMessages: number
	totalBatches: number
}

const activeAdapters = new Map<number, ActiveAdapter>()
let focusedTabId: number | null = null

// Track focused tab for focus-only adapter processing
browser.tabs.onActivated.addListener(({ tabId }) => {
	const previousFocused = focusedTabId
	focusedTabId = tabId

	// Dismiss indicator on previously focused tab if it had an adapter
	if (previousFocused != null && previousFocused !== tabId && activeAdapters.has(previousFocused)) {
		browser.tabs.sendMessage(previousFocused, { action: 'dismissStreamIndicator' }).catch(() => {})
	}

	// Show indicator on newly focused tab if it has an adapter
	const adapter = activeAdapters.get(tabId)
	if (adapter) {
		browser.tabs
			.sendMessage(tabId, {
				action: 'showStreamIndicator',
				platform: adapter.platform,
				streamInfo: adapter.streamInfo,
				endpointNames: adapter.endpointNames,
			})
			.catch(() => {})
		if (adapter.totalMessages > 0 || adapter.totalBatches > 0) {
			browser.tabs
				.sendMessage(tabId, {
					action: 'updateStreamIndicator',
					totalMessages: adapter.totalMessages,
					totalBatches: adapter.totalBatches,
					streamInfo: adapter.streamInfo,
				})
				.catch(() => {})
		}
	}
})

// Also track window focus changes
browser.windows.onFocusChanged.addListener(async (windowId) => {
	if (windowId === browser.windows.WINDOW_ID_NONE) return
	try {
		const [tab] = await browser.tabs.query({ active: true, windowId })
		if (tab?.id != null) {
			const previousFocused = focusedTabId
			focusedTabId = tab.id

			if (
				previousFocused != null &&
				previousFocused !== tab.id &&
				activeAdapters.has(previousFocused)
			) {
				browser.tabs
					.sendMessage(previousFocused, { action: 'dismissStreamIndicator' })
					.catch(() => {})
			}

			const adapter = activeAdapters.get(tab.id)
			if (adapter) {
				browser.tabs
					.sendMessage(tab.id, {
						action: 'showStreamIndicator',
						platform: adapter.platform,
						streamInfo: adapter.streamInfo,
						endpointNames: adapter.endpointNames,
					})
					.catch(() => {})
			}
		}
	} catch {}
})

// Initialize focused tab on startup
browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
	if (tab?.id != null) focusedTabId = tab.id
})

async function resolveStreamEndpoints(): Promise<{ targets: Endpoint[]; names: string[] }> {
	const [allEndpoints, config] = await Promise.all([getEndpoints(), getLiveStreamConfig()])
	// Only send to explicitly selected endpoints; empty = no sending
	const targets =
		(config.endpointIds?.length ?? 0) > 0
			? allEndpoints.filter((e) => e.enabled && config.endpointIds.includes(e.id))
			: []
	const names = targets.map((e) => e.name || 'Unnamed')
	return { targets, names }
}

async function handleAdapterActive(
	platform: string,
	streamInfo: StreamInfo | null,
	tabId: number,
): Promise<void> {
	const { names } = await resolveStreamEndpoints()

	activeAdapters.set(tabId, {
		tabId,
		platform,
		streamInfo: streamInfo || null,
		endpointNames: names,
		totalMessages: 0,
		totalBatches: 0,
	})
	updateBadge()
	console.debug(`[adapter] ${platform} active (tab ${tabId}):`, streamInfo?.title || 'unknown')

	// Only show indicator on the focused tab
	if (tabId === focusedTabId) {
		browser.tabs
			.sendMessage(tabId, {
				action: 'showStreamIndicator',
				platform,
				streamInfo,
				endpointNames: names,
			})
			.catch(() => {})
	}
}

function handleAdapterInactive(platform: string, tabId: number): void {
	activeAdapters.delete(tabId)
	updateBadge()
	console.debug(`[adapter] ${platform} inactive (tab ${tabId})`)

	browser.tabs
		.sendMessage(tabId, {
			action: 'dismissStreamIndicator',
		})
		.catch(() => {})
}

function updateBadge(): void {
	if (activeAdapters.size > 0) {
		browser.action.setBadgeText({ text: '📡' })
		browser.action.setBadgeBackgroundColor({ color: '#10b981' })
	} else {
		browser.action.setBadgeText({ text: '' })
	}
}

async function handleChatBatch(batch: ChatBatch, tabId: number) {
	try {
		// Only process chat from the focused tab
		if (tabId !== focusedTabId) {
			console.debug(`[adapter] chat batch dropped: tab ${tabId} not focused`)
			return { ok: false, error: 'Tab not focused' }
		}

		const [allEndpoints, config] = await Promise.all([getEndpoints(), getLiveStreamConfig()])

		// Only send to explicitly selected endpoints; empty = no sending
		const targets =
			(config.endpointIds?.length ?? 0) > 0
				? allEndpoints.filter((e) => e.enabled && config.endpointIds.includes(e.id))
				: []
		if (targets.length === 0) {
			console.debug('[adapter] chat batch dropped: no endpoint selected')
			// Still update stats even though we're not sending
			const adapter = activeAdapters.get(tabId)
			if (adapter) {
				adapter.totalMessages += batch.totalCount
				adapter.totalBatches += 1
				if (batch.streamInfo) adapter.streamInfo = batch.streamInfo
				browser.tabs
					.sendMessage(tabId, {
						action: 'updateStreamIndicator',
						totalMessages: adapter.totalMessages,
						totalBatches: adapter.totalBatches,
						streamInfo: batch.streamInfo,
					})
					.catch(() => {})
			}
			return { ok: false, error: 'No endpoint selected' }
		}

		// Build variable map for template compilation
		const messagesForJson = batch.messages.map((m) => ({
			user: m.displayName,
			message: m.message,
			roles: m.roles,
			event: m.event,
			monetization: m.monetization || undefined,
		}))

		const streamUrl = batch.streamInfo?.url || ''
		const variables: Record<string, string | number | boolean> = {
			'{{platform}}': batch.platform,
			'{{channel}}': batch.channelName,
			'{{title}}': batch.streamInfo?.title || '',
			'{{category}}': batch.streamInfo?.category || '',
			'{{viewers}}': batch.streamInfo?.viewerCount || 0,
			'{{isLive}}': batch.streamInfo?.isLive ?? true,
			'{{totalMessages}}': batch.totalCount,
			'{{sampledMessages}}': batch.sampledCount,
			'{{messages}}': JSON.stringify(messagesForJson),
			'{{donations}}': JSON.stringify(batch.donations),
			'{{memberships}}': JSON.stringify(batch.memberships),
			'{{timestamp}}': new Date().toISOString(),
			'{{url}}': streamUrl,
		}

		const body = await compileTemplate(tabId, config.chatBodyTemplate, variables, streamUrl)

		// Send to all target endpoints
		const results = await Promise.allSettled(targets.map((ep) => sendToEndpoint(ep, body)))

		// Log results and record send history
		for (let i = 0; i < results.length; i++) {
			const r = results[i]
			const ep = targets[i]
			const epName = ep.name || 'Unnamed'
			const ok = r.status === 'fulfilled' && r.value.ok
			const status = r.status === 'fulfilled' ? r.value.status : 0
			const statusText = r.status === 'fulfilled' ? r.value.statusText : String(r.reason)

			if (ok) {
				console.debug(`[adapter] chat batch sent → ${epName}: ${status}`)
			} else {
				console.error(`[adapter] chat batch failed → ${epName}: ${status} ${statusText}`)
			}

			appendSendHistory({
				id: crypto.randomUUID(),
				timestamp: Date.now(),
				url: batch.streamInfo?.url || '',
				endpointName: epName,
				trigger: 'livestream',
				ok,
				status,
				statusText,
			}).catch(() => {})
		}

		// Update stats, streamInfo, and relay to stream indicator
		const adapter = activeAdapters.get(tabId)
		if (adapter) {
			adapter.totalMessages += batch.totalCount
			adapter.totalBatches += 1
			// Keep streamInfo fresh (channel name may have loaded late)
			if (batch.streamInfo) adapter.streamInfo = batch.streamInfo
			browser.tabs
				.sendMessage(tabId, {
					action: 'updateStreamIndicator',
					totalMessages: adapter.totalMessages,
					totalBatches: adapter.totalBatches,
					streamInfo: batch.streamInfo,
				})
				.catch(() => {})
		}

		const firstResult = results[0]
		return firstResult?.status === 'fulfilled'
			? firstResult.value
			: { ok: false, error: String((firstResult as PromiseRejectedResult)?.reason) }
	} catch (error) {
		return { ok: false, error: String(error) }
	}
}

async function handleTranscript(chunk: TranscriptChunk, tabId: number) {
	try {
		// Only process transcript from the focused tab
		if (tabId !== focusedTabId) {
			console.debug(`[adapter] transcript dropped: tab ${tabId} not focused`)
			return { ok: false, error: 'Tab not focused' }
		}

		const [allEndpoints, config] = await Promise.all([getEndpoints(), getLiveStreamConfig()])

		// Only send to explicitly selected endpoints; empty = no sending
		const targets =
			(config.endpointIds?.length ?? 0) > 0
				? allEndpoints.filter((e) => e.enabled && config.endpointIds.includes(e.id))
				: []
		if (targets.length === 0) return { ok: false, error: 'No endpoint selected' }

		const streamUrl = ''
		const variables: Record<string, string | number | boolean> = {
			'{{platform}}': chunk.platform,
			'{{videoId}}': chunk.videoId,
			'{{title}}': chunk.title,
			'{{channel}}': chunk.channelName,
			'{{text}}': chunk.text,
			'{{currentTime}}': chunk.currentTime ?? 0,
			'{{duration}}': chunk.duration ?? 0,
			'{{timestamp}}': new Date().toISOString(),
			'{{url}}': streamUrl,
		}

		const body = await compileTemplate(-1, config.transcriptBodyTemplate, variables, streamUrl)

		const results = await Promise.allSettled(targets.map((ep) => sendToEndpoint(ep, body)))

		// Record send history
		for (let i = 0; i < results.length; i++) {
			const r = results[i]
			const ep = targets[i]
			appendSendHistory({
				id: crypto.randomUUID(),
				timestamp: Date.now(),
				url: chunk.videoId ? `https://youtube.com/watch?v=${chunk.videoId}` : '',
				endpointName: ep.name || 'Unnamed',
				trigger: 'livestream',
				ok: r.status === 'fulfilled' && r.value.ok,
				status: r.status === 'fulfilled' ? r.value.status : 0,
				statusText: r.status === 'fulfilled' ? r.value.statusText : String(r.reason),
			}).catch(() => {})
		}

		const firstResult = results[0]
		return firstResult?.status === 'fulfilled'
			? firstResult.value
			: { ok: false, error: String((firstResult as PromiseRejectedResult)?.reason) }
	} catch (error) {
		return { ok: false, error: String(error) }
	}
}
