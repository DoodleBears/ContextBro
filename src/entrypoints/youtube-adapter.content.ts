import type { ChatBatch, TranscriptChunk } from '@/lib/adapters/types'
import { YouTubeAdapter } from '@/lib/adapters/youtube'
import type { LiveStreamConfig } from '@/lib/types'

export default defineContentScript({
	matches: ['*://*.youtube.com/watch*', '*://*.youtube.com/live*'],
	runAt: 'document_idle',
	async main() {
		// Early exit if YouTube adapter is disabled
		const stored = await browser.storage.local.get('liveStreamConfig')
		const config = stored.liveStreamConfig as LiveStreamConfig | undefined
		if (config && !config.youtube.enabled) return

		const adapter = new YouTubeAdapter()
		const url = new URL(window.location.href)

		if (!adapter.match(url)) return

		console.debug('[context-bro] YouTube adapter initializing')

		adapter.onChatBatch((batch: ChatBatch) => {
			browser.runtime.sendMessage({
				action: 'adapterChatBatch',
				batch,
			})
		})

		adapter.onTranscript?.((chunk: TranscriptChunk) => {
			browser.runtime.sendMessage({
				action: 'adapterTranscript',
				chunk,
			})
		})

		await adapter.init()

		// Notify background that adapter is active
		browser.runtime.sendMessage({
			action: 'adapterActive',
			platform: 'youtube',
			streamInfo: adapter.getStreamInfo(),
		})

		// Cleanup on page unload
		window.addEventListener('beforeunload', () => {
			adapter.destroy()
			browser.runtime.sendMessage({
				action: 'adapterInactive',
				platform: 'youtube',
			})
		})
	},
})
