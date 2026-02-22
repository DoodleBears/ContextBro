import type { ContentScriptContext } from 'wxt/utils/content-script-context'
import { TwitchAdapter } from '@/lib/adapters/twitch'
import type { ChatBatch } from '@/lib/adapters/types'
import type { LiveStreamConfig } from '@/lib/types'

export default defineContentScript({
	matches: ['*://*.twitch.tv/*'],
	runAt: 'document_idle',
	async main(ctx: ContentScriptContext) {
		// Early exit if Twitch adapter is disabled
		const stored = await browser.storage.local.get('liveStreamConfig')
		const config = stored.liveStreamConfig as LiveStreamConfig | undefined
		if (config && !config.twitch.enabled) return

		const adapter = new TwitchAdapter()
		const url = new URL(window.location.href)

		if (!adapter.match(url)) return

		console.debug('[context-bro] Twitch adapter initializing')

		adapter.onChatBatch((batch: ChatBatch) => {
			if (ctx.isInvalid) return
			browser.runtime
				.sendMessage({
					action: 'adapterChatBatch',
					batch,
				})
				.catch(() => {})
		})

		await adapter.init()

		// Notify background that adapter is active
		browser.runtime
			.sendMessage({
				action: 'adapterActive',
				platform: 'twitch',
				streamInfo: adapter.getStreamInfo(),
			})
			.catch(() => {})

		// Cleanup when extension context is invalidated (extension reload/update)
		ctx.onInvalidated(() => {
			adapter.destroy()
		})

		// Cleanup on page unload
		window.addEventListener('beforeunload', () => {
			adapter.destroy()
			if (ctx.isInvalid) return
			browser.runtime
				.sendMessage({
					action: 'adapterInactive',
					platform: 'twitch',
				})
				.catch(() => {})
		})
	},
})
