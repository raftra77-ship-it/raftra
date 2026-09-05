# ⚡ Raftra AI: Premium AI Growth Operating System

Raftra is a state-of-the-art Growth Operating System built for modern businesses. It replaces fragmented, disconnected SaaS stacks (creatives, ads, SEO, analytics, influencers) with a coordinated, live multi-agent network.

Built with a design philosophy inspired by **Linear**, **Vercel**, **Arc**, and **Ryze AI**, Raftra delivers a premium, dark-mode glassmorphic interface that runs automated growth pipelines with Human-in-the-Loop (HITL) checkpoints.

---

## 🧭 System Architecture & Workspaces

Raftra coordinates **6 specialized AI Workspaces** inside a single, cohesive dashboard terminal:

### 1. 🎨 AI Creative Studio
* **Core Agent**: `Creative Strategy Agent` $\rightarrow$ `Copywriting Agent` $\rightarrow$ `Design Agent` $\rightarrow$ `Video Agent` $\rightarrow$ `Voice Agent` $\rightarrow$ `Quality Review Agent`
* **Features**: Ingests brand guidelines, targets URLs, and compiles copies, static creatives, UGC scripts, and dynamic tone maps.

### 2. 📣 AI Campaign Manager
* **Core Agent**: `Marketing Planner` $\rightarrow$ `Audience Research` $\rightarrow$ `Budget Planner` $\rightarrow$ `Campaign Builder` $\rightarrow$ `Meta Specialist` $\rightarrow$ `Google Ads Specialist` $\rightarrow$ `Optimization Agent`
* **Features**: Sandbox platforms connectors (Google Ads, Meta Ads) for demographic targeting, real-time CPA monitoring, and automatic daily budget limits rebalancing.

### 3. 🌐 SEO + GEO/AEO Dominance
* **Traditional SEO Graph**: `Crawler` $\rightarrow$ `Technical SEO` $\rightarrow$ `Keyword Agent` $\rightarrow$ `Content Strategy` $\rightarrow$ `Internal Linking` $\rightarrow$ `Backlink` $\rightarrow$ `Schema` $\rightarrow$ `Publishing`
* **Answer Engine Optimization (AEO/GEO) Graph**: `Entity Agent` $\rightarrow$ `Citation Agent` $\rightarrow$ `Prompt Visibility` $\rightarrow$ `LLM Ranking` $\rightarrow$ `Authority` $\rightarrow$ `Knowledge Graph` $\rightarrow$ `Optimization Agent`
* **Features**: Audits entity citations and recommendations score inside LLM models like ChatGPT, Claude, and Gemini to dominate modern conversational AI search.

### 4. 📊 Analytics + Claude Intel
* **Core Agent**: `Data Collection` $\rightarrow$ `Cleaning` $\rightarrow$ `SQL Agent` $\rightarrow$ `Python Agent` $\rightarrow$ `Visualization` $\rightarrow$ `Claude Insights` $\rightarrow$ `Recommendation Agent`
* **Features**: Connects platforms metrics to a unified performance trend chart, allowing natural language queries answered in real-time by a Claude simulation console.

### 5. 💬 Social Hub AI
* **Core Agent**: `Content Planner` $\rightarrow$ `Image Agent` $\rightarrow$ `Video Agent` $\rightarrow$ `Caption Agent` $\rightarrow$ `Scheduler` $\rightarrow$ `Comment Agent` $\rightarrow$ `DM Agent` $\rightarrow$ `Analytics`
* **Features**: Autogenerates post drafts, publishes schedules to Twitter/LinkedIn channels, and handles incoming mentions or messages automatically.

### 6. 🤝 Influencer Marketplace
* **Core Agent**: `Creator Discovery` $\rightarrow$ `Audience Verification` $\rightarrow$ `Fake Follower Detection` $\rightarrow$ `Brand Match` $\rightarrow$ `Pricing Agent` $\rightarrow$ `Negotiation Assistant` $\rightarrow$ `Campaign Manager`
* **Features**: Discovers matching content creators, audits follower quality indices, scores brand matching compatibility, and runs automated contract negotiation bots.

---

## 🛠️ Technology Stack
* **Vite** (V8 client building environment)
* **React** (State-driven SPA UI modules)
* **TypeScript** (Strict compiler types check)
* **Framer Motion** (Subtle micro-animations & transitions)
* **Lucide React** (Vector iconography system)
* **Recharts** (Performance curves visualization)

---

## ⚡ Quick Start

### 1. Ingest Dependencies
```bash
npm install
```

### 2. Launch Local Hot-Reload Server
```bash
npm run dev
```
Open **[http://localhost:5173/](http://localhost:5173/)** to access the dashboard.

### 3. Compile Production Bundle
```bash
npm run build
```

---

## 🧠 Design Tokens & HSL Palette
* **Background Primary**: `hsl(240, 10%, 4%)` (Deep Obsidian)
* **Accent Core**: `hsl(243, 100%, 66%)` (Glow Indigo Violet)
* **Success Mint**: `hsl(157, 100%, 50%)` (AEO Citations Green)
* **Glass Card Backdrop**: `rgba(255, 255, 255, 0.01)` with `backdrop-filter: blur(20px)`

---

## 🧠 Brand Intelligence Pipeline (multi-tenant RAG)

Onboarding a brand URL now produces a real **brand kit**, and two scheduled syncs keep a
**competitor ad vault** and a **market/search radar** fresh beside it. Everything is scoped
to a workspace, which is the tenancy boundary.

### 1. Ingestion & extraction — `backend/core/brand_kit.py`
Deterministic first, LLM second, because the two answer different kinds of question:

* **Design tokens** are parsed from the site's own CSS. Declared custom properties
  (`--color-primary: #FF6B00`) win, because they carry a *name and a role*; frequency
  counting is the fallback for sites that ship no variables.
* **Typography** from Google Fonts links, `@font-face` and `font-family` declarations.
* **Logos** from the markup, best evidence first: `<img class="logo">` → inline `<svg>` →
  Open Graph image → favicon.
* **Identity** (overview, mission, positioning, USPs, benefits, personality, tone of voice,
  personas + ad hooks, business model) via one **Pydantic-validated** LLM pass. Every field
  may come back empty — a thin site yields blanks, not a fabricated mission statement.

### 2. Scheduled external syncs — `backend/core/intel_sync.py`
| Sync | Cadence | Source | Table |
|---|---|---|---|
| Competitor ads | every **2 weeks** | Meta Ad Library API / Apify | `competitor_ads`, `competitor_ad_strategies` |
| Market & search trends | every **4 weeks** | SerpApi or pytrends + YouTube Data API v3 | `market_trend_reports` |

Both are **off by default** (`ENABLE_INTEL_SYNCS=false`) and can always be run on demand
from Market Intelligence → *Sync now*. Every run writes a `sync_runs` row, so a job that has
been failing for a month is visible rather than looking like a quiet market.

> **⚠️ What the Meta Ad Library API can actually do.** `/ads_archive` returns *all* active
> ads, commercial included, **only for EU/EEA countries** — the DSA requires it there. For
> every other market, India included, the API is limited to
> `ad_type=POLITICAL_AND_ISSUE_ADS`. The Ad Library *website* shows commercial ads
> everywhere; the API does not. So EU competitors need only `META_AD_LIBRARY_TOKEN`, and
> non-EU markets additionally need a third-party collector (`APIFY_TOKEN`). With neither
> configured the vault stays empty **and says why** — it never invents ads.

### 3. Multi-tenant storage
* **PostgreSQL** — every new table carries an indexed `workspace_id`, and every route
  resolves the workspace through an ownership check before reading a row.
* **Qdrant** — one collection, partitioned by a mandatory `workspace_id` filter plus a
  `type` filter (`onboarding_scrape` | `competitor_ad` | `market_trend`). The filter is
  built inside `core/rag.py`, so no caller can forget it.

### 4. Hybrid RAG router — `backend/core/rag.py`
| Question | Store | Why |
|---|---|---|
| "What's our CTA hex?" | Postgres | Exact values must be literal. Nearest-neighbour search returns something *hex-shaped*, not the right hex. |
| "What angle are rivals not running?" | Qdrant | There is no key to look this up by; the question is semantic. |

`get_brand_context()` — which every agent already calls — now returns both, so campaign and
creative briefs are grounded in live competitor tactics and rising search intent rather than
the site crawl alone.

### API
```
GET  /api/workspaces/{id}/brand-kit
GET  /api/workspaces/{id}/competitor-ads          POST .../competitor-ads/sync
GET  /api/workspaces/{id}/market-trends           POST .../market-trends/sync
POST /api/workspaces/{id}/intelligence/query      GET  .../intelligence/status
```

### Migration
```bash
cd backend && alembic upgrade head
```
