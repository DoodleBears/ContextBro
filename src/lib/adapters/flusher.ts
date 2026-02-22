/**
 * Debounce-based flush scheduler with maxWait cap.
 *
 * When `schedule()` is called:
 * 1. If no cycle is active, start both a debounce timer and a maxWait timer.
 * 2. If a cycle is active, reset the debounce timer (but maxWait keeps ticking).
 * 3. When either timer fires first → invoke `onFlush()` and clear both timers.
 *
 * Effect: slow chat flushes quickly (~debounceMs after last message),
 * fast/continuous chat batches up to maxWaitMs before forced flush.
 */
export class DebouncedFlusher {
	private debounceMs: number
	private maxWaitMs: number
	private onFlush: () => void

	private debounceTimer: ReturnType<typeof setTimeout> | null = null
	private maxWaitTimer: ReturnType<typeof setTimeout> | null = null
	private hasPending = false

	constructor(opts: { debounceMs: number; maxWaitMs: number; onFlush: () => void }) {
		this.debounceMs = opts.debounceMs
		this.maxWaitMs = opts.maxWaitMs
		this.onFlush = opts.onFlush
	}

	/** Call this whenever a new message is buffered. */
	schedule(): void {
		// Start maxWait timer on first schedule in a cycle
		if (!this.hasPending) {
			this.hasPending = true
			this.maxWaitTimer = setTimeout(() => this.fire(), this.maxWaitMs)
		}

		// Reset debounce timer on every schedule
		if (this.debounceTimer) clearTimeout(this.debounceTimer)
		this.debounceTimer = setTimeout(() => this.fire(), this.debounceMs)
	}

	/** Force an immediate flush (e.g., on destroy). */
	flush(): void {
		if (this.hasPending) {
			this.fire()
		}
	}

	/** Update config dynamically (from storage.onChanged). New values apply on next cycle. */
	updateConfig(debounceMs: number, maxWaitMs: number): void {
		this.debounceMs = debounceMs
		this.maxWaitMs = maxWaitMs
	}

	destroy(): void {
		this.flush()
		this.clearTimers()
	}

	private fire(): void {
		this.clearTimers()
		this.hasPending = false
		this.onFlush()
	}

	private clearTimers(): void {
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer)
			this.debounceTimer = null
		}
		if (this.maxWaitTimer) {
			clearTimeout(this.maxWaitTimer)
			this.maxWaitTimer = null
		}
	}
}
