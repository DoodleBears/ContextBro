# Issue 创建器 (GitHub CLI)

## 🎯 概述

使用 GitHub CLI (`gh`) 高效创建 GitHub Issue 的标准化工作流。

## 📝 快速使用指南

### 1. 环境准备
```bash
gh auth login
gh auth status
```

### 2. 创建 Issue
```bash
# 基础创建
gh issue create --title "🐛 Bug: content extraction fails on SPA" \
               --body "Steps to reproduce:..." \
               --label "bug,high-priority"

# 指定标签和分配人
gh issue create --title "✨ feat: Add YouTube adapter" \
               --assignee "developer1" \
               --label "enhancement,adapter"
```

### 标签规范
- **类型标签**: `bug`, `enhancement`, `documentation`, `question`
- **优先级标签**: `low-priority`, `medium-priority`, `high-priority`, `critical`
- **状态标签**: `status/backlog`, `status/in-progress`, `status/review`, `status/done`
- **模块标签**: `clipper`, `cron`, `adapter`, `popup`, `background`, `template`

## ⚠️ 强制要求
- 任何 gh issue list 等可能分页的命令都必须添加 `| cat`
- 创建临时的 .md 文件编写 description 后再用 gh cli 创建 issue
- 先检查需要创建的 label 是否存在，如果不存在，先创建 label

我现在需要创建1个issue，请用中文编写，参考以下内容：
