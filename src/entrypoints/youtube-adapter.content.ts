import type { ContentScriptContext } from 'wxt/utils/content-script-context'
import type { ChatBatch, TranscriptChunk } from '@/lib/adapters/types'
import { YouTubeAdapter } from '@/lib/adapters/youtube'
import type { LiveStreamConfig } from '@/lib/types'

export default defineContentScript({
	matches: ['*://*.youtube.com/*'],
	runAt: 'document_idle',
	async main(ctx: ContentScriptContext) {
		// Early exit if YouTube adapter is disabled
		const stored = await browser.storage.local.get('liveStreamConfig')
		const config = stored.liveStreamConfig as LiveStreamConfig | undefined
		if (config && !config.youtube.enabled) return

		let adapter: YouTubeAdapter | null = null
		let currentUrl = window.location.href

		async function startAdapter() {
			adapter = new YouTubeAdapter()
			const url = new URL(window.location.href)

			if (!adapter.match(url)) {
				adapter = null
				return
			}

			console.debug('[context-bro] YouTube adapter initializing')

			adapter.onChatBatch((batch: ChatBatch) => {
				if (ctx.isInvalid) return
				browser.runtime
					.sendMessage({
						action: 'adapterChatBatch',
						batch,
					})
					.catch(() => {})
			})

			adapter.onTranscript?.((chunk: TranscriptChunk) => {
				if (ctx.isInvalid) return
				browser.runtime
					.sendMessage({
						action: 'adapterTranscript',
						chunk,
					})
					.catch(() => {})
			})

			await adapter.init()

			// Notify background that adapter is active
			if (ctx.isInvalid) return
			const streamInfo = adapter.getStreamInfo()
			browser.runtime
				.sendMessage({
					action: 'adapterActive',
					platform: 'youtube',
					streamInfo,
				})
				.catch(() => {})

			// YouTube lazily renders channel name — retry after a delay if empty
			if (!streamInfo?.channelName) {
				const currentAdapter = adapter
				setTimeout(() => {
					if (ctx.isInvalid || currentAdapter !== adapter) return
					const freshInfo = currentAdapter.getStreamInfo()
					if (freshInfo?.channelName) {
						browser.runtime
							.sendMessage({
								action: 'adapterActive',
								platform: 'youtube',
								streamInfo: freshInfo,
							})
							.catch(() => {})
					}
				}, 3000)
			}
		}

		function stopAdapter() {
			if (!adapter) return
			adapter.destroy()
			adapter = null
			if (ctx.isInvalid) return
			browser.runtime
				.sendMessage({
					action: 'adapterInactive',
					platform: 'youtube',
				})
				.catch(() => {})
		}

		// YouTube SPA navigation: reinitialize adapter when URL changes
		document.addEventListener('yt-navigate-finish', async () => {
			if (ctx.isInvalid) return
			const newUrl = window.location.href
			if (newUrl === currentUrl) return
			currentUrl = newUrl
			console.debug('[context-bro] YouTube SPA navigation detected')
			stopAdapter()
			// Wait for YouTube to render the new page content (live badge, chat, channel name)
			await new Promise((r) => setTimeout(r, 1500))
			if (ctx.isInvalid) return
			await startAdapter()
		})

		await startAdapter()

		// Re-announce adapter when tab becomes visible (handles service worker restart losing activeAdapters)
		document.addEventListener('visibilitychange', () => {
			if (ctx.isInvalid || !adapter || document.visibilityState !== 'visible') return
			const streamInfo = adapter.getStreamInfo()
			browser.runtime
				.sendMessage({
					action: 'adapterActive',
					platform: 'youtube',
					streamInfo,
				})
				.catch(() => {})
		})

		// Cleanup when extension context is invalidated (extension reload/update)
		ctx.onInvalidated(() => {
			try {
				if (adapter) {
					adapter.destroy()
					adapter = null
				}
			} catch {
				// Extension context already gone
			}
		})

		// Cleanup on page unload
		window.addEventListener('beforeunload', () => {
			stopAdapter()
		})
	},
})
