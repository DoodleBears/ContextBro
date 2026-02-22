import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root'
import type { StreamInfo } from '@/lib/adapters/types'

export default defineContentScript({
	matches: ['*://*.youtube.com/*', '*://*.twitch.tv/*'],
	cssInjectionMode: 'manual',
	runAt: 'document_idle',
	async main(ctx) {
		console.debug('[stream-indicator] content script loaded')

		let root: ReturnType<typeof createRoot> | null = null
		let currentStreamInfo: StreamInfo | null = null
		let currentEndpointNames: string[] = []
		let currentStats = { totalMessages: 0, totalBatches: 0 }
		let dismissed = false

		const ui = await createShadowRootUi(ctx, {
			name: 'context-bro-stream-indicator',
			position: 'overlay',
			zIndex: 2147483645,
			onMount(uiContainer) {
				const style = document.createElement('style')
				style.textContent = `
					@keyframes cb-pulse {
						0%, 100% { opacity: 1; }
						50% { opacity: 0.4; }
					}
				`
				uiContainer.getRootNode().appendChild(style)

				root = createRoot(uiContainer)
				return root
			},
			onRemove(r) {
				r?.unmount()
				root = null
			},
		})

		function render(phase: 'enter' | 'active' | 'exit') {
			if (!root || !currentStreamInfo) return
			root.render(
				<StreamIndicator
					streamInfo={currentStreamInfo}
					endpointNames={currentEndpointNames}
					stats={currentStats}
					phase={phase}
					onDismiss={() => {
						dismissed = true
						ui.remove()
					}}
					onExitDone={() => ui.remove()}
				/>,
			)
		}

		function showIndicator(_platform: string, streamInfo: StreamInfo, endpointNames: string[]) {
			if (dismissed) return

			console.debug('[stream-indicator] showIndicator', streamInfo.channelName)

			currentStreamInfo = streamInfo
			currentEndpointNames = endpointNames
			currentStats = { totalMessages: 0, totalBatches: 0 }

			ui.remove()
			ui.mount()

			// Style inner <html> for pointer-events pass-through
			const innerHtml = ui.shadow.querySelector('html') as HTMLElement | null
			if (innerHtml) {
				innerHtml.style.pointerEvents = 'none'
			}

			render('enter')
		}

		function updateStats(totalMessages: number, totalBatches: number, streamInfo?: StreamInfo) {
			if (dismissed) return
			currentStats = { totalMessages, totalBatches }
			// Keep streamInfo fresh (channel name may arrive late)
			if (streamInfo?.channelName) currentStreamInfo = streamInfo
			render('active')
		}

		function dismissIndicator() {
			if (!root) {
				ui.remove()
				return
			}
			render('exit')
			setTimeout(() => ui.remove(), 300)
		}

		browser.runtime.onMessage.addListener((message) => {
			if (message.action === 'showStreamIndicator') {
				console.debug('[stream-indicator] received showStreamIndicator message')
				showIndicator(
					message.platform,
					message.streamInfo as StreamInfo,
					(message.endpointNames as string[]) || [],
				)
			}
			if (message.action === 'updateStreamIndicator') {
				updateStats(
					message.totalMessages as number,
					message.totalBatches as number,
					message.streamInfo as StreamInfo | undefined,
				)
			}
			if (message.action === 'dismissStreamIndicator') {
				dismissIndicator()
			}
		})

		// Query background for current stream state in case we loaded after the adapter
		try {
			const state = await browser.runtime.sendMessage({ action: 'getStreamState' })
			console.debug('[stream-indicator] getStreamState response:', state)
			if (state?.active && state.streamInfo) {
				showIndicator(
					state.platform,
					state.streamInfo as StreamInfo,
					(state.endpointNames as string[]) || [],
				)
				if (state.totalMessages > 0 || state.totalBatches > 0) {
					updateStats(state.totalMessages as number, state.totalBatches as number)
				}
			}
		} catch (err) {
			console.debug('[stream-indicator] getStreamState failed:', err)
		}
	},
})

// ── Colors (same neutral scheme as focused indicator) ──

const COLORS = {
	light: {
		bg: 'rgba(255,255,255,0.92)',
		color: '#333',
		border: 'rgba(0,0,0,0.1)',
		muted: '#6b7280',
		live: '#10b981',
	},
	dark: {
		bg: 'rgba(30,30,30,0.92)',
		color: '#e5e5e5',
		border: 'rgba(255,255,255,0.1)',
		muted: '#9ca3af',
		live: '#34d399',
	},
}

// ── Platform Icons (inline SVG paths) ──

function YouTubeIcon({ size = 14 }: { size?: number }) {
	return (
		<svg width={size} height={size} viewBox="0 0 24 24" fill="none" role="img" aria-label="YouTube">
			<rect x="2" y="4" width="20" height="16" rx="4" fill="#FF0000" />
			<path d="M10 8.5v7l6-3.5-6-3.5z" fill="white" />
		</svg>
	)
}

function TwitchIcon({ size = 14 }: { size?: number }) {
	return (
		<svg width={size} height={size} viewBox="0 0 24 24" fill="none" role="img" aria-label="Twitch">
			<path d="M4 3L3 7v13h5v3h3l3-3h4l5-5V3H4zm14 11l-3 3h-4l-3 3v-3H5V5h13v9z" fill="#9146FF" />
			<path d="M15 7h2v5h-2V7zm-4 0h2v5h-2V7z" fill="#9146FF" />
		</svg>
	)
}

// ── Component (chip/pill style matching focused indicator) ──

interface IndicatorProps {
	streamInfo: StreamInfo
	endpointNames: string[]
	stats: { totalMessages: number; totalBatches: number }
	phase: 'enter' | 'active' | 'exit'
	onDismiss: () => void
	onExitDone: () => void
}

function StreamIndicator({
	streamInfo,
	endpointNames,
	stats,
	phase,
	onDismiss,
	onExitDone,
}: IndicatorProps) {
	const [visible, setVisible] = useState(false)
	const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
	const c = isDark ? COLORS.dark : COLORS.light

	useEffect(() => {
		if (phase === 'enter') {
			const raf = requestAnimationFrame(() => setVisible(true))
			return () => cancelAnimationFrame(raf)
		}
		if (phase === 'exit') {
			setVisible(false)
			const timer = setTimeout(onExitDone, 300)
			return () => clearTimeout(timer)
		}
		// phase === 'active': keep visible
	}, [phase, onExitDone])

	const isVisible = (visible && phase === 'enter') || phase === 'active'
	const PlatformIcon = streamInfo.platform === 'twitch' ? TwitchIcon : YouTubeIcon
	const channelName = streamInfo.channelName || 'Unknown'

	// Format endpoint display: "Name" or "Name +2"
	let endpointLabel = ''
	if (endpointNames.length > 0) {
		endpointLabel = endpointNames[0]
		if (endpointNames.length > 1) {
			endpointLabel += ` +${endpointNames.length - 1}`
		}
	}

	return (
		<div
			style={{
				position: 'fixed',
				bottom: '16px',
				left: '50%',
				transform: `translateX(-50%) translateY(${isVisible ? '0' : '8px'})`,
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
				transition: 'opacity 0.3s ease, transform 0.3s ease',
				whiteSpace: 'nowrap',
				pointerEvents: 'auto',
				cursor: 'default',
			}}
		>
			<PlatformIcon />
			<span
				style={{
					fontWeight: 600,
					maxWidth: '120px',
					overflow: 'hidden',
					textOverflow: 'ellipsis',
					whiteSpace: 'nowrap',
				}}
			>
				{channelName}
			</span>
			{streamInfo.isLive && (
				<span
					style={{
						width: '6px',
						height: '6px',
						borderRadius: '50%',
						backgroundColor: c.live,
						display: 'inline-block',
						flexShrink: 0,
						animation: 'cb-pulse 2s ease-in-out infinite',
					}}
				/>
			)}
			{endpointLabel && (
				<>
					<span style={{ color: c.muted, opacity: 0.4 }}>{'→'}</span>
					<span style={{ color: c.muted, fontSize: '11px' }}>{endpointLabel}</span>
				</>
			)}
			<span style={{ color: c.muted, opacity: 0.3 }}>{'|'}</span>
			<span style={{ color: c.muted, fontSize: '11px' }}>{stats.totalMessages} msgs</span>
			<span style={{ color: c.muted, opacity: 0.4 }}>{'·'}</span>
			<span style={{ color: c.muted, fontSize: '11px' }}>{stats.totalBatches} batches</span>
			<button
				type="button"
				onClick={onDismiss}
				style={{
					background: 'none',
					border: 'none',
					cursor: 'pointer',
					padding: '0 0 0 2px',
					lineHeight: 1,
					fontSize: '14px',
					color: c.muted,
					opacity: 0.5,
				}}
				onMouseEnter={(e) => {
					e.currentTarget.style.opacity = '1'
				}}
				onMouseLeave={(e) => {
					e.currentTarget.style.opacity = '0.5'
				}}
			>
				{'×'}
			</button>
		</div>
	)
}
