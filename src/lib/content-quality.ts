import type { ContentResponse } from '@/lib/content-extractor'
import type { GlobalSettings } from '@/lib/types'

export interface ContentQualityResult {
	ok: boolean
	score: number
	reason: string
	textLength: number
	wordCount: number
}

interface ContentQualityConfig {
	minTextLength: number
	minWordCount: number
	minScore: number
}

/**
 * Evaluate whether extracted Defuddle content is valuable enough for catchAll auto-share.
 * This mirrors the Readability-style threshold idea from the test project:
 * - basic minimum text threshold
 * - plus lightweight quality signals to avoid nav/login/noise pages
 */
export function evaluateContentQuality(
	response: ContentResponse,
	config?: Partial<ContentQualityConfig>,
): ContentQualityResult {
	const plainText = getPlainText(response)
	const textLength = plainText.length
	const wordCount = response.wordCount || estimateWordCount(plainText)
	const merged = {
		minTextLength: 180,
		minWordCount: 20,
		minScore: 4,
		...config,
	}

	// Hard reject very short/noisy pages (equivalent to Readability low-content guard)
	if (textLength < 50 && wordCount < merged.minWordCount) {
		return {
			ok: false,
			score: 0,
			reason: 'too_short',
			textLength,
			wordCount,
		}
	}

	let score = 0

	// Main body signal
	if (textLength >= 500) score += 3
	else if (textLength >= 200) score += 2
	else if (textLength >= 100) score += 1

	// Defuddle word count signal
	if (wordCount >= 150) score += 2
	else if (wordCount >= 60) score += 1

	// Metadata completeness signal
	if ((response.title || '').trim().length >= 8) score += 1
	if ((response.description || '').trim().length >= 24) score += 1
	if ((response.author || '').trim().length > 0) score += 1

	// Accept if either substantial body or enough combined confidence
	const substantialBody = textLength >= merged.minTextLength
	const confidentStructure = score >= merged.minScore && wordCount >= merged.minWordCount
	const ok = substantialBody || confidentStructure

	return {
		ok,
		score,
		reason: ok ? 'valuable' : 'low_confidence',
		textLength,
		wordCount,
	}
}

export function getContentQualityConfig(settings: GlobalSettings): ContentQualityConfig {
	return {
		minTextLength: settings.contentQuality.minTextLength,
		minWordCount: settings.contentQuality.minWordCount,
		minScore: settings.contentQuality.minScore,
	}
}

function getPlainText(response: ContentResponse): string {
	const source = response.contentMarkdown || stripHtml(response.content || '')
	return source.replace(/\s+/g, ' ').trim()
}

function stripHtml(input: string): string {
	return input.replace(/<[^>]*>/g, ' ')
}

function estimateWordCount(text: string): number {
	if (!text) return 0
	const tokens = text.split(/\s+/).filter(Boolean)
	return tokens.length
}
