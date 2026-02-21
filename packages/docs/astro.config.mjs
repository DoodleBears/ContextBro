import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'
import starlightThemeObsidian from 'starlight-theme-obsidian'

export default defineConfig({
	site: 'https://contextbro.app',
	vite: {
		css: {
			devSourcemap: false,
		},
	},
	integrations: [
		starlight({
			title: {
				en: 'Context Bro Docs',
				'zh-CN': 'Context Bro 文档',
				ja: 'Context Bro ドキュメント',
			},
			logo: {
				src: './src/assets/logo.svg',
				replacesTitle: false,
			},
			defaultLocale: 'root',
			locales: {
				root: {
					label: 'English',
					lang: 'en',
				},
				zh: {
					label: '简体中文',
					lang: 'zh-CN',
				},
				ja: {
					label: '日本語',
					lang: 'ja',
				},
			},
			sidebar: [
				{
					label: 'Getting Started',
					translations: { 'zh-CN': '快速开始', ja: 'はじめに' },
					items: [
						{
							label: 'What is Context Bro?',
							translations: { 'zh-CN': '什么是 Context Bro?', ja: 'Context Broとは?' },
							slug: '',
						},
						{
							label: 'Quick Start',
							translations: { 'zh-CN': '快速开始', ja: 'クイックスタート' },
							slug: 'getting-started',
						},
					],
				},
				{
					label: 'Concepts',
					translations: { 'zh-CN': '核心概念', ja: 'コンセプト' },
					items: [
						{
							label: 'Architecture',
							translations: {
								'zh-CN': '架构概览',
								ja: 'アーキテクチャ',
							},
							slug: 'concepts/architecture',
						},
						{
							label: 'Privacy & Allowlist',
							translations: { 'zh-CN': '隐私与允许列表', ja: 'プライバシーとAllowlist' },
							slug: 'concepts/privacy',
						},
					],
				},
				{
					label: 'Guides',
					translations: { 'zh-CN': '使用指南', ja: 'ガイド' },
					items: [
						{
							label: 'Templates',
							translations: { 'zh-CN': '模板配置', ja: 'テンプレート' },
							slug: 'guides/templates',
						},
						{
							label: 'Endpoints',
							translations: { 'zh-CN': 'API 端点', ja: 'エンドポイント' },
							slug: 'guides/endpoints',
						},
						{
							label: 'Allowlist & Scheduled Sharing',
							translations: {
								'zh-CN': '允许列表与定时分享',
								ja: 'Allowlistとスケジュール共有',
							},
							slug: 'guides/allowlist-schedule',
						},
						{
							label: 'Selection Sharing',
							translations: { 'zh-CN': '选区分享', ja: '選択テキスト共有' },
							slug: 'guides/selection-sharing',
						},
						{
							label: 'Twitch & YouTube Live',
							translations: {
								'zh-CN': 'Twitch / YouTube 直播',
								ja: 'Twitch / YouTube ライブ',
							},
							slug: 'guides/live-stream',
						},
					],
				},
			],
			plugins: [
				starlightThemeObsidian({
					graph: true,
					backlinks: true,
					graphConfig: {
						visibilityRules: ['**/*'],
						actions: ['fullscreen', 'depth', 'reset-zoom', 'render-arrows', 'settings'],
						depth: 1,
						renderArrows: true,
						nodeCurrentStyle: {
							shapeSize: 25,
						},
					},
				}),
			],
			components: {
				PageSidebar: './src/components/PageSidebar.astro',
			},
			customCss: ['./src/styles/custom.css'],
			lastUpdated: true,
			tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
		}),
	],
})
