const STORAGE_KEY = 'contextBroContentHashes'

interface DedupEntry {
	hash: string
	sentAt: number
}

type DedupStore = Record<string, DedupEntry>

/**
 * Compute SHA-256 hash of content string.
 */
async function sha256(content: string): Promise<string> {
	const encoded = new TextEncoder().encode(content)
	const hashBuffer = await crypto.subtle.digest('SHA-256', encoded)
	const hashArray = Array.from(new Uint8Array(hashBuffer))
	return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Normalize stored values: if a value is a plain string (v3 format),
 * convert it to { hash, sentAt: 0 } for backward compatibility.
 */
function normalizeStore(raw: Record<string, unknown>): DedupStore {
	const store: DedupStore = {}
	for (const [url, value] of Object.entries(raw)) {
		if (typeof value === 'string') {
			store[url] = { hash: value, sentAt: 0 }
		} else if (value && typeof value === 'object' && 'hash' in value) {
			store[url] = value as DedupEntry
		}
	}
	return store
}

/**
 * Check if content for a URL has changed or the dedup window has expired.
 * @param dedupWindowSeconds - Window in seconds. 0 or negative means dedup disabled.
 * Returns true if the content should be sent.
 */
export async function hasContentChanged(
	url: string,
	content: string,
	dedupWindowSeconds = 900,
): Promise<boolean> {
	// Dedup disabled — always send
	if (dedupWindowSeconds <= 0) return true

	const hash = await sha256(content)
	const stored = await browser.storage.local.get(STORAGE_KEY)
	const hashes = normalizeStore((stored[STORAGE_KEY] || {}) as Record<string, unknown>)
	const now = Date.now()

	const existing = hashes[url]
	if (existing) {
		const windowMs = dedupWindowSeconds * 1_000
		const withinWindow = now - existing.sentAt < windowMs
		if (existing.hash === hash && withinWindow) {
			return false // same content, within window → skip
		}
	}

	// Update hash and sentAt
	hashes[url] = { hash, sentAt: now }
	await browser.storage.local.set({ [STORAGE_KEY]: hashes })
	return true
}

/**
 * Clear all stored content hashes.
 */
export async function clearContentHashes(): Promise<void> {
	await browser.storage.local.remove(STORAGE_KEY)
}
