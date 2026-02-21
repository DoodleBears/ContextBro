# Chrome Web Store Listing

## Basic Info

- **Name**: Context Bro
- **Short description** (132 chars max): Web Clipper for AI Agents — share browsing context with your AI companion via custom API endpoints.
- **Category**: Productivity
- **Language**: English

## Detailed Description

Context Bro lets you clip web pages and send browsing context to any API endpoint — designed for AI agent workflows.

**Key Features:**

- Share page content to your own API endpoints with one click, keyboard shortcut, or right-click menu
- Template-driven payloads — full control over JSON shape using {{variables}} and 50+ filters
- 7 built-in template presets (General, GitHub PR, Stack Overflow, News, Reddit, YouTube, Selection)
- Scheduled auto-sharing for allowlisted domains with content dedup
- Live stream chat capture for Twitch and YouTube (chat messages, donations, subscriptions)
- Allowlist-first privacy model — default: share nothing

**How it works:**

1. Configure your API endpoint(s) in Settings
2. Browse normally — click the extension or press Ctrl+Shift+K to share
3. Context Bro extracts the page, compiles your template, and POSTs the JSON to your API

**Privacy first:**

- No data collection, no analytics, no tracking
- No server-side components — your data goes only where you tell it
- All settings stored locally in your browser
- Full source code available for review

**Use cases:**

- Feed web context to your AI assistant (Claude, ChatGPT, custom agents)
- Build a personal knowledge base from web clippings
- Monitor live stream chat for AI-powered moderation
- Automated research pipelines with scheduled extraction

## Permissions Justification

| Permission | Reason |
|------------|--------|
| `activeTab` | Read page content when user clicks Share |
| `scripting` | Inject content extraction script into pages |
| `storage` | Save user settings (endpoints, templates, allowlist) locally |
| `alarms` | Power scheduled sharing at user-configured intervals |
| `tabs` | Query open tabs for scheduled extraction of allowlisted domains |
| `contextMenus` | Add "Share to Context Bro" right-click menu items |

## Content Matches

| Pattern | Reason |
|---------|--------|
| `<all_urls>` (content script) | Page content extraction on any site when triggered by user |
| `*://*.twitch.tv/*` | Twitch live chat adapter |
| `*://*.youtube.com/watch*`, `*://*.youtube.com/live*` | YouTube live chat + VOD transcript adapter |

## Assets Checklist

- [ ] Icon 16x16 (toolbar)
- [ ] Icon 32x32
- [ ] Icon 48x48 (extensions page)
- [ ] Icon 128x128 (Chrome Web Store)
- [ ] Screenshot 1: Popup with page preview (1280x800)
- [ ] Screenshot 2: Options — Endpoint configuration (1280x800)
- [ ] Screenshot 3: Options — Template editor with presets (1280x800)
- [ ] Screenshot 4: Right-click context menu (1280x800)
- [ ] Screenshot 5: Selection floating button (1280x800)
- [ ] Promotional tile 440x280 (optional)

## Review Notes

- Single purpose: Web page clipping and sharing to user-configured API endpoints
- No remote code execution
- No minified/obfuscated code (source maps available)
- Privacy policy URL: `chrome-extension://<id>/privacy.html`
