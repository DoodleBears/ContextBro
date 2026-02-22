import type { SiteRule } from '@/lib/types'

export function matchesPattern(hostname: string, pattern: string): boolean {
	const normalizedPattern = pattern.toLowerCase().trim()
	const normalizedHost = hostname.toLowerCase()

	// Wildcard subdomain: *.example.com
	if (normalizedPattern.startsWith('*.')) {
		const baseDomain = normalizedPattern.slice(2)
		return normalizedHost === baseDomain || normalizedHost.endsWith(`.${baseDomain}`)
	}

	// Exact match
	return normalizedHost === normalizedPattern
}

/**
 * Check if a URL matches any enabled site rule.
 * Returns all matching rules (a URL can match multiple rules).
 */
export function matchesSiteRules(url: string, rules: SiteRule[]): SiteRule[] {
	let hostname: string
	try {
		hostname = new URL(url).hostname
	} catch {
		return []
	}

	return rules.filter(
		(rule) => rule.enabled && rule.patterns.some((p) => matchesPattern(hostname, p)),
	)
}

/** Built-in allowlist presets for quick setup */
export const ALLOWLIST_PRESETS: Record<string, { label: string; patterns: string[] }> = {
	dev: {
		label: 'Dev',
		patterns: [
			'github.com',
			'*.stackoverflow.com',
			'developer.mozilla.org',
			'docs.python.org',
			'docs.rs',
			'pkg.go.dev',
			'npmjs.com',
		],
	},
	news: {
		label: 'News',
		patterns: [
			'news.ycombinator.com',
			'*.bbc.com',
			'*.reuters.com',
			'arstechnica.com',
			'techcrunch.com',
			'theverge.com',
		],
	},
	social: {
		label: 'Social',
		patterns: ['*.reddit.com', 'twitter.com', 'x.com', '*.mastodon.social', 'bsky.app'],
	},
	streaming: {
		label: 'Streaming',
		patterns: ['*.twitch.tv', '*.youtube.com', 'youtu.be'],
	},
}
