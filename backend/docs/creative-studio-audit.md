# Creative Studio — Principal Engineer Audit

Date: 2026-11-12 · Branch: `feature/Campaign` @ `df5fe5e` + uncommitted work
Method: code inspection, live production database reads, executed pipeline runs against
workspace 4 (DSA), competitor research with sources.

**Convention used throughout:** `[VERIFIED]` = I ran it or read it in this codebase/database.
`[VENDOR]` = the competitor's own claim, not independently confirmed. `[RECOMMENDATION]` =
my engineering judgement, not an industry benchmark.

---

## 1. Executive technical assessment

**The backend design is better than the product it currently delivers.**

The core architectural insight — that image models cannot spell, so the brand's words must
never reach the image model and must be drawn afterwards in real type — is correct, well
reasoned, and ahead of most of the market. Research supports it: diffusion models treat
text as pixels rather than character strings, and the accuracy problem persists in current
models including SD3 and Flux. Separate typography layers are the known workaround. You
arrived at the right architecture from first principles, with measurements in the comments
to justify it ("DSA Mastery Hub" → "Data Mastery Arts St Aseles").

Three further decisions are genuinely good and should not change:

1. **CreativeSpec as a structured IR.** One LLM call resolves intent; every downstream
   prompt is derived mechanically. This makes variation a field edit rather than a re-guess,
   and makes every generation inspectable. Most competitors expose a prompt box and a
   result.
2. **Determinism where judgement is not required.** `platforms.py`, `optimizer.py`,
   `motion.py` are lookups and assembly, not model calls. Correct instinct, correctly applied.
3. **Evidence-backed extraction.** `Evidence{source_url, snippet, confidence, basis}` is
   populated in production — 11 blocks for ws4, 14 for ws12, all with non-empty source URLs.
   **No competitor in this comparison publicly documents per-field source attribution with
   confidence.** This is your strongest differentiator and it already works.

**What undermines it is almost entirely operational, not architectural.**

The quality system exists and was never called. The video pipeline is a Ken Burns pan over
a still. The best image provider is disabled by an env flag. The font the entire text
architecture depends on resolves to `C:/Windows/Fonts` and does not exist on the Linux host
you deploy to. Generation is unmetered. The graph has no quality gate and no regeneration
loop. And until this week, six of nine production workspaces held no logo, no palette and no
typography while reporting onboarding as COMPLETED.

**Verdict:** this is not a student project. It is a well-architected system with a thin
operational layer and one large unimplemented area (video). The gap between "designed" and
"delivered" is the whole audit.

---

## 2. Architecture map (verified)

### 2.1 Module inventory `[VERIFIED]`

```
backend/core/creative/              ~3,900 LOC
  service.py        578   orchestration: plan → create_row → run
  optimizer.py      633   CreativeSpec → provider prompt (deterministic, no LLM)
  analyzer.py       581   prompt → CreativeSpec (the one LLM call)
  spec.py           205   the IR: 42 fields
  overlay.py        262   draws headline/CTA/brand in real type
  overlays.py       163   layout variants
  compose.py        204   green-screen compositing of real screenshots
  platforms.py      144   aspect ratios / placements as data
  motion.py         149   verb → camera physics lookup
  evaluate/        1,042   9 criteria across 3 tiers  ← imported by nothing until this week

backend/agents/creative_nodes/      ~2,800 LOC
  onboarding_graph.py   1,176   crawl → vision → synthesis → persist
  generation_graph.py     733   fetch_context → strategy_and_router → copywriting → media
  campaign_graph.py       577
  _brief_halves.py        172   strategy / copy split
  router.py               133   provider chain + cooldown

backend/core/providers/
  image_providers.py   8 classes   nano_banana, hf_flux, gpt_image, flux_schnell + 4 stubs
  video_providers.py   6 classes   Seedance/Kling/Veo all raise NotImplemented
  kenburns_video.py    1 class     ffmpeg zoompan over a still  ← the only working "video"

API: 7 creative routes (/platforms /templates /analyze /generate /jobs/{id} /copy /{id}/variation)
DB:  AdAsset (+ creative_spec JSON), BrandProfile, KnowledgeChunk; 8 migrations
UI:  WorkspaceCreative.tsx — 6,327 lines, single component, no state library, zero tests
```

### 2.2 The user journey, traced `[VERIFIED]`

```
URL entry  →  workspace_routes create (now: is_crawlable_host guard)
           →  run_onboarding_pipeline
              → brand_intelligence_node   Firecrawl (JS-rendering) or direct crawl
                                          same-host only, ≤12 pages, _is_useful_page filter
              → vision_analysis_node      palette / typography / logos from HTML+CSS
              → synthesis_and_persistence LLM → BrandKit → brand_profiles + guidelines JSON
                                          + _extraction provenance + coverage (new)
                                          + vector index (knowledge_chunks)

Brief      →  POST /creative/generate
           →  service.plan()              brand_facts (Postgres) + brand_excerpts (pgvector)
                                          → analyzer (1 LLM call) → CreativeSpec
           →  build_prompts()             deterministic → image_prompt + negative_prompt
           →  create_row()                AdAsset id returned immediately
           →  service.run()  (BackgroundTasks, in-process)
              → provider chain walk + cooldown, one logged seed
              → compose.composite_screenshot   (if a real screenshot was supplied)
              → overlay.render_overlay         headline/CTA/brand in real type
              → kenburns / stock               (if media_type == video)
              → commit + WebSocket broadcast
              → evaluate_asset()               (newly wired; table not yet migrated)
```

### 2.3 Measured behaviour, workspace 4 `[VERIFIED]`

Executed against the live analyzer and real brand facts:

```
CreativeSpec:  headline "Ace your next technical coding interview"
               cta      "Start Practicing Now"
               audience "final-year students, Technical Interview Candidates"   ← from stored profile
               4:5 instagram/feed

image_prompt (352 chars): "...product centred with clean negative space for a headline..."
  no-text rule present : True
  leaks headline       : False
  leaks CTA            : False

overlay: headline + CTA, accent #38bdf8   ← real colour from the brand palette
         brand        : EMPTY             ← brand_facts(4)['brand_name'] is MISSING
evaluator: REVIEW, 100/100, 0 violations, 4 UNKNOWN (audience.fit, tone.voice_match,
                                                      visual.logo, visual.palette)
provider chain: ['hf_flux', 'flux_schnell']   ← nano_banana off (GEMINI_IMAGE_ENABLED unset)
font: C:/Windows/Fonts/segoeuib.ttf           ← does not exist on Render
latency: >120s, after 4 Gemini 503s and a model-chain walk
```

---

## 3. Competitor benchmark

Sources at the end of this section. Treat all competitor capability claims as `[VENDOR]`
unless noted — most come from the vendors' own marketing and help pages, and independent
evaluation of output quality is essentially absent from the public record.

### 3.1 What each one actually does

**Canva — Brand Kit / Canva AI**
Brand Kit stores logos, fonts, colours, templates, and is browsable by category including
Brand Voice. A "Magic Brand Kit Setup" is reported to extract fonts, colours and logos
automatically from a website or a brand guidelines PDF — *this is a third-party report and
is not confirmed in Canva's own documentation in the sources I found*. Brand Voice is
reported to be trained by uploading 3–5 representative writing samples; also unconfirmed by
Canva's docs. Note "Magic Studio" is no longer the current umbrella branding.
*Why it matters:* automatic kit extraction from a URL is your core flow too — this is your
closest direct competitor on that specific capability, and it ships at consumer scale.

**Adobe — Firefly Custom Models / Express / Foundry**
Teams train Firefly on a small set of brand-approved assets to produce on-brand content;
models can be previewed, tested and refined before rollout, with admin controls over who may
train and use them. Express offers AI-powered **brand validation** to check outputs for brand
compliance. Firefly is trained only on licensed Adobe Stock and public-domain content, with
IP indemnification on qualifying plans. Firefly Foundry builds bespoke models on a company's
own IP. Firefly will not generate outputs containing known brands.
*Why it matters:* two things you do not have — (a) a **model that has learned the brand's
visual style**, versus your prompt-level style transfer; (b) **automated brand compliance
validation as a product feature**, which is exactly what your `evaluate/` package is, except
theirs is shipped and yours was not called.

**Jasper — Jasper IQ**
A shared context layer consumed by every agent and workflow at runtime. Component naming
varies across Jasper's own sources (the help centre says six; the IQ page describes three;
a third-party walkthrough reports five cards), but the consistently named pieces are
**Brand Voice, Audiences, Style Guide, Knowledge Base, Visual Guidelines, and Product IQ**,
where Product IQ "owns product truth". The Knowledge Base is **multimodal** — text,
documents, images, audio, video, URLs — and has **live connectors** (SharePoint, Google
Drive) so it does not go stale after upload. Multi-brand: distinct voices, audiences and
style rules per property.
*Why it matters:* this is the single most important comparison for you. Jasper separates
**brand voice** from **audiences** from **product truth** from **style** as first-class,
independently editable, independently retrievable objects. You collapse all of it into one
`guidelines` JSON blob plus a few columns.

**Creatopy (now "The Brief")**
Generates ad creatives **directly from a website URL**. Brand kit holds logos, colours,
fonts, and can apply brand tone of voice to copy. Automatic generation from product feeds
with batch variations. Governance: roles and permissions for who can edit, approve and
publish each template. Reported to run Veo for text-to-video and Nano Banana for image.
*Why it matters:* feed-driven batch variation and an approval workflow are table stakes for
commercial ad platforms and you have neither. Also note they use the same Nano Banana model
you have configured but disabled.

### 3.2 Capability matrix

Status for Raftra is assigned on **verified end-to-end behaviour**, not on the existence of
a field or component.

| Capability | Raftra | Canva | Adobe | Jasper | Creatopy | Recommended |
|---|---|---|---|---|---|---|
| Brand kit auto-extraction from URL | **Partially** — works, but 6/9 prod workspaces came back empty | Reported | Not primary | Via KB/URL | Implemented | Fix reliability before features |
| Per-field source attribution | **Implemented** ✅ 11–14 evidence blocks live | Missing | Not publicly verifiable | Not publicly verifiable | Missing | **Keep — your moat** |
| Per-field confidence scores | **Implemented** (schema + populated) | Missing | Not publicly verifiable | Not publicly verifiable | Missing | **Surface in UI** |
| Extraction coverage reported to user | **Implemented** (new this week) | Not publicly verifiable | Not publicly verifiable | Not publicly verifiable | Not publicly verifiable | Keep |
| JS-rendered site handling | **Implemented** (Firecrawl) | Not publicly verifiable | — | Not publicly verifiable | Implemented | Add SPA sub-route warning |
| Logo detection + preservation | **Partially** — detected 2/9; never composited into output | Implemented | Implemented | Visual Guidelines | Implemented | **P1** |
| Separate Brand Voice object | **Missing** — one text column | Reported | — | **Implemented** | Partial | **P1** |
| Audience personas as objects | **Partially** — list in JSON, not retrievable units | Missing | — | **Implemented** | Missing | **P1** |
| Product truth / Product IQ | **Missing** | Missing | — | **Implemented** | Via feeds | **P1** |
| Multimodal knowledge base | **Missing** — text chunks only | Partial | — | **Implemented** | Missing | P2 |
| Live connectors for freshness | **Missing** | Missing | — | **Implemented** | Feeds | P2 |
| Brand-trained image model | **Missing** (prompt-level only) | Missing | **Implemented** | — | Missing | P3 |
| Automated brand compliance check | **Partially** — built, wired this week, table not migrated, 3/9 criteria UNKNOWN | Missing | **Implemented** | Policy controls | Missing | **P0 to finish** |
| Text rendered as real type | **Implemented** ✅ verified no leak | Implemented (editor) | Implemented (editor) | — | Implemented | **Keep** |
| Real product image compositing | **Implemented** (green screen) ✅ | Manual | Manual | — | Feed images | **Keep — unusual** |
| Reproducible generation (seed) | **Implemented** ✅ | Missing | Not publicly verifiable | — | Missing | Keep |
| True text-to-video | **Missing** — Ken Burns only | Partial | Implemented | — | Reported (Veo) | **P1** |
| Storyboard / multi-scene | **Missing** — fields exist, never read | Missing | Partial | — | Not publicly verifiable | P2 |
| Voiceover / captions | **Missing** | Implemented | Implemented | — | Not publicly verifiable | P2 |
| Batch / feed variations | **Missing** | Partial | Implemented (GenStudio) | — | **Implemented** | P2 |
| Approval workflow | **Partially** — `status` column, no flow | Implemented | Implemented | — | **Implemented** | P2 |
| Usage metering / credits | **Missing** — zero deduction in creative path | Implemented | Implemented | Implemented | Implemented | **P0** |

---

## 4. Brand extraction audit

### 4.1 What works `[VERIFIED]`

- **Same-host restriction enforced twice** (`onboarding_graph.py:199`, `:230`). Checked every
  crawled URL in production: **zero off-domain**. ws4 → only dsahelper.onrender.com; ws12 and
  ws20 → only nike.in.
- **Firecrawl renders JavaScript**, with a direct link-crawl fallback.
- **Link scoring** before spending budget (`_score_link`), deduplication by `_page_key`,
  error-page rejection (`_is_useful_page`, `_looks_like_error_page`), asset rejection.
- **User edits are protected** from re-crawl via `USER_EDITED_KEY`, and overruled fields are
  reported rather than silently kept.
- **Provenance** `_extraction{last_crawled, source_pages, source_urls, extraction_version,
  schema_version, crawled_url}`.
- **Evidence per field** with source URL, snippet and confidence — populated.

### 4.2 What fails `[VERIFIED]`

| Failure | Evidence | Root cause |
|---|---|---|
| Empty kits reported as success | 6/9 workspaces no logo/colours/type, all `is_onboarded=true` | `is_onboarded` set unconditionally |
| Zero-page crawls reported COMPLETED | ws18 (reachable site), ws19 — `source_pages=0` | task summary was a constant string |
| Un-crawlable hosts accepted | `hdh`, `bdh`, `12345678` became permanent workspaces | no host validation at entry |
| Logo detection weak | 2/9 workspaces have logos | `_LOGO_HINT_RE` relies on markup hints |
| SPA sub-routes invisible | ws4 got 1 page; every sub-route 404s | site-side, but never surfaced |
| Same site, different outcomes | nike.in → 12 pages, 12 pages, 0, never-ran | non-determinism, no retry |

The first three are addressed by the work done this week (`coverage()`, `extraction_status()`,
`is_crawlable_host()`, truthful task records). The rest remain.

### 4.3 Schema assessment

**Already present and correct:** `Evidence` (source_url, snippet, confidence, basis),
`USP`, `ProductCategory`, `JobToBeDone`, `VoiceTrait`, `VoiceGuide`, `Messaging`,
`BrandStory`, `PositioningSignals`, `verified_claims`, `unsupported_topics`, `avoid_words`.
This is a **richer schema than any competitor publicly documents.** The problem is not the
schema — it is that retrieval flattens it.

**Missing fields** `[RECOMMENDATION]`

| Field | Why |
|---|---|
| `logo_variants[]` (primary/mono/mark, with transparency + safe-area) | Required to composite a real logo rather than hope the model draws one |
| `photography_style{}` (subject treatment, lighting, crop, people/no-people) | The single biggest driver of "does this look like our brand" |
| `competitors[]` | Referenced in positioning, never extracted |
| `claim_substantiation[]` linking a claim to its evidence URL | `verified_claims` is a bare string list; it cannot be audited |
| `locale{}` (currency, language, market) | Market-specific copy is generated from guesswork |
| `last_verified_by_human` per section | Nothing distinguishes machine guess from human-approved |

**Incorrectly structured**

- `guidelines` is a **single JSON blob** carrying ~20 heterogeneous concepts. It cannot be
  versioned per section, diffed, permissioned, or retrieved selectively. This is the central
  structural problem.
- `brand_voice` lives on `workspaces` while tone lives inside `guidelines` — two homes for
  one concept, and `coverage()` has to check both.
- `verified_claims` as `List[str]` cannot carry evidence or expiry.
- `color_palette` (flat list) and `color_tokens` (roled) coexist; every consumer must handle both.

**Redundant:** `color_palette` once `color_tokens` is populated; `brand_guidelines_summary`
duplicates `guidelines.overview`.

---

## 5. Brand knowledge storage and retrieval audit

**You are storing structured brand intelligence** — the schema proves that. **But you
retrieve it as flattened text**, which discards the structure at exactly the moment it
matters.

`get_brand_context()` concatenates profile + kit + graph + retrieved chunks into one string
handed to the model. Consequences `[VERIFIED]`:

- `brand_facts(4)['brand_name']` is **MISSING**, so `build_overlay_spec` renders an empty
  brand field — **every DSA creative ships unbranded.**
- There is no way to ask "what do we promote to *this* audience" without the model inferring
  it from prose.
- `verified_claims` is empty for ws4, so no claim can be licensed even if true.
- The pgvector index is keyed by embedding model; a provider mismatch silently returns zero
  rows (fixed this week with a loud diagnostic).

**Jasper's separation is the right model.** `[RECOMMENDATION]` Promote to first-class,
independently retrievable objects:

```
BrandVoice      traits, do/don't, sample sentences, forbidden words
Audience[]      persona, pains, jobs-to-be-done, objections, channel
Product[]       name, category, claims+evidence, price band, imagery refs   ← Product IQ
StyleGuide      palette with roles, typography, logo variants, photography style, layout rules
ClaimRegistry   claim → evidence URL → approved_by → expires_at
KnowledgeBase   chunks, with kind + source + confidence (already exists)
```

Retrieval then selects *per campaign*: one Audience + one Product + BrandVoice + StyleGuide,
rather than one undifferentiated blob. This is a retrieval-shape change, not a rewrite — the
data already exists inside `guidelines`.

---

## 6. Image generation audit

**Architecturally sound. Keep the core.** `[VERIFIED]` Confirmed on a live run: the image
prompt carries a no-text instruction and reserved negative space, leaks neither headline nor
CTA, and the overlay draws both in real type with a real brand colour. Green-screen
compositing for real screenshots is a genuinely unusual and correct solution.

Gaps:

| # | Issue | Evidence | Fix |
|---|---|---|---|
| 1 | Font resolves to a Windows path | `C:/Windows/Fonts/segoeuib.ttf`; Render is Linux, native Python runtime, no font package in build | Vendor a `.ttf` into `backend/assets/fonts/` |
| 2 | Best provider disabled | chain = `['hf_flux','flux_schnell']`; `nano_banana` needs `GEMINI_IMAGE_ENABLED=true` | Set the flag; it is the model the code calls "genuinely usable ad creative" |
| 3 | Brand name never drawn | `brand_facts['brand_name']` missing | Populate from `Workspace.name` / extracted `kit.brand_name` |
| 4 | Logo never composited | `logos[]` extracted, no consumer | Composite as a layer in `overlay.py` |
| 5 | No quality gate in the graph | `generation_graph` is linear: fetch → strategy → copy → media → END | Add an evaluate node + bounded regeneration |
| 6 | No layout intelligence | `LAYOUTS` are fixed variants chosen without regard to image content | Choose layout from detected negative space |
| 7 | Pixel tier limited | `evaluate/pixels.py` exists; `visual.palette` returned UNKNOWN on a real run | Implement palette/contrast/safe-area checks |

---

## 7. Video generation audit

**There is no video pipeline.** `[VERIFIED]`

```
SeedanceProvider.generate_video → raise VideoProviderError("not implemented")
KlingProvider.generate_video    → raise VideoProviderError("not implemented")
VeoProvider.generate_video      → raise VideoProviderError("not implemented")
PexelsProvider / PixabayProvider → stock footage, unrelated to the brand (no keys set)
KenBurnsVideoProvider           → ffmpeg zoompan over the generated still   ← the only real path
```

`CreativeSpec` declares `scenes`, `voiceover`, `timeline`, `subject_motion`,
`environment_motion` — **grep confirms nothing ever reads them.** The schema anticipates a
storyboard pipeline that was never built. 35 videos exist in production; all are pan-and-zoom.

Missing stages, in dependency order `[RECOMMENDATION]`: brief→video brief · storyboard
(scene list with purpose per scene) · scene planning · **character/product consistency across
scenes** (the hard problem — reference-image conditioning or a locked seed per entity) ·
motion direction per scene (`motion.py` already does this for one shot) · transitions ·
voiceover (TTS) + music bed · burned-in captions (reuse `overlay.py`) · per-platform duration
and aspect · assembly (ffmpeg concat) · quality validation.

Honest intermediate step: Ken Burns is a reasonable floor for a static ad. What is not
reasonable is calling it "AI Video Generation" on the marketing site.

---

## 8. Objective quality framework

All thresholds are `[RECOMMENDATION]` unless marked otherwise — I found no established
industry benchmark for any of these in the public record, and will not invent one.

| # | Metric | Precise definition | How to test | Acceptable | Excellent | Mode |
|---|---|---|---|---|---|---|
| 1 | Extraction coverage | fraction of the 6 kit dimensions populated | `coverage()` over all workspaces | ≥80% of workspaces ≥4/6 | ≥95% at 6/6 | Automated |
| 2 | Extraction precision | sampled fields that match the source page | 50 fields/quarter against `evidence.source_url` | ≥90% correct | ≥98% | Human |
| 3 | Evidence completeness | fields carrying a non-empty `source_url` | count over `guidelines` | ≥80% | ≥95% | Automated |
| 4 | Crawl sufficiency | pages successfully read per site | `_extraction.source_pages` | ≥5 | ≥10 | Automated |
| 5 | Brand consistency | evaluator PASS rate, unknowns excluded | `evaluate_asset` on every generation | ≥95% PASS | ≥99% | Automated |
| 6 | Criteria evaluability | criteria returning a verdict, not UNKNOWN | report `tiers_run` | ≥8/9 | 9/9 | Automated |
| 7 | Claim safety | creatives containing an unlicensed regulated/absolute claim | `policy.*` criteria | **0** (hard gate) | 0 | Automated |
| 8 | Product accuracy | creatives where the depicted product matches the real one | human review, 30/month | ≥90% | ≥98% | Human |
| 9 | Visual brand match | reviewer agrees "this looks like the brand" | blind 1–5 scale, 30/month | mean ≥3.5 | ≥4.5 | Human |
| 10 | Palette adherence | output pixels within ΔE≤10 of a brand colour | `evaluate/pixels.py` | ≥60% of frame | ≥80% | Automated |
| 11 | Typography correctness | rendered copy matching the stored string exactly | OCR vs `AdAsset.headline` | 100% | 100% | Automated |
| 12 | Text legibility | contrast ratio of copy against its backing | computed in overlay | ≥4.5:1 (WCAG AA — **established**) | ≥7:1 (AAA) | Automated |
| 13 | Safe-area compliance | copy inside platform-safe margins | geometric check | 100% | 100% | Automated |
| 14 | Image defect rate | outputs with artifacts/extra limbs/garbled glyphs | human review, 30/month | ≤10% | ≤2% | Human |
| 15 | Video coherence | scenes consistent in product/brand/motion | human review | ≥80% | ≥95% | Human |
| 16 | Generation success | generations producing a usable asset | `generation_status` | ≥95% | ≥99% | Automated |
| 17 | Graceful failure | failures with an actionable message, no stuck rows | synthetic fault injection | 100% | 100% | Automated |
| 18 | Latency p95 | request → asset available | server timing | ≤60s | ≤25s | Automated |
| 19 | Cost per creative | provider spend ÷ accepted creatives | metering ledger | track first | — | Automated |
| 20 | Edit/regen rate | creatives regenerated before acceptance | product analytics | ≤30% | ≤10% | Automated |

**Current measured position:** #1 fails (6/9 empty pre-fix) · #6 fails (6/9 criteria) ·
#11 cannot be measured (no OCR) · #16 ≈ 93% (125 completed / 10 failed / 25 null) ·
#18 fails (>120s observed) · #19 impossible (no metering).

---

## 9. Critical architectural gaps

1. **Quality system not in the execution path.** `evaluate/` was imported by nothing; the
   graph has no evaluation node and no regeneration loop. Wiring it into `service.run()`
   (done this week) is advisory-only and post-hoc.
2. **Retrieval flattens a structured schema.** The single biggest quality lever: the model
   receives prose where it should receive objects.
3. **No durable job execution.** `BackgroundTasks` in-process, on an instance that sleeps
   after 15 idle minutes and restarts on deploy. Celery and Redis exist; **no worker service
   is defined in `render.yaml`.**
4. **No metering.** Zero credit deduction in the creative path; unbounded provider spend.
5. **Host-dependent font.** The text architecture's single point of failure is an
   unmanaged filesystem path.
6. **Video is a stub behind a product claim.**
7. **Frontend has zero tests and one 6,327-line component.**
8. **Ephemeral asset storage risk.** `store_bytes` falls back to a local directory when
   Supabase is unconfigured; on Render that disk does not survive a redeploy.

---

## 10. Roadmap

### P0 — prevents reliable operation

| # | Item | Current | Problem | Solution | Files | Effort |
|---|---|---|---|---|---|---|
| 1 | Vendor a font | `C:/Windows/Fonts` fallback | Overlay silently skipped on Linux → ads ship with no copy | Commit a `.ttf`; fail loudly if absent | `backend/assets/fonts/`, `overlay.py` | XS |
| 2 | Credit metering | none | Unbounded spend; "powered by Raftra Credits" is false | Pre-flight balance check + post-generation debit, idempotent on `creative_id` | `creative_routes.py`, `service.py`, `models.py` | M |
| 3 | Finish the evaluator | wired, table absent | Reports computed and discarded | Run `b4c7e2f09a13`; surface in UI | migration, `WorkspaceCreative.tsx` | S |
| 4 | Populate `brand_name` | MISSING | **Every creative ships unbranded** | Fill from `Workspace.name` / `kit.brand_name` | `core/rag.py`, `brand_context.py` | XS |
| 5 | Enable `nano_banana` | off via flag | Running on the compressed floor | `GEMINI_IMAGE_ENABLED=true` | env | XS |
| 6 | Durable jobs | BackgroundTasks | Work lost on sleep/redeploy; no retry | Add the Celery worker service | `render.yaml`, `creative_tasks.py` | M |

### P1 — professional-quality results

7. **Split `guidelines` into BrandVoice / Audience[] / Product[] / StyleGuide / ClaimRegistry**
   — migration + retrieval change; the single biggest quality lever.
8. **Composite the real logo** into the overlay (`logo_variants` + safe area).
9. **Evaluation node in the graph** with bounded regeneration (max 1 retry on CRITICAL).
10. **Vision tier** to close criteria #6 — 3 of 9 criteria are permanently UNKNOWN without it.
11. **One real video provider** (Veo via the existing Gemini key is the shortest path), or
    relabel the marketing claim.
12. **Second paid image provider** so the chain has real depth.

### P2 — quality, flexibility, scale

13. Storyboard + multi-scene video with product consistency.
14. Voiceover (TTS) + burned-in captions, reusing `overlay.py`.
15. Batch/feed variations.
16. Approval workflow on the existing `status` column.
17. Layout chosen from detected negative space.
18. Break up `WorkspaceCreative.tsx`; add frontend tests.
19. Cost + latency telemetry per provider.

### P3 — differentiating

20. **Brand-trained image model** (LoRA on approved assets) — Adobe's Custom Models equivalent.
21. **Multimodal knowledge base** + live connectors (Jasper equivalent).
22. **Surface evidence and confidence in the UI** — nobody else does this; it is a trust feature.
23. Multi-brand workspaces with per-brand voice and style.

---

## 11. Target architecture

```
                 ┌─────────────────── Brand Intelligence ───────────────────┐
  URL / PDF  →   │ crawl → extract → EVIDENCE-BOUND FACTS → human verify    │
                 │        ↓                                                 │
                 │  BrandVoice · Audience[] · Product[] · StyleGuide ·       │
                 │  ClaimRegistry · KnowledgeBase(multimodal)                │
                 │        ↑ versioned, per-section, confidence + source      │
                 └──────────────────────────┬───────────────────────────────┘
                                            │  selective retrieval per campaign
                                            │  (1 audience + 1 product + voice + style)
  Brief  →  Analyzer (1 LLM call)  →  CreativeSpec (IR)
                                            │
                        ┌───────────────────┴───────────────────┐
                        │  deterministic derivation (no LLM)     │
                        │  optimizer · platforms · motion · layout│
                        └───────────────────┬───────────────────┘
                                            │
                      ┌─────────────────────┴─────────────────────┐
                      │ IMAGE: provider chain → composite(real     │
                      │        screenshot/logo) → overlay(real type)│
                      │ VIDEO: storyboard → scenes → per-scene      │
                      │        motion → captions → VO → assemble    │
                      └─────────────────────┬─────────────────────┘
                                            │
                              ┌─────────────┴─────────────┐
                              │  QUALITY GATE (blocking)   │
                              │  objective · pixels · vision│
                              │  PASS → publish             │
                              │  FAIL → 1 bounded regen     │
                              │  UNKNOWN → human review     │
                              └─────────────┬─────────────┘
                                            │
                          durable queue · metered · telemetry
```

Three changes versus today: knowledge is retrieved **as objects, selectively**; the quality
gate is **in the path and can block**; execution is **durable and metered**.

---

## 12. Test strategy and acceptance criteria

**Current state** `[VERIFIED]`: 90 backend test functions across 7 files; `test_auth.py`,
`test_generation.py`, `test_login.py`, `test_ws.py` contain **zero** test functions (they are
manual scripts). **Zero frontend tests.** No integration test covers URL → creative.

**Required additions** `[RECOMMENDATION]`

| Layer | Test | Acceptance |
|---|---|---|
| Unit | `coverage()` / `extraction_status()` | done — 27 tests |
| Unit | overlay font resolution | **fails loudly** when no scalable font exists |
| Unit | `build_prompts` text safety | headline/CTA never appear in `image_prompt` |
| Unit | evaluator policy criteria | done — 27 tests |
| Contract | every provider satisfies `ImageProvider` | stubs raise, never return a placeholder |
| Integration | onboarding against a recorded fixture site | coverage ≥4/6, evidence ≥80% |
| Integration | generate → evaluate → persist | row written, report persisted, no stuck `processing` |
| Integration | provider exhaustion | chain walks, cooldown set, asset still produced |
| E2E | URL → creative, headless | asset has non-empty headline pixels (OCR) |
| Regression | golden set of 10 brands | coverage and evaluator score do not drop between releases |
| Load | 20 concurrent generations | no lost jobs; p95 ≤60s |
| Frontend | WorkspaceCreative smoke | renders, generates, shows errors |

**Release gate** `[RECOMMENDATION]`: no release if claim-safety (#7) is non-zero, typography
correctness (#11) is below 100%, or generation success (#16) is below 95%.

---

## Sources

Competitor claims above are vendor-published unless stated. Independent evaluation of output
quality is largely absent from the public record for all four products.

- Canva Brand Kit / brand assets — https://www.canva.com/help/find-and-manage-brand-assets/
- Canva Brand Kits foundation — https://www.canva.com/design-school/lessons/brand-kits-the-foundation
- Canva brand kit guide (third-party) — https://bringyourownlaptop.com/blog/canva-brand-kits-guide
- Canva AI workflow 2026 (third-party, Magic Brand Kit Setup claim) — https://frankx.ai/blog/ultimate-canva-ai-workflow-2026
- Jasper IQ help centre — https://help.jasper.ai/hc/en-us/articles/18618654325787-Jasper-IQ
- Jasper IQ product page — https://www.jasper.ai/jasper-iq
- Jasper platform — https://www.jasper.ai/platform
- Jasper knowledge base — https://jasper.ai/knowledge-base
- Adobe Firefly Custom Models — https://business.adobe.com/products/firefly-business/custom-models.html
- Adobe Firefly Foundry — https://business.adobe.com/products/firefly-business/firefly-foundry.html
- Adobe Firefly AI approach (training data, indemnification) — https://business.adobe.com/products/firefly-business/firefly-ai-approach.html
- Adobe Firefly enterprise — https://www.adobe.com/sensei/generative-ai/firefly/enterprise.html
- Creatopy AI advertisement generator — https://www.creatopy.com/campaigns/ai-advertisement-generator
- Creatopy review (third-party) — https://sonary.com/reviews/creatopy/
- Creatopy/The Brief G2 — https://www.g2.com/products/the-brief
- Text rendering in diffusion models, Type-R (SD3/Flux limitation) — https://arxiv.org/html/2411.18159v1
- WordCon, word-level typography control — https://arxiv.org/html/2506.21276v1
- Why text in AI images goes wrong — https://uxdesign.cc/lost-for-words-why-text-in-ai-images-still-goes-wrong-b5232c39bd11
- Separate text rendering engines overlaid on the image (opinion) — https://dev.to/klement_gunndu_e16216829c/ai-image-generators-cant-render-text-heres-why-and-4-fixes-that-actually-work-3i8o
- WCAG 2.1 contrast minimum (the one established threshold used) — https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html
