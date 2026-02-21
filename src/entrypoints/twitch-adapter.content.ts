import { TwitchAdapter } from '@/lib/adapters/twitch'
import type { ChatBatch } from '@/lib/adapters/types'

export default defineContentScript({
	matches: ['*://*.twitch.tv/*'],
	runAt: 'document_idle',
	async main() {
		const adapter = new TwitchAdapter()
		const url = new URL(window.location.href)

		if (!adapter.match(url)) return

		console.debug('[context-bro] Twitch adapter initializing')

		adapter.onChatBatch((batch: ChatBatch) => {
			browser.runtime.sendMessage({
				action: 'adapterChatBatch',
				batch,
			})
		})

		await adapter.init()

		// Notify background that adapter is active
		browser.runtime.sendMessage({
			action: 'adapterActive',
			platform: 'twitch',
			streamInfo: adapter.getStreamInfo(),
		})

		// Cleanup on page unload
		window.addEventListener('beforeunload', () => {
			adapter.destroy()
			browser.runtime.sendMessage({
				action: 'adapterInactive',
				platform: 'twitch',
			})
		})
	},
})
