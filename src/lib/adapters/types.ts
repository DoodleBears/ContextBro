// ── Platform Adapter Interface ──

export interface PlatformAdapter {
	platform: 'twitch' | 'youtube' | string
	match(url: URL): boolean
	init(): Promise<void>
	destroy(): void
	getStreamInfo(): StreamInfo | null
	onChatBatch(cb: (batch: ChatBatch) => void): void
	onTranscript?(cb: (chunk: TranscriptChunk) => void): void
}

// ── Stream Info ──

export interface StreamInfo {
	platform: string
	channelName: string
	channelAvatar?: string
	title: string
	category?: string
	viewerCount?: number
	isLive: boolean
	startedAt?: string
	url: string
}

// ── Normalized Chat Message (SSN-inspired, richer) ──

export interface NormalizedChatMessage {
	// Identity
	platform: string
	username: string
	displayName: string
	avatarUrl?: string
	nameColor?: string

	// Content
	message: string
	emotes?: EmoteRef[]

	// Roles & Badges
	roles: ChatRole[]
	badges?: Badge[]
	subscriberTier?: number
	subscriberMonths?: number

	// Monetization
	monetization?: {
		type: 'bits' | 'superchat' | 'supersticker' | 'gift_sub' | 'donation'
		amount: number
		currency?: string
		formattedAmount: string
		tier?: number
		giftCount?: number
		message?: string
	}

	// Membership events
	membership?: {
		type: 'new' | 'resub' | 'gift_received' | 'upgrade'
		months?: number
		tier?: number
		gifterName?: string
	}

	// Platform-specific enrichments
	twitch?: {
		messageId: string
		channelPointRedemption?: string
		isFirstMessage?: boolean
		isReturningChatter?: boolean
	}

	youtube?: {
		liveChatId: string
		isChatOwner?: boolean
		isChatSponsor?: boolean
	}

	// Metadata
	event: 'message' | 'donation' | 'membership' | 'gift' | 'raid' | 'system'
	timestamp: number
	isDeleted?: boolean

	// Reply context
	replyTo?: {
		username: string
		message: string
	}

	// Spam aggregation: number of identical messages collapsed into this one
	count?: number
}

export interface EmoteRef {
	id: string
	name: string
	source: 'native' | 'bttv' | '7tv' | 'ffz'
	startIndex: number
	endIndex: number
}

export interface Badge {
	id: string
	name: string
	version: string
	imageUrl?: string
}

export type ChatRole =
	| 'broadcaster'
	| 'moderator'
	| 'vip'
	| 'subscriber'
	| 'turbo'
	| 'artist'
	| 'member'

// ── Chat Batch (aggregated over flush interval) ──

export interface ChatBatch {
	platform: string
	channelName: string
	streamInfo: StreamInfo | null
	messages: NormalizedChatMessage[]
	totalCount: number
	sampledCount: number
	flushTimestamp: number
	donations: {
		count: number
		totalValue: number
	}
	memberships: {
		newCount: number
		resubCount: number
		giftCount: number
	}
}

// ── Transcript (VOD / Live captions) ──

export interface TranscriptChunk {
	platform: string
	videoId: string
	title: string
	channelName: string
	text: string
	startTime: number
	endTime?: number
	currentTime?: number
	duration?: number
}
