# PRD: Refetch Mechanism & Capture Mode Clarity

**Status:** Draft
**Created:** 2026-02-22
**Author:** Architecture Team
**Module:** Auto-Capture — Refetch for Slowly-Changing Pages + UI Mode Distinction

---

## Phase Progress Overview

| Phase | Name | Status | Link |
|-------|------|--------|------|
| 1 | Focused-Mode Refetch | 🔲 Pending | [Phase 1 Checklist](#phase-1-checklist) |
| 2 | UI Capture-Mode Clarity | 🔲 Pending | [Phase 2 Checklist](#phase-2-checklist) |

> Status Legend: ✅ Completed | 🔄 In Progress | 🔲 Pending

---

## 1. Overview

### 1.1 Background

Context Bro has three content capture mechanisms, each designed for different content volatility:

| Mechanism | Content Type | Current Behavior | Gap |
|-----------|-------------|------------------|-----|
| **Focused mode** | Static pages | 10s dwell → one-shot extract → done | No re-check; user must switch away and back to trigger again |
| **Any-tab mode** | Static pages (background) | Chrome Alarm at N-minute intervals | Works as designed — periodic polling |
| **Platform Adapters** | Live streams (Twitch/YouTube) | MutationObserver → 30s chat batch → POST | Separate pipeline, works well — but UI doesn't surface the distinction |

**The gap:** Slowly-changing pages (HN front page, Reddit feed, Twitter timeline, dashboards, monitoring pages) are **not static** but also **not live streams**. They update on a minutes-to-hours timescale. Currently:

- **Focused mode** fires once after 10s, then never again. A user reading HN for 30 minutes gets a single snapshot from minute 0.
- **Any-tab mode** could work but it was designed for background tabs — it uses Chrome Alarms (minimum 1-minute granularity) and scans *all* open matching tabs. Overkill for "re-check the tab I'm looking at."
- **Adapters** are purpose-built for real-time streams and don't apply to regular web pages.

Additionally, the UI (SiteRuleEditor) does not visually distinguish between these three fundamentally different capture models. A user configuring "SNS" sees the same card as someone configuring "Twitch" — the adapter pipeline is invisible.

### 1.2 Target Users

| Role | Description |
|------|-------------|
| **Feed reader** | Browsing HN, Reddit, Twitter — page content changes as they scroll and new items load |
| **Dashboard monitor** | Watching Grafana, Datadog, or internal dashboards — data refreshes periodically |
| **Researcher** | Reading long-form content with live-updating comments (GitHub Issues, forums) |

### 1.3 Core Value

1. **Refetch for focused mode**: After the initial dwell trigger, optionally re-extract at a configurable interval — dedup ensures only *changed* content is sent
2. **UI capture-mode clarity**: Visually distinguish "static page capture" (SiteRule) from "live stream capture" (Adapter) so users understand the two pipelines
3. **Backward compatible**: Refetch defaults to off; existing behavior unchanged

---

## 2. System Architecture

### 2.1 Current Capture Architecture

```
                    ┌─────────────────────────────┐
                    │        SiteRule Config        │
                    │   (user-configured per-site)  │
                    └──────────┬──────────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                 ▼
     ┌────────────┐   ┌──────────────┐   ┌──────────────┐
     │  Focused   │   │   Any Tab    │   │   Adapter    │
     │   Mode     │   │    Mode      │   │  (Twitch/YT) │
     │            │   │              │   │              │
     │ Event-     │   │ Chrome Alarm │   │ Mutation     │
     │ driven     │   │ periodic     │   │ Observer     │
     │ one-shot   │   │ polling      │   │ real-time    │
     └────────────┘   └──────────────┘   └──────────────┘
          │                  │                   │
          ▼                  ▼                   ▼
     Defuddle +         Defuddle +         NormalizedChat
     Template           Template           Message batch
          │                  │                   │
          └────────┬─────────┘                   │
                   ▼                             ▼
              Dedup (SHA-256)              Dedup (sliding window)
                   │                             │
                   └──────────┬──────────────────┘
                              ▼
                    POST to user endpoint(s)
```

### 2.2 Proposed Change: Focused Mode + Refetch

```
     ┌────────────────────────────────────────────────┐
     │              Focused Mode (enhanced)            │
     │                                                  │
     │  Tab focus ──► 10s dwell ──► extract + send     │
     │                                 │               │
     │                    ┌────────────┘               │
     │                    ▼                             │
     │            refetchEnabled?                       │
     │              │        │                          │
     │             yes       no ──► done (current)     │
     │              │                                   │
     │              ▼                                   │
     │     setInterval(refetchIntervalSeconds)          │
     │              │                                   │
     │              ├──► extract ──► dedup ──► send     │
     │              ├──► extract ──► dedup ──► skip     │
     │              ├──► extract ──► dedup ──► send     │
     │              │         ...                       │
     │              │                                   │
     │     Tab blur / navigate away ──► clearInterval  │
     └────────────────────────────────────────────────┘
```

**Key design decisions:**

1. **Refetch lives inside focused-mode** — it is NOT a new mode. It extends focused-mode with a recurring timer after the initial dwell trigger.
2. **Dedup gates every send** — refetch triggers extraction, but `hasContentChanged()` prevents redundant POSTs. This is the existing dedup mechanism, not new logic.
3. **Timer lifecycle** — `setInterval` starts after the first successful dwell extraction. Cleared on tab blur, navigation away, or tab close.
4. **No Chrome Alarm needed** — refetch uses `setInterval` in the service worker (same as dwell timer uses `setTimeout`). This is fine because refetch only runs while the user is actively focused on the tab — the service worker won't be killed while a tab is active.

---

## 3. Data Model Design

### 3.1 SiteRule Type Changes

Current `SiteRule` in `src/lib/types.ts`:

```typescript
export interface SiteRule {
  id: string
  name: string
  patterns: string[]
  enabled: boolean
  templateId?: string
  endpointIds: string[]
  autoShare: boolean
  intervalMinutes: number       // used by any_tab mode
  scheduleMode: 'focused' | 'any_tab'
  dedupEnabled: boolean
  dedupWindowSeconds: number
}
```

**Add two fields:**

```diff
 export interface SiteRule {
   // ... existing fields ...
   scheduleMode: 'focused' | 'any_tab'
+  refetchEnabled: boolean       // default: false
+  refetchIntervalSeconds: number // default: 60 (1 minute)
   dedupEnabled: boolean
   dedupWindowSeconds: number
 }
```

**Field semantics:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `refetchEnabled` | `boolean` | `false` | When true, focused mode re-extracts at `refetchIntervalSeconds` after the initial dwell trigger |
| `refetchIntervalSeconds` | `number` | `60` | Re-extraction interval in seconds. Range: 10–3600 (10 seconds to 1 hour) |

**Interaction with other fields:**

- Only meaningful when `autoShare: true` AND `scheduleMode: 'focused'`
- Dedup still applies — `dedupEnabled` + `dedupWindowSeconds` filter unchanged content
- `intervalMinutes` is unrelated — it's the any_tab alarm period

### 3.2 Migration: V5 → V6

```typescript
export async function migrateV5ToV6(): Promise<boolean> {
  const result = await browser.storage.local.get(['siteRules'])
  const rules = (result.siteRules as Record<string, unknown>[]) || []

  if (rules.length === 0) return false
  // Already migrated if first rule has refetchEnabled field
  if (rules[0].refetchEnabled !== undefined) return false

  const updated = rules.map((r) => ({
    ...r,
    refetchEnabled: false,
    refetchIntervalSeconds: 60,
  }))

  await browser.storage.local.set({ siteRules: updated })
  return true
}
```

---

## 4. Implementation Design

### 4.1 Focused-Mode Refetch — `src/lib/focused-mode.ts`

Current flow:
1. `handleTabFocus()` → cancel pending dwell → start 10s `setTimeout`
2. After dwell → `extractForFocusedRules()` → done

Proposed flow:
1. `handleTabFocus()` → cancel pending dwell **+ cancel any active refetch timer** → start 10s `setTimeout`
2. After dwell → `extractForFocusedRules()`
3. For each rule with `refetchEnabled: true`:
   - Start `setInterval(rule.refetchIntervalSeconds * 1000)` → re-run extraction for that rule
   - Store the interval ID per `rule.id`
4. On tab blur / navigate away → `cancelDwell()` **+ clear all refetch intervals**

**State management:**

```typescript
// Existing
let dwellTimer: ReturnType<typeof setTimeout> | null = null

// New — one refetch interval per rule
const refetchTimers = new Map<string, ReturnType<typeof setInterval>>()

function cancelRefetch(): void {
  for (const timer of refetchTimers.values()) {
    clearInterval(timer)
  }
  refetchTimers.clear()
}
```

**Refetch execution:**

```typescript
// After successful dwell extraction, for each refetch-enabled rule:
function startRefetch(
  tabId: number,
  url: string,
  rule: SiteRule,
  deps: FocusedModeDeps,
): void {
  if (!rule.refetchEnabled || rule.refetchIntervalSeconds <= 0) return

  const timer = setInterval(async () => {
    // Verify tab is still active
    try {
      const [currentTab] = await browser.tabs.query({ active: true, currentWindow: true })
      if (!currentTab || currentTab.id !== tabId) {
        cancelRefetch()
        return
      }
    } catch {
      cancelRefetch()
      return
    }

    // Re-extract for this single rule
    await extractForFocusedRules(tabId, url, [rule], deps)
  }, rule.refetchIntervalSeconds * 1000)

  refetchTimers.set(rule.id, timer)
}
```

**Critical: dedup interaction**

The existing `hasContentChanged()` function already handles this correctly:
- If content hasn't changed AND we're within the dedup window → returns `false` → skip send
- If content HAS changed → returns `true` → send + update hash
- If dedup window expired → returns `true` → send (even if content unchanged — user wants periodic updates)

This means refetch + dedup work together naturally:
- **Page unchanged**: refetch triggers extraction but dedup skips the send → no wasted API calls
- **Page changed**: refetch triggers extraction, dedup detects new hash → send
- **Dedup window expired**: refetch triggers extraction, even if same content → send (acts as a heartbeat)

### 4.2 Service Worker Lifecycle Considerations

**Concern:** MV3 service workers can be terminated after ~30 seconds of inactivity.

**Why this is OK for focused-mode refetch:**
- Focused mode only runs while the user is actively looking at a matching tab
- Browser activity (tab focus, mouse, etc.) keeps the service worker alive
- The `setInterval` itself counts as activity for the service worker
- If the service worker IS terminated, the user has navigated away — so refetch should stop anyway

**Contrast with any_tab mode:** any_tab uses Chrome Alarms precisely because those tabs are in the background and the service worker CAN be killed.

### 4.3 Default Rule Creation

Update `addRule()` and `addPreset()` in `SiteRuleEditor.tsx` to include the new fields:

```typescript
{
  // ... existing fields ...
  refetchEnabled: false,
  refetchIntervalSeconds: 60,
}
```

---

## 5. Frontend Design

### 5.1 SiteRuleEditor — Refetch Controls

Add refetch controls to the auto-capture row, visible only when `autoShare: true` AND `scheduleMode: 'focused'`:

```
┌──────────────────────────────────────────────────────────────┐
│ ⊙ [  SNS                      ]              ⊐  🗑         │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ x.com                                                   │ │
│ │ *.reddit.com                                            │ │
│ └──────────────────────────────────────────────────────────┘ │
│ Template: [Default ▾]    Endpoints: ☑ My API                │
│                                                              │
│ ⊙ Auto-capture  [When focused ▾]                            │
│   ☑ Refetch   [30] [sec ▾]                                  │
│   ☑ Dedup     [15] [min ▾]                                  │
└──────────────────────────────────────────────────────────────┘
```

**Refetch row visibility logic:**

| `autoShare` | `scheduleMode` | Show refetch row? |
|-------------|----------------|-------------------|
| `false` | — | No |
| `true` | `focused` | **Yes** |
| `true` | `any_tab` | No (any_tab has its own interval via `intervalMinutes`) |

**Refetch row controls:**

1. **Checkbox** (`refetchEnabled`) — toggle on/off
2. **Number input** (`refetchIntervalSeconds` display value) — converted using the same unit helpers as dedup
3. **Unit select** — seconds / minutes / hours (same pattern as dedup unit selector)

### 5.2 i18n Keys

Add to all three locale files (`en.json`, `zh.json`, `ja.json`):

| Key | en | zh | ja |
|-----|----|----|-----|
| `sites.refetch` | Refetch | 定时刷新 | 定期再取得 |
| `sites.refetchDesc` | Re-extract page content at this interval while tab is focused | 在标签页聚焦期间按此间隔重新提取页面内容 | タブがフォーカスされている間、この間隔でページ内容を再取得 |

### 5.3 Capture Mode Conceptual Distinction in UI

Currently the UI does not communicate **why** there are two auto-capture modes (focused vs any_tab) or how they relate to live streaming adapters. The three capture models should be conceptually clear:

#### 5.3.1 SiteRule Card — "Static/Slow-Changing Pages"

SiteRules handle pages where content is either:
- **Static** (articles, documentation) — one-shot capture is sufficient
- **Slowly changing** (feeds, dashboards) — refetch catches updates

This is already what SiteRules do. No change needed to the card itself — the refetch toggle makes the slow-changing case explicit.

#### 5.3.2 Adapter Status — "Live Streams" (Future Enhancement)

Live stream adapters (Twitch/YouTube) run a completely separate pipeline:
- Content scripts with MutationObserver on chat DOM
- 30s batch flush with priority sampling
- No SiteRule needed — adapters auto-activate when the user visits a matching URL

**Current state:** Adapters work but are invisible in the settings UI. The only indicator is the 📡 badge on the extension icon.

**Future enhancement (not in this PRD scope):** Add a read-only "Live Adapters" section to the Settings page showing:
- Which adapters are available (Twitch, YouTube)
- Which are currently active (with stream info)
- Link to adapter-specific settings (batch interval, sampling threshold)

This is **out of scope** for this PRD but noted here to establish the conceptual separation.

#### 5.3.3 Help Text for Schedule Modes

Update the `focusedTabDesc` and `anyTabDesc` descriptions to better communicate the behavior:

| Key | Current | Proposed |
|-----|---------|----------|
| `sites.focusedTabDesc` (en) | "Only captures when this site is the active tab" | "Captures when this site is the active tab. Enable Refetch for pages that update over time." |
| `sites.anyTabDesc` (en) | "Captures whenever the tab is open in any window" | "Periodically captures all matching tabs in background at the configured interval." |

*(zh and ja translations updated accordingly)*

---

## 6. Implementation Plan

### Phase 1: Focused-Mode Refetch

**Goal:** Add configurable refetch to focused mode so slowly-changing pages are re-extracted periodically.

**Tasks:**
- [ ] Add `refetchEnabled` and `refetchIntervalSeconds` to `SiteRule` type (`src/lib/types.ts`)
- [ ] Add migration `migrateV5ToV6()` in `src/lib/migration.ts`
- [ ] Call `migrateV5ToV6()` in migration chain (`src/entrypoints/background/index.ts`)
- [ ] Implement refetch timer logic in `src/lib/focused-mode.ts`:
  - [ ] `refetchTimers` Map + `cancelRefetch()` helper
  - [ ] `startRefetch()` function — called after successful dwell extraction
  - [ ] Clear refetch timers in `cancelDwell()` and on tab blur
- [ ] Update `addRule()` and `addPreset()` in `SiteRuleEditor.tsx` to include default refetch fields
- [ ] Add refetch UI controls to `SiteRuleEditor.tsx` (checkbox + number + unit, visible when focused mode)
- [ ] Add i18n keys (`sites.refetch`, `sites.refetchDesc`) to `en.json`, `zh.json`, `ja.json`

### Phase 1 Checklist

- [ ] Refetch timer starts after initial dwell extraction (focused mode + refetch enabled)
- [ ] Refetch timer clears on tab blur / navigation away
- [ ] Dedup correctly filters unchanged content during refetch cycles
- [ ] Changed content is sent during refetch cycles
- [ ] Refetch UI controls only visible when autoShare + focused mode
- [ ] Migration V5→V6 adds default values to existing rules
- [ ] `npm run typecheck` + `npm run build` pass

### Phase 2: UI Capture-Mode Clarity

**Goal:** Improve UI text and descriptions so users understand the three capture models.

**Tasks:**
- [ ] Update `sites.focusedTabDesc` and `sites.anyTabDesc` descriptions in all 3 locales
- [ ] Add tooltip or small description text for the refetch toggle explaining its purpose
- [ ] (Optional) Add a brief explanatory note at the top of the Sites tab distinguishing SiteRule capture from live adapter capture

### Phase 2 Checklist

- [ ] Schedule mode descriptions clearly communicate behavior differences
- [ ] Refetch purpose is understandable without documentation
- [ ] i18n translations accurate in all 3 languages

---

## 7. Out of Scope

- **Adapter settings UI**: A dedicated settings panel for live stream adapters (batch interval, sampling threshold, etc.) is a separate feature — noted as future work in §5.3.2
- **Adapter-SiteRule unification**: Adapters and SiteRules remain separate pipelines. Unifying them would require fundamental architecture changes with unclear benefit
- **Configurable dwell time**: The 10s `DWELL_TIME_MS` constant remains hardcoded. Making it configurable adds complexity with little user value (10s is a reasonable universal default)
- **Differential/delta sharing for web pages**: Sending only the changed portions of a page (as opposed to the full page on each refetch) is a complex feature involving content diffing. Dedup already prevents sending unchanged full-page snapshots, which covers the common case. True delta sharing is future work
- **WebSocket-based refetch**: Using WebSocket or Server-Sent Events to detect page changes (instead of polling) would be more efficient but requires per-site integration. Out of scope

---

## 8. Security Considerations

- **No new permissions**: Refetch uses existing `tabs` + `scripting` permissions
- **Rate limiting awareness**: Refetch can generate more API calls than one-shot mode. Dedup mitigates this, but users should be aware that short refetch intervals (10s) + disabled dedup = high request volume. The minimum refetch interval (10s) provides a floor
- **Service worker memory**: The `refetchTimers` Map is bounded by the number of active focused-mode rules (typically 1-3). No memory concern

---

## 9. Related Documents

| Document | Description |
|----------|-------------|
| [Context Bro PRD](../20260222-context-bro-browser-context-provider/20260222-context-bro-browser-context-provider-prd.md) | Main product requirement document — covers all 4 phases |
| `src/lib/focused-mode.ts` | Current focused-mode implementation (dwell timer + one-shot extraction) |
| `src/lib/scheduler.ts` | Any-tab mode scheduler (Chrome Alarm + periodic extraction) |
| `src/lib/dedup.ts` | SHA-256 content dedup (shared by both modes) |
| `src/lib/adapters/base.ts` | Adapter base class (live stream pipeline — separate from SiteRules) |

---

## 10. Open Questions

| # | Question | Status | Decision |
|---|----------|--------|----------|
| 1 | Should refetch survive service worker restarts? | Resolved | No — refetch only matters while the user is actively focused on the tab. If the SW restarts, the tab focus event will re-trigger the dwell → refetch cycle naturally. |
| 2 | Should refetch interval be per-rule or global? | Resolved | Per-rule — different sites change at different rates (Twitter feed: 30s, dashboard: 5min) |
| 3 | Should we show a visual indicator (badge/icon) when refetch is actively running? | Open | Could show a subtle pulsing dot or timer in the popup when refetch is active. Low priority. |
| 4 | Minimum refetch interval? | Resolved | 10 seconds — matches the dwell time. Shorter intervals risk overwhelming endpoints and provide little value since page DOM updates rarely happen faster than this. |

---

## 11. Document Change Log

| Date | Author | Changes |
|------|--------|---------|
| 2026-02-22 | Architecture Team | Initial draft — refetch mechanism for focused mode + capture mode UI clarity |
