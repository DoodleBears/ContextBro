import { sendToEndpoint } from '@/lib/api/send'
import { buildVariables, extractPageContent } from '@/lib/content-extractor'
import { compileTemplate } from '@/lib/template-engine/compiler'
import type { ContextBroTemplate, Endpoint } from '@/lib/types'

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
	})
})

/**
 * Extract page content, compile template, and send to the default endpoint.
 */
async function shareFromTab(tabId: number): Promise<void> {
	try {
		// Ensure content script is injected
		await ensureContentScript(tabId)

		const endpoints = await getEndpoints()
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
	const result = await browser.storage.local.get('endpoints')
	return (result.endpoints as Endpoint[]) || []
}

async function getTemplate(templateId?: string): Promise<ContextBroTemplate> {
	if (!templateId || templateId === 'default') {
		return DEFAULT_TEMPLATE
	}

	const result = await browser.storage.local.get('templates')
	const templates = (result.templates as ContextBroTemplate[]) || []
	return templates.find((t) => t.id === templateId) || DEFAULT_TEMPLATE
}
