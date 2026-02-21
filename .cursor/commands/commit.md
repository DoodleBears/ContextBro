# 快速 Commit 生成器 (Quick Commit Generator)

## 🎯 概述

快速生成符合项目规范的 commit message。基于 gitmoji 和 conventional commits 规范，支持自动验证和格式化。

## ⚠️ 重要提醒

**🔴 强制要求：所有代码变更必须通过完整的 linting 检查**（biome）后才能提交

**优先使用 `--no-pager` / `core.pager` / `GIT_PAGER`**：禁用分页器且不影响退出码或后续管道。例如：
- ✅ `git --no-pager status -s`
- ✅ `git --no-pager diff file.ts`
- ✅ `git -c core.pager=cat log --oneline`

## 📝 快速使用指南

### 1. 查看变更
```bash
git status -s | cat
git diff --cached --stat | cat
git diff --cached | cat
```

### 2. 常用作用域 (scope)

| Extension | Core | 通用 |
|-----------|------|------|
| `popup` | `clipper` | `config` |
| `background` | `template` | `utils` |
| `content` | `filters` | `types` |
| `sidebar` | `adapter` | `tests` |
| `ui` | `cron` | `docs` |

### 3. Emoji 使用规范

| Commit 类型 | 必须使用的 Emoji | 示例 |
|------------|-----------------|------|
| `feat` | ✨ | `✨ feat(clipper): add Defuddle content extraction` |
| `fix` | 🐛 | `🐛 fix(cron): resolve alarm scheduling issue` |
| `refactor` | ♻️ | `♻️ refactor(template): simplify AST renderer` |
| `chore` | 🔧 | `🔧 chore(deps): update dependencies` |
| `build` | 📦️ | `📦️ build(wxt): update manifest config` |
| `style` | 💄 | `💄 style(popup): format component code` |
| `perf` | ⚡️ | `⚡️ perf(filters): optimize filter chain` |
| `test` | ✅ | `✅ test(adapter): add YouTube adapter tests` |
| `docs` | 📝 | `📝 docs(prd): update implementation plan` |
| `revert` | ⏪️ | `⏪️ revert(clipper): revert changes` |
| `ci` | 👷 | `👷 ci(pipeline): update config` |

### 4. 运行 Linting 检查

```bash
npx biome check --write --no-errors-on-unmatched --files-ignore-unknown=true .
```

## ❗ 强制要求

- 任何 git diff、git log、git status 等可能分页的命令都必须添加 `| cat`
- **🔴 所有代码变更必须通过 biome linting 检查后才能提交**
- **🔴 所有 commit message 必须使用英文**
- **🔴 每个 commit 类型必须使用对应的 emoji 图标**
