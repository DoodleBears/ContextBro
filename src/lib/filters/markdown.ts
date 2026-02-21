import { strip_tags } from './strip_tags'

/**
 * Convert HTML to Markdown.
 *
 * Full Turndown-based conversion runs in the content script (which has DOM access)
 * and is already applied to {{content}} and {{selection}} variables.
 *
 * This filter provides a lightweight regex-based fallback so it works safely
 * in the background service worker (no DOMParser).
 */
export const markdown = (str: string, _param?: string): string => {
	if (!str) return str

	let result = str

	// Convert headings
	result = result.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, level, text) => {
		return `${'#'.repeat(Number(level))} ${text.trim()}\n\n`
	})

	// Convert links
	result = result.replace(/<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')

	// Convert images
	result = result.replace(/<img[^>]+alt="([^"]*)"[^>]+src="([^"]*)"[^>]*\/?>/gi, '![$1]($2)')
	result = result.replace(/<img[^>]+src="([^"]*)"[^>]*\/?>/gi, '![]($1)')

	// Convert bold and italic
	result = result.replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, '**$2**')
	result = result.replace(/<(em|i)>([\s\S]*?)<\/\1>/gi, '*$2*')

	// Convert code
	result = result.replace(/<code>([\s\S]*?)<\/code>/gi, '`$1`')
	result = result.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '\n```\n$1\n```\n')

	// Convert line breaks and paragraphs
	result = result.replace(/<br\s*\/?>/gi, '\n')
	result = result.replace(/<\/p>/gi, '\n\n')
	result = result.replace(/<p[^>]*>/gi, '')

	// Convert lists
	result = result.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n')
	result = result.replace(/<\/?[ou]l[^>]*>/gi, '\n')

	// Strip remaining HTML tags and decode entities
	result = strip_tags(result)

	// Collapse excessive newlines
	result = result.replace(/\n{3,}/g, '\n\n')

	return result.trim()
}
