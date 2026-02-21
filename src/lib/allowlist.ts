import type { AllowlistEntry, SiteRule } from '@/lib/types'

/**
 * Check if a URL matches any enabled allowlist entry.
 * Supports:
 * - Exact domain: "github.com"
 * - Wildcard subdomain: "*.reddit.com" (matches www.reddit.com, old.reddit.com, etc.)
 * - Localhost with port: "localhost:3000"
 */
export function matchesAllowlist(url: string, allowlist: AllowlistEntry[]): AllowlistEntry | null {
	let hostname: string
	try {
		hostname = new URL(url).hostname
	} catch {
		return null
	}

	for (const entry of allowlist) {
		if (!entry.enabled) continue
		if (matchesPattern(hostname, entry.pattern)) {
			return entry
		}
	}

	return null
}

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
 */
export function matchesSiteRules(url: string, rules: SiteRule[]): SiteRule | null {
	let hostname: string
	try {
		hostname = new URL(url).hostname
	} catch {
		return null
	}

	for (const rule of rules) {
		if (!rule.enabled) continue
		if (matchesPattern(hostname, rule.pattern)) {
			return rule
		}
	}

	return null
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
