.PHONY: dev dev-docs deploy-docs zip zip-chrome zip-firefox build check typecheck help

# ============================================================================
# Development
# ============================================================================

dev: ## Start extension dev server (Chrome)
	pnpm run dev

dev-docs: ## Start docs dev server (Astro)
	pnpm --filter @context-bro/docs dev

# ============================================================================
# Build & Deploy
# ============================================================================

build: ## Build extension for production
	pnpm run build

zip: ## Package for all platforms (Chrome + Firefox)
	pnpm run zip
	pnpm run zip:firefox

zip-chrome: ## Package for Chrome only
	pnpm run zip

zip-firefox: ## Package for Firefox only
	pnpm run zip:firefox

deploy-docs: ## Build and deploy docs to Cloudflare Pages
	pnpm --filter @context-bro/docs build
	npx wrangler pages deploy packages/docs/dist --project-name=context-bro-docs --commit-dirty=true

# ============================================================================
# Code Quality
# ============================================================================

check: ## Run Biome check (lint + format)
	pnpm run check

typecheck: ## Run TypeScript type checking
	pnpm run typecheck

# ============================================================================
# Help
# ============================================================================

help: ## Show this help message
	@echo "Context Bro Development Commands"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-20s %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
