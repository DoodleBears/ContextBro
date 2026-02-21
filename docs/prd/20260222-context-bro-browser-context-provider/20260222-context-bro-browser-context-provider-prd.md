# PRD: Context Bro — Browser Context Provider for AI Agent

**Status:** Draft
**Created:** 2026-02-22
**Author:** Architecture Team / Product
**Module:** Standalone Browser Extension — Context Bro (WXT + React, Obsidian Web Clipper 核心逻辑抽取)

---

## Phase Progress Overview

| Phase | Name | Status | Link |
|-------|------|--------|------|
| 1 | WXT 项目搭建 & Core Clipper 功能 | 🔲 Pending | [Phase 1 Checklist](#phase-1-checklist) |
| 2 | Scheduled Context Sharing (Cron) | 🔲 Pending | [Phase 2 Checklist](#phase-2-checklist) |
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
| **输出目标** | `obsidian://` URI scheme + clipboard | `POST /api/extension/context` (Kite-U API) |
| **模板输出格式** | Markdown (`.md` 文件) | JSON (Event payload) |
| **认证** | 无（本地 Obsidian） | Cookie-based (Kite-U session) |
| **Vault 选择** | Obsidian Vault | Kite-U Agent 选择 |
| **Note 行为** | create / append / prepend / overwrite | 固定：创建 Event |
| **YAML Frontmatter** | Obsidian Properties | Event metadata (platform, element, event_type) |
| **新增：定时 Cron** | ❌ 无 | ✅ Chrome Alarm + Allowlist 自动分享 |
| **新增：Platform Adapters** | ❌ 无 | ✅ Twitch / YouTube live context |
| **移除：AI Interpreter** | LLM prompt 变量 | 移除（Agent 自行处理 context，不在 clipper 内 LLM） |
| **移除：Reader Mode** | 阅读模式 | 移除（Context Bro 专注于分享，不改变阅读体验） |

### 1.3 技术选型：三种路径对比

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

#### ✅ 决定方案：C. WXT + 抽取 Obsidian Clipper 核心逻辑

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

### 1.4 设计理念

```
Context Bro = Web Clipper for AI Agents

技术栈:  WXT (Vite) + React + Obsidian Clipper 核心逻辑 (Defuddle, Template Engine)
输出:    网页 → 模板 → JSON → POST Kite-U API → Agent Event Stream
```

### 1.5 Target Users

| Role | Description | Permissions |
|------|-------------|-------------|
| **Agent Owner** | 安装 Context Bro，配置 Allowlist + 模板 + 定时器 | Extension Settings |
| **Agent (LLM)** | 消费 Context Event，理解用户当前关注 | Event Stream 只读 |

### 1.5 Core Value

1. **低门槛安装**：Web Clipper 心智模型，无需信任 Agent 操作浏览器
2. **模板驱动**：复用 Obsidian Web Clipper 的强大模板系统，用户可精确控制分享什么
3. **持续感知**：Cron 定时 + Allowlist，Agent 可以持续感知用户关注的领域
4. **精确分享**：Highlight Mode 选区分享，CSS Selector 精确提取
5. **共同体验**：Twitch/YouTube adapter，Agent 和用户一起看直播
6. **成熟基底**：Fork Obsidian Web Clipper（MIT, 3k+ stars），大幅减少开发量和 bug

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
│  │  (user click)  │                              │             │
│  │                │    ┌──────────────┐          │             │
│  │  Selection ────┼───▶│  Defuddle    │          │             │
│  │  (highlight)   │    │  Extractor   │          │             │
│  │                │    └──────┬───────┘          │             │
│  │  Cron ─────────┘           │                  │             │
│  │  (Chrome Alarm)            ▼                  │             │
│  │                    ┌──────────────┐           │             │
│  │                    │  Template    │           │             │
│  │  Live Adapter ────▶│  Compiler   │           │             │
│  │  (Twitch/YT)      │  (AST-based) │           │             │
│  │                    └──────┬───────┘           │             │
│  └───────────────────────────┼───────────────────┘             │
│                              │ JSON payload                    │
│                              ▼                                 │
│                 ┌──────────────────────────┐                   │
│                 │  POST /api/extension/    │                   │
│                 │  context                 │                   │
│                 │  (cookie auth)           │                   │
│                 └────────────┬─────────────┘                   │
└──────────────────────────────┼─────────────────────────────────┘
                               │
┌──────────────────────────────┼─────────────────────────────────┐
│  Kite-U Server               ▼                                 │
│                                                                │
│  ┌─────────────────────────────────────────┐                  │
│  │  Context Ingest Route                    │                  │
│  │  - validate session + agent              │                  │
│  │  - dedup (content_hash)                  │                  │
│  │  - createEvent(platform='context-bro')   │                  │
│  └──────────────┬──────────────────────────┘                  │
│                 │                                              │
│                 ▼                                              │
│  ┌─────────────────────────────────────────┐                  │
│  │  Event Stream → Agent perceives          │                  │
│  └─────────────────────────────────────────┘                  │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 2.3 输出改造：Obsidian → Kite-U API

**原始 (Obsidian Web Clipper):**
```typescript
// obsidian-note-creator.ts
const url = `obsidian://new?file=${encodeURIComponent(path + name)}&clipboard`;
openObsidianUrl(url);
```

**改造后 (Context Bro):**
```typescript
// kite-event-creator.ts
async function sendToKite(payload: ContextPayload): Promise<void> {
  await fetch(`${KITE_API_URL}/api/extension/context`, {
    method: 'POST',
    credentials: 'include',  // cookie auth
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agentId: settings.agentId,
      event_type: payload.event_type,  // 'page_context' | 'selection' | 'live_stream'
      source_url: payload.url,
      source_title: payload.title,
      content: payload.content,         // compiled template output (JSON)
      content_hash: payload.hash,       // dedup
      timestamp: new Date().toISOString(),
    }),
  })
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

**新增快捷路径：**
- 选中文本 → 快捷键 `Ctrl+Shift+K` → 立即发送到 Agent（无 Popup）
- 选中文本 → 右键 → "Share Selection to Kite" → 立即发送
- 选中文本 → 浮动 🪁 按钮 → 立即发送

### 3.4 Feature 4: Platform Adapters — Twitch & YouTube（新增）

与前一版 PRD 设计一致——MutationObserver 提取 chat/transcript，batch 后发送。

#### Adapter 接口

```typescript
interface PlatformAdapter {
  platform: string
  match(url: URL): boolean
  init(): Promise<void>
  destroy(): void
  getStreamInfo(): StreamInfo | null
  onChatBatch(cb: (batch: ChatBatch) => void): void
  onTranscript?(cb: (chunk: TranscriptChunk) => void): void
}
```

#### Chat 聚合策略
- 30 秒 flush interval
- > 100 条/30s → 采样（保留 mod/sub + 随机）
- 模板编译后发送：`event_type: 'live_stream'`

#### Agent 看到的 Event

```
- [02-22 20:00] [evt_cb010] context-bro/twitch (live_stream): [twitch.tv/shroud] "Valorant Ranked" — 45k viewers — Chat (30s): 87 msgs — Sample: alice: "That clutch!", bob: "GG"
- [02-22 16:30] [evt_cb011] context-bro/youtube (live_stream): [youtube.com] "3Blue1Brown: Neural Networks" — User at 8:30/19:12 — Transcript: "each neuron is just a function..."
```

---

## 4. API Design (Server-Side)

### 4.1 Ingest Endpoint

仅新增一个端点（复用 Kite-U Extension API pattern）：

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/extension/context` | POST | 接收 Context Bro 的所有 context event |

### 4.2 Request Format

```typescript
// POST /api/extension/context
// Auth: Cookie-based (kite-u.com session)
{
  agentId: string,
  event_type: 'page_context' | 'selection' | 'live_stream',
  source_url: string,
  source_title: string,
  content: string | object,      // 模板编译输出（JSON 或 Markdown）
  content_hash: string,          // SHA-256 for dedup
  timestamp: string,             // ISO
  metadata?: {
    template_name?: string,
    trigger_matched?: string,
    adapter?: 'twitch' | 'youtube',
  }
}
```

### 4.3 Server 处理

```typescript
// packages/server/src/routes/extension-context.ts (新增)
// 1. Validate session (cookie auth)
// 2. Validate agentId belongs to user
// 3. Dedup: compare content_hash with last hash for this (agentId, source_url)
// 4. createEvent({
//      platform: 'context-bro',
//      element: metadata.adapter || 'clipper',
//      event_type: request.event_type,
//      title: generateTitle(request),
//      payload: request.content,
//    })
```

### 4.4 Rate Limiting

| 类型 | 限制 | 说明 |
|------|------|------|
| page_context | 每 URL 每 5 分钟 1 次 | 防止 cron 过快 |
| selection | 每分钟 10 次 | 用户主动操作 |
| live_stream | 每 30 秒 1 次 per stream | 与 chat flush 对齐 |
| Payload 大小 | 最大 20KB | 截断超大内容 |

---

## 5. Frontend Design (Extension UI)

### 5.1 Popup — 改造 Obsidian Web Clipper Popup

保留 Obsidian Web Clipper 的 Popup 布局，替换 Obsidian 相关为 Kite-U：

```
┌──────────── Context Bro ──────────────┐
│                                        │
│  Agent: [Kite ▼]          [Settings ⚙] │
│                                        │
│  Template: [Auto-detected ▼]          │
│                                        │
│  ── Page Info ──                       │
│  Title: "How to fix CORS in Vite"      │
│  URL: stackoverflow.com/q/12345       │
│                                        │
│  ── Preview ──                         │
│  {                                     │
│    "title": "How to fix CORS...",      │
│    "content": "To fix CORS in...",     │
│    "tags": ["vite","cors","proxy"]     │
│  }                                     │
│                                        │
│  [🪁 Share to Kite]  [▼ More]         │
│                                        │
│  ── Quick Actions ──                   │
│  [🖍 Highlight Mode]  [📋 Copy JSON]  │
│                                        │
└────────────────────────────────────────┘
```

**关键 UI 变化（vs Obsidian）：**
- "Add to Obsidian" → "Share to Kite"
- "Vault" 下拉 → "Agent" 下拉
- "Note Name" → 移除（Event 自动命名）
- "Note Path" → 移除（Event 无文件路径）
- "Properties" → 移除 YAML frontmatter（改为 Event metadata）
- 新增 Preview（JSON 预览，因为输出是 JSON）
- 保留：Template selector、Highlight toggle、Variable inspector

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
- [ ] `pnpm create wxt@latest context-bro --template react` 初始化项目
- [ ] 配置 TailwindCSS v4 + shadcn/ui（与 Kite-U web 一致）
- [ ] 安装依赖：`defuddle`, `turndown`, `turndown-plugin-gfm`
- [ ] 从 Obsidian Clipper 抽取核心逻辑到 `src/lib/`（纯 TS，MIT License）
  - `template-engine/`：tokenizer, parser, renderer, compiler
  - `filters/`：50+ filter 函数
  - `variables/`：preset, selector, schema 变量解析器
  - `triggers.ts`：Trie + regex URL 匹配
  - `highlighter.ts`：高亮核心逻辑
- [ ] 新建 content script：`src/entrypoints/content/extractor.ts`
  - Defuddle 提取 + Turndown 转 Markdown
- [ ] 新建 API 层：`src/hooks/useKiteApi.ts`
  - `POST /api/extension/context`（cookie auth）
- [ ] 新建 Popup UI（React + TailwindCSS）
  - Agent selector、Template selector、JSON Preview、"Share to Kite" 按钮
- [ ] 新建 Options/Settings UI（React）
  - TemplateEditor.tsx — React 重写 UI，调用 `src/lib/` 的编译逻辑
  - General settings — Kite-U 登录、Agent 选择
- [ ] Server：新增 `POST /api/extension/context` ingest route
  - Dedup: content_hash
  - createEvent with `platform='context-bro'`
- [ ] 右键菜单："Share to Kite"、"Share Selection to Kite"
- [ ] 快捷键：`Ctrl+Shift+K` 快速分享选区
- [ ] CSUI 浮动按钮：`src/entrypoints/content/selection-button.tsx`
  - 选中文本后出现 🪁 按钮（Shadow DOM React 组件）

### Phase 1 Checklist

- [ ] 手动 Clip 页面 → Event 出现在 Agent Event Stream 中
- [ ] 模板引擎正常工作（变量 + filters + triggers 从 Obsidian Clipper 抽取）
- [ ] CSS Selector 变量正常提取
- [ ] Highlight Mode 选区 → 发送到 Kite-U
- [ ] 右键 "Share Selection to Kite" 可用
- [ ] Agent selector 可切换目标 Agent
- [ ] `wxt build` 产出 Chrome MV3 可安装包
- [ ] TailwindCSS v4 样式正常（含 CSUI Shadow DOM）

### Phase 2: Scheduled Context Sharing (Cron)

**Goal:** 新增定时自动分享——Obsidian Web Clipper 没有的核心新功能

**Tasks:**
- [ ] 新建 `src/managers/allowlist-settings.ts`（Allowlist UI）
  - Domain CRUD (add / remove / toggle)
  - 通配符匹配（`*.reddit.com`）
  - 预设模板（News / Dev / Social / Streaming）
  - 每个域名可绑定特定 Template
- [ ] 新建 `src/managers/schedule-settings.ts`（Schedule UI）
  - 开关 + interval + mode (focused / all_allowed)
- [ ] 新建 `src/utils/scheduler.ts`（Cron 调度）
  - `chrome.alarms` API
  - Tab 查询 → Allowlist 过滤 → 提取 → 模板编译 → 发送
  - Dedup by content hash
- [ ] 新增 `manifest.json` permission: `alarms`
- [ ] 新增 `manifest.json` permission: `tabs`（查询 all_allowed tabs 需要）

### Phase 2 Checklist

- [ ] Allowlist 域名匹配正确（精确 / 通配符 / localhost）
- [ ] Chrome Alarm 定时触发 → 提取 → Dedup → 发送
- [ ] 页面未变化时跳过
- [ ] focused 模式仅提取当前 tab
- [ ] all_allowed 模式提取所有匹配 tab
- [ ] 非 Allowlist 域名不被提取

### Phase 3: Platform Adapters — Twitch & YouTube

**Goal:** Agent 和用户一起看直播/视频

**Tasks:**
- [ ] 新建 `src/adapters/base.ts`（Adapter 接口）
- [ ] 新建 `src/adapters/twitch.ts`
  - MutationObserver: chat messages
  - Stream info（title, category, viewers）
  - Chat batching（30s flush + 采样）
- [ ] 新建 `src/adapters/youtube.ts`
  - VOD: video info + transcript (captions / DOM observer)
  - Live: live chat batch + stream info
  - Progress tracking（currentTime / duration）
- [ ] Adapter 自动注册：检测 URL → 匹配 → init
- [ ] Chat 聚合（> 100 条/30s → 采样）
- [ ] Badge 状态指示（📡 Live adapter active）
- [ ] 更新 manifest: Twitch host permission

### Phase 3 Checklist

- [ ] Twitch 频道：chat batch → Event
- [ ] YouTube VOD：transcript + 进度 → Event
- [ ] YouTube Live：chat batch + stream info → Event
- [ ] 高频 chat 正确采样
- [ ] Tab 导航时 adapter 正确清理
- [ ] Badge 📡 状态正确

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
- **Save as File / Copy**：移除；唯一输出是 Kite-U API
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

- Cookie-based（kite-u.com session），与现有 Kite-U Extension 一致
- Extension popup 提供登录入口（link to kite-u.com/login?extension=context-bro）
- Handshake endpoint 复用 `/api/extension/handshake`

---

## 9. Related Documents

| Document | Description |
|----------|-------------|
| [Obsidian Web Clipper (GitHub)](https://github.com/obsidianmd/obsidian-clipper) | Fork 基底 (MIT License) |
| [API Poll PRD](../20260221-heartbeat-api-polling-event-ingestion/20260221-heartbeat-api-polling-event-ingestion-prd.md) | 同属 event ingestion 扩展 |
| [Webhook PRD](../20260220-webhook-event-ingestion-mapping-security/20260220-webhook-event-ingestion-mapping-security-prd.md) | Webhook 事件接入 |
| [Unified Event Stream PRD](../20260213-unified-event-stream-agent-planning/20260213-unified-event-stream-agent-planning-prd.md) | Event Stream 设计原则 |

---

## 10. Open Questions

| # | Question | Status | Decision |
|---|----------|--------|----------|
| 1 | Context Bro 独立 repo 还是 monorepo 内的 `packages/context-bro`？ | Open | 倾向独立 repo（独立 CI/CD + Chrome Web Store 发布流程），但需要 Server ingest route 在主 monorepo |
| 2 | 是否保留 Obsidian Web Clipper 的 Side Panel 模式？ | Open | 保留——Chrome Side Panel 适合 live stream 场景（持续可见） |
| 3 | Obsidian Web Clipper 的 Defuddle 库是否需要 fork？ | Open | 初期直接 `npm install defuddle`（独立包，MIT License）；仅在需要定制时 fork |
| 4 | 是否允许用户同时发送到 Obsidian 和 Kite-U？（双输出） | Open | 有趣的可能性——保留 `obsidian://` 作为可选输出，让 Context Bro 成为 "universal web clipper"。但会增加复杂度，后续迭代考虑 |
| 5 | 字幕/transcript 提取是否存在平台 ToS 合规风险？ | Open | YouTube captions 有公开 API；Twitch chat 是公开的。需法务确认 |
| 6 | 是否支持更多 adapter（Bilibili、Discord、TikTok）？ | Open | Phase 3 仅 Twitch + YouTube，其他后续或社区贡献 |

---

## 11. Document Change Log

| Date | Author | Changes |
|------|--------|---------|
| 2026-02-22 | Architecture Team / Product | Initial draft — Context Bro as standalone extension, fork of Obsidian Web Clipper |
| 2026-02-22 | Architecture Team | Tech stack decided: WXT (Vite + React) over direct fork / Plasmo; added §1.3 comparison table; rewrote Phase 1 & project structure |

---

> **Note:** Context Bro is a standalone browser extension built with **WXT (Vite + React)**, extracting core logic from [Obsidian Web Clipper](https://github.com/obsidianmd/obsidian-clipper) (MIT License). Repurposed from "clip web → save to Obsidian vault" to "clip web → send to AI Agent event stream." Core reuse includes: Defuddle extraction, AST-based template engine with 50+ filters, highlight mode, CSS selector variables, and trigger-based template matching — all extracted as library code into the WXT project. UI is fully rewritten in React. The key additions are: (1) Kite-U API output instead of `obsidian://`, (2) Chrome Alarm cron scheduling with domain allowlist, and (3) Twitch/YouTube platform adapters. By being a separate extension from Kite-U Extension, Context Bro offers a lower-trust, lower-barrier entry point for users who want to share browsing context with their Agent without granting Agent-driven browser automation permissions.
