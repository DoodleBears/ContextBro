.PHONY: dev dev-docs deploy-docs zip build check typecheck

# 1. Local extension development (WXT dev server)
dev:
	pnpm run dev

# 2. Local docs development (Astro dev server)
dev-docs:
	pnpm --filter @context-bro/docs dev

# 3. Deploy docs to Cloudflare Pages
deploy-docs:
	pnpm --filter @context-bro/docs build
	npx wrangler pages deploy packages/docs/dist --project-name=context-bro-docs --commit-dirty=true

# 4. Build & package for Chrome Web Store
zip:
	pnpm run zip

# Helpers
build:
	pnpm run build

check:
	pnpm run check

typecheck:
	pnpm run typecheck
