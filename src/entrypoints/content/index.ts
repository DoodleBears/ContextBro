import Defuddle from 'defuddle'
import type { ContentResponse } from '@/lib/content-extractor'
import { createMarkdownContent } from '@/lib/markdown-converter'
import { getDomain } from '@/lib/string-utils'

export default defineContentScript({
	matches: ['<all_urls>'],
	runAt: 'document_idle',
	main() {
		browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
			if (message.action === 'ping') {
				sendResponse({})
				return
			}

			if (message.action === 'getPageContent') {
				const response = getPageContent()
				sendResponse(response)
				return
			}

			if (message.action === 'extractContent') {
				const result = extractContentBySelector(
					message.selector,
					message.attribute,
					message.extractHtml,
				)
				sendResponse({ content: result })
				return
			}
		})

		initRealtimeDetection()
	},
})

/**
 * Extract the main page content using Defuddle and gather metadata.
 */
function getPageContent(): ContentResponse {
	// Capture user's current selection
	const selection = window.getSelection()
	let selectedHtml = ''
	if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
		const container = document.createElement('div')
		for (let i = 0; i < selection.rangeCount; i++) {
			container.appendChild(selection.getRangeAt(i).cloneContents())
		}
		selectedHtml = container.innerHTML
	}

	// Run Defuddle to extract main content
	const defuddled = new Defuddle(document, { url: document.URL }).parse()

	// Build a clean full HTML (no scripts/styles)
	const fullHtml = getCleanFullHtml()

	// Convert HTML to Markdown here (content script has DOM access)
	// Prefer Defuddle, but fall back to multi-stage extraction when result looks weak/noisy.
	let contentHtml = defuddled.content || ''
	if (isWeakOrNoisyExtractedHtml(contentHtml)) {
		const fallbackHtml = extractByContainerScoring()
		if (
			getTextLengthFromHtml(fallbackHtml) > getTextLengthFromHtml(contentHtml) ||
			!isWeakOrNoisyExtractedHtml(fallbackHtml)
		) {
			contentHtml = fallbackHtml
		}
	}
	if (isWeakOrNoisyExtractedHtml(contentHtml)) {
		const metadataFallback = extractFromMetadata(defuddled)
		if (getTextLengthFromHtml(metadataFallback) > getTextLengthFromHtml(contentHtml)) {
			contentHtml = metadataFallback
		}
	}

	const contentMarkdown = contentHtml ? createMarkdownContent(contentHtml, document.URL) : ''
	const selectionMarkdown = selectedHtml ? createMarkdownContent(selectedHtml, document.URL) : ''
	const extractedWordCount = estimateWordCount((contentMarkdown || '').replace(/\s+/g, ' ').trim())

	return {
		content: contentHtml,
		contentMarkdown,
		selectedHtml,
		selectionMarkdown,
		schemaOrgData: defuddled.schemaOrgData || null,
		fullHtml,
		title: defuddled.title || document.title || '',
		description: defuddled.description || '',
		domain: defuddled.domain || getDomain(document.URL),
		favicon: defuddled.favicon || '',
		image: defuddled.image || '',
		parseTime: defuddled.parseTime || 0,
		published: defuddled.published || '',
		author: defuddled.author || '',
		site: defuddled.site || '',
		wordCount: Math.max(defuddled.wordCount || 0, extractedWordCount),
		metaTags: defuddled.metaTags || [],
	}
}

/**
 * A weak extraction typically indicates shell/nav-heavy pages or JS-heavy layouts
 * where the main article content is not well captured by generic extraction.
 */
function isWeakOrNoisyExtractedHtml(html: string): boolean {
	const text = getTextFromHtml(html)
	if (text.length < 260) return true
	return isLikelyUiPromptText(text)
}

function getTextLengthFromHtml(html: string): number {
	return getTextFromHtml(html).length
}

function getTextFromHtml(html: string): string {
	if (!html) return ''
	const doc = new DOMParser().parseFromString(html, 'text/html')
	return (doc.body?.textContent || '').replace(/\s+/g, ' ').trim()
}

/**
 * Readability-like fallback:
 * 1) Collect likely article containers
 * 2) Remove obvious boilerplate nodes
 * 3) Score by text amount, paragraph/sentence richness, and link density penalty
 * 4) Return the best container's HTML
 */
function extractByContainerScoring(): string {
	const selectors = [
		'article',
		'main',
		'[role="main"]',
		'section',
		'.article',
		'.article-body',
		'.article-content',
		'.post-content',
		'.entry-content',
		'.content',
		'.markdown',
		'.prose',
		'#content',
		'#main',
	]

	const seen = new Set<Element>()
	const candidates: Element[] = []

	for (const selector of selectors) {
		for (const el of document.querySelectorAll(selector)) {
			if (!seen.has(el)) {
				seen.add(el)
				candidates.push(el)
			}
		}
	}

	// Ensure at least one fallback candidate.
	if (candidates.length === 0 && document.body) {
		candidates.push(document.body)
	}
	for (const el of document.querySelectorAll('section, div')) {
		if (seen.has(el)) continue
		const textLen = ((el.textContent || '').replace(/\s+/g, ' ').trim()).length
		if (textLen >= 260) {
			seen.add(el)
			candidates.push(el)
		}
	}

	let bestHtml = ''
	let bestScore = Number.NEGATIVE_INFINITY

	for (const candidate of candidates) {
		const clone = candidate.cloneNode(true) as HTMLElement
		pruneBoilerplate(clone)

		const text = (clone.textContent || '').replace(/\s+/g, ' ').trim()
		if (text.length < 140) continue

		const pCount = clone.querySelectorAll('p').length
		const sentenceCount = (text.match(/[。！？!?\.](?:\s|$)/g) || []).length

		let linkTextLength = 0
		for (const a of clone.querySelectorAll('a')) {
			linkTextLength += ((a.textContent || '').replace(/\s+/g, ' ').trim()).length
		}
		const linkDensity = text.length > 0 ? linkTextLength / text.length : 1

		const idClass = `${candidate.id || ''} ${(candidate.className || '').toString()}`
		const lower = idClass.toLowerCase()
		const positiveHint = /(article|content|post|entry|markdown|prose|story|read)/.test(lower)
		const negativeHint = /(nav|menu|sidebar|aside|comment|footer|header|toolbar|actions|widget|controls)/.test(
			lower,
		)

		let score = 0
		score += text.length
		score += pCount * 90
		score += sentenceCount * 24
		score -= linkDensity * text.length * 0.9
		if (positiveHint) score += 220
		if (negativeHint) score -= 260

		if (score > bestScore) {
			bestScore = score
			bestHtml = clone.innerHTML
		}
	}

	return bestHtml
}

function isLikelyUiPromptText(text: string): boolean {
	const lower = text.toLowerCase()
	const noisePhrases = [
		'highlight & ask',
		'add context',
		'try asking',
		'assistant',
		'my notes',
		'comments',
		'similar',
		'hide tools',
		'ctrl + /',
	]
	let hits = 0
	for (const phrase of noisePhrases) {
		if (lower.includes(phrase)) hits++
	}
	return hits >= 2
}

function extractFromMetadata(defuddled: ReturnType<Defuddle['parse']>): string {
	const blocks: string[] = []
	if (defuddled.description) {
		blocks.push(`<p>${escapeHtml(defuddled.description)}</p>`)
	}
	const schemaText = getSchemaText(defuddled.schemaOrgData)
	if (schemaText) {
		blocks.push(`<p>${escapeHtml(schemaText)}</p>`)
	}
	return blocks.join('\n')
}

function getSchemaText(schema: unknown): string {
	if (!schema) return ''
	const values: string[] = []
	const stack: unknown[] = [schema]
	while (stack.length > 0) {
		const current = stack.pop()
		if (!current) continue
		if (Array.isArray(current)) {
			for (const item of current) stack.push(item)
			continue
		}
		if (typeof current === 'object') {
			const rec = current as Record<string, unknown>
			for (const [key, val] of Object.entries(rec)) {
				if (key === 'description' || key === 'abstract' || key === 'articleBody') {
					if (typeof val === 'string' && val.trim()) values.push(val.trim())
				} else if (typeof val === 'object') {
					stack.push(val)
				}
			}
		}
	}
	const unique = Array.from(new Set(values))
	return unique.join('\n\n')
}

function estimateWordCount(text: string): number {
	if (!text) return 0
	return text.split(/\s+/).filter(Boolean).length
}

function escapeHtml(input: string): string {
	return input
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
}

function pruneBoilerplate(root: ParentNode): void {
	const junkSelectors = [
		'script',
		'style',
		'noscript',
		'nav',
		'header',
		'footer',
		'aside',
		'form',
		'button',
		'input',
		'select',
		'textarea',
		'[role="navigation"]',
		'[aria-hidden="true"]',
		'.sidebar',
		'.menu',
		'.toc',
		'.comments',
		'.comment',
		'.share',
		'.social',
		'.ads',
		'.advertisement',
	]
	for (const selector of junkSelectors) {
		for (const node of root.querySelectorAll(selector)) {
			node.remove()
		}
	}
}

/**
 * Get a cleaned version of the full page HTML (scripts and styles removed).
 */
function getCleanFullHtml(): string {
	const doc = new DOMParser().parseFromString(document.documentElement.outerHTML, 'text/html')

	// Remove all script and style elements
	for (const el of doc.querySelectorAll('script, style')) {
		el.remove()
	}

	// Remove inline style attributes
	for (const el of doc.querySelectorAll('[style]')) {
		el.removeAttribute('style')
	}

	// Convert relative URLs to absolute
	const baseUrl = new URL(document.URL)
	for (const el of doc.querySelectorAll('[src]')) {
		const src = el.getAttribute('src')
		if (src) {
			try {
				el.setAttribute('src', new URL(src, baseUrl).href)
			} catch {
				// leave as-is if URL parsing fails
			}
		}
	}
	for (const el of doc.querySelectorAll('[href]')) {
		const href = el.getAttribute('href')
		if (href) {
			try {
				el.setAttribute('href', new URL(href, baseUrl).href)
			} catch {
				// leave as-is
			}
		}
	}

	return doc.documentElement.outerHTML
}

/**
 * Extract content from the live DOM using a CSS selector.
 * Supports attribute extraction and HTML mode.
 */
function extractContentBySelector(
	selector: string,
	attribute?: string,
	extractHtml = false,
): string | string[] {
	try {
		const elements = document.querySelectorAll(selector)
		if (elements.length === 0) return ''

		const results: string[] = []
		for (const el of elements) {
			if (attribute) {
				results.push(el.getAttribute(attribute) || '')
			} else if (extractHtml) {
				results.push(el.outerHTML)
			} else {
				results.push(el.textContent?.trim() || '')
			}
		}

		// Return single string if one result, array if multiple
		return results.length === 1 ? results[0] : results
	} catch (error) {
		console.error('Error in extractContentBySelector:', error)
		return ''
	}
}

// ── Realtime detection: push lightweight page-event notifications to background ──

/**
 * Send a lightweight "contentReady" signal to background.
 * Contains only the URL and event type — no page content — so the
 * background can decide whether to trigger a full Defuddle extraction
 * based on site rules.
 */
function notifyContentReady(event: 'load' | 'spa_navigation' | 'visibility_change'): void {
	const url = window.location.href
	if (!url.startsWith('http://') && !url.startsWith('https://')) return

	browser.runtime
		.sendMessage({ action: 'contentReady', url, event })
		.catch(() => {})
}

/**
 * Set up proactive page-event detection for realtime mode.
 * Detects page load, SPA navigation (pushState/replaceState), and visibility changes.
 */
function initRealtimeDetection(): void {
	let lastNotifiedUrl = ''
	let debounceTimer: ReturnType<typeof setTimeout> | null = null

	function debouncedNotify(event: 'load' | 'spa_navigation' | 'visibility_change', delayMs = 1000): void {
		if (debounceTimer) clearTimeout(debounceTimer)
		debounceTimer = setTimeout(() => {
			const currentUrl = window.location.href
			if (event === 'load' && currentUrl === lastNotifiedUrl) return
			lastNotifiedUrl = currentUrl
			notifyContentReady(event)
		}, delayMs)
	}

	// Page load detection
	if (document.readyState === 'complete') {
		debouncedNotify('load')
	} else {
		window.addEventListener('load', () => debouncedNotify('load'))
	}

	// Visibility change — re-notify when tab becomes visible
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'visible') {
			debouncedNotify('visibility_change', 500)
		}
	})

	// SPA navigation detection via MutationObserver
	let lastObservedUrl = window.location.href
	const urlObserver = new MutationObserver(() => {
		const currentUrl = window.location.href
		if (currentUrl !== lastObservedUrl) {
			lastObservedUrl = currentUrl
			lastNotifiedUrl = ''
			debouncedNotify('spa_navigation', 1500)
		}
	})

	if (document.body) {
		urlObserver.observe(document.body, { childList: true, subtree: true })
	}
}
