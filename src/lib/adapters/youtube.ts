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

export class YouTubeAdapter extends BaseAdapter {
	platform = 'youtube' as const
	private streamInfo: StreamInfo | null = null
	private transcriptCallbacks: ((chunk: TranscriptChunk) => void)[] = []
	private transcriptTimer: ReturnType<typeof setInterval> | null = null
	private lastTranscriptTime = 0
	private sentSegments = new Set<number>()
	private isLive = false

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
			this.startTranscriptTracking()
		}
	}

	destroy(): void {
		super.destroy()
		this.sentSegments.clear()
		if (this.transcriptTimer) {
			clearInterval(this.transcriptTimer)
			this.transcriptTimer = null
		}
	}

	protected async attach(): Promise<void> {
		// Only observe chat on live streams with chat enabled
		if (!this.isLive || !this.config.youtube.chat) return

		// Live chat may be in an iframe
		const target = await this.findChatContainer(15_000)
		if (!target) {
			console.debug('[youtube] Live chat container not found')
			return
		}

		// Main observer for new messages
		this.attachObserver(target, {
			childList: true,
			subtree: false,
		})

		// Deletion observer for is-deleted attribute
		this.attachDeletionObserver(target, {
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

		// Only emit if time has progressed past threshold
		if (currentTime <= this.lastTranscriptTime + this.config.transcript.progressThresholdS) return
		this.lastTranscriptTime = currentTime

		// Try transcript panel DOM first, then fall back to textTracks (CC/subtitles)
		const newText: string[] = []
		let segStartTime = 0
		let segEndTime = 0

		// Strategy 1: Transcript panel DOM (ytd-transcript-segment-renderer)
		const segments = document.querySelectorAll('ytd-transcript-segment-renderer')
		if (segments.length > 0) {
			for (const seg of segments) {
				const timeEl = seg.querySelector('.segment-timestamp')
				const textEl = seg.querySelector('.segment-text')
				if (!timeEl || !textEl) continue

				const segTime = this.parseTimestamp(timeEl.textContent?.trim() || '')
				if (segTime < currentTime - 5 || segTime > currentTime + 5) continue

				const roundedTime = Math.round(segTime)
				if (this.sentSegments.has(roundedTime)) continue

				this.sentSegments.add(roundedTime)
				newText.push(textEl.textContent?.trim() || '')

				if (!segStartTime || segTime < segStartTime) segStartTime = segTime
				if (segTime > segEndTime) segEndTime = segTime
			}
		}

		// Strategy 2: video.textTracks API (CC/subtitles)
		if (newText.length === 0 && video.textTracks) {
			for (let i = 0; i < video.textTracks.length; i++) {
				const track = video.textTracks[i]
				if (track.mode !== 'showing' || !track.activeCues) continue

				for (let j = 0; j < track.activeCues.length; j++) {
					const cue = track.activeCues[j] as VTTCue
					const roundedStart = Math.round(cue.startTime)
					if (this.sentSegments.has(roundedStart)) continue

					this.sentSegments.add(roundedStart)
					const text = cue.text?.replace(/<[^>]*>/g, '').trim()
					if (text) {
						newText.push(text)
						if (!segStartTime || cue.startTime < segStartTime) segStartTime = cue.startTime
						if (cue.endTime > segEndTime) segEndTime = cue.endTime
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

	private parseTimestamp(text: string): number {
		// Parse "1:23" or "1:23:45" into seconds
		const parts = text.split(':').map(Number)
		if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
		if (parts.length === 2) return parts[0] * 60 + parts[1]
		return parts[0] || 0
	}
}
