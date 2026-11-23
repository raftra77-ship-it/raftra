# Brand extraction — design note

Status: implemented, pending backfill and UI surfacing
Date: 2026-11-12
Scope: `agents/creative_nodes/onboarding_graph.py`, `core/brand_kit.py`,
`intelligence_routes.py`, `workspace_routes.py`

## The problem

Creative Studio's output quality is bounded by the brand kit, not by the image model. A
controlled comparison earlier in this work made that concrete: the same prompt, model and
code produced on-brand copy against a 20k-character vault and regulated claims
("clinically proven", "cheapest") against a 4k one. So extraction is the input that decides
whether the rest of the section can work at all.

Measured on production, nine workspaces:

| ws | URL | pages crawled | logo | colors | typography | reported as |
|----|-----|---------------|------|--------|------------|-------------|
| 12 | nike.in | 12 | ✓ | ✓ | ✓ | COMPLETED |
| 20 | nike.in | 12 | ✓ | ✓ | ✓ | COMPLETED |
| 4  | dsahelper.onrender.com | 1 | — | ✓ | ✓ | COMPLETED |
| 15 | nike.in | (pre-provenance) | — | — | — | COMPLETED |
| 13 | hdh | (pre-provenance) | — | — | — | COMPLETED |
| 16 | bdh | (pre-provenance) | — | — | — | COMPLETED |
| 18 | www.rasova.com | **0** | — | — | — | COMPLETED |
| 19 | 12345678 | **0** | — | — | — | COMPLETED |
| 14 | nike.in | never ran | — | — | — | (no record) |

Six of nine held no logo, no palette and no typography. Every one of them had
`is_onboarded = True` and an agent task reading
`COMPLETED — "Brand profile & knowledge base built"`.

Two of them crawled **zero pages** and still reported that. One, `rasova.com`, is a real
reachable site.

The only field populated on all nine is `brand_voice` — the field the model *synthesises*
rather than extracts. The honest fields, the ones that come from actually reading a site,
are the empty ones. The system could not distinguish a brand it had read from a brand it
had invented, and neither could the user.

Note also that `nike.in` produced three different outcomes across four workspaces. The
failure is not a property of the site.

## Root causes

1. **`is_onboarded` recorded that the pipeline ran, not that a brand was obtained.** It was
   set unconditionally at the end of persistence.
2. **The agent task summary was a constant string.** It did not consult the result.
3. **No host validation at entry.** `normalize_target_url()` fixes a URL's shape and asks
   nothing about its host, so `hdh`, `bdh` and `12345678` became permanent workspaces.
4. **Nothing surfaced the gap.** A user with an empty kit had no signal and no reason to
   look.

## Design

### `is_onboarded` is deliberately not repurposed

It drives post-login routing (`/onboarding-status` → `next: dashboard | onboarding`).
Tightening it to mean "has a usable brand" would trap every thin-kit user in the onboarding
loop forever, including the six above. "Did this person finish the flow" and "do we hold a
usable brand" are different questions and get different fields.

### `coverage()` — one definition, three consumers

A pure function in `core/brand_kit.py`, no database and no network, over six dimensions:

```
logo · colors · typography · voice · audience · guidelines
```

These mirror the Brand Kit checklist the dashboard already renders
(`ModernHomeOverview.kitReady`), so the screen and the pipeline cannot disagree about what
"complete" means. `COVERAGE_USABLE_MIN = 3` is the point below which a creative can carry
neither the brand's look nor its words.

It tolerates every shape these JSON columns have actually held in production — `None`,
`""`, `[]`, `{}`, `"null"`, `"[]"` — and treats the extractor's `NOT_AVAILABLE` sentinel as
absence, so a kit of placeholders cannot report as complete.

### `extraction_status()` — one word for the outcome

`complete` · `partial` · `empty` · `unreachable`

`unreachable` (zero pages read) is kept distinct from `empty` (pages read, nothing learned)
because they are different problems with different fixes.

### Where it is written and read

- **Written** by `synthesis_and_persistence_node` into the existing `_extraction`
  provenance block, beside `source_pages` / `last_crawled` / `extraction_version`.
- **Reported** by `run_onboarding_pipeline` — a run that read nothing is now recorded
  `FAILED` with the reason, not `COMPLETED`.
- **Broadcast** to the user during onboarding: which dimensions are missing, or that the
  site could not be read at all.
- **Read** on `GET /api/workspaces/{id}/brand-kit` as `extraction`, recomputed on read
  rather than trusted from storage, because workspaces onboarded before the provenance
  block existed have no recorded coverage and a hand-edited kit changes the answer with no
  crawl involved.

### `is_crawlable_host()` — a shape check, not a DNS lookup

Applied at workspace creation; returns `400` with an actionable message. Deliberately not a
resolution: it runs inside a request, a lookup adds latency, and a site that is merely down
for a minute should not cost someone a workspace. Genuine unreachability is a separate,
recoverable outcome already reported by the crawl as `status="unreachable"`.

## Verification

`backend/test_brand_coverage.py`, 27 tests, each pinned to an observed production failure
rather than a hypothetical. Checked against live rows:

```
ws12  complete      6/6 (100%)  pages=12
ws4   partial       5/6  (83%)  pages=1   missing=[logo]
ws18  unreachable   1/6  (17%)  pages=0   missing=[logo, colors, typography, audience, guidelines]
ws13  unknown       1/6  (17%)  pages=None
```

`unknown` is correct for ws13: it predates the provenance block, so no crawl record exists
to classify. It is not reported as a success.

## Not done

- **Backfill.** The nine existing workspaces carry no recorded status. Recomputing on read
  covers the API, but the stored `_extraction.status` stays absent until each is re-crawled.
  This is a production write and has not been run.
- **UI.** The `extraction` field is served and nothing renders it yet. The intended surface
  is the Brand Kit card: coverage, what is missing, and an upload path for logo/colours/
  fonts so a thin crawl is recoverable by hand.
- **The reindex path** (`POST /{id}/reindex`) does not yet apply `is_crawlable_host`; only
  creation does.
- **Crawl depth.** `dsahelper.onrender.com` yielded one page because the site is an SPA
  served without a rewrite rule, so every sub-route 404s. That is a property of the site,
  not the crawler, but a "we could only read 1 page" warning belongs in the same surface.
