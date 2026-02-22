import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root'

export default defineContentScript({
	matches: ['<all_urls>'],
	cssInjectionMode: 'manual',
	runAt: 'document_idle',
	async main(ctx) {
		let root: ReturnType<typeof createRoot> | null = null
		let dismissTimer: ReturnType<typeof setTimeout> | null = null

		const ui = await createShadowRootUi(ctx, {
			name: 'context-bro-focused-indicator',
			position: 'overlay',
			zIndex: 2147483646,
			onMount(uiContainer) {
				root = createRoot(uiContainer)
				return root
			},
			onRemove(r) {
				r?.unmount()
				root = null
			},
		})

		function showIndicator(endpointNames: string[]) {
			// Clear any pending dismiss
			if (dismissTimer) {
				clearTimeout(dismissTimer)
				dismissTimer = null
			}

			// Remove previous if mounted
			ui.remove()

			// Mount first, then position the inner <html> element.
			// WXT overlay sets shadowHost to width:0;height:0 (zero-size anchor),
			// so positioning/transforms on it won't work. Style the inner <html>
			// with position:fixed to break out of the zero-size parent.
			ui.mount()
			const innerHtml = ui.shadow.querySelector('html') as HTMLElement | null
			if (innerHtml) {
				innerHtml.style.position = 'fixed'
				innerHtml.style.top = '12px'
				innerHtml.style.left = '50%'
				innerHtml.style.transform = 'translateX(-50%)'
				innerHtml.style.pointerEvents = 'none'
			}

			if (root) {
				root.render(
					<FocusedIndicator
						endpointNames={endpointNames}
						phase="enter"
						onDismissed={() => ui.remove()}
					/>,
				)
			}

			// Safety net: remove after 120s even if dismiss message never arrives
			dismissTimer = setTimeout(() => ui.remove(), 120_000)
		}

		function dismissIndicator() {
			if (dismissTimer) {
				clearTimeout(dismissTimer)
				dismissTimer = null
			}
			if (root) {
				root.render(
					<FocusedIndicator
						endpointNames={[]}
						phase="exit"
						onDismissed={() => ui.remove()}
					/>,
				)
				// Safety: remove after exit animation
				dismissTimer = setTimeout(() => ui.remove(), 500)
			} else {
				ui.remove()
			}
		}

		browser.runtime.onMessage.addListener((message) => {
			if (message.action === 'showFocusedIndicator') {
				showIndicator(message.endpointNames as string[])
			}
			if (message.action === 'dismissFocusedIndicator') {
				dismissIndicator()
			}
		})
	},
})

const COLORS = {
	light: {
		bg: 'rgba(255,255,255,0.92)',
		color: '#333',
		border: 'rgba(0,0,0,0.1)',
		arrow: '#6b7280',
	},
	dark: {
		bg: 'rgba(30,30,30,0.92)',
		color: '#e5e5e5',
		border: 'rgba(255,255,255,0.1)',
		arrow: '#9ca3af',
	},
}

interface IndicatorProps {
	endpointNames: string[]
	phase: 'enter' | 'exit'
	onDismissed: () => void
}

function FocusedIndicator({ endpointNames, phase, onDismissed }: IndicatorProps) {
	const [visible, setVisible] = useState(false)
	const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
	const c = isDark ? COLORS.dark : COLORS.light
	// Use runtime.getURL with type assertion — WXT's PublicPath type doesn't include icons
	const iconUrl = (browser.runtime.getURL as (path: string) => string)('/icon/32.png')

	useEffect(() => {
		if (phase === 'enter') {
			// Trigger enter animation on next frame
			const raf = requestAnimationFrame(() => setVisible(true))
			return () => cancelAnimationFrame(raf)
		}
		// phase === 'exit': start fade-out, then notify parent
		setVisible(false)
		const timer = setTimeout(onDismissed, 300)
		return () => clearTimeout(timer)
	}, [phase, onDismissed])

	const isVisible = visible && phase === 'enter'

	return (
		<div
			style={{
				display: 'inline-flex',
				alignItems: 'center',
				gap: '6px',
				padding: '5px 12px',
				borderRadius: '20px',
				fontSize: '12px',
				fontFamily: 'system-ui, sans-serif',
				fontWeight: 500,
				backgroundColor: c.bg,
				color: c.color,
				border: `1px solid ${c.border}`,
				boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
				backdropFilter: 'blur(8px)',
				WebkitBackdropFilter: 'blur(8px)',
				opacity: isVisible ? 1 : 0,
				transform: `translateY(${isVisible ? '0' : '-8px'})`,
				transition: 'opacity 0.3s ease, transform 0.3s ease',
				whiteSpace: 'nowrap',
			}}
		>
			<img
				src={iconUrl}
				alt=""
				style={{ width: 16, height: 16, borderRadius: 3 }}
			/>
			<span style={{ color: c.arrow }}>→</span>
			<span>{endpointNames.join(', ')}</span>
		</div>
	)
}
