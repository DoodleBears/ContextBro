import type { ChatBatch, NormalizedChatMessage, PlatformAdapter, StreamInfo } from './types'

const FLUSH_INTERVAL_MS = 30_000
const DEDUP_WINDOW_MS = 10_000
const MAX_MESSAGES_PER_BATCH = 100
const PROCESS_TICK_MS = 20

/**
 * Base adapter class providing common infrastructure:
 * - MutationObserver lifecycle (attach / disconnect / reconnect)
 * - Sliding window dedup (10s window, Map<string, number>)
 * - Chat batch aggregator (30s flush + priority sampling)
 * - Delayed processing queue (20ms tick to avoid high-frequency blocking)
 */
export abstract class BaseAdapter implements PlatformAdapter {
	abstract platform: string
	abstract match(url: URL): boolean
	abstract getStreamInfo(): StreamInfo | null

	protected observer: MutationObserver | null = null
	protected deletionObserver: MutationObserver | null = null
	private batchCallbacks: ((batch: ChatBatch) => void)[] = []
	private messageBuffer: NormalizedChatMessage[] = []
	private flushTimer: ReturnType<typeof setInterval> | null = null
	private dedupWindow = new Map<string, number>()
	private processQueue: (() => void)[] = []
	private processTimer: ReturnType<typeof setTimeout> | null = null
	private isProcessing = false

	// ── Lifecycle ──

	async init(): Promise<void> {
		this.startFlushing()
		await this.attach()
	}

	destroy(): void {
		this.stopFlushing()
		this.detachObservers()
		this.processQueue = []
		this.messageBuffer = []
		this.dedupWindow.clear()
		if (this.processTimer) {
			clearTimeout(this.processTimer)
			this.processTimer = null
		}
	}

	onChatBatch(cb: (batch: ChatBatch) => void): void {
		this.batchCallbacks.push(cb)
	}

	// ── Subclass hooks ──

	/** Subclass must find the observer target and call attachObserver() */
	protected abstract attach(): Promise<void>

	/** Subclass implements per-node message parsing */
	protected abstract parseMessageNode(node: Element): NormalizedChatMessage | null

	// ── Observer management ──

	protected attachObserver(target: Element, config: MutationObserverInit): void {
		this.detachObservers()

		this.observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				if (mutation.type === 'childList') {
					for (const node of mutation.addedNodes) {
						if (node.nodeType !== Node.ELEMENT_NODE) continue
						const el = node as Element
						this.enqueue(() => this.handleNewNode(el))
					}
				}

				if (mutation.type === 'attributes') {
					this.handleAttributeMutation(mutation)
				}
			}
		})

		this.observer.observe(target, config)
	}

	protected attachDeletionObserver(target: Element, config: MutationObserverInit): void {
		this.deletionObserver?.disconnect()

		this.deletionObserver = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				if (mutation.type === 'attributes') {
					this.handleDeletion(mutation.target as Element)
				}
			}
		})

		this.deletionObserver.observe(target, config)
	}

	protected detachObservers(): void {
		this.observer?.disconnect()
		this.observer = null
		this.deletionObserver?.disconnect()
		this.deletionObserver = null
	}

	/** Override in subclass for platform-specific attribute mutation handling */
	protected handleAttributeMutation(_mutation: MutationRecord): void {}

	/** Override in subclass for platform-specific deletion handling */
	protected handleDeletion(_element: Element): void {}

	// ── Delayed processing queue (20ms tick) ──

	private enqueue(fn: () => void): void {
		this.processQueue.push(fn)
		this.scheduleProcessing()
	}

	private scheduleProcessing(): void {
		if (this.isProcessing || this.processTimer) return
		this.processTimer = setTimeout(() => {
			this.processTimer = null
			this.processNext()
		}, PROCESS_TICK_MS)
	}

	private processNext(): void {
		if (this.isProcessing) return
		this.isProcessing = true

		try {
			const fn = this.processQueue.shift()
			fn?.()
		} finally {
			this.isProcessing = false
		}

		if (this.processQueue.length > 0) {
			this.scheduleProcessing()
		}
	}

	// ── Message handling ──

	private handleNewNode(el: Element): void {
		const msg = this.parseMessageNode(el)
		if (!msg) return
		if (this.isDuplicate(msg)) return
		this.messageBuffer.push(msg)
	}

	// ── Sliding window dedup (10s) ──

	private isDuplicate(msg: NormalizedChatMessage): boolean {
		const key = `${msg.platform}-${msg.username}-${msg.message.slice(0, 100)}`
		const now = Date.now()

		// Clean expired entries
		for (const [k, ts] of this.dedupWindow) {
			if (now - ts > DEDUP_WINDOW_MS) {
				this.dedupWindow.delete(k)
			}
		}

		if (this.dedupWindow.has(key)) return true
		this.dedupWindow.set(key, now)
		return false
	}

	// ── Batch flushing (30s interval) ──

	private startFlushing(): void {
		this.flushTimer = setInterval(() => this.flush(), FLUSH_INTERVAL_MS)
	}

	private stopFlushing(): void {
		if (this.flushTimer) {
			clearInterval(this.flushTimer)
			this.flushTimer = null
		}
		// Flush remaining messages
		if (this.messageBuffer.length > 0) {
			this.flush()
		}
	}

	private flush(): void {
		if (this.messageBuffer.length === 0) return

		const all = this.messageBuffer.splice(0)
		const sampled = sampleMessages(all, MAX_MESSAGES_PER_BATCH)

		// Count monetization and membership events
		let donationCount = 0
		let donationTotal = 0
		let newMemberCount = 0
		let resubCount = 0
		let giftCount = 0

		for (const msg of all) {
			if (msg.monetization) {
				donationCount++
				donationTotal += msg.monetization.amount
			}
			if (msg.membership) {
				if (msg.membership.type === 'new') newMemberCount++
				else if (msg.membership.type === 'resub') resubCount++
				else if (msg.membership.type === 'gift_received') giftCount++
			}
		}

		const batch: ChatBatch = {
			platform: this.platform,
			channelName: this.getStreamInfo()?.channelName || 'unknown',
			streamInfo: this.getStreamInfo(),
			messages: sampled,
			totalCount: all.length,
			sampledCount: sampled.length,
			flushTimestamp: Date.now(),
			donations: { count: donationCount, totalValue: donationTotal },
			memberships: { newCount: newMemberCount, resubCount, giftCount },
		}

		for (const cb of this.batchCallbacks) {
			try {
				cb(batch)
			} catch (e) {
				console.error(`[${this.platform}] Batch callback error:`, e)
			}
		}
	}
}

/**
 * Sample chat messages when volume exceeds threshold.
 * Priority: monetization > mod/broadcaster > regular (random sample).
 */
function sampleMessages(
	messages: NormalizedChatMessage[],
	maxCount: number,
): NormalizedChatMessage[] {
	if (messages.length <= maxCount) return messages

	const priority: NormalizedChatMessage[] = []
	const regular: NormalizedChatMessage[] = []

	for (const msg of messages) {
		const isPriority =
			msg.monetization ||
			msg.membership ||
			msg.roles.includes('moderator') ||
			msg.roles.includes('broadcaster')

		if (isPriority) {
			priority.push(msg)
		} else {
			regular.push(msg)
		}
	}

	const remaining = maxCount - priority.length
	if (remaining <= 0) return priority.slice(0, maxCount)

	// Fisher-Yates shuffle for random sampling
	for (let i = regular.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1))
		;[regular[i], regular[j]] = [regular[j], regular[i]]
	}

	return [...priority, ...regular.slice(0, remaining)]
}
