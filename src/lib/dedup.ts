const STORAGE_KEY = 'contextBroContentHashes'

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
 * Check if content for a URL has changed since last extraction.
 * Returns true if the content is new or changed (should be sent).
 * Returns false if it's a duplicate (should be skipped).
 */
export async function hasContentChanged(url: string, content: string): Promise<boolean> {
	const hash = await sha256(content)
	const stored = await browser.storage.local.get(STORAGE_KEY)
	const hashes: Record<string, string> = stored[STORAGE_KEY] || {}

	if (hashes[url] === hash) {
		return false
	}

	hashes[url] = hash
	await browser.storage.local.set({ [STORAGE_KEY]: hashes })
	return true
}

/**
 * Clear all stored content hashes.
 */
export async function clearContentHashes(): Promise<void> {
	await browser.storage.local.remove(STORAGE_KEY)
}
