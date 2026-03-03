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
 * CatchAll rules are only returned when no pattern-based rules match.
 */
export function matchesSiteRules(url: string, rules: SiteRule[]): SiteRule[] {
	let hostname: string
	try {
		hostname = new URL(url).hostname
	} catch {
		return []
	}

	const patternMatches = rules.filter(
		(rule) => rule.enabled && !rule.catchAll && rule.patterns.some((p) => matchesPattern(hostname, p)),
	)

	if (patternMatches.length > 0) return patternMatches

	return rules.filter((rule) => rule.enabled && rule.catchAll)
}

/**
 * Check if a hostname matches any pattern-based (non-catchAll) enabled rule.
 * Used by scheduling modules to determine if catchAll rules should apply.
 */
export function isMatchedByPatternRules(hostname: string, rules: SiteRule[]): boolean {
	return rules.some(
		(r) => r.enabled && !r.catchAll && r.patterns.some((p) => matchesPattern(hostname, p)),
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
