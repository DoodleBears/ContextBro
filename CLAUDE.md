# Context Bro Project Guide

> This document provides essential context for AI assistants working on the Context Bro codebase.
> For architectural concepts and design decisions, always refer to the PRD documentation.

---

## Project Overview

**Context Bro** is a browser extension that lets users share browsing context with AI agents — a Web Clipper for AI.

**Tagline**: *Your AI's eyes on the web.*

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Extension Framework** | WXT (Vite-based) |
| **UI** | React 19 + TailwindCSS v4 |
| **Content Extraction** | Defuddle (from Obsidian Web Clipper) |
| **Template Engine** | AST-based (extracted from Obsidian Web Clipper) |
| **Formatting** | Biome (not ESLint/Prettier) |
| **Language** | TypeScript (strict mode) |
| **Target** | Chrome MV3 (Firefox/Safari later) |

---

## Project Structure

```
context-bro/
├── .agents/                    # Project-local agent skills
├── .claude/                    # Claude-specific config
├── .cursor/                    # Cursor command/skill config
│
├── src/
│   ├── entrypoints/            # WXT convention
│   │   ├── popup/              # Extension popup (React)
│   │   ├── background/         # Service worker (alarms, messaging)
│   │   ├── content/            # Content scripts (DOM extraction)
│   │   └── sidepanel/          # Chrome Side Panel (future)
│   │
│   ├── components/             # Shared React components
│   ├── lib/                    # Core logic
│   │   ├── clipper/            # Defuddle integration
│   │   ├── template-engine/    # AST tokenizer/parser/renderer
│   │   ├── filters/            # 50+ content filters
│   │   ├── variables/          # CSS selector & Schema.org variables
│   │   └── api/                # Kite-U API client
│   │
│   └── assets/                 # Icons, images
│
├── docs/prd/                   # Product documentation
├── wxt.config.ts               # WXT configuration
├── biome.json                  # Biome linter/formatter config
└── tsconfig.json               # TypeScript config
```

---

## Commands

```bash
# Development
npm run dev           # Start dev server (Chrome)
npm run dev:firefox   # Start dev server (Firefox)

# Build
npm run build         # Build for Chrome
npm run build:firefox # Build for Firefox

# Package
npm run zip           # Create Chrome Web Store zip
npm run zip:firefox   # Create Firefox zip

# Code Quality
npm run check         # Run Biome linter
npm run check:fix     # Auto-fix lint issues
npm run typecheck     # TypeScript type check
```

---

## Coding Conventions

1. **TypeScript**: Strict mode
2. **Styling**: TailwindCSS v4
3. **Formatting**: Biome (not ESLint/Prettier)
4. **Extension APIs**: Use WXT auto-imports (`defineBackground`, `defineContentScript`, etc.)

---

## Documentation

> **Important**: For architectural concepts, design decisions, and implementation details, always refer to the PRD documents below.

### PRDs

| Document | Path | Description |
|----------|------|-------------|
| **Context Bro PRD** | `docs/prd/20260222-context-bro-browser-context-provider/20260222-context-bro-browser-context-provider-prd.md` | Main product requirement document |
| **PRD Template** | `docs/prd/prd-template.md` | Template for new PRDs |

---

## Logging Standards & References

When adding or modifying logs, follow these references:

| Type | Path | Purpose |
|------|------|---------|
| **Skill (Project-local)** | `.agents/skills/logging-best-practices/SKILL.md` | Wide events / canonical log line best practices |

Required checklist for new logs:

1. Prefer one structured completion log (wide event) per request/service hop.
2. Include correlation fields whenever available: `request_id`, `trace_id`.
3. Use consistent JSON field names (`snake_case`) and stable event names.
4. Never log secrets or sensitive payloads (`token`, `cookie`, `apiKey`, page content).

---

## Key Design Principles

### Allowlist-First Privacy
- **Default: share nothing** — users must explicitly add domains to the Allowlist
- Cron scheduler only extracts from Allowlist domains
- Never extract password fields or incognito tab content

### Separation from Kite-U Extension
- Context Bro is **user-controlled** (web clipper model)
- Kite-U Extension is **agent-controlled** (browser automation)
- Different trust levels, different permissions, different repos

### Obsidian Web Clipper Heritage
- Core logic (Defuddle, template engine, filters) extracted from Obsidian Web Clipper (MIT License)
- UI fully rewritten in React
- Output target: Kite-U API (not `obsidian://`)
