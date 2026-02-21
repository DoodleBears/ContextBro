import dayjs from 'dayjs'
import { getDomain, sanitizeFileName } from './string-utils'

export interface MetaTag {
	name?: string | null
	property?: string | null
	content: string | null
}

export interface ContentResponse {
	content: string
	contentMarkdown: string
	selectedHtml: string
	selectionMarkdown: string
	schemaOrgData: any
	fullHtml: string
	title: string
	description: string
	domain: string
	favicon: string
	image: string
	parseTime: number
	published: string
	author: string
	site: string
	wordCount: number
	metaTags: MetaTag[]
}

/**
 * Build the template variables dictionary from extracted page content.
 * Keys use the {{name}} format expected by the template engine.
 */
export function buildVariables(response: ContentResponse, url: string): Record<string, string> {
	const variables: Record<string, string> = {}

	// Core page metadata
	variables['{{title}}'] = response.title || ''
	variables['{{author}}'] = response.author || ''
	variables['{{description}}'] = response.description || ''
	variables['{{site}}'] = response.site || ''
	variables['{{published}}'] = response.published || ''
	variables['{{domain}}'] = response.domain || getDomain(url)
	variables['{{image}}'] = response.image || ''
	variables['{{favicon}}'] = response.favicon || ''
	variables['{{url}}'] = url
	variables['{{wordCount}}'] = String(response.wordCount || 0)

	// Content — markdown pre-converted in content script (DOM required)
	variables['{{content}}'] = response.contentMarkdown || ''
	variables['{{contentHtml}}'] = response.content || ''
	variables['{{fullHtml}}'] = response.fullHtml || ''

	// Selection — markdown pre-converted in content script
	variables['{{selection}}'] = response.selectionMarkdown || ''
	variables['{{selectionHtml}}'] = response.selectedHtml || ''

	// Timestamps
	variables['{{date}}'] = dayjs().format('YYYY-MM-DD')
	variables['{{time}}'] = dayjs().format('HH:mm')

	// Derived
	variables['{{noteName}}'] = sanitizeFileName(response.title || 'Untitled')

	// Meta tags
	if (response.metaTags) {
		for (const tag of response.metaTags) {
			const content = tag.content || ''
			if (tag.name) {
				variables[`{{meta:name:${tag.name}}}`] = content
			}
			if (tag.property) {
				variables[`{{meta:property:${tag.property}}}`] = content
			}
		}
	}

	// Schema.org data — flatten into variables
	if (response.schemaOrgData) {
		addSchemaOrgDataToVariables(response.schemaOrgData, variables)
	}

	return variables
}

/**
 * Recursively flatten Schema.org JSON-LD data into template variables.
 * e.g., { "@type": "Article", "headline": "Hello" }
 * becomes: variables["{{schema:@Article:headline}}"] = "Hello"
 */
function addSchemaOrgDataToVariables(
	schemaData: any,
	variables: Record<string, string>,
	prefix = '',
): void {
	if (!schemaData || typeof schemaData !== 'object') return

	// Handle arrays of schema objects (e.g., @graph)
	const items = Array.isArray(schemaData) ? schemaData : [schemaData]

	for (const item of items) {
		if (!item || typeof item !== 'object') continue

		const type = item['@type']
		const itemPrefix = prefix || (type ? `@${type}` : '')

		for (const [key, value] of Object.entries(item)) {
			if (key === '@type' || key === '@context') continue

			const fullKey = itemPrefix ? `${itemPrefix}:${key}` : key

			if (Array.isArray(value)) {
				// Store the whole array as JSON
				variables[`{{schema:${fullKey}}}`] = JSON.stringify(value)
				// Also flatten individual items
				for (let i = 0; i < value.length; i++) {
					const arrayItem = value[i]
					if (typeof arrayItem === 'object' && arrayItem !== null) {
						for (const [subKey, subValue] of Object.entries(arrayItem)) {
							if (subKey === '@type' || subKey === '@context') continue
							variables[`{{schema:${fullKey}[${i}].${subKey}}}`] = String(subValue ?? '')
						}
					} else {
						variables[`{{schema:${fullKey}[${i}]}}`] = String(arrayItem ?? '')
					}
				}
			} else if (typeof value === 'object' && value !== null) {
				// Nested object — recurse
				addSchemaOrgDataToVariables(value, variables, fullKey)
			} else {
				variables[`{{schema:${fullKey}}}`] = String(value ?? '')
			}
		}
	}
}

/**
 * Extract page content from a tab by sending a message to the content script.
 * Returns the ContentResponse or null if extraction fails.
 */
export async function extractPageContent(tabId: number): Promise<ContentResponse | null> {
	try {
		const response = (await browser.tabs.sendMessage(tabId, {
			action: 'getPageContent',
		})) as ContentResponse | undefined

		if (!response) {
			console.error('No response from content script')
			return null
		}

		return response
	} catch (error) {
		console.error('Failed to extract page content:', error)
		return null
	}
}

/**
 * Extract content by CSS selector from a tab's content script.
 */
export async function extractContentBySelector(
	tabId: number,
	selector: string,
	attribute?: string,
	extractHtml = false,
): Promise<string | string[] | undefined> {
	try {
		const response = (await browser.tabs.sendMessage(tabId, {
			action: 'extractContent',
			selector,
			attribute,
			extractHtml,
		})) as { content: string | string[] } | undefined

		return response?.content
	} catch (error) {
		console.error('Error extracting content by selector:', error)
		return undefined
	}
}
