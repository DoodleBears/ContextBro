import { BaseAdapter } from './base'
import type { ChatRole, NormalizedChatMessage, StreamInfo } from './types'

// ── Cascading selectors (native Twitch → 7TV → FFZ) ──

const CHAT_CONTAINER_SELECTORS = ['.chat-list--other', '.chat-list--default', '.chat-room__content']

const MESSAGE_SELECTORS =
	'.chat-line__message, .seventv-message, .paid-pinned-chat-message-content-wrapper'

const DISPLAY_NAME_SELECTORS =
	'.chat-author__display-name, .chatter-name, .seventv-chat-user-username'

const MESSAGE_BODY_SELECTORS =
	".seventv-chat-message-body, .seventv-message-context, [data-a-target='chat-line-message-body'], .message"

const BADGE_SELECTORS =
	'img.chat-badge[src], img.chat-badge[srcset], .seventv-chat-badge>img[src], .seventv-chat-badge>img[srcset], .ffz-badge'

const BITS_SELECTORS = '.chat-line__message--cheer-amount'

export class TwitchAdapter extends BaseAdapter {
	platform = 'twitch' as const
	private streamInfo: StreamInfo | null = null
	private channelName = ''

	match(url: URL): boolean {
		return url.hostname === 'www.twitch.tv' || url.hostname === 'twitch.tv'
	}

	getStreamInfo(): StreamInfo | null {
		return this.streamInfo
	}

	protected async attach(): Promise<void> {
		if (!this.config.twitch.chat) return

		this.channelName = this.extractChannelName()
		this.streamInfo = this.buildStreamInfo()

		const target = await this.waitForElement(CHAT_CONTAINER_SELECTORS, 10_000)
		if (!target) {
			console.debug('[twitch] Chat container not found')
			return
		}

		// 7TV changes DOM structure, need broader attribute observation
		const has7TV = !!document.querySelector('seventv-container')

		this.attachObserver(target, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: has7TV ? ['data-a-target', 'class'] : ['data-a-target'],
		})
	}

	protected parseMessageNode(node: Element): NormalizedChatMessage | null {
		// Check if this is actually a chat message
		const messageEl = node.matches(MESSAGE_SELECTORS) ? node : node.querySelector(MESSAGE_SELECTORS)
		if (!messageEl) return null

		// Skip already-processed or deleted nodes
		const dataset = (messageEl as HTMLElement).dataset
		if (dataset.contextBroProcessed) return null
		if (messageEl.querySelector('.deleted, [data-a-target="chat-deleted-message-placeholder"]'))
			return null
		dataset.contextBroProcessed = '1'

		// Check for event messages (sub, gift, raid)
		if (this.isEventMessage(messageEl)) {
			return this.parseEventMessage(messageEl)
		}

		return this.parseChatMessage(messageEl)
	}

	protected handleAttributeMutation(mutation: MutationRecord): void {
		const target = mutation.target as Element
		if (
			mutation.attributeName === 'class' &&
			(target as HTMLElement).classList?.contains('deleted')
		) {
			this.markDeleted(target)
		}
		if (
			mutation.attributeName === 'data-a-target' &&
			(target as HTMLElement).dataset?.aTarget === 'chat-deleted-message-placeholder'
		) {
			this.markDeleted(target)
		}
	}

	// ── Chat message parsing ──

	private parseChatMessage(el: Element): NormalizedChatMessage | null {
		const nameEl = el.querySelector(DISPLAY_NAME_SELECTORS)
		if (!nameEl) return null

		const displayName = nameEl.textContent?.trim() || ''
		if (!displayName) return null

		// Username may differ from display name (intl-login)
		const intlLogin = el.querySelector('.chat-author__intl-login')
		const username = intlLogin
			? intlLogin.textContent?.replace(/[()]/g, '').trim() || displayName
			: displayName

		// Name color
		const nameColor = (nameEl as HTMLElement).style?.color || ''

		// Roles and badges
		const { roles, badges } = this.extractRolesAndBadges(el)

		// Message body
		const bodyEl = el.querySelector(MESSAGE_BODY_SELECTORS)
		const message = bodyEl?.textContent?.trim() || ''
		if (!message) return null

		// Bits / donations
		const monetization = this.extractBits(el)

		// Reply context
		const replyTo = this.extractReply(el)

		// Twitch message ID
		const messageId = (el as HTMLElement).dataset?.id || crypto.randomUUID()

		return {
			platform: 'twitch',
			username: username.toLowerCase(),
			displayName,
			nameColor: nameColor || undefined,
			message,
			roles,
			badges,
			monetization: monetization || undefined,
			twitch: {
				messageId,
				isFirstMessage: !!el.querySelector('[data-a-target="chat-first-message-badge"]'),
			},
			event: monetization ? 'donation' : 'message',
			timestamp: Date.now(),
			replyTo: replyTo || undefined,
		}
	}

	// ── Event messages (sub, gift, raid) ──

	private isEventMessage(el: Element): boolean {
		return !!el.querySelector(
			'.user-notice-line, [data-test-selector="user-notice-line"], .message-event-pill',
		)
	}

	private parseEventMessage(el: Element): NormalizedChatMessage | null {
		const text = el.textContent?.trim() || ''
		if (!text) return null

		const nameEl = el.querySelector(DISPLAY_NAME_SELECTORS)
		const displayName = nameEl?.textContent?.trim() || 'System'
		const username = displayName.toLowerCase()

		// Detect event type from message text
		let event: NormalizedChatMessage['event'] = 'system'
		let membership: NormalizedChatMessage['membership'] | undefined
		let monetization: NormalizedChatMessage['monetization'] | undefined

		const lowerText = text.toLowerCase()

		if (lowerText.includes('gifting') || lowerText.includes('gifted')) {
			event = 'gift'
			const countMatch = text.match(/(\d+)\s+(?:sub|Sub)/i)
			const giftCount = countMatch ? Number.parseInt(countMatch[1], 10) : 1
			monetization = {
				type: 'gift_sub',
				amount: giftCount * 5,
				formattedAmount: `${giftCount} Gift Sub${giftCount > 1 ? 's' : ''}`,
				giftCount,
			}
		} else if (lowerText.includes('subscribed') || lowerText.includes('resub')) {
			event = 'membership'
			const monthsMatch = text.match(/(\d+)\s+months?/i)
			const isResub =
				lowerText.includes('resub') || (monthsMatch && Number.parseInt(monthsMatch[1], 10) > 1)
			membership = {
				type: isResub ? 'resub' : 'new',
				months: monthsMatch ? Number.parseInt(monthsMatch[1], 10) : 1,
			}
		} else if (lowerText.includes('raiding') || lowerText.includes('raid')) {
			event = 'raid'
		}

		return {
			platform: 'twitch',
			username,
			displayName,
			message: text,
			roles: [],
			event,
			membership,
			monetization: monetization || undefined,
			twitch: { messageId: crypto.randomUUID() },
			timestamp: Date.now(),
		}
	}

	// ── Roles and badges ──

	private extractRolesAndBadges(el: Element): {
		roles: ChatRole[]
		badges: { id: string; name: string; version: string; imageUrl?: string }[]
	} {
		const roles: ChatRole[] = []
		const badges: { id: string; name: string; version: string; imageUrl?: string }[] = []

		const badgeEls = el.querySelectorAll(BADGE_SELECTORS)
		for (const badge of badgeEls) {
			const badgeText = (
				badge.getAttribute('alt') ||
				badge.getAttribute('aria-label') ||
				badge.getAttribute('title') ||
				''
			)
				.trim()
				.toLowerCase()

			if (badgeText === 'moderator' && !roles.includes('moderator')) {
				roles.push('moderator')
			} else if (badgeText === 'vip' && !roles.includes('vip')) {
				roles.push('vip')
			} else if (badgeText === 'broadcaster' && !roles.includes('broadcaster')) {
				roles.push('broadcaster')
			} else if (badgeText.includes('subscriber') || this.isSubscriberBadge(badge)) {
				if (!roles.includes('subscriber')) roles.push('subscriber')
			}

			const imageUrl =
				(badge as HTMLImageElement).src || (badge as HTMLImageElement).srcset?.split(' ')[0]
			badges.push({
				id: badgeText || 'unknown',
				name: badgeText || 'unknown',
				version: '1',
				imageUrl: imageUrl || undefined,
			})
		}

		return { roles, badges }
	}

	private isSubscriberBadge(badge: Element): boolean {
		const keywords = [
			'subscriber',
			'suscriptor',
			'abonné',
			'abonnent',
			'assinante',
			'订阅者',
			'購読者',
			'구독자',
		]
		const text = (
			badge.getAttribute('alt') ||
			badge.getAttribute('aria-label') ||
			badge.getAttribute('title') ||
			''
		).toLowerCase()
		return keywords.some((kw) => text.includes(kw))
	}

	// ── Bits extraction ──

	private extractBits(el: Element): NormalizedChatMessage['monetization'] | null {
		const bitsEl = el.querySelector(BITS_SELECTORS)
		if (!bitsEl) return null

		const bitsText = bitsEl.textContent?.trim() || ''
		const amount = Number.parseInt(bitsText.replace(/\D/g, ''), 10)
		if (!amount) return null

		return {
			type: 'bits',
			amount,
			currency: 'bits',
			formattedAmount: `${amount} Bits`,
		}
	}

	// ── Reply extraction ──

	private extractReply(el: Element): { username: string; message: string } | null {
		const replyEl = el.querySelector(
			'.seventv-reply-message-part, [data-a-target="chat-reply-link"]',
		)
		if (!replyEl) return null

		const replyText = replyEl.textContent?.trim() || ''
		const colonIndex = replyText.indexOf(':')
		if (colonIndex === -1) return { username: '', message: replyText }

		return {
			username: replyText.slice(0, colonIndex).replace('@', '').trim(),
			message: replyText.slice(colonIndex + 1).trim(),
		}
	}

	// ── Deletion ──

	private markDeleted(el: Element): void {
		// Find the closest message container and dispatch deletion
		const msgEl = el.closest(MESSAGE_SELECTORS) || el
		const dataset = (msgEl as HTMLElement).dataset
		if (dataset.contextBroDeleted) return
		dataset.contextBroDeleted = '1'
	}

	// ── Stream info ──

	private extractChannelName(): string {
		const path = window.location.pathname
		const segments = path.split('/').filter(Boolean)
		return segments[0] || ''
	}

	private buildStreamInfo(): StreamInfo {
		const titleEl = document.querySelector('[data-a-target="stream-title"]')
		const categoryEl = document.querySelector('[data-a-target="stream-game-link"]')
		const viewerEl = document.querySelector('[data-a-target="animated-channel-viewers-count"]')

		return {
			platform: 'twitch',
			channelName: this.channelName,
			title: titleEl?.textContent?.trim() || '',
			category: categoryEl?.textContent?.trim() || undefined,
			viewerCount: viewerEl
				? Number.parseInt(viewerEl.textContent?.replace(/\D/g, '') || '0', 10)
				: undefined,
			isLive: !!document.querySelector(
				'.live-indicator, [data-a-target="player-overlay-live-indicator"]',
			),
			url: window.location.href,
		}
	}

	// ── Helpers ──

	protected async waitForElement(selectors: string[], timeoutMs: number): Promise<Element | null> {
		const deadline = Date.now() + timeoutMs
		while (Date.now() < deadline) {
			for (const selector of selectors) {
				const el = document.querySelector(selector)
				if (el) return el
			}
			await new Promise((r) => setTimeout(r, 500))
		}
		return null
	}
}
