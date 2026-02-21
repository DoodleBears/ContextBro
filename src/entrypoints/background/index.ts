import type { ChatBatch, StreamInfo, TranscriptChunk } from '@/lib/adapters/types'
import { matchesSiteRules } from '@/lib/allowlist'
import { sendToEndpoint } from '@/lib/api/send'
import { buildVariables, extractPageContent } from '@/lib/content-extractor'
import { migrateV1ToV2 } from '@/lib/migration'
import { initScheduler, updateGlobalSettings, updateSiteRules } from '@/lib/scheduler'
import { getEndpoints as getEndpointsFromStorage, getSiteRules } from '@/lib/storage'
import { compileTemplate } from '@/lib/template-engine/compiler'
import type { ContextBroTemplate, Endpoint, GlobalSettings, SiteRule } from '@/lib/types'

const DEFAULT_TEMPLATE: ContextBroTemplate = {
	id: 'default',
	name: 'Default',
	contentFormat: `{
  "title": "{{title}}",
  "url": "{{url}}",
  "content": "{{content}}",
  "author": "{{author}}",
  "published": "{{published}}",
  "domain": "{{domain}}",
  "description": "{{description}}",
  "wordCount": {{wordCount}},
  "clippedAt": "{{date}} {{time}}"
}`,
}

export default defineBackground(() => {
	console.log('Context Bro background service worker started')

	// Run migration before initializing scheduler
	migrateV1ToV2().then((migrated) => {
		if (migrated) console.debug('[background] Storage migration completed')
	})

	// Initialize the scheduled extraction system
	initScheduler({
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

		if (message.action === 'compilePreview') {
			handleCompilePreview(message.tabId, message.templateId).then(sendResponse)
			return true
		}

		if (message.action === 'updateSiteRules') {
			updateSiteRules(message.siteRules as SiteRule[]).then(sendResponse)
			return true
		}

		if (message.action === 'updateGlobalSettings') {
			updateGlobalSettings(message.globalSettings as GlobalSettings).then(sendResponse)
			return true
		}

		// ── Adapter messages ──

		if (message.action === 'adapterActive') {
			handleAdapterActive(message.platform, message.streamInfo)
			return false
		}

		if (message.action === 'adapterInactive') {
			handleAdapterInactive(message.platform)
			return false
		}

		if (message.action === 'adapterChatBatch') {
			handleChatBatch(message.batch).then(sendResponse)
			return true
		}

		if (message.action === 'adapterTranscript') {
			handleTranscript(message.chunk).then(sendResponse)
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
		const matchedRule = url ? matchesSiteRules(url, siteRules) : null

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

const activeAdapters = new Map<string, StreamInfo | null>()

function handleAdapterActive(platform: string, streamInfo: StreamInfo | null): void {
	activeAdapters.set(platform, streamInfo || null)
	updateBadge()
	console.debug(`[adapter] ${platform} active:`, streamInfo?.title || 'unknown')
}

function handleAdapterInactive(platform: string): void {
	activeAdapters.delete(platform)
	updateBadge()
	console.debug(`[adapter] ${platform} inactive`)
}

function updateBadge(): void {
	if (activeAdapters.size > 0) {
		browser.action.setBadgeText({ text: '📡' })
		browser.action.setBadgeBackgroundColor({ color: '#10b981' })
	} else {
		browser.action.setBadgeText({ text: '' })
	}
}

async function handleChatBatch(batch: ChatBatch) {
	try {
		const endpoints = await getEndpoints()
		const defaultEndpoint = endpoints.find((e) => e.enabled)
		if (!defaultEndpoint) return { ok: false, error: 'No endpoint' }

		// Build batch-specific variables
		const messagesForJson = batch.messages.map((m) => ({
			user: m.displayName,
			message: m.message,
			roles: m.roles,
			event: m.event,
			monetization: m.monetization || undefined,
		}))

		const body = JSON.stringify({
			event_type: 'live_stream',
			platform: batch.platform,
			channel: batch.channelName,
			title: batch.streamInfo?.title || '',
			category: batch.streamInfo?.category || '',
			viewers: batch.streamInfo?.viewerCount || 0,
			isLive: batch.streamInfo?.isLive ?? true,
			totalMessages: batch.totalCount,
			sampledMessages: batch.sampledCount,
			messages: messagesForJson,
			donations: batch.donations,
			memberships: batch.memberships,
			timestamp: new Date().toISOString(),
		})

		const result = await sendToEndpoint(defaultEndpoint, body)
		return result
	} catch (error) {
		return { ok: false, error: String(error) }
	}
}

async function handleTranscript(chunk: TranscriptChunk) {
	try {
		const endpoints = await getEndpoints()
		const defaultEndpoint = endpoints.find((e) => e.enabled)
		if (!defaultEndpoint) return { ok: false, error: 'No endpoint' }

		const body = JSON.stringify({
			event_type: 'transcript',
			platform: chunk.platform,
			videoId: chunk.videoId,
			title: chunk.title,
			channel: chunk.channelName,
			text: chunk.text,
			currentTime: chunk.currentTime,
			duration: chunk.duration,
			timestamp: new Date().toISOString(),
		})

		const result = await sendToEndpoint(defaultEndpoint, body)
		return result
	} catch (error) {
		return { ok: false, error: String(error) }
	}
}
