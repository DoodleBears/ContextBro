# PRD: Context Bro — Browser Context Provider for AI Agent

**Status:** Draft
**Created:** 2026-02-22
**Author:** Architecture Team / Product
**Module:** Standalone Browser Extension — Context Bro (WXT + React, Obsidian Web Clipper 核心逻辑抽取)

---

## Phase Progress Overview

| Phase | Name | Status | Link |
|-------|------|--------|------|
| 1 | WXT 项目搭建 & Core Clipper 功能 | ✅ Completed | [Phase 1 Checklist](#phase-1-checklist) |
| 2 | Scheduled Context Sharing (Cron) | ✅ Completed | [Phase 2 Checklist](#phase-2-checklist) |
| 3 | Platform Adapters — Twitch & YouTube | 🔲 Pending | [Phase 3 Checklist](#phase-3-checklist) |
| 4 | Documentation & Launch | 🔲 Pending | [Phase 4 Checklist](#phase-4-checklist) |

> Status Legend: ✅ Completed | 🔄 In Progress | 🔲 Pending

---

## 1. Overview

### 1.1 Background: 为什么要两个 Extension

Kite-U 已有一个浏览器 Extension（`packages/extension/`）。Context Bro 必须是**独立的第二个 Extension**，原因：

| | Kite-U Extension | Context Bro |
|--|------------------|-------------|
| **核心行为** | **代替用户操作浏览器** — 后台打开 tab、注入脚本、自主搜索 | **用户主动分享浏览内容** — Web Clipper + 定时分享 |
| **权限模型** | 激进（`<all_urls>` + `scripting`），Agent 主动驱动 | 保守（Allowlist-first），用户完全控制 |
| **隐私等级** | 高风险：Agent 可以看任意网页 | 低风险：只看用户显式允许的网页 |
| **触发方** | Server (SSE exploration_task) | 用户（手动 clip / 选区）或用户配置的定时器 |
| **安装意愿** | 需要信任 Agent（高门槛） | Web Clipper 心智模型（低门槛） |
| **技术基底** | 自研（React + Zustand + SSE） | **Fork of Obsidian Web Clipper**（Vanilla TS + Defuddle） |

**分离的价值：**
1. 用户可以只装 Context Bro 而不装 Kite-U Extension（降低门槛）
2. Chrome Web Store 审核更容易通过（权限更少）
3. 基于成熟的 Obsidian Web Clipper（MIT License），大幅减少开发量
4. 两个 Extension 可独立迭代

### 1.2 Obsidian Web Clipper 作为基底

[Obsidian Web Clipper](https://github.com/obsidianmd/obsidian-clipper) — MIT License, 3k+ stars, by kepano (Steph Ango)

**可直接复用的能力：**

| Obsidian Web Clipper 能力 | Context Bro 中的用途 |
|--------------------------|---------------------|
| **Defuddle** 内容提取（优于 Readability） | 页面全文提取 |
| **模板引擎**（tokenizer → parser → AST → renderer） | JSON 打包模板（替代 Markdown 输出） |
| **50+ Filters**（`lower`, `split`, `date`, `markdown`, `strip_tags`...） | 内容过滤和格式化 |
| **CSS Selector 变量**（`{{selector:h1}}`） | 站点特定内容提取 |
| **Schema.org 变量**（`{{schema:@Movie:genre}}`） | 结构化数据提取 |
| **Highlight Mode**（选区 + 元素高亮 + 注释） | Selection Context |
| **Template Triggers**（URL pattern / regex / schema auto-match） | 按域名自动选择模板 |
| **33 语言 i18n** | 国际化基础 |
| **MV3 跨浏览器**（Chrome / Firefox / Safari manifest） | 多浏览器支持 |
| **Side Panel + Popup + Embedded 三种 UI 模式** | 灵活的 UI 入口 |

**需要改造的部分：**

| 改造项 | 原始 | 改为 |
|--------|------|------|
| **输出目标** | `obsidian://` URI scheme + clipboard | **用户自定义 API endpoints**（POST，支持多个命名 endpoint） |
| **模板输出格式** | Markdown (`.md` 文件) | **Template-driven payload**（模板编译结果即 POST body，用户完全控制 JSON 形状） |
| **认证** | 无（本地 Obsidian） | **自定义 Headers**（用户配置 key-value header pairs，支持 Bearer/API Key/任意 auth） |
| **Vault 选择** | Obsidian Vault | **Endpoint 选择**（用户配置的多个 API endpoint） |
| **Note 行为** | create / append / prepend / overwrite | POST body = compiled template（用户自行决定 JSON 结构） |
| **YAML Frontmatter** | Obsidian Properties | 移除（模板直接输出完整 JSON） |
| **新增：定时 Cron** | ❌ 无 | ✅ Chrome Alarm + Allowlist 自动分享 |
| **新增：Platform Adapters** | ❌ 无 | ✅ Twitch / YouTube live context |
| **移除：AI Interpreter** | LLM prompt 变量 | 移除（Agent 自行处理 context，不在 clipper 内 LLM） |
| **移除：Reader Mode** | 阅读模式 | 移除（Context Bro 专注于分享，不改变阅读体验） |

### 1.3 Social Stream Ninja 作为动态上下文参考

[Social Stream Ninja](https://github.com/steveseguin/social_stream) — GPL-3.0, ~1k stars, by Steve Seguin

如果说 Obsidian Web Clipper 解决了"**静态网页阅读上下文**"（Phase 1），那么 Social Stream Ninja (SSN) 是 "**直播/动态实时上下文**"（Phase 3）的最佳架构参考。

SSN 是一个整合了 120+ 直播/社交平台 live chat 的浏览器扩展，其核心价值在于 Steve Seguin 完成了全平台最脏最累的逆向工程——每个平台的 DOM 选择器、MutationObserver 配置、消息归一化逻辑。

**SSN 的核心架构模式（Phase 3 参考）：**

| SSN 能力 | Context Bro Phase 3 中的用途 |
|----------|----------------------------|
| **全平台 DOM 选择器字典** — 120+ 平台的 chat container 锚点、消息节点选择器、动态类名 fallback | Twitch/YouTube adapter 的 MutationObserver 目标节点 |
| **数据归一化 (Normalized Message)** — 不同平台的 chat 统一为标准 JSON（username, message, badges, donation, membership） | `NormalizedChatMessage` 接口设计 |
| **三层捕获策略** — MutationObserver (主) → WebSocket 拦截 (备) → 轮询 (兜底) | Adapter 的 fallback 策略 |
| **高频消息节流与批量处理** — 延迟处理队列（20ms tick）、滑动窗口去重（6s）、采样逻辑 | Chat batching + dedup + sampling |
| **平台 DOM 变更应对** — 级联 selector fallback、多 Observer 策略（Twitch: native/7TV/FFZ 共存） | Adapter 的健壮性设计 |
| **Generic Heuristic Scraper** — 按域名学习成功的 CSS selector 模式，支持无专用 adapter 的站点 | 未来扩展：通用直播平台支持 |

**⚠️ 许可证差异与使用策略：**

| | Obsidian Web Clipper | Social Stream Ninja |
|--|---------------------|---------------------|
| **License** | MIT（可直接复制代码） | **GPL-3.0**（Copyleft） |
| **使用方式** | 直接抽取 60+ 源码文件到 `src/lib/` | **仅参考架构模式，独立用 TypeScript 重新实现** |
| **Context Bro 许可证** | MIT（不受影响） | MIT（不受影响——未复制代码） |

**具体策略：**
- Clone SSN 仓库到本地作为参考（不 fork、不 push、不复制代码）
- 学习其平台 DOM 选择器（这些是第三方平台 DOM 结构的事实描述，非 SSN 创作）
- 学习其 MutationObserver 配置策略（工程经验，非版权保护的表达）
- 学习其消息归一化 schema（数据结构设计，通常不受版权保护）
- 用 TypeScript 独立实现，采用更现代的架构（WXT Content Script + 类型安全 + 模块化）
- 结果：比 SSN 的 Vanilla JS 全局脚本有更优雅的架构，且包含更丰富的平台特定信息

**Context Bro 的双引擎架构：**

```
静态引擎 (Phase 1, Obsidian Clipper MIT)     动态引擎 (Phase 3, SSN-inspired, 独立实现)
├── Defuddle 内容提取                          ├── Platform Adapter (per-site content script)
├── Template Engine (AST)                     │   ├── MutationObserver / Poll / WS fallback
├── 50+ Filters                               │   ├── NormalizedChatMessage schema
├── CSS Selector / Schema.org 变量            │   └── Batch + sample + dedup
└── 输出: 静态页面 → JSON → POST               └── 输出: 实时流 → JSON → POST
```

### 1.4 技术选型：三种路径对比

| 维度 | A. 直接 Fork Obsidian Clipper | B. Plasmo (React) | C. WXT (Vite + React) |
|------|-------------------------------|--------------------|-----------------------|
| **基底** | 原 repo 完整 fork | 全新项目，抽取 Defuddle + 模板引擎作为库 | 全新项目，抽取 Defuddle + 模板引擎作为库 |
| **UI 框架** | Vanilla TS（手写 DOM） | React（一等公民，真 HMR） | React（Vite HMR） |
| **Bundler** | Webpack（原项目自带） | Parcel（Plasmo 内置） | **Vite**（与 Kite-U web 一致） |
| **Manifest 管理** | 手写 3 份 manifest | 自动生成（约定式） | 自动生成（约定式） |
| **CSUI 注入** | 手写 Shadow DOM | 内置 Shadow DOM + React render | 内置 Shadow DOM + 框架无关 |
| **Messaging** | 手写 `chrome.runtime` | `@plasmohq/messaging`（类型安全） | `defineExtensionMessaging`（类型安全） |
| **Stars / 维护** | 3k / Obsidian 团队活跃 | 12.9k / **维护放缓，社区有弃用信号** | 7.9k / **活跃维护，增速最快** |
| **TailwindCSS v4** | 需自行配置 | **不兼容**（Parcel 版本滞后） | ✅ 原生支持 |
| **与 Kite-U 技术栈一致性** | ❌ Vanilla TS ≠ React | ⚠️ Parcel ≠ Vite | ✅ **Vite + React = 完全一致** |
| **Dev 体验** | 无 HMR（手动 reload） | React HMR（非 React 无 HMR） | Vite HMR（所有框架） |
| **上手成本** | 低（已有代码）但改造多 | 中（新框架学习） | 中（新框架学习） |
| **长期风险** | 追踪上游 merge conflict | Plasmo 停止维护 / Parcel 债务 | 低（Vite 生态稳定） |

#### ✅ 决定方案：C. WXT + 抽取 Obsidian Clipper 核心逻辑 + SSN 架构参考

```
决定理由：

1. Vite 一致性 — Kite-U web 已使用 Vite，Extension 也用 Vite 减少认知负担
2. React 一致性 — Kite-U web 使用 React 19，复用组件和 hooks
3. 活跃维护 — WXT 团队活跃，社区增长快，无 Plasmo 的维护放缓问题
4. TailwindCSS v4 — WXT + Vite 原生支持，无 Parcel 兼容性问题
5. Obsidian 精华照搬 — Defuddle (npm 包)、模板引擎、filters 均为纯 TS 逻辑，
   可以 npm install / copy-paste 到 WXT 项目中使用
```

**如何抽取 Obsidian Clipper 的核心逻辑：**

| 组件 | 来源 | 抽取方式 |
|------|------|----------|
| **Defuddle** 内容提取 | `npm install defuddle` | 独立 npm 包，直接安装 |
| **Turndown** HTML→Markdown | `npm install turndown` | 独立 npm 包，直接安装 |
| **模板引擎** (tokenizer/parser/renderer) | `obsidian-clipper/src/utils/` | Copy 源码到 `src/lib/template-engine/`（MIT License） |
| **50+ Filters** | `obsidian-clipper/src/utils/filters/` | Copy 源码到 `src/lib/filters/` |
| **CSS Selector 变量** | `obsidian-clipper/src/utils/variables/selector.ts` | Copy 源码 |
| **Schema.org 变量** | `obsidian-clipper/src/utils/variables/schema.ts` | Copy 源码 |
| **Trigger 匹配 (Trie)** | `obsidian-clipper/src/utils/triggers.ts` | Copy 源码 |
| **Highlighter** | `obsidian-clipper/src/utils/highlighter.ts` | Copy 源码，用 React 重写 UI 层 |

**UI 部分全部用 React 重写**（Popup、Settings、CSUI 浮动按钮），不 fork Obsidian 的 Vanilla TS DOM 代码。

### 1.5 设计理念

```
Context Bro = Web Clipper for AI Agents

技术栈:  WXT (Vite) + React + Obsidian Clipper 核心逻辑 (Defuddle, Template Engine)
参考:    Social Stream Ninja 架构模式 (动态上下文, 独立 TS 实现)
输出:    网页 → 模板 → JSON → POST 用户自定义 API endpoint(s)

关键设计决策:
- 独立 Extension，不绑定任何特定后端
- 多个命名 Endpoints（用户配置 URL + 自定义 Headers）
- Template-driven payload（模板编译结果即 POST body，用户完全控制 JSON 形状）
- 双引擎架构：静态引擎 (Obsidian Clipper) + 动态引擎 (SSN-inspired)
```

### 1.6 Target Users

| Role | Description | Permissions |
|------|-------------|-------------|
| **Agent Owner** | 安装 Context Bro，配置 Allowlist + 模板 + 定时器 | Extension Settings |
| **Agent (LLM)** | 消费 Context Event，理解用户当前关注 | Event Stream 只读 |

### 1.7 Core Value

1. **低门槛安装**：Web Clipper 心智模型，无需信任 Agent 操作浏览器
2. **模板驱动**：复用 Obsidian Web Clipper 的强大模板系统，用户可精确控制分享什么
3. **持续感知**：Cron 定时 + Allowlist，Agent 可以持续感知用户关注的领域
4. **精确分享**：Highlight Mode 选区分享，CSS Selector 精确提取
5. **共同体验**：Twitch/YouTube adapter（参考 SSN 架构），Agent 和用户一起看直播
6. **成熟基底**：静态引擎 fork Obsidian Web Clipper（MIT）；动态引擎参考 Social Stream Ninja 架构模式（独立 TS 实现）

---

## 2. System Architecture

### 2.1 Project Structure (WXT + React，抽取 Obsidian Clipper 核心)

```
context-bro/                          # 独立 repo，WXT 新项目
├── src/
│   ├── entrypoints/                  # WXT 约定目录：每个文件 = manifest 入口
│   │   ├── background.ts             # Service worker (cron scheduler + message routing)
│   │   ├── popup/                    # Popup UI (React)
│   │   │   ├── App.tsx
│   │   │   ├── main.tsx
│   │   │   └── style.css
│   │   ├── options/                   # Settings 页面 (React)
│   │   │   ├── App.tsx               # Templates + Allowlist + Schedule + General
│   │   │   └── main.tsx
│   │   └── content/                   # Content scripts
│   │       ├── extractor.ts           # 页面提取 (Defuddle, 无 UI)
│   │       ├── selection-button.tsx    # 浮动 🪁 按钮 (CSUI, Shadow DOM React)
│   │       └── adapters/              # Platform adapters (content script)
│   │           ├── twitch.ts          # Twitch chat MutationObserver
│   │           └── youtube.ts         # YouTube transcript + live chat
│   │
│   ├── lib/                           # 从 Obsidian Clipper 抽取的纯 TS 逻辑 (MIT)
│   │   ├── template-engine/           # tokenizer → parser → AST → renderer
│   │   │   ├── tokenizer.ts
│   │   │   ├── parser.ts
│   │   │   ├── renderer.ts
│   │   │   └── compiler.ts
│   │   ├── filters/                   # 50+ filters (lower, split, markdown, date...)
│   │   │   ├── index.ts
│   │   │   ├── string.ts
│   │   │   ├── array.ts
│   │   │   ├── date.ts
│   │   │   └── ...
│   │   ├── variables/                 # Variable resolvers
│   │   │   ├── preset.ts             # {{title}}, {{content}}, {{url}}, ...
│   │   │   ├── selector.ts           # {{selector:h1}}, {{selector:img?src}}
│   │   │   └── schema.ts             # {{schema:@Movie:genre}}
│   │   ├── triggers.ts               # Trie + regex URL 匹配 → auto-select template
│   │   └── highlighter.ts            # Highlight 核心逻辑 (纯 TS, UI 由 React 渲染)
│   │
│   ├── components/                    # React 组件 (全新, 非 fork)
│   │   ├── TemplateEditor.tsx         # 模板编辑器 (变量 + filters + preview)
│   │   ├── AllowlistManager.tsx       # 域名 Allowlist CRUD
│   │   ├── ScheduleConfig.tsx         # Cron 配置 (interval + mode)
│   │   ├── AgentSelector.tsx          # Kite-U Agent 选择
│   │   ├── JsonPreview.tsx            # 模板编译结果 JSON 预览
│   │   ├── VariableInspector.tsx      # 当前页面可用变量检查器
│   │   └── HighlightControls.tsx      # 高亮模式控制
│   │
│   ├── stores/                        # Zustand stores
│   │   ├── auth.ts                    # Kite-U 登录状态
│   │   ├── templates.ts              # 模板列表
│   │   ├── allowlist.ts              # 域名 allowlist
│   │   └── schedule.ts               # Cron 配置
│   │
│   ├── hooks/                         # React hooks
│   │   ├── useKiteApi.ts             # POST /api/extension/context
│   │   └── useTemplateCompile.ts     # 实时模板编译预览
│   │
│   └── assets/                        # 图标、品牌资源
│
├── wxt.config.ts                      # WXT 配置 (Vite plugins, manifest overrides)
├── tailwind.config.ts                 # TailwindCSS v4
├── package.json
└── tsconfig.json
```

**WXT 约定：**
- `src/entrypoints/background.ts` → 自动注册为 `background.service_worker`
- `src/entrypoints/popup/` → 自动注册为 `action.default_popup`
- `src/entrypoints/options/` → 自动注册为 `options_ui.page`
- `src/entrypoints/content/*.ts` → 自动注册为 `content_scripts[]`
- `src/entrypoints/content/*.tsx` → CSUI（Shadow DOM 注入 React 组件）
- Manifest 由 WXT **自动生成**，无需手写

### 2.2 数据流

```
┌───────────────────────────────────────────────────────────────┐
│  Context Bro Extension (Browser)                               │
│                                                                │
│  ┌──────────────────────────────────────────────┐             │
│  │  Trigger Sources                              │             │
│  │                                               │             │
│  │  Manual Clip ──┐                              │             │
│  │  (popup click) │                              │             │
│  │                │    ┌──────────────┐          │             │
│  │  Selection ────┼───▶│  Defuddle    │          │             │
│  │  (CSUI button) │    │  Extractor   │          │             │
│  │                │    └──────┬───────┘          │             │
│  │  Context Menu ─┘           │                  │             │
│  │  Keyboard ─────┘           ▼                  │             │
│  │  (Ctrl+Shift+K)    ┌──────────────┐           │             │
│  │                    │  Template    │           │             │
│  │  Cron ────────────▶│  Compiler   │           │             │
│  │  (Chrome Alarm)    │  (AST-based) │           │             │
│  │                    └──────┬───────┘           │             │
│  └───────────────────────────┼───────────────────┘             │
│                              │ compiled payload                │
│                              ▼                                 │
│                 ┌──────────────────────────┐                   │
│                 │  POST to user-configured  │                   │
│                 │  API endpoint(s)          │                   │
│                 │  (custom headers)         │                   │
│                 └────────────┬─────────────┘                   │
└──────────────────────────────┼─────────────────────────────────┘
                               │
                               ▼
              ┌──────────────────────────────┐
              │  Any API (user-configured)    │
              │  e.g. Kite-U, httpbin, etc.   │
              └──────────────────────────────┘
```

### 2.3 输出改造：Obsidian → 用户自定义 API Endpoint

**原始 (Obsidian Web Clipper):**
```typescript
// obsidian-note-creator.ts
const url = `obsidian://new?file=${encodeURIComponent(path + name)}&clipboard`;
openObsidianUrl(url);
```

**改造后 (Context Bro):**
```typescript
// src/lib/api/send.ts
interface Endpoint {
  id: string
  name: string         // e.g. "Work API", "Personal"
  url: string          // POST URL
  headers: Record<string, string>  // custom headers (auth, content-type, etc.)
  enabled: boolean
}

async function sendToEndpoint(endpoint: Endpoint, body: string): Promise<SendResult> {
  const response = await fetch(endpoint.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...endpoint.headers },
    body,  // body = compiled template output (用户通过模板控制 JSON 形状)
  })
  return { ok: response.ok, status: response.status, statusText: response.statusText }
}
```

### 2.4 模板输出格式改造

**原始 (Obsidian):** 输出为 Markdown + YAML frontmatter → `.md` 文件

**改造 (Context Bro):** 输出为 JSON → Event payload

用户在模板中可以用同样的变量和过滤器，但输出目标是 JSON：

```
── Obsidian Template ──                ── Context Bro Template ──
---                                    {
title: "{{title}}"                       "title": "{{title}}",
author: "{{author}}"                     "author": "{{author}}",
url: "{{url}}"                           "url": "{{url}}",
---                                      "summary": "{{description}}",
                                         "content": "{{content|truncate:5000}}",
{{content}}                              "tags": "{{selector:.tag|join:','}}"
                                       }
```

**关键：** 模板引擎（tokenizer/parser/AST/renderer + 50 个 filters）完全保留，只改输出容器。

---

## 3. Feature Design

### 3.1 Feature 1: Manual Clip（基于 Obsidian Web Clipper 保留功能）

即 Obsidian Web Clipper 的核心功能，改输出到 Kite-U：

- **一键 Clip**：点击 Extension 图标 / 快捷键 → 提取页面 → 模板编译 → 发送到 Kite-U
- **模板选择**：自动匹配（Trigger）或手动选择
- **变量检查器**：查看当前页面可用的所有变量
- **Highlight Mode**：选区高亮 + 注释 → 只分享高亮部分
- **Agent 选择**：替代 Vault 选择 — 用户选择发送到哪个 Agent

### 3.2 Feature 2: Domain Allowlist & Scheduled Context（新增）

Obsidian Web Clipper 没有定时功能。这是 Context Bro 的核心新增。

#### 3.2.1 Domain Allowlist

```typescript
interface ContextBroScheduleConfig {
  enabled: boolean
  intervalMinutes: number           // 5-120 min, default 15
  mode: 'focused' | 'all_allowed'  // focused tab only vs all allowed tabs
  allowlist: AllowlistEntry[]
}

interface AllowlistEntry {
  pattern: string                  // e.g. "github.com", "*.reddit.com"
  enabled: boolean
  templateId?: string              // 指定使用的模板（可选，默认用 trigger 匹配）
}
```

**与 Obsidian Web Clipper Template Triggers 的关系：**
- Triggers 决定**用哪个模板**（URL pattern → Template）
- Allowlist 决定**是否自动分享**（域名 → 允许 Cron 提取）
- 两者互补：Allowlist 控制"能不能自动分享"，Trigger 控制"分享时用什么模板"

#### 3.2.2 Cron Scheduler

```typescript
// 使用 Chrome Alarms API（Service Worker 休眠后仍可唤醒）
chrome.alarms.create('context-bro-schedule', {
  periodInMinutes: config.intervalMinutes
})

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'context-bro-schedule') return

  const tabs = config.mode === 'focused'
    ? await chrome.tabs.query({ active: true, currentWindow: true })
    : await chrome.tabs.query({})

  for (const tab of tabs) {
    if (!matchesAllowlist(tab.url, config.allowlist)) continue
    if (isDeduplicated(tab.url, lastContentHash)) continue

    // Extract → Template compile → POST to Kite-U
    const content = await extractContent(tab.id)
    const compiled = await compileTemplate(content, matchedTemplate)
    await sendToKite({ event_type: 'page_context', ...compiled })
  }
})
```

**Dedup：** 对每个 URL 的提取内容计算 SHA-256，未变化则跳过。

### 3.3 Feature 3: Selection Context（基于 Highlight Mode 扩展）

Obsidian Web Clipper 已有完整的 Highlight Mode（选区 + 元素高亮 + 注释 + 持久化）。Context Bro 在此基础上增加"快速发送"：

| 原始行为 (Obsidian) | Context Bro 改造 |
|---------------------|-----------------|
| 选区 → 存入 `{{highlights}}` 变量 → 用户 Clip 时一起发 | 选区 → 即时发送到 Kite-U（无需打开 Popup） |
| 元素高亮 → 持久化到 Storage → Clip 时包含 | 元素高亮 → 即时发送（可选） |
| 注释 → 存入高亮数据 | 注释 → 作为 context 附加到 Event |

**新增快捷路径（✅ Phase 1 已实现）：**
- 选中文本 → 快捷键 `Ctrl+Shift+K` / `Cmd+Shift+K` → 立即发送到默认 endpoint（无 Popup）
- 选中文本 → 右键 → "Share selection to Context Bro" → 立即发送
- 选中文本 → 浮动 "Share to AI" 按钮（CSUI Shadow DOM）→ 立即发送

### 3.4 Feature 4: Platform Adapters — Twitch & YouTube（新增，参考 SSN 架构）

> **架构参考：** [Social Stream Ninja](https://github.com/steveseguin/social_stream) (GPL-3.0)
> 参考其架构模式和平台 DOM 知识，用 TypeScript 独立实现。不复制代码。

#### 3.4.1 Adapter 接口

```typescript
interface PlatformAdapter {
  platform: 'twitch' | 'youtube' | string
  match(url: URL): boolean
  init(): Promise<void>
  destroy(): void
  getStreamInfo(): StreamInfo | null
  onChatBatch(cb: (batch: ChatBatch) => void): void
  onTranscript?(cb: (chunk: TranscriptChunk) => void): void
}

interface StreamInfo {
  platform: string
  channelName: string
  channelAvatar?: string
  title: string
  category?: string         // Twitch: game/category; YouTube: video category
  viewerCount?: number
  isLive: boolean
  startedAt?: string
  url: string
}
```

#### 3.4.2 Normalized Chat Message Schema（SSN-inspired, 更丰富）

SSN 使用 `chatname`/`chatmessage` 等扁平命名。Context Bro 设计更结构化、类型安全的 schema，且包含 SSN 未覆盖的平台特定信息：

```typescript
interface NormalizedChatMessage {
  // Identity
  platform: string                    // "twitch" | "youtube"
  username: string                    // 登录名 (twitch login name, youtube channel ID)
  displayName: string                 // 显示名 (可含 emoji/unicode)
  avatarUrl?: string                  // 头像 URL
  nameColor?: string                  // 用户名颜色 (Twitch 特有)

  // Content
  message: string                     // 纯文本消息 (HTML stripped)
  emotes?: EmoteRef[]                 // 表情引用 (ID + 位置, 不内嵌 HTML)

  // Roles & Badges (SSN 仅有 mod/member/vip，我们更细)
  roles: ChatRole[]                   // ['broadcaster', 'moderator', 'vip', 'subscriber']
  badges?: Badge[]                    // 完整 badge 列表 (subscriber tier, bits tier, etc.)
  subscriberTier?: number             // Twitch: 1/2/3; YouTube: member level
  subscriberMonths?: number           // 连续订阅月数

  // Monetization (SSN 有 hasDonation 字符串，我们结构化)
  monetization?: {
    type: 'bits' | 'superchat' | 'supersticker' | 'gift_sub' | 'donation'
    amount: number                    // 数值金额
    currency?: string                 // "USD", "JPY", "bits"
    formattedAmount: string           // "$5.00", "100 Bits", "¥500"
    tier?: number                     // Gift sub tier
    giftCount?: number                // 批量 gift sub 数量
    message?: string                  // Super Chat/Bits 附带消息
  }

  // Membership events
  membership?: {
    type: 'new' | 'resub' | 'gift_received' | 'upgrade'
    months?: number
    tier?: number
    gifterName?: string
  }

  // Platform-specific enrichments (SSN 未覆盖)
  twitch?: {
    messageId: string                 // Twitch message UUID (精确去重)
    channelPointRedemption?: string   // Channel Points 兑换名称
    hypeTrain?: { level: number; progress: number }
    prediction?: { title: string; outcome: string }
    isFirstMessage?: boolean          // 首次在该频道发言
    isReturningChatter?: boolean      // 回归观众标记
  }

  youtube?: {
    liveChatId: string                // YouTube Live Chat message ID
    isChatOwner?: boolean             // 频道主本人
    isChatSponsor?: boolean           // 频道会员
  }

  // Metadata
  event: 'message' | 'donation' | 'membership' | 'gift' | 'raid' | 'system'
  timestamp: number                   // Unix ms
  isDeleted?: boolean                 // 消息被删除 (moderation)

  // Reply context
  replyTo?: {
    username: string
    message: string
  }
}

interface EmoteRef {
  id: string
  name: string
  source: 'native' | 'bttv' | '7tv' | 'ffz'  // Twitch 第三方表情源
  startIndex: number
  endIndex: number
}

interface Badge {
  id: string
  name: string                        // "subscriber", "bits-leader", "predictions"
  version: string                     // Badge 版本/等级
  imageUrl?: string
}

type ChatRole = 'broadcaster' | 'moderator' | 'vip' | 'subscriber' | 'turbo' | 'artist' | 'member'
```

**vs SSN 的消息 schema 对比：**

| 维度 | SSN (`chatname`/`chatmessage`) | Context Bro (`NormalizedChatMessage`) |
|------|------|------|
| 类型安全 | ❌ Vanilla JS, 无类型 | ✅ TypeScript interface |
| 角色 | `mod`, `member`, `vip` (boolean) | `roles: ChatRole[]` + 完整 `badges[]` |
| 订阅 | `membership` (string) | 结构化 `subscriberTier` + `subscriberMonths` |
| 打赏 | `hasDonation` (string), `donoValue` (number) | 结构化 `monetization` (type + amount + currency) |
| 表情 | HTML `<img>` 内嵌 | `EmoteRef[]` 引用 (AI 友好，不含 HTML) |
| 平台特有 | ❌ 扁平混合 | ✅ `twitch?` / `youtube?` 命名空间隔离 |
| Twitch 扩展 | ❌ 缺失 | ✅ Channel Points, Hype Train, Predictions, First Message |
| 删除追踪 | 部分 (deletion observer) | ✅ `isDeleted` flag |

#### 3.4.3 三层捕获策略（参考 SSN 经验）

SSN 在 120+ 平台上积累的经验表明，单一 MutationObserver 策略不够健壮。Context Bro 采用三层 fallback：

| Tier | 方式 | 适用场景 | SSN 参考 |
|------|------|---------|---------|
| **1 (Default)** | MutationObserver | 大多数平台，DOM 结构稳定 | `sources/youtube.js`, `sources/twitch.js` |
| **2 (Fallback)** | WebSocket / API 拦截 | DOM 变更频繁或 React 虚拟 DOM 干扰 | `sources/websocket/youtube.js` |
| **3 (Last resort)** | 轮询 (`setInterval`) | React 重渲染破坏 Observer 的平台 | `sources/facebook.js` (800ms poll) |

**Per-platform MutationObserver 配置（从 SSN 经验中提炼）：**

```typescript
// Twitch — SSN 经验：需要 subtree + attributes，因为 7TV/FFZ 修改 DOM 结构
// 使用延迟处理队列避免高频突变阻塞
const TWITCH_OBSERVER_CONFIG: MutationObserverInit = {
  childList: true,
  subtree: true,          // 7TV/FFZ 扩展会修改 chat DOM 子树
  attributes: true,
  attributeFilter: ['class', 'data-a-target'],  // 检测消息删除
}
// Target: '.chat-scrollable-area__message-container' 或 7TV 替代容器
// 注意：Twitch 有原生 / 7TV / FFZ 三种 DOM 变体，需级联 selector

// YouTube Live Chat — SSN 经验：childList only，不需要 subtree
const YOUTUBE_OBSERVER_CONFIG: MutationObserverInit = {
  childList: true,
  subtree: false,         // YouTube chat items 直接 append 到 #items
}
// Target: 'yt-live-chat-item-list-renderer #items'
// 消息分类通过 tag name: yt-live-chat-text-message-renderer,
//   yt-live-chat-paid-message-renderer, yt-live-chat-membership-item-renderer 等
```

**去重策略（参考 SSN 的滑动窗口）：**
- SSN 使用 6 秒滑动窗口，key = `channel-user-text`
- Context Bro 采用类似策略：`Map<string, number>` 滑动窗口，key = `platform-username-messageHash`，窗口 10 秒
- 额外：Twitch message UUID (`twitch.messageId`) 可直接用于精确去重

#### 3.4.4 Chat 聚合策略

- 30 秒 flush interval
- \> 100 条/30s → 采样策略：
  - **保留**：所有 monetization 消息（bits/superchat/gift sub）
  - **保留**：所有 mod/broadcaster 消息
  - **保留**：所有 membership 事件
  - **采样**：普通消息随机采样至 100 条
- 模板编译后发送：`event_type: 'live_stream'`

#### 3.4.5 Agent 看到的 Event

```
- [02-22 20:00] [evt_cb010] context-bro/twitch (live_stream): [twitch.tv/shroud] "Valorant Ranked" — 45k viewers — Chat (30s): 87 msgs — Sample: alice: "That clutch!", bob: "GG" — Donations: 2 ($15 total) — New subs: 3
- [02-22 16:30] [evt_cb011] context-bro/youtube (live_stream): [youtube.com] "3Blue1Brown: Neural Networks" — User at 8:30/19:12 — Transcript: "each neuron is just a function..." — SuperChat: $10 from user123
```

---

## 4. API Design (Extension-Side)

### 4.1 Endpoint 配置（用户自定义）

Context Bro 不绑定任何特定后端。用户在 Options 页面配置 API endpoint(s)：

```typescript
// src/lib/types.ts
interface Endpoint {
  id: string
  name: string              // e.g. "Work API", "Personal"
  url: string               // POST URL
  headers: Record<string, string>  // custom headers (auth, content-type, etc.)
  enabled: boolean
}
```

用户可配置多个命名 endpoint，每个 endpoint 有独立的 URL 和自定义 headers（支持 Bearer token, API Key, 或任何自定义 auth 方式）。

### 4.2 Payload 格式（Template-Driven）

POST body = 模板编译输出。用户通过模板完全控制 JSON 形状：

```
── Default Template ──
{
  "title": "{{title}}",
  "url": "{{url}}",
  "content": "{{content}}",
  "author": "{{author}}",
  "published": "{{published}}",
  "domain": "{{domain}}",
  "description": "{{description}}",
  "wordCount": {{wordCount}},
  "clippedAt": "{{date}} {{time}}"
}
```

**默认 Content-Type:** `application/json`（可被 endpoint headers 覆盖）

### 4.3 Server 端兼容

Context Bro 不要求特定的 server 实现。任何能接收 POST JSON 的 API 均可作为 endpoint，例如：
- Kite-U API (`/api/extension/context`)
- httpbin.org（测试用）
- 自建 webhook 接收器
- n8n / Zapier webhook
- 任意 REST API

### 4.4 Rate Limiting

Rate limiting 由目标 API server 自行控制。Context Bro 不做客户端限流。

---

## 5. Frontend Design (Extension UI)

### 5.1 Popup — 全新 React UI

全新 React + TailwindCSS 实现，不 fork Obsidian 的 Vanilla TS DOM：

```
┌──────────── Context Bro ──────────────┐
│                                        │
│  Endpoint: [My API ▼]    [Settings ⚙] │
│  Template: [Default ▼]               │
│                                        │
│  ── Page Info ──                       │
│  Title: "How to fix CORS in Vite"      │
│  URL: stackoverflow.com               │
│                                        │
│  ── Preview ──                         │
│  {                                     │
│    "title": "How to fix CORS...",      │
│    "content": "To fix CORS in...",     │
│    "wordCount": 1234,                  │
│    "clippedAt": "2026-02-22 16:30"    │
│  }                                     │
│                                        │
│  [Share]                  [Copy]       │
│                                        │
└────────────────────────────────────────┘
```

**关键 UI 变化（vs Obsidian）：**
- "Add to Obsidian" → "Share"（POST 到用户 endpoint）
- "Vault" 下拉 → "Endpoint" 下拉（多个命名 API endpoint）
- "Note Name/Path/Properties" → 移除（模板控制完整 JSON 结构）
- 新增 Preview（实时模板编译 JSON 预览）
- 新增 Copy 按钮（复制编译后 JSON 到剪贴板）
- 保留：Template selector

### 5.2 Settings — Allowlist & Schedule

Settings 页面新增两个 tab：

```
┌── Settings ──────────────────────────────────────────────────┐
│                                                               │
│  [Templates] [Allowlist] [Schedule] [General]                │
│                                                               │
│  ── Allowlist Tab ──                                         │
│                                                               │
│  Presets: [+News] [+Dev] [+Social] [+Streaming]             │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ ✅ github.com                     Default template   │    │
│  │ ✅ *.reddit.com                   Reddit template    │    │
│  │ ✅ *.twitch.tv          🎮       Twitch adapter      │    │
│  │ ✅ *.youtube.com        📺       YouTube adapter     │    │
│  │ ⬜ news.ycombinator.com          Default template   │    │
│  │                                                      │    │
│  │ [+ Add domain]                                       │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ── Schedule Tab ──                                          │
│                                                               │
│  Auto-share           [ON ✓]                                 │
│  Interval             [15 min ▼]                             │
│  Mode                 [Focused Tab ▼]                        │
│                        • Focused Tab — only the active tab   │
│                        • All Allowed — all tabs in allowlist │
│                                                               │
│  ── General Tab ──                                           │
│                                                               │
│  Kite-U Account       user@example.com  [Logout]             │
│  Default Agent        [Kite ▼]                               │
│  Selection Shortcut   Ctrl+Shift+K                           │
│  Show floating button [ON ✓]                                 │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### 5.3 Template Editor（保留 Obsidian 原有设计）

模板编辑器完整保留——它是 Obsidian Web Clipper 最强大的功能。

用户可以为不同网站配置不同的提取模板：

```
── GitHub PR Template (trigger: github.com/*/pull/*) ──

{
  "title": "{{title}}",
  "pr_number": "{{selector:.gh-header-number}}",
  "author": "{{selector:.author|first}}",
  "status": "{{selector:.State|first|trim}}",
  "description": "{{selector:.comment-body|first|markdown|truncate:3000}}",
  "files_changed": "{{selector:#files_tab_counter|first}}",
  "labels": "{{selector:.IssueLabel|join:','}}"
}
```

```
── Reddit Post Template (trigger: *.reddit.com) ──

{
  "title": "{{title}}",
  "subreddit": "{{selector:[data-testid='subreddit-name']|first}}",
  "score": "{{selector:[data-testid='post-score']|first}}",
  "content": "{{content|truncate:5000}}",
  "top_comments": "{{selector:.comment .md|slice:0:3|join:'\n---\n'}}"
}
```

---

## 6. Implementation Plan

### Phase 1: WXT 项目搭建 & Core Clipper 功能

**Goal:** 用 WXT + React 搭建新项目，集成 Obsidian Clipper 核心逻辑，实现基础 clip → Kite-U API

**Tasks:**
- [x] `pnpm create wxt@latest context-bro --template react` 初始化项目
  - ✅ WXT 0.20.17 + React 19 + TypeScript 5.9 (strict mode)
  - ✅ `wxt.config.ts` 配置完成（React module, srcDir, manifest permissions）
  - ✅ Biome 2.4.4 formatter/linter 配置完成（替代 ESLint/Prettier）
  - ✅ pnpm scripts: `dev`, `build`, `zip`, `check`, `check:fix`, `typecheck`
  - ✅ Manifest permissions 已声明: `activeTab`, `scripting`, `storage`, `alarms`, `tabs`, `contextMenus`
  - ✅ Background service worker (`src/entrypoints/background/index.ts`)
  - ✅ Popup React (`src/entrypoints/popup/`)
- [x] 配置 TailwindCSS v4（`@tailwindcss/vite` + `src/assets/tailwind.css`）
- [x] 安装依赖：`defuddle`, `turndown`, `turndown-plugin-gfm`, `dayjs`
- [x] 从 Obsidian Clipper (MIT) 抽取核心逻辑到 `src/lib/`（60+ 文件）
  - ✅ `template-engine/`：tokenizer, parser, renderer, compiler（移除 prompt 处理）
  - ✅ `filters/`：50+ filter 函数 + registry（移除 debugLog，更新 import 路径）
  - ✅ `variables/`：resolver, simple, selector, schema（移除 browser-polyfill，WXT 自动导入）
  - ✅ `triggers.ts`：Trie + regex URL 匹配（Template → ContextBroTemplate）
  - ✅ `types.ts`：ContextBroTemplate, Endpoint, FilterFunction, Property
  - ✅ `memoize.ts`, `parser-utils.ts`, `string-utils.ts`, `markdown-converter.ts`
- [x] 新建 content script：`src/entrypoints/content/index.ts`
  - ✅ Defuddle 页面提取 + 选区捕获 + 清理 HTML + CSS selector 查询
  - ✅ `src/lib/content-extractor.ts`：buildVariables + extractPageContent
- [x] 新建 API 层：`src/lib/api/send.ts`
  - ✅ `sendToEndpoint(endpoint, body)` — POST 到用户自定义 endpoint
  - ✅ 支持自定义 headers（Bearer/API Key/任意认证方式）
- [x] 新建 Popup UI（React + TailwindCSS）
  - ✅ Endpoint selector、Template selector、JSON Preview、Share/Copy 按钮
  - ✅ 实时模板编译预览
- [x] 新建 Options/Settings UI（React）
  - ✅ Endpoints tab：CRUD endpoints（name, URL, custom headers key-value editor, test button）
  - ✅ Templates tab：CRUD templates（name, triggers, content format editor, variable reference）
  - ✅ General tab：keyboard shortcut info, about
- [x] 右键菜单："Share page to Context Bro"、"Share selection to Context Bro"
- [x] 快捷键：`Ctrl+Shift+K` / `Cmd+Shift+K` 快速分享选区
- [x] CSUI 浮动按钮：`src/entrypoints/selection-button.content/index.tsx`
  - ✅ 选中文本后出现 "Share to AI" 按钮（Shadow DOM React 组件）
- [x] Background service worker 完整实现
  - ✅ Message routing（getPageData, share, compilePreview）
  - ✅ Context menu handlers
  - ✅ Keyboard shortcut handler
  - ✅ Content script 自动注入
  - ✅ Default template（JSON 格式）
- [x] Build 验证：`pnpm run build` 产出 646 KB Chrome MV3 extension

### Phase 1 Checklist

- [x] 手动 Clip 页面 → POST 到用户配置的 API endpoint
- [x] 模板引擎正常工作（变量 + 50+ filters + triggers 从 Obsidian Clipper 抽取）
- [x] CSS Selector 变量正常提取（content script handles `extractContent` messages）
- [x] Selection → 快速分享（浮动按钮 / 右键 / 快捷键 三种路径）
- [x] 右键 "Share page/selection to Context Bro" 可用
- [x] Endpoint selector 可切换目标 endpoint（支持多个命名 endpoint）
- [x] Template selector 可切换模板
- [x] `pnpm run build` 产出 Chrome MV3 可安装包（646 KB）
- [x] TailwindCSS v4 样式正常（Popup + Options）
- [x] CSUI Shadow DOM 浮动按钮正常（选中文本后出现）
- [x] Options 页面：Endpoints / Templates / General 三个 tab
- [x] `pnpm run typecheck` + `pnpm run check` 零错误

### Phase 2: Scheduled Context Sharing (Cron)

**Goal:** 新增定时自动分享——Obsidian Web Clipper 没有的核心新功能

**Tasks:**
- [x] 新建 `src/lib/allowlist.ts`（Allowlist 域名匹配）
  - ✅ 精确域名匹配 + 通配符子域名（`*.reddit.com`）
  - ✅ 内置预设（Dev / News / Social / Streaming）
  - ✅ `matchesAllowlist()` 返回匹配的 AllowlistEntry（含绑定 templateId）
- [x] 新建 `src/components/AllowlistEditor.tsx`（Allowlist UI）
  - ✅ Domain CRUD（add / remove / enable-disable toggle）
  - ✅ 预设快捷按钮（一键添加 Dev / News / Social / Streaming 域名组）
  - ✅ 每个域名可绑定特定 Template（下拉选择）
- [x] 新建 `src/components/ScheduleEditor.tsx`（Schedule UI）
  - ✅ Toggle 开关 + interval 选择（5min ~ 2hr）+ mode 单选（focused / all_allowed）
- [x] 新建 `src/lib/dedup.ts`（SHA-256 内容去重）
  - ✅ `hasContentChanged(url, content)` — 按 URL 存储 content hash，未变化则跳过
- [x] 新建 `src/lib/scheduler.ts`（Cron 调度）
  - ✅ `initScheduler()` — 启动时注册 alarm listener + 恢复已有 alarm
  - ✅ `updateScheduleConfig()` — 更新配置并同步 Chrome alarm
  - ✅ Tab 查询 → Allowlist 过滤 → Dedup → 提取 → 模板编译 → 发送
  - ✅ focused 模式：仅当前窗口活跃 tab
  - ✅ all_allowed 模式：所有匹配 allowlist 的 tab
- [x] 更新 Options 页面：新增 Allowlist + Schedule 两个 tab
- [x] 更新 Background service worker：初始化 scheduler + 处理 `updateSchedule` 消息
- [x] 新增 `manifest.json` permission: `alarms` — ✅ 已在 Phase 1 初始化时声明
- [x] 新增 `manifest.json` permission: `tabs` — ✅ 已在 Phase 1 初始化时声明

### Phase 2 Checklist

- [x] Allowlist 域名匹配正确（精确 / 通配符 / localhost）
- [x] Chrome Alarm 定时触发 → 提取 → Dedup → 发送
- [x] 页面未变化时跳过（SHA-256 content hash 去重）
- [x] focused 模式仅提取当前 tab
- [x] all_allowed 模式提取所有匹配 tab
- [x] 非 Allowlist 域名不被提取
- [x] Options 页面 Allowlist tab：CRUD + 预设 + 模板绑定
- [x] Options 页面 Schedule tab：开关 + interval + mode
- [x] `pnpm run build` 产出 657 KB Chrome MV3 extension
- [x] `pnpm run typecheck` + `pnpm run check` 零错误

### Phase 3: Platform Adapters — Twitch & YouTube（参考 SSN 架构）

**Goal:** Agent 和用户一起看直播/视频

**架构参考：** Clone [Social Stream Ninja](https://github.com/steveseguin/social_stream) 到本地，参考其平台 DOM 选择器和 MutationObserver 策略。用 TypeScript 独立实现，保持 MIT License。

**Tasks:**
- [ ] 新建 `src/lib/adapters/types.ts`（类型定义）
  - `PlatformAdapter` 接口（见 §3.4.1）
  - `StreamInfo` 接口
  - `NormalizedChatMessage` 接口（见 §3.4.2，比 SSN 更丰富）
  - `EmoteRef`, `Badge`, `ChatRole` 类型
  - `ChatBatch` 聚合类型
- [ ] 新建 `src/lib/adapters/base.ts`（Adapter 基类）
  - 通用 MutationObserver 管理（attach / disconnect / reconnect）
  - 滑动窗口去重（`Map<string, number>`，10s 窗口，参考 SSN 6s 窗口）
  - Chat 批量聚合器（30s flush + 采样逻辑，见 §3.4.4）
  - 延迟处理队列（20ms tick，参考 SSN Twitch 实现，避免高频突变阻塞）
- [ ] 新建 `src/lib/adapters/twitch.ts`（参考 SSN `sources/twitch.js`）
  - MutationObserver 配置：`childList + subtree + attributes`（§3.4.3）
  - 级联 selector：原生 Twitch → 7TV → FFZ DOM 变体
  - Stream info 提取（title, category, viewers, uptime）
  - Chat 消息解析：username, displayName, nameColor, roles, badges
  - Emote 解析（native + BTTV + 7TV + FFZ emote sets）
  - Monetization 解析：Bits, Gift Sub（含批量）, Sub, Resub
  - 平台特有信息：Channel Points, Hype Train, Predictions, First Message, Raid
  - 消息删除检测（`data-a-target="chat-deleted-message-placeholder"`）
- [ ] 新建 `src/lib/adapters/youtube.ts`（参考 SSN `sources/youtube.js`）
  - **Live Chat**：
    - MutationObserver 配置：`childList only, no subtree`（§3.4.3）
    - Target: `yt-live-chat-item-list-renderer #items`
    - 消息分类 by tag name（text, paid, membership, supersticker）
    - Super Chat / Super Sticker 解析（金额、颜色、tier）
    - Membership 事件解析
    - 删除检测（`is-deleted` attribute observer）
  - **VOD**：
    - Video info（title, channel, duration, views）
    - Transcript 提取（captions API / DOM `ytd-transcript-segment-renderer`）
    - Progress tracking（`currentTime / duration`）
- [ ] 新建 `src/entrypoints/content/adapters/` — WXT Content Script 注入
  - Per-platform content script（WXT `matches` 声明 URL pattern）
  - `twitch.tv` → 注入 Twitch adapter
  - `youtube.com/watch*`, `youtube.com/live*` → 注入 YouTube adapter
  - Adapter 生命周期：URL 匹配 → init → observe → destroy (on navigate away)
- [ ] Background 集成
  - Adapter content script ↔ background messaging（chat batch 传输）
  - 模板编译：`event_type: 'live_stream'`
  - 发送到用户 endpoints
- [ ] Badge 状态指示（📡 Live adapter active）
- [ ] 更新 `wxt.config.ts`：Twitch + YouTube host permissions

### Phase 3 Checklist

- [ ] Twitch 频道：chat batch → NormalizedChatMessage[] → 模板编译 → POST
- [ ] Twitch：roles/badges/emotes 正确解析
- [ ] Twitch：Bits/Gift Sub/Sub/Raid 事件正确识别
- [ ] Twitch：7TV/FFZ DOM 变体兼容
- [ ] YouTube VOD：transcript + 进度 → Event
- [ ] YouTube Live：chat batch + Super Chat + Membership → Event
- [ ] YouTube Live：消息删除正确追踪
- [ ] 高频 chat 正确采样（monetization/mod 消息优先保留）
- [ ] 滑动窗口去重正常工作
- [ ] Tab 导航时 adapter 正确 destroy + 清理 observer
- [ ] Badge 📡 状态正确
- [ ] `pnpm run typecheck` + `pnpm run check` 零错误

### Phase 4: Documentation & Launch

**Goal:** 文档 + Chrome Web Store 上架

**Tasks:**
- [ ] 新建 `packages/docs/src/content/docs/guides/context-bro.mdx`（EN）
- [ ] 新建 `packages/docs/src/content/docs/ja/guides/context-bro.mdx`（JA）
- [ ] 新建 `packages/docs/src/content/docs/zh/guides/context-bro.mdx`（ZH）
- [ ] 修改 `packages/docs/astro.config.mjs`：新增 "Extension Guides" sidebar section
  - Context Bro 与现有 Kite-U Extension 并列说明
- [ ] 文档内容：
  - 概念：Context Bro vs Kite-U Extension 的区别
  - 安装指南
  - 模板配置教程（保留 Obsidian Web Clipper 的模板语法文档）
  - Allowlist + Schedule 配置
  - Selection sharing 操作
  - Twitch / YouTube 共同观看
  - 隐私说明
  - 常见模板示例（GitHub PR, Reddit, News, Weather）
- [ ] Chrome Web Store 上架准备
- [ ] 可选：Context Bro 独立文档站（如果产品需要独立品牌）

### Phase 4 Checklist

- [ ] EN / JA / ZH 三语文档
- [ ] Chrome Web Store 审核通过
- [ ] 至少 5 个预设模板示例
- [ ] 隐私政策页面

---

## 7. Out of Scope

- **AI Interpreter**：移除 Obsidian Web Clipper 的 LLM prompt 变量；Context Bro 专注于提取和传输，LLM 处理由 Agent 完成
- **Reader Mode**：移除；Context Bro 不改变用户的阅读体验
- **Save as File**：移除；输出为 POST API（Copy JSON 到剪贴板在 Popup 中可用）
- **跨设备配置同步**：Allowlist / 模板存 Chrome Storage (local)，不同步
- **其他浏览器 Extension API**（如 Firefox Sidebar）：Phase 1 仅 Chrome；Firefox / Safari 后续
- **视频帧截图**：不截取视频画面，仅传输文字（chat / transcript / metadata）
- **音频转录（STT）**：仅使用平台提供的字幕 / transcript

---

## 8. Security & Privacy

### 8.1 Allowlist-First

- **默认不分享任何网页**——用户必须显式添加域名到 Allowlist
- Cron scheduler 仅在 Allowlist 域名上提取
- 非 Allowlist 域名上：手动 Clip 和 Selection 仍可用（与 Obsidian Web Clipper 行为一致）

### 8.2 vs Kite-U Extension 的权限对比

| Permission | Kite-U Extension | Context Bro |
|------------|-----------------|-------------|
| `<all_urls>` | ✅ (exploration 需要) | ❌ (仅 allowlist 域名) |
| `scripting` | ✅ (注入提取脚本) | ✅ (content script) |
| `activeTab` | ✅ | ✅ |
| `tabs` | ❌ | ✅ (cron 查询 all tabs) |
| `alarms` | ❌ | ✅ (cron 调度) |
| `storage` | ✅ | ✅ |
| `contextMenus` | ✅ | ✅ |
| 可以代替用户操作浏览器 | ✅ (后台打开 tab) | ❌ |
| 可以访问用户未打开的网页 | ✅ (exploration) | ❌ |

### 8.3 Content Sanitization

保留 Obsidian Web Clipper 的清理逻辑：
- 移除 `<script>`, `<style>`, `<noscript>`
- 不提取 `<input>`, `<textarea>` 的 value
- 不提取 `type="password"` 字段
- Incognito tab 默认不提取

### 8.4 认证

- **用户自定义 Headers**：每个 Endpoint 可配置任意 key-value header pairs
- 支持 Bearer token, API Key, 自定义 auth header, 或无认证
- 认证方式完全由目标 API 决定，Context Bro 不做限制
- 示例：`Authorization: Bearer sk-xxx` 或 `X-API-Key: my-key`

---

## 9. Related Documents

| Document | Description |
|----------|-------------|
| [Obsidian Web Clipper (GitHub)](https://github.com/obsidianmd/obsidian-clipper) | 静态引擎基底 — 核心逻辑直接抽取 (MIT License) |
| [Social Stream Ninja (GitHub)](https://github.com/steveseguin/social_stream) | 动态引擎架构参考 — 参考模式，独立 TS 实现 (GPL-3.0, 不复制代码) |
| [API Poll PRD](../20260221-heartbeat-api-polling-event-ingestion/20260221-heartbeat-api-polling-event-ingestion-prd.md) | 同属 event ingestion 扩展 |
| [Webhook PRD](../20260220-webhook-event-ingestion-mapping-security/20260220-webhook-event-ingestion-mapping-security-prd.md) | Webhook 事件接入 |
| [Unified Event Stream PRD](../20260213-unified-event-stream-agent-planning/20260213-unified-event-stream-agent-planning-prd.md) | Event Stream 设计原则 |

---

## 10. Open Questions

| # | Question | Status | Decision |
|---|----------|--------|----------|
| 1 | Context Bro 独立 repo 还是 monorepo 内的 `packages/context-bro`？ | ✅ Decided | **独立 repo** — 已创建为独立项目 `ContextBro/`，Server ingest route 在主 monorepo |
| 2 | 是否保留 Obsidian Web Clipper 的 Side Panel 模式？ | Open | 保留——Chrome Side Panel 适合 live stream 场景（持续可见） |
| 3 | Obsidian Web Clipper 的 Defuddle 库是否需要 fork？ | Open | 初期直接 `npm install defuddle`（独立包，MIT License）；仅在需要定制时 fork |
| 4 | 是否允许用户同时发送到 Obsidian 和 Kite-U？（双输出） | Open | 有趣的可能性——保留 `obsidian://` 作为可选输出，让 Context Bro 成为 "universal web clipper"。但会增加复杂度，后续迭代考虑 |
| 5 | 字幕/transcript 提取是否存在平台 ToS 合规风险？ | Open | YouTube captions 有公开 API；Twitch chat 是公开的。需法务确认 |
| 6 | 是否支持更多 adapter（Bilibili、Discord、TikTok）？ | Open | Phase 3 仅 Twitch + YouTube，其他后续或社区贡献。SSN 已有 120+ 平台的 DOM 选择器可参考 |
| 7 | Social Stream Ninja (GPL-3.0) 作为参考的许可证策略？ | ✅ Decided | **仅参考架构模式，用 TypeScript 独立实现**。不复制代码、不 fork、不 push。学习内容：平台 DOM 选择器（第三方平台的事实描述）、MutationObserver 配置（工程经验）、消息归一化 schema（数据结构）。Context Bro 保持 MIT License |

---

## 11. Document Change Log

| Date | Author | Changes |
|------|--------|---------|
| 2026-02-22 | Architecture Team / Product | Initial draft — Context Bro as standalone extension, fork of Obsidian Web Clipper |
| 2026-02-22 | Architecture Team | Tech stack decided: WXT (Vite + React) over direct fork / Plasmo; added §1.3 comparison table; rewrote Phase 1 & project structure |
| 2026-02-22 | Architecture Team | Progress update: Phase 1 → In Progress; marked project init task as complete (WXT 0.20.17 + React 19 + Biome + manifest permissions); Phase 2 permissions pre-declared in manifest |
| 2026-02-22 | Architecture Team | **Design pivot**: Context Bro 改为完全独立的 Extension，不绑定 Kite-U。支持用户自定义 API endpoints（多个命名 endpoint + 自定义 headers）。Template-driven payload（模板编译结果即 POST body）。更新 §2.2 数据流图、§2.3 输出改造、§4 API Design、§5.1 Popup UI、§8.4 认证 |
| 2026-02-22 | Architecture Team | **Phase 1 完成**: 7 个 batch 全部实现。包括：TailwindCSS v4 配置、60+ 文件从 Obsidian Clipper 抽取（template engine, 50+ filters, variables, triggers）、Defuddle content script、API send layer、Popup UI (React)、Options/Settings page (Endpoints/Templates/General tabs)、CSUI 选区浮动按钮。Build 产出 646 KB Chrome MV3 extension。typecheck + lint 零错误 |
| 2026-02-22 | Architecture Team | **新增 SSN 架构参考**: 新增 §1.3 Social Stream Ninja 作为动态上下文架构参考（GPL-3.0, 仅参考模式不复制代码）。确立双引擎架构：静态引擎 (Obsidian Clipper MIT) + 动态引擎 (SSN-inspired, 独立 TS 实现)。大幅丰富 §3.4 Platform Adapters 设计：NormalizedChatMessage schema（比 SSN 更丰富的类型安全结构）、三层捕获策略（MutationObserver → WebSocket → Polling）、Per-platform Observer 配置、滑动窗口去重、采样策略。丰富 Phase 3 实现任务清单。新增 Open Question #7 确认 GPL-3.0 使用策略 |

---

> **Note:** Context Bro is a **standalone, independent** browser extension built with **WXT (Vite + React)**, with a dual-engine architecture: (1) **Static engine** extracting core logic from [Obsidian Web Clipper](https://github.com/obsidianmd/obsidian-clipper) (MIT License, code directly extracted), and (2) **Dynamic engine** inspired by [Social Stream Ninja](https://github.com/steveseguin/social_stream) (GPL-3.0, architecture patterns only — independently implemented in TypeScript). It is not tied to any specific backend — users configure their own API endpoints. Repurposed from "clip web → save to Obsidian vault" to "clip web → POST to user-configured API endpoint(s)." Core reuse includes: Defuddle extraction, AST-based template engine with 50+ filters, CSS selector variables, Schema.org variables, and trigger-based template matching — all extracted as library code into the WXT project. Dynamic engine includes: per-platform MutationObserver adapters with NormalizedChatMessage schema, three-tier capture strategy (Observer → WebSocket → Polling), sliding-window deduplication, and priority-based chat sampling. UI is fully rewritten in React. Key design decisions: (1) Multiple named endpoints with custom headers (full auth flexibility), (2) Template-driven payload (compiled template IS the POST body — users control the JSON shape), (3) Chrome Alarm cron scheduling with domain allowlist (Phase 2), and (4) Twitch/YouTube platform adapters with SSN-inspired architecture (Phase 3).
