export interface StreamInfo {
	platform: string
	channelName: string
	title: string
	category?: string
	viewers?: number
	isLive: boolean
}

export interface ChatMessage {
	author: string
	text: string
	timestamp: number
	isMod?: boolean
	isSub?: boolean
}

export interface ChatBatch {
	platform: string
	channelName: string
	messages: ChatMessage[]
	totalCount: number
	sampledCount: number
	flushTimestamp: number
}

export interface TranscriptChunk {
	platform: string
	videoId: string
	text: string
	startTime: number
	endTime?: number
}

export interface PlatformAdapter {
	platform: string
	match(url: URL): boolean
	init(): Promise<void>
	destroy(): void
	getStreamInfo(): StreamInfo | null
	onChatBatch(cb: (batch: ChatBatch) => void): void
	onTranscript?(cb: (chunk: TranscriptChunk) => void): void
}

/**
 * Sample chat messages when volume exceeds threshold.
 * Keeps mod/sub messages + random sample of the rest.
 */
export function sampleMessages(messages: ChatMessage[], maxCount = 100): ChatMessage[] {
	if (messages.length <= maxCount) return messages

	const priority: ChatMessage[] = []
	const regular: ChatMessage[] = []

	for (const msg of messages) {
		if (msg.isMod || msg.isSub) {
			priority.push(msg)
		} else {
			regular.push(msg)
		}
	}

	const remaining = maxCount - priority.length
	if (remaining <= 0) return priority.slice(0, maxCount)

	// Shuffle regular messages and take a sample
	for (let i = regular.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1))
		;[regular[i], regular[j]] = [regular[j], regular[i]]
	}

	return [...priority, ...regular.slice(0, remaining)]
}
