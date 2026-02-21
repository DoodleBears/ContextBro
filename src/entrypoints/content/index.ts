import Defuddle from 'defuddle'
import type { ContentResponse } from '@/lib/content-extractor'
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

	return {
		content: defuddled.content || '',
		selectedHtml,
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
		wordCount: defuddled.wordCount || 0,
		metaTags: defuddled.metaTags || [],
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
