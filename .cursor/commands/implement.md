# 功能实现指南 (Implementation Guide)

## 🎯 概述

本指南提供 Context Bro 的功能实现工作流，从 PRD 开始到最终提交 Pull Request 的完整过程。

请根据 prompt 提示的需求或者 PRD 文档，完成功能实现。

## 🚀 实现工作流

### Phase 1: 分析和规划

#### 1.1. 审查 PRD 文档
```bash
# 查看对应的 PRD 文档
# 例如：docs/prd/20260222-context-bro-.../

# 重点关注：
# - Detailed Requirements 部分
# - Implementation Plan 部分
# - Data Model Design 部分（如适用）
```

#### 1.2. 识别需要修改的文件
基于 PRD 中的引用，列出需要修改的文件：

```bash
# WXT 项目结构
# src/entrypoints/popup/     — Popup UI
# src/entrypoints/background/ — Service worker
# src/entrypoints/content/    — Content scripts
# src/lib/                    — Core logic (Defuddle, template engine, filters)
# src/components/             — React components
```

### Phase 2: 核心实现

按照 PRD 的 Implementation Plan 逐步实现

### Phase 3: 文档更新

实现完成后更新 PRD 状态

## 🎯 最佳实践

- **渐进式开发**: 小步快走，频繁提交
- **遵循现有模式**: 与项目代码风格保持一致
- **安全 / 隐私**: 输入校验、Allowlist-first、不提取 password 字段
- **可观测性**: 结构化日志

---

💡 **提示**: 始终将 PRD 文档作为实现指南，定期参考验收标准，确保实现符合预期。
