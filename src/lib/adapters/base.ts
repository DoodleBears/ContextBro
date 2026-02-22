import { DEFAULT_LIVE_STREAM_CONFIG } from '@/lib/storage'
import type { LiveStreamConfig } from '@/lib/types'
import { DebouncedFlusher } from './flusher'
import type { ChatBatch, NormalizedChatMessage, PlatformAdapter, StreamInfo } from './types'

const PROCESS_TICK_MS = 20

/**
 * Base adapter class providing common infrastructure:
 * - MutationObserver lifecycle (attach / disconnect / reconnect)
 * - Sliding window dedup with optional spam aggregation
 * - Debounce-based chat batch flusher with maxWait cap
 * - Delayed processing queue (20ms tick to avoid high-frequency blocking)
 * - Live config updates via storage.onChanged
 */
export abstract class BaseAdapter implements PlatformAdapter {
	abstract platform: string
	abstract match(url: URL): boolean
	abstract getStreamInfo(): StreamInfo | null

	protected observer: MutationObserver | null = null
	protected deletionObserver: MutationObserver | null = null
	private batchCallbacks: ((batch: ChatBatch) => void)[] = []
	private messageBuffer: NormalizedChatMessage[] = []
	private flusher: DebouncedFlusher | null = null
	private dedupWindow = new Map<string, { timestamp: number; bufferIndex: number }>()
	private processQueue: (() => void)[] = []
	private processTimer: ReturnType<typeof setTimeout> | null = null
	private isProcessing = false

	protected config: LiveStreamConfig = DEFAULT_LIVE_STREAM_CONFIG
	private storageListener: ((changes: Record<string, { newValue?: unknown }>) => void) | null = null

	// ── Lifecycle ──

	async init(): Promise<void> {
		await this.loadConfig()
		this.listenForConfigChanges()
		this.startFlushing()
		await this.attach()
	}

	destroy(): void {
		this.flusher?.destroy()
		this.flusher = null
		this.detachObservers()
		this.processQueue = []
		this.messageBuffer = []
		this.dedupWindow.clear()
		if (this.processTimer) {
			clearTimeout(this.processTimer)
			this.processTimer = null
		}
		if (this.storageListener) {
			try {
				browser.storage.onChanged.removeListener(this.storageListener)
			} catch {
				// Extension context may already be invalidated
			}
			this.storageListener = null
		}
	}

	onChatBatch(cb: (batch: ChatBatch) => void): void {
		this.batchCallbacks.push(cb)
	}

	// ── Config ──

	private async loadConfig(): Promise<void> {
		const result = await browser.storage.local.get('liveStreamConfig')
		if (result.liveStreamConfig) {
			this.config = result.liveStreamConfig as LiveStreamConfig
		}
	}

	private listenForConfigChanges(): void {
		this.storageListener = (changes) => {
			if (changes.liveStreamConfig?.newValue) {
				this.config = changes.liveStreamConfig.newValue as LiveStreamConfig
				const { mode, debounceMs, maxWaitMs } = this.config.flush
				this.flusher?.updateConfig(
					mode === 'immediate' ? 0 : debounceMs,
					mode === 'immediate' ? 0 : maxWaitMs,
				)
			}
		}
		browser.storage.onChanged.addListener(this.storageListener)
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

	// ── Message handling with dedup / spam aggregation ──

	private handleNewNode(el: Element): void {
		const msg = this.parseMessageNode(el)
		if (!msg) return

		if (this.config.dedup.enabled) {
			const key = `${msg.platform}-${msg.username}-${msg.message.slice(0, 100)}`
			const now = Date.now()

			// Clean expired entries
			for (const [k, entry] of this.dedupWindow) {
				if (now - entry.timestamp > this.config.dedup.windowMs) {
					this.dedupWindow.delete(k)
				}
			}

			const existing = this.dedupWindow.get(key)
			if (existing) {
				if (this.config.dedup.aggregateSpam && existing.bufferIndex >= 0) {
					// Increment count on existing message in buffer
					const buffered = this.messageBuffer[existing.bufferIndex]
					if (buffered) {
						buffered.count = (buffered.count || 1) + 1
					}
					this.dedupWindow.set(key, { timestamp: now, bufferIndex: existing.bufferIndex })
				}
				// Drop duplicate (whether aggregated or not)
				return
			}

			msg.count = 1
			const index = this.messageBuffer.length
			this.dedupWindow.set(key, { timestamp: now, bufferIndex: index })
		}

		this.messageBuffer.push(msg)
		this.flusher?.schedule()
	}

	// ── Debounce-based flushing ──

	private startFlushing(): void {
		const { mode, debounceMs, maxWaitMs } = this.config.flush
		this.flusher = new DebouncedFlusher({
			debounceMs: mode === 'immediate' ? 0 : debounceMs,
			maxWaitMs: mode === 'immediate' ? 0 : maxWaitMs,
			onFlush: () => this.flush(),
		})
	}

	private flush(): void {
		if (this.messageBuffer.length === 0) return

		const all = this.messageBuffer.splice(0)

		// Invalidate buffer indices in dedup window (buffer was drained)
		for (const [, entry] of this.dedupWindow) {
			entry.bufferIndex = -1
		}

		const sampled = sampleMessages(all, this.config.sampling.maxMessagesPerBatch)

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
 * Priority: monetization > mod/broadcaster > aggregated spam > regular (random sample).
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
			msg.roles.includes('broadcaster') ||
			(msg.count && msg.count > 1)

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
