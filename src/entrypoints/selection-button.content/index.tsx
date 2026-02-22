import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root'

export default defineContentScript({
	matches: ['<all_urls>'],
	cssInjectionMode: 'manual',
	runAt: 'document_idle',
	async main(ctx) {
		let currentSelection = ''

		const ui = await createShadowRootUi(ctx, {
			name: 'context-bro-selection',
			position: 'overlay',
			zIndex: 2147483647,
			onMount(uiContainer) {
				const root = createRoot(uiContainer)
				root.render(<SelectionButton getSelection={() => currentSelection} />)
				return root
			},
			onRemove(root) {
				root?.unmount()
			},
		})

		// Track mouse position for button placement
		let mouseX = 0
		let mouseY = 0

		document.addEventListener('mousemove', (e) => {
			mouseX = e.clientX
			mouseY = e.clientY
		})

		document.addEventListener('mouseup', () => {
			// Delay to let selection finalize
			setTimeout(() => {
				const selection = window.getSelection()
				const text = selection?.toString().trim() || ''

				if (text.length > 0) {
					currentSelection = text
					// Position near mouse
					const host = ui.shadowHost
					host.style.position = 'fixed'
					host.style.left = `${mouseX + 10}px`
					host.style.top = `${mouseY - 40}px`
					ui.mount()
				} else {
					ui.remove()
					currentSelection = ''
				}
			}, 10)
		})

		// Hide on selection clear
		document.addEventListener('mousedown', (e) => {
			// Don't hide if clicking the button itself
			if (ui.shadowHost.contains(e.target as Node)) return
			ui.remove()
			currentSelection = ''
		})
	},
})

const COLORS = {
	light: {
		idle: { color: '#fff', bg: '#2563eb', border: '#1d4ed8' },
		done: { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
	},
	dark: {
		idle: { color: '#fff', bg: '#1d4ed8', border: '#1e40af' },
		done: { color: '#4ade80', bg: '#052e16', border: '#166534' },
	},
}

function SelectionButton({ getSelection }: { getSelection: () => string }) {
	const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle')
	const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
	const palette = isDark ? COLORS.dark : COLORS.light
	const c = status === 'done' ? palette.done : palette.idle

	async function handleClick() {
		const selection = getSelection()
		if (!selection) return

		setStatus('sending')

		try {
			await browser.runtime.sendMessage({
				action: 'share',
				tabId: undefined,
				selection,
			})
			setStatus('done')
			setTimeout(() => setStatus('idle'), 1000)
		} catch {
			setStatus('idle')
		}
	}

	return (
		<button
			type="button"
			onClick={handleClick}
			disabled={status === 'sending'}
			style={{
				display: 'flex',
				alignItems: 'center',
				gap: '4px',
				padding: '6px 10px',
				fontSize: '12px',
				fontFamily: 'system-ui, sans-serif',
				fontWeight: 500,
				color: c.color,
				backgroundColor: c.bg,
				border: '1px solid',
				borderColor: c.border,
				borderRadius: '6px',
				cursor: status === 'sending' ? 'wait' : 'pointer',
				boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.15)',
				whiteSpace: 'nowrap',
			}}
		>
			{status === 'sending' ? 'Sharing...' : status === 'done' ? 'Shared!' : 'Share to AI'}
		</button>
	)
}
