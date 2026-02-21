// Markdown converter adapted from Obsidian Web Clipper (MIT License)
// Simplified: removed MathML/LaTeX, ArXiv-specific rules

import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'
import { processUrls } from './string-utils'

function getElementHTML(element: Element): string {
	const serializer = new XMLSerializer()
	let result = ''
	Array.from(element.childNodes).forEach((node) => {
		if (node.nodeType === Node.ELEMENT_NODE) {
			result += serializer.serializeToString(node)
		} else if (node.nodeType === Node.TEXT_NODE) {
			result += node.textContent
		}
	})
	return result
}

export function createMarkdownContent(content: string, url: string): string {
	const baseUrl = new URL(url)
	const processedContent = processUrls(content, baseUrl)

	const turndownService = new TurndownService({
		headingStyle: 'atx',
		hr: '---',
		bulletListMarker: '-',
		codeBlockStyle: 'fenced',
		emDelimiter: '*',
		preformattedCode: true,
	})

	turndownService.use(gfm)

	turndownService.addRule('table', {
		filter: 'table',
		replacement(content, node) {
			if (!(node instanceof HTMLTableElement)) return content

			const hasComplexStructure = Array.from(node.querySelectorAll('td, th')).some(
				(cell) => cell.hasAttribute('colspan') || cell.hasAttribute('rowspan'),
			)

			if (hasComplexStructure) {
				return `\n\n${node.outerHTML}\n\n`
			}

			const rows = Array.from(node.rows).map((row) => {
				const cells = Array.from(row.cells).map((cell) => {
					let cellContent = turndownService
						.turndown(getElementHTML(cell))
						.replace(/\n/g, ' ')
						.trim()
					cellContent = cellContent.replace(/\|/g, '\\|')
					return cellContent
				})
				return `| ${cells.join(' | ')} |`
			})

			const separatorRow = `| ${Array(rows[0].split('|').length - 2)
				.fill('---')
				.join(' | ')} |`
			const tableContent = [rows[0], separatorRow, ...rows.slice(1)].join('\n')
			return `\n\n${tableContent}\n\n`
		},
	})

	turndownService.remove(['style', 'script', 'button'])
	turndownService.keep(['iframe', 'video', 'audio', 'sup', 'sub'])

	turndownService.addRule('list', {
		filter: ['ul', 'ol'],
		replacement(content: string, node: Node) {
			content = content.trim()
			const isTopLevel = !(
				node.parentNode &&
				(node.parentNode.nodeName === 'UL' || node.parentNode.nodeName === 'OL')
			)
			return `${(isTopLevel ? '\n' : '') + content}\n`
		},
	})

	turndownService.addRule('listItem', {
		filter: 'li',
		replacement(content: string, node: Node, options: TurndownService.Options) {
			if (!(node instanceof HTMLElement)) return content

			const isTaskListItem = node.classList.contains('task-list-item')
			const checkbox = node.querySelector('input[type="checkbox"]') as HTMLInputElement | null
			let taskListMarker = ''

			if (isTaskListItem && checkbox) {
				content = content.replace(/<input[^>]*>/, '')
				taskListMarker = checkbox.checked ? '[x] ' : '[ ] '
			}

			content = content
				.replace(/\n+$/, '')
				.split('\n')
				.filter((line) => line.length > 0)
				.join('\n\t')

			let prefix = `${options.bulletListMarker} `
			const parent = node.parentNode

			let level = 0
			let currentParent = node.parentNode
			while (
				currentParent &&
				(currentParent.nodeName === 'UL' || currentParent.nodeName === 'OL')
			) {
				level++
				currentParent = currentParent.parentNode
			}

			const indentLevel = Math.max(0, level - 1)
			prefix = '\t'.repeat(indentLevel) + prefix

			if (parent instanceof HTMLOListElement) {
				const start = parent.getAttribute('start')
				const index = Array.from(parent.children).indexOf(node as HTMLElement) + 1
				prefix = `${'\t'.repeat(level - 1) + (start ? Number(start) + index - 1 : index)}. `
			}

			return (
				prefix +
				taskListMarker +
				content.trim() +
				(node.nextSibling && !/\n$/.test(content) ? '\n' : '')
			)
		},
	})

	turndownService.addRule('figure', {
		filter: 'figure',
		replacement(content, node) {
			const figure = node as HTMLElement
			const img = figure.querySelector('img')
			const figcaption = figure.querySelector('figcaption')

			if (!img) return content

			const alt = img.getAttribute('alt') || ''
			const src = img.getAttribute('src') || ''
			const caption = figcaption ? figcaption.textContent?.trim() || '' : ''

			return `![${alt}](${src})${caption ? `\n\n${caption}` : ''}\n\n`
		},
	})

	turndownService.addRule('highlight', {
		filter: 'mark',
		replacement(content) {
			return `==${content}==`
		},
	})

	turndownService.addRule('strikethrough', {
		filter: (node: Node) =>
			node.nodeName === 'DEL' || node.nodeName === 'S' || node.nodeName === 'STRIKE',
		replacement(content) {
			return `~~${content}~~`
		},
	})

	turndownService.addRule('preformattedCode', {
		filter: (node) => node.nodeName === 'PRE',
		replacement(content, node) {
			if (!(node instanceof HTMLElement)) return content

			const codeElement = node.querySelector('code')
			if (!codeElement) return content

			const language = codeElement.getAttribute('data-lang') || ''
			const code = codeElement.textContent || ''
			const cleanCode = code.trim().replace(/`/g, '\\`')

			return `\n\`\`\`${language}\n${cleanCode}\n\`\`\`\n`
		},
	})

	turndownService.addRule('removeHiddenElements', {
		filter(node) {
			return node.style.display === 'none'
		},
		replacement() {
			return ''
		},
	})

	try {
		let markdown = turndownService.turndown(processedContent)

		// Remove the title from the beginning if it exists
		const titleMatch = markdown.match(/^# .+\n+/)
		if (titleMatch) {
			markdown = markdown.slice(titleMatch[0].length)
		}

		// Remove empty non-image links
		markdown = markdown.replace(/\n*(?<!!)\[]\([^)]+\)\n*/g, '')

		// Collapse excessive newlines
		markdown = markdown.replace(/\n{3,}/g, '\n\n')

		return markdown.trim()
	} catch (error) {
		console.error('Error converting HTML to Markdown:', error)
		return processedContent
	}
}
