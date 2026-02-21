# PRD (Product Requirement Document) 创建指南

## 🎯 概述

本指南介绍 Context Bro 的 PRD（产品需求文档）创建工作流。确保每个功能开发都有清晰的产品需求定义。

请根据 prompt 中的需求分析，创建 PRD 文档

## 📋 目录结构

### 1. PRD 存放位置
```
docs/prd/
├── prd-template.md                           # PRD 模板
├── 20260222-context-bro-.../                  # 主 PRD
└── YYYYMMDD-<feature-name>/                   # 功能 PRD
    └── YYYYMMDD-<feature-name>-prd.md
```

### 2. 命名规范
```
YYYYMMDD-<prd key content>-prd.md
```

## 🏗️ PRD 创建工作流

### Phase 1: 需求分析与规划
请根据 prompt 中的需求分析，识别需求来源

### Phase 2: PRD 文档创建
基于项目模板 `docs/prd/prd-template.md` 填写 PRD 内容

## 🔄 PRD 生命周期管理

### 状态管理
```markdown
**Status:** Draft      # 草稿阶段
**Status:** Final      # 定稿可执行
**Status:** Completed  # 开发完成
**Status:** Deprecated # 已废弃
```

## 🎯 最佳实践

- **用户中心**：从用户视角出发，关注用户价值
- **可度量**：每个需求都有明确的验收标准
- **可拆分**：复杂功能拆分为可独立开发的任务
- **保持简单**：PRD 应该聚焦核心需求，避免过度设计

## 🔗 相关资源

- [PRD 模板](../../docs/prd/prd-template.md) - 标准 PRD 文档模板

{{ 额外要求（可留空）： }}
