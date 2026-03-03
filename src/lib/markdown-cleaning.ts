import type { GlobalSettings } from '@/lib/types'

export function applyMarkdownCleaning(markdown: string, settings: GlobalSettings): string {
	const policy = settings.contentCleaning.markdownLinkPolicy
	if (!markdown || policy === 'keep') return markdown

	if (policy === 'text_only') {
		return stripMarkdownUrlsKeepText(markdown)
	}

	if (policy === 'domain_only') {
		return reduceMarkdownUrlsToDomain(markdown)
	}

	return markdown
}

function stripMarkdownUrlsKeepText(markdown: string): string {
	let output = markdown
	// Images: ![alt](url) -> [image: alt] / [image]
	output = output.replace(/!\[((?:\\.|[^\]\\])*)\]\(([^)]+)\)/g, (_m, alt: string) => {
		const cleanedAlt = (alt || '').trim()
		return cleanedAlt ? `[image: ${cleanedAlt}]` : '[image]'
	})
	// Links: [text](url) -> [text] (supports escaped brackets in text)
	output = output.replace(/\[((?:\\.|[^\]\\])*)\]\(([^)]+)\)/g, '[$1]')
	// Autolink: <https://...> -> ''
	output = output.replace(/<https?:\/\/[^>]+>/g, '')
	// Bare URL -> ''
	output = output.replace(/\bhttps?:\/\/[^\s)]+/g, '')
	return output
}

function reduceMarkdownUrlsToDomain(markdown: string): string {
	let output = markdown
	output = output.replace(/!\[((?:\\.|[^\]\\])*)\]\(([^)]+)\)/g, (_m, alt: string, url: string) => {
		const root = toRootUrl(url)
		return root ? `![${alt}](${root})` : `![${alt}]`
	})
	output = output.replace(/\[((?:\\.|[^\]\\])*)\]\(([^)]+)\)/g, (_m, text: string, url: string) => {
		const root = toRootUrl(url)
		return root ? `[${text}](${root})` : text
	})
	output = output.replace(/<https?:\/\/[^>]+>/g, (m) => {
		const url = m.slice(1, -1)
		const root = toRootUrl(url)
		return root ? `<${root}>` : ''
	})
	output = output.replace(/\bhttps?:\/\/[^\s)]+/g, (url) => toRootUrl(url) || '')
	return output
}

function toRootUrl(raw: string): string | null {
	try {
		const url = new URL(raw)
		return `${url.protocol}//${url.host}/`
	} catch {
		return null
	}
}
