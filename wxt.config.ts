import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'wxt'

export default defineConfig({
	modules: ['@wxt-dev/module-react'],
	srcDir: 'src',
	vite: () => ({
		plugins: [tailwindcss()],
	}),
	manifest: {
		name: 'Context Bro',
		description: 'Web Clipper for AI Agents — share browsing context with your AI companion',
		permissions: ['activeTab', 'scripting', 'storage', 'alarms', 'tabs', 'contextMenus'],
		commands: {
			'share-selection': {
				suggested_key: { default: 'Ctrl+Shift+K', mac: 'Command+Shift+K' },
				description: 'Share selection to Context Bro',
			},
		},
		web_accessible_resources: [
			{
				resources: ['icon/*.png'],
				matches: ['<all_urls>'],
			},
		],
	},
})
