import { BaseAdapter } from './base'
import type { NormalizedChatMessage, StreamInfo, TranscriptChunk } from './types'

// ── Selectors (from SSN youtube.js patterns) ──

const CHAT_CONTAINER_SELECTOR = 'yt-live-chat-item-list-renderer #items'

const MESSAGE_TAG_NAMES: Record<string, NormalizedChatMessage['event']> = {
	'YT-LIVE-CHAT-TEXT-MESSAGE-RENDERER': 'message',
	'YT-LIVE-CHAT-PAID-MESSAGE-RENDERER': 'donation',
	'YT-LIVE-CHAT-PAID-STICKER-RENDERER': 'donation',
	'YT-LIVE-CHAT-MEMBERSHIP-ITEM-RENDERER': 'membership',
}

const GIFT_TAG_NAMES = [
	'YTD-SPONSORSHIPS-LIVE-CHAT-GIFT-PURCHASE-ANNOUNCEMENT-RENDERER',
	'YTD-SPONSORSHIPS-LIVE-CHAT-GIFT-REDEMPTION-ANNOUNCEMENT-RENDERER',
]

interface CaptionSegment {
	text: string
	startMs: number
	durationMs: number
}

export class YouTubeAdapter extends BaseAdapter {
	platform = 'youtube' as const
	private streamInfo: StreamInfo | null = null
	private transcriptCallbacks: ((chunk: TranscriptChunk) => void)[] = []
	private transcriptTimer: ReturnType<typeof setInterval> | null = null
	private lastTranscriptTime = 0
	private sentSegments = new Set<number>()
	private isLive = false
	private captionSegments: CaptionSegment[] = []
	private chatRetryTimer: ReturnType<typeof setInterval> | null = null
	private captionRetryTimer: ReturnType<typeof setInterval> | null = null
	private liveRetryTimer: ReturnType<typeof setInterval> | null = null

	match(url: URL): boolean {
		return (
			(url.hostname === 'www.youtube.com' || url.hostname === 'youtube.com') &&
			(url.pathname.startsWith('/watch') || url.pathname.startsWith('/live'))
		)
	}

	getStreamInfo(): StreamInfo | null {
		// Retry building stream info if channel name was empty (YouTube renders lazily)
		if (this.streamInfo && !this.streamInfo.channelName) {
			this.streamInfo = this.buildStreamInfo()
		}
		return this.streamInfo
	}

	onTranscript(cb: (chunk: TranscriptChunk) => void): void {
		this.transcriptCallbacks.push(cb)
	}

	async init(): Promise<void> {
		this.streamInfo = this.buildStreamInfo()
		this.isLive = this.detectLive()

		// super.init() loads config → starts flusher → calls attach()
		// attach() checks isLive + config.youtube.chat before waiting for chat container
		await super.init()

		if (this.config.youtube.transcript) {
			// Fetch full captions upfront via timedtext API, then track progressively
			await this.fetchCaptions()
			this.startTranscriptTracking()

			// If no captions found (e.g., ad playing or data not ready), retry periodically
			if (this.captionSegments.length === 0) {
				this.captionRetryTimer = setInterval(async () => {
					await this.fetchCaptions()
					if (this.captionSegments.length > 0 && this.captionRetryTimer) {
						clearInterval(this.captionRetryTimer)
						this.captionRetryTimer = null
						console.debug('[youtube] Captions fetched on retry')
					}
				}, 10_000)
			}
		}
	}

	destroy(): void {
		super.destroy()
		this.sentSegments.clear()
		if (this.transcriptTimer) {
			clearInterval(this.transcriptTimer)
			this.transcriptTimer = null
		}
		if (this.chatRetryTimer) {
			clearInterval(this.chatRetryTimer)
			this.chatRetryTimer = null
		}
		if (this.captionRetryTimer) {
			clearInterval(this.captionRetryTimer)
			this.captionRetryTimer = null
		}
		if (this.liveRetryTimer) {
			clearInterval(this.liveRetryTimer)
			this.liveRetryTimer = null
		}
	}

	protected async attach(): Promise<void> {
		if (!this.config.youtube.chat) return

		// If not detected as live yet (SPA navigation timing), retry periodically
		if (!this.isLive) {
			this.liveRetryTimer = setInterval(async () => {
				if (this.detectLive()) {
					this.isLive = true
					if (this.liveRetryTimer) {
						clearInterval(this.liveRetryTimer)
						this.liveRetryTimer = null
					}
					// Update streamInfo with fresh live status
					this.streamInfo = this.buildStreamInfo()
					console.debug('[youtube] Live detected on retry, attaching chat')
					await this.attachChat()
				}
			}, 5_000)
			return
		}

		await this.attachChat()
	}

	private async attachChat(): Promise<void> {
		// Live chat may be in an iframe
		const target = await this.findChatContainer(15_000)
		if (target) {
			this.observeChat(target)
			return
		}

		// Chat container not found — likely blocked by a pre-roll ad. Retry periodically.
		console.debug('[youtube] Live chat container not found, will retry (ad may be playing)')
		this.chatRetryTimer = setInterval(() => {
			const el =
				document.querySelector(CHAT_CONTAINER_SELECTOR) ||
				(document.querySelector('iframe#chatframe') as HTMLIFrameElement | null)?.contentDocument?.querySelector(
					CHAT_CONTAINER_SELECTOR,
				)
			if (el) {
				if (this.chatRetryTimer) {
					clearInterval(this.chatRetryTimer)
					this.chatRetryTimer = null
				}
				this.observeChat(el)
				console.debug('[youtube] Live chat container found on retry (ad ended)')
			}
		}, 5_000)
	}

	private observeChat(container: Element): void {
		this.attachObserver(container, {
			childList: true,
			subtree: false,
		})
		this.attachDeletionObserver(container, {
			attributes: true,
			attributeFilter: ['is-deleted'],
			subtree: true,
		})
	}

	protected parseMessageNode(node: Element): NormalizedChatMessage | null {
		const tagName = node.tagName

		// Gift purchase/redemption
		if (GIFT_TAG_NAMES.includes(tagName)) {
			return this.parseGiftMessage(node)
		}

		// Standard message types
		const eventType = MESSAGE_TAG_NAMES[tagName]
		if (!eventType) return null

		// Skip already-deleted messages
		if (node.hasAttribute('is-deleted')) return null

		// Skip already-processed
		const dataset = (node as HTMLElement).dataset
		if (dataset.contextBroProcessed) return null
		dataset.contextBroProcessed = '1'

		const nameEl = node.querySelector('#author-name')
		const displayName = nameEl?.textContent?.trim() || ''
		if (!displayName) return null

		const message =
			node.querySelector('#message, .seventv-yt-message-content')?.textContent?.trim() || ''

		// Avatar
		const avatarEl = node.querySelector(
			'#img[src], #author-photo img[src]',
		) as HTMLImageElement | null
		const avatarUrl = avatarEl?.src?.startsWith('data:') ? undefined : avatarEl?.src

		// Roles
		const roles = this.extractRoles(node, nameEl as Element)

		// Name color
		let nameColor: string | undefined
		if (roles.includes('moderator')) nameColor = '#5e84f1'
		else if (roles.includes('member')) nameColor = '#107516'

		// Badges
		const badges = this.extractBadges(node)

		// Paid message (Super Chat)
		const monetization = this.extractMonetization(node, tagName)

		// Membership
		const membership = this.extractMembership(node, tagName)

		// YouTube chat ID
		const liveChatId = node.id || ''

		return {
			platform: 'youtube',
			username: displayName.toLowerCase().replace(/\s+/g, ''),
			displayName,
			avatarUrl,
			nameColor,
			message: message || (monetization ? monetization.message || '' : ''),
			roles,
			badges,
			monetization: monetization || undefined,
			membership: membership || undefined,
			youtube: {
				liveChatId,
				isChatOwner: (nameEl as HTMLElement)?.classList?.contains('owner') || false,
				isChatSponsor: roles.includes('member'),
			},
			event: membership ? 'membership' : eventType,
			timestamp: Date.now(),
		}
	}

	protected handleDeletion(el: Element): void {
		if (!el.hasAttribute('is-deleted')) return
		const dataset = (el as HTMLElement).dataset
		if (dataset.contextBroDeleted) return
		dataset.contextBroDeleted = '1'
	}

	// ── Roles ──

	private extractRoles(el: Element, nameEl: Element | null): NormalizedChatMessage['roles'] {
		const roles: NormalizedChatMessage['roles'] = []

		el.querySelectorAll('yt-live-chat-author-badge-renderer[type]').forEach((badge) => {
			const type = badge.getAttribute('type')
			if (type === 'mod' && !roles.includes('moderator')) roles.push('moderator')
			if (type === 'member' && !roles.includes('member')) roles.push('member')
		})

		if (nameEl) {
			if (
				(nameEl as HTMLElement).classList?.contains('moderator') &&
				!roles.includes('moderator')
			) {
				roles.push('moderator')
			}
			if ((nameEl as HTMLElement).classList?.contains('member') && !roles.includes('member')) {
				roles.push('member')
			}
			if ((nameEl as HTMLElement).classList?.contains('owner') && !roles.includes('broadcaster')) {
				roles.push('broadcaster')
			}
		}

		return roles
	}

	// ── Badges ──

	private extractBadges(el: Element): NormalizedChatMessage['badges'] {
		const badges: NonNullable<NormalizedChatMessage['badges']> = []

		el.querySelectorAll('.yt-live-chat-author-badge-renderer img').forEach((img) => {
			let src = (img as HTMLImageElement).src?.trim() || ''
			// Upscale badge images
			src = src.replace(/=w16-h16-/g, '=w48-h48-').replace(/=s16-/g, '=s48-')
			badges.push({
				id: (img as HTMLImageElement).alt || 'badge',
				name: (img as HTMLImageElement).alt || 'badge',
				version: '1',
				imageUrl: src || undefined,
			})
		})

		return badges.length > 0 ? badges : undefined
	}

	// ── Monetization (Super Chat / Sticker) ──

	private extractMonetization(
		el: Element,
		tagName: string,
	): NormalizedChatMessage['monetization'] | null {
		if (tagName === 'YT-LIVE-CHAT-PAID-MESSAGE-RENDERER') {
			const amountEl = el.querySelector('#purchase-amount')
			const formattedAmount = amountEl?.textContent?.trim() || ''
			const amount = this.parseAmount(formattedAmount)

			return {
				type: 'superchat',
				amount,
				formattedAmount,
				message: el.querySelector('#message')?.textContent?.trim() || undefined,
			}
		}

		if (tagName === 'YT-LIVE-CHAT-PAID-STICKER-RENDERER') {
			const amountEl = el.querySelector('#purchase-amount-chip')
			const formattedAmount = amountEl?.textContent?.trim() || ''
			const amount = this.parseAmount(formattedAmount)

			return {
				type: 'supersticker',
				amount,
				formattedAmount,
			}
		}

		return null
	}

	// ── Membership ──

	private extractMembership(
		el: Element,
		tagName: string,
	): NormalizedChatMessage['membership'] | null {
		if (tagName !== 'YT-LIVE-CHAT-MEMBERSHIP-ITEM-RENDERER') return null

		const subtextEl = el.querySelector('#header-subtext, #header-primary-text')
		const text = subtextEl?.textContent?.trim() || ''
		const lowerText = text.toLowerCase()

		if (lowerText.includes('welcome to') || lowerText.includes('willkommen bei')) {
			return { type: 'new' }
		}

		if (lowerText.includes('upgraded')) {
			return { type: 'upgrade' }
		}

		// Resub with months
		const monthsMatch = text.match(/(\d+)\s+months?/i)
		if (monthsMatch) {
			return {
				type: 'resub',
				months: Number.parseInt(monthsMatch[1], 10),
			}
		}

		return { type: 'new' }
	}

	// ── Gift messages ──

	private parseGiftMessage(el: Element): NormalizedChatMessage | null {
		const primaryText = el.querySelector('#primary-text')
		const text = primaryText?.textContent?.trim() || el.textContent?.trim() || ''
		if (!text) return null

		const nameEl = el.querySelector('#author-name')
		const displayName = nameEl?.textContent?.trim() || 'System'

		const countMatch = text.match(/(\d+)/i)
		const giftCount = countMatch ? Number.parseInt(countMatch[1], 10) : 1

		const isRedemption = el.tagName.includes('REDEMPTION')

		return {
			platform: 'youtube',
			username: displayName.toLowerCase().replace(/\s+/g, ''),
			displayName,
			message: text,
			roles: [],
			monetization: isRedemption
				? undefined
				: {
						type: 'gift_sub',
						amount: giftCount * 5,
						formattedAmount: `${giftCount} Gifted`,
						giftCount,
					},
			membership: isRedemption ? { type: 'gift_received', gifterName: text } : undefined,
			youtube: { liveChatId: el.id || '' },
			event: isRedemption ? 'membership' : 'gift',
			timestamp: Date.now(),
		}
	}

	// ── Caption fetching (timedtext API) ──

	private async fetchCaptions(): Promise<void> {
		try {
			// Re-fetch page HTML to extract captionTracks from ytInitialPlayerResponse
			const html = await fetch(window.location.href).then((r) => r.text())
			const marker = '"captionTracks":'
			const start = html.indexOf(marker)
			if (start === -1) {
				console.debug('[youtube] No captionTracks found in page')
				return
			}

			// Extract JSON array by matching brackets
			let depth = 0
			let i = start + marker.length
			const begin = i
			for (; i < html.length; i++) {
				if (html[i] === '[') depth++
				if (html[i] === ']') depth--
				if (depth === 0) break
			}

			const tracks = JSON.parse(html.substring(begin, i + 1)) as {
				baseUrl: string
				languageCode: string
			}[]
			if (!tracks.length) return

			// Fetch first available track in json3 format
			const url = `${tracks[0].baseUrl}&fmt=json3`
			const data = await fetch(url).then((r) => r.json())

			this.captionSegments = (
				data.events as { tStartMs?: number; dDurationMs?: number; segs?: { utf8: string }[] }[]
			)
				.filter((e) => e.segs)
				.map((e) => ({
					text: (e.segs ?? []).map((s) => s.utf8).join('').trim(),
					startMs: e.tStartMs ?? 0,
					durationMs: e.dDurationMs ?? 0,
				}))
				.filter((s) => s.text.length > 0)

			console.debug(
				`[youtube] Fetched ${this.captionSegments.length} caption segments (${tracks[0].languageCode})`,
			)
		} catch (e) {
			console.debug('[youtube] Failed to fetch captions:', e)
		}
	}

	// ── Progressive transcript tracking ──

	private startTranscriptTracking(): void {
		this.transcriptTimer = setInterval(() => {
			this.checkTranscript()
		}, this.config.transcript.pollIntervalMs)
	}

	private checkTranscript(): void {
		const video = document.querySelector('video') as HTMLVideoElement | null
		if (!video) return

		const currentTime = video.currentTime
		const duration = video.duration

		// Detect seek backward — reset so we can emit unsent segments from the new position
		if (currentTime < this.lastTranscriptTime - 1) {
			this.lastTranscriptTime = currentTime
		}

		// Only emit if time has progressed past threshold (also gates paused state)
		if (currentTime <= this.lastTranscriptTime + this.config.transcript.progressThresholdS) return
		this.lastTranscriptTime = currentTime

		const newText: string[] = []
		let segStartTime = 0
		let segEndTime = 0
		const currentMs = currentTime * 1000

		// Strategy 1: Pre-fetched captions (most reliable for VODs)
		if (this.captionSegments.length > 0) {
			for (const seg of this.captionSegments) {
				// Segments are sorted by time — skip past-window ones
				if (seg.startMs + seg.durationMs < (currentMs - 10_000)) continue
				// Stop when we reach segments ahead of playback
				if (seg.startMs > currentMs) break

				const roundedStart = Math.round(seg.startMs / 1000)
				if (this.sentSegments.has(roundedStart)) continue

				this.sentSegments.add(roundedStart)
				newText.push(seg.text)

				const startSec = seg.startMs / 1000
				const endSec = (seg.startMs + seg.durationMs) / 1000
				if (!segStartTime || startSec < segStartTime) segStartTime = startSec
				if (endSec > segEndTime) segEndTime = endSec
			}
		}

		// Strategy 2: YouTube's caption overlay DOM (fallback for live streams)
		if (newText.length === 0) {
			const captionEls = document.querySelectorAll('.ytp-caption-segment')
			if (captionEls.length > 0) {
				const captionText = Array.from(captionEls)
					.map((el) => el.textContent?.trim())
					.filter(Boolean)
					.join(' ')

				if (captionText) {
					const roundedTime = Math.round(currentTime)
					if (!this.sentSegments.has(roundedTime)) {
						this.sentSegments.add(roundedTime)
						newText.push(captionText)
						segStartTime = currentTime
						segEndTime = currentTime
					}
				}
			}
		}

		// Safety prune: if set grows too large (very long video), trim older half
		if (this.sentSegments.size > 50_000) {
			const sorted = [...this.sentSegments].sort((a, b) => a - b)
			this.sentSegments = new Set(sorted.slice(sorted.length / 2))
		}

		if (newText.length === 0) return

		const videoId = new URL(window.location.href).searchParams.get('v') || ''

		const chunk: TranscriptChunk = {
			platform: 'youtube',
			videoId,
			title: this.streamInfo?.title || document.title,
			channelName: this.streamInfo?.channelName || '',
			text: newText.join(' '),
			startTime: segStartTime,
			endTime: segEndTime,
			currentTime,
			duration: Number.isFinite(duration) ? duration : undefined,
		}

		for (const cb of this.transcriptCallbacks) {
			try {
				cb(chunk)
			} catch (e) {
				console.error('[youtube] Transcript callback error:', e)
			}
		}
	}

	// ── Stream info ──

	private buildStreamInfo(): StreamInfo {
		const titleEl =
			document.querySelector('h1.ytd-watch-metadata yt-formatted-string') ||
			document.querySelector('#title h1')
		const channelEl =
			document.querySelector('#channel-name yt-formatted-string a') ||
			document.querySelector('#owner-name a')

		return {
			platform: 'youtube',
			channelName: channelEl?.textContent?.trim() || '',
			title: titleEl?.textContent?.trim() || document.title,
			isLive: this.detectLive(),
			url: window.location.href,
		}
	}

	private detectLive(): boolean {
		// Check for live badge or live chat
		return (
			!!document.querySelector('.ytp-live-badge[disabled]') ||
			!!document.querySelector('yt-live-chat-renderer') ||
			window.location.pathname.startsWith('/live')
		)
	}

	// ── Helpers ──

	private async findChatContainer(timeoutMs: number): Promise<Element | null> {
		const deadline = Date.now() + timeoutMs
		while (Date.now() < deadline) {
			// Try main page
			const el = document.querySelector(CHAT_CONTAINER_SELECTOR)
			if (el) return el

			// Try inside iframe
			const iframe = document.querySelector('iframe#chatframe') as HTMLIFrameElement | null
			if (iframe?.contentDocument) {
				const iframeEl = iframe.contentDocument.querySelector(CHAT_CONTAINER_SELECTOR)
				if (iframeEl) return iframeEl
			}

			await new Promise((r) => setTimeout(r, 500))
		}
		return null
	}

	private parseAmount(text: string): number {
		// Extract numeric value from formatted amounts like "$5.00", "€10,00", "¥500"
		const cleaned = text.replace(/[^0-9.,]/g, '').replace(',', '.')
		return Number.parseFloat(cleaned) || 0
	}
}
