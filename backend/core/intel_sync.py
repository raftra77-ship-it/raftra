"""
The two scheduled external syncs, and the single place that writes their results.

    market trends    every 2 weeks   Google Trends + YouTube    -> market_trend_reports
    competitor ads   every 4 weeks   Meta Ad Library (or Apify) -> competitor_ads

Both follow the same rules, and they are the rules that make this trustworthy rather than
decorative:

* Every write carries workspace_id, and every vector point carries it in its payload, so a
  tenant's ads and trends can only be retrieved under a filter that names them.
* Every run records a SyncRun row - success, failure or skip. A job that has been failing
  for a month must not look like a quiet market.
* Nothing is invented. If no source is configured the run is recorded as failed with the
  reason, and the screen stays empty.
"""
import asyncio
import os
import uuid
from datetime import datetime, timedelta
from typing import List, Optional

DEFAULT_COUNTRY = os.getenv("DEFAULT_MARKET_COUNTRY", "IN")

# Payload `type` values in the shared Qdrant collection. Retrieval filters on these as well
# as workspace_id, so a question about ad tactics does not come back with brand boilerplate.
KIND_AD = "competitor_ad"
KIND_TREND = "market_trend"


def _record(db, workspace_id: int, kind: str, status: str, message: str = "",
            items: int = 0, started: Optional[datetime] = None):
    import models
    row = models.SyncRun(workspace_id=workspace_id, kind=kind, status=status,
                         message=(message or "")[:480], items=items,
                         started_at=started or datetime.utcnow(),
                         finished_at=datetime.utcnow())
    db.add(row)
    db.commit()
    return row


def _index(workspace_id: int, kind: str, texts: List[dict], replace: bool = True,
           retain_days: int = 0) -> int:
    """Write this workspace's points of one kind.

    `replace=True` (competitor ads): the previous snapshot is dropped first. An ad set from
    two weeks ago is not history, it is a stale answer to the same question, and leaving it
    in means a query about "what are they running" retrieves ads that have since stopped.

    `replace=False` with `retain_days` (market trends): points ACCUMULATE, and anything
    older than the window is pruned. Trends are the opposite case - a four-weekly sync
    exists so the market can be compared across time, and deleting last month's index is
    exactly what makes "what changed" unanswerable. Retention keeps that bounded rather
    than growing forever.

    Returns how many points were written; never raises, because a vector store that is down
    must not lose the relational rows that were already committed.
    """
    if not texts:
        return 0
    try:
        from database import qdrant_client
        from qdrant_client.models import (PointStruct, Filter, FieldCondition, MatchValue)
        from core.embeddings import embed_passage, ensure_collection, COLLECTION_NAME

        from qdrant_client.models import Range

        ensure_collection(qdrant_client)
        scope = [
            FieldCondition(key="workspace_id", match=MatchValue(value=workspace_id)),
            FieldCondition(key="type", match=MatchValue(value=kind)),
        ]
        if replace:
            qdrant_client.delete(collection_name=COLLECTION_NAME,
                                 points_selector=Filter(must=scope))
        elif retain_days:
            # Keep history, but bounded: drop anything past the retention window rather
            # than letting a four-weekly job grow the index without limit.
            cutoff = int((datetime.utcnow() - timedelta(days=retain_days)).timestamp())
            qdrant_client.delete(
                collection_name=COLLECTION_NAME,
                points_selector=Filter(must=scope + [
                    FieldCondition(key="indexed_ts", range=Range(lt=cutoff))]),
            )
        # Every point carries WHEN it was written, in two forms. `indexed_at` is readable in
        # a payload dump; `indexed_ts` is an integer epoch because Qdrant range filters and
        # ordering need a number, not an ISO string. Without these a trend index answers
        # "what is true about this market" but never "what changed since last month" - and
        # a four-weekly sync exists precisely to make that question answerable.
        now = datetime.utcnow()
        stamp = {"indexed_at": now.isoformat(), "indexed_ts": int(now.timestamp())}
        points = [
            PointStruct(id=str(uuid.uuid4()), vector=embed_passage(t["content"]),
                        payload={"workspace_id": workspace_id, "type": kind,
                                 "content": t["content"], **stamp, **(t.get("meta") or {})})
            for t in texts if (t.get("content") or "").strip()
        ]
        if points:
            qdrant_client.upsert(collection_name=COLLECTION_NAME, points=points)
        return len(points)
    except Exception as e:
        print("[intel_sync] vector index failed for workspace %s (%s): %s" % (workspace_id, kind, e))
        return 0


# ------------------------------------------------------------- competitor ads

async def sync_competitor_ads(workspace_id: int, country: str = None,
                              competitors: Optional[List[str]] = None,
                              per_competitor: int = 25) -> dict:
    """Refresh one workspace's competitor ad vault.

    Competitors default to the ones already researched into CompetitorReport, so the ad
    sync tracks the rivals the user actually named rather than a guess.
    """
    import models
    from database import SessionLocal
    from core import ad_library
    from core.providers.llm_providers import GeminiProvider

    started = datetime.utcnow()
    country = (country or DEFAULT_COUNTRY).upper()

    with SessionLocal() as db:
        ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id).first()
        if not ws:
            return {"status": "skipped", "reason": "workspace not found"}
        brand_name = ws.name or ""

        names = [n.strip() for n in (competitors or []) if (n or "").strip()]
        if not names:
            names = [r.competitor for r in
                     db.query(models.CompetitorReport)
                       .filter(models.CompetitorReport.workspace_id == workspace_id).all()
                     if (r.competitor or "").strip()]
        bp = (db.query(models.BrandProfile)
                .filter(models.BrandProfile.workspace_id == workspace_id).first())
        guidelines = (bp.guidelines if bp else None) or {}
        categories = [str(c) for c in (guidelines.get("categories") or []) if str(c).strip()]
        brand_context = " ".join(str(guidelines.get(k) or "")
                                 for k in ("overview", "competitive", "business_model"))[:1500]

    discovered: List[str] = []
    if not names:
        # A workspace onboarded from nothing but its URL has no competitors saved, and this
        # used to skip on that basis - so the report the product promises stayed
        # permanently empty unless someone knew to type rival names in by hand. Derive a
        # starting list from what onboarding already learned about the brand.
        from core import competitors as competitor_research
        discovered = await competitor_research.discover_competitors(
            brand_name, categories, DEFAULT_COUNTRY, brand_context)
        names = discovered

    if not names:
        with SessionLocal() as db:
            _record(db, workspace_id, "competitor_ads", "skipped",
                    "No competitors saved, and none could be identified from the brand profile.",
                    0, started)
        return {"status": "skipped", "reason": "no competitors configured", "ads": 0}

    if discovered:
        # Saved as ordinary rows so they appear in Market Intelligence and can be corrected
        # or removed, rather than being an invisible list only this job knows about.
        with SessionLocal() as db:
            existing = {(r.competitor or "").lower() for r in
                        db.query(models.CompetitorReport)
                          .filter(models.CompetitorReport.workspace_id == workspace_id).all()}
            for n in discovered:
                if n.lower() not in existing:
                    db.add(models.CompetitorReport(workspace_id=workspace_id, competitor=n))
            db.commit()

    llm = GeminiProvider()
    fetched: dict = {}
    errors: List[str] = []

    for name in names[:8]:
        try:
            fetched[name] = await ad_library.fetch_competitor_ads(name, country, per_competitor)
        except ad_library.AdLibraryError as e:
            errors.append("%s: %s" % (name, e))
        except Exception as e:
            errors.append("%s: %s" % (name, e))

    total = sum(len(v) for v in fetched.values())
    if total == 0:
        with SessionLocal() as db:
            msg = "; ".join(errors) or "No active ads found."
            _record(db, workspace_id, "competitor_ads",
                    "failed" if errors else "success", msg, 0, started)
        return {"status": "failed" if errors else "success", "ads": 0, "errors": errors}

    # Persist ads, replacing this workspace's previous snapshot for the competitors that
    # answered. A competitor whose fetch failed keeps its last good rows rather than being
    # wiped by an outage.
    vector_docs: List[dict] = []
    with SessionLocal() as db:
        for name, ads in fetched.items():
            (db.query(models.CompetitorAd)
               .filter(models.CompetitorAd.workspace_id == workspace_id,
                       models.CompetitorAd.competitor_name == name)
               .delete(synchronize_session=False))
            for ad in ads:
                db.add(models.CompetitorAd(
                    workspace_id=workspace_id,
                    competitor_name=name,
                    external_id=ad.get("external_id") or None,
                    ad_title=ad.get("ad_title") or None,
                    ad_copy=ad.get("ad_copy") or None,
                    snapshot_url=ad.get("snapshot_url") or None,
                    platforms=ad.get("platforms") or [],
                    offers=ad.get("offers") or {},
                    started_at=ad.get("started_at"),
                    days_active=ad.get("days_active"),
                    country=country,
                    source=ad.get("source") or "unknown",
                    synced_at=datetime.utcnow(),
                ))
                vector_docs.append({
                    "content": "Competitor ad by %s (%s days active): %s\n%s"
                               % (name, ad.get("days_active", "?"),
                                  ad.get("ad_title") or "", ad.get("ad_copy") or ""),
                    "meta": {"competitor": name, "source_url": ad.get("snapshot_url") or "",
                             "days_active": ad.get("days_active") or 0},
                })
        db.commit()

    # One strategy read per competitor, over that competitor's ads.
    for name, ads in fetched.items():
        if not ads:
            continue
        try:
            analysis = await ad_library.analyse_ads(llm, brand_name, ads)
        except Exception as e:
            print("[intel_sync] ad strategy analysis failed for %s: %s" % (name, e))
            continue
        if not analysis:
            continue
        with SessionLocal() as db:
            row = (db.query(models.CompetitorAdStrategy)
                     .filter(models.CompetitorAdStrategy.workspace_id == workspace_id,
                             models.CompetitorAdStrategy.competitor_name == name).first())
            if not row:
                row = models.CompetitorAdStrategy(workspace_id=workspace_id, competitor_name=name)
                db.add(row)
            row.summary = analysis.get("summary") or ""
            row.offer_strategy = analysis.get("offer_strategy") or ""
            row.evergreen_winners = analysis.get("evergreen_winners") or []
            row.fatiguing = analysis.get("fatiguing") or []
            row.blue_ocean = analysis.get("blue_ocean") or {}
            row.red_ocean = analysis.get("red_ocean") or {}
            row.recommended_formats = analysis.get("recommended_formats") or []
            row.ads_analysed = len(ads)
            row.country = country
            row.synced_at = datetime.utcnow()
            db.commit()
        if analysis.get("summary"):
            vector_docs.append({
                "content": "Competitor ad strategy - %s: %s\nOffers: %s\nBlue ocean: %s\nRed ocean: %s"
                           % (name, analysis.get("summary", ""), analysis.get("offer_strategy", ""),
                              (analysis.get("blue_ocean") or {}).get("rationale", ""),
                              (analysis.get("red_ocean") or {}).get("rationale", "")),
                "meta": {"competitor": name},
            })

    indexed = _index(workspace_id, KIND_AD, vector_docs)
    with SessionLocal() as db:
        _record(db, workspace_id, "competitor_ads", "success",
                "%d ad(s) across %d competitor(s); %d indexed.%s"
                % (total, len(fetched), indexed,
                   (" Errors: " + "; ".join(errors)) if errors else ""),
                total, started)
    return {"status": "success", "ads": total, "indexed": indexed, "errors": errors}


# --------------------------------------------------------------- market trends

async def sync_market_trends(workspace_id: int, region: str = None,
                             extra_keywords: Optional[List[str]] = None) -> dict:
    """Build and store one workspace's four-weekly market trend report."""
    import models
    from database import SessionLocal
    from core import market_trends
    from core.providers.llm_providers import GeminiProvider

    started = datetime.utcnow()
    region = (region or DEFAULT_COUNTRY).upper()

    with SessionLocal() as db:
        ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id).first()
        if not ws:
            return {"status": "skipped", "reason": "workspace not found"}
        bp = (db.query(models.BrandProfile)
                .filter(models.BrandProfile.workspace_id == workspace_id).first())
        brand_name = ws.name or ""
        guidelines = (bp.guidelines if bp else None) or {}
        categories = [str(c) for c in (guidelines.get("categories") or []) if str(c).strip()]

    try:
        report = await market_trends.build_trend_report(
            GeminiProvider(), brand_name, categories, region, extra_keywords)
    except market_trends.TrendSourceError as e:
        with SessionLocal() as db:
            _record(db, workspace_id, "market_trends", "failed", str(e), 0, started)
        return {"status": "failed", "reason": str(e)}
    except Exception as e:
        with SessionLocal() as db:
            _record(db, workspace_id, "market_trends", "failed", str(e), 0, started)
        return {"status": "failed", "reason": str(e)}

    with SessionLocal() as db:
        row = models.MarketTrendReport(
            workspace_id=workspace_id,
            report_title=report["report_title"],
            summary=report.get("summary") or "",
            region=report["region"],
            period_start=datetime.combine(report["period_start"], datetime.min.time()),
            period_end=datetime.combine(report["period_end"], datetime.min.time()),
            strategic_keywords=report.get("strategic_keywords") or [],
            winning_patterns=report.get("winning_patterns") or [],
            creative_formats=report.get("creative_formats") or [],
            creator_video_refs=report.get("creator_video_refs") or [],
            sources=report.get("sources") or [],
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        report_id = row.id

    docs = []
    if report.get("summary"):
        docs.append({"content": "Market trend report (%s, %s): %s"
                                % (report["region"], report["report_title"], report["summary"]),
                     "meta": {"report_id": report_id}})
    for k in (report.get("strategic_keywords") or []):
        docs.append({
            "content": "Search trend in %s - '%s' interest %s (%s intent). Hook: %s"
                       % (report["region"], k.get("keyword", ""), k.get("score", ""),
                          k.get("bucket", ""), k.get("hook", "")),
            "meta": {"report_id": report_id, "keyword": k.get("keyword", ""),
                     "region": report["region"], "bucket": k.get("bucket", ""),
                     "score": k.get("score"),
                     "period_end": report["period_end"].isoformat()},
        })
    for p in (report.get("winning_patterns") or []):
        docs.append({"content": "Winning creative pattern in %s: %s" % (report["region"], p),
                     "meta": {"report_id": report_id}})

    # Trends accumulate so the index can be queried across time - that is the whole point
    # of a recurring sync. A year keeps ~13 reports per workspace, which is enough for
    # year-on-year seasonality without unbounded growth.
    indexed = _index(workspace_id, KIND_TREND, docs, replace=False, retain_days=365)
    with SessionLocal() as db:
        _record(db, workspace_id, "market_trends", "success",
                "%d keyword(s), %d video ref(s); %d indexed. Sources: %s"
                % (len(report.get("strategic_keywords") or []),
                   len(report.get("creator_video_refs") or []), indexed,
                   ", ".join(report.get("sources") or []) or "none"),
                len(report.get("strategic_keywords") or []), started)
    return {"status": "success", "report_id": report_id, "indexed": indexed}


# ------------------------------------------------------------- batch (scheduler)

# Space workspaces out so a burst does not exhaust the free Gemini / Trends / YouTube
# quotas all at once - the same reasoning as the monthly SEO scheduler.
_DELAY_BETWEEN_WORKSPACES_SEC = int(os.getenv("INTEL_SYNC_SPACING_SEC", "20"))


async def _eligible_workspaces() -> List[int]:
    """Workspaces that have been onboarded. Syncing one that has no brand profile would
    produce a report with no category to measure and no rival to look up."""
    from database import SessionLocal
    import models
    with SessionLocal() as db:
        rows = (db.query(models.BrandProfile.workspace_id)
                  .filter(models.BrandProfile.is_onboarded.is_(True)).all())
    return [r[0] for r in rows if r[0]]


async def run_all_competitor_ad_syncs():
    ids = await _eligible_workspaces()
    print("[intel_sync] competitor-ad sync starting for %d workspace(s)." % len(ids))
    for ws_id in ids:
        try:
            await sync_competitor_ads(ws_id)
        except Exception as e:
            # One workspace failing must never stop the rest of the run.
            print("[intel_sync] competitor-ad sync failed for workspace %s: %s" % (ws_id, e))
        await asyncio.sleep(_DELAY_BETWEEN_WORKSPACES_SEC)
    print("[intel_sync] competitor-ad sync complete.")


async def run_all_market_trend_syncs():
    ids = await _eligible_workspaces()
    print("[intel_sync] market-trend sync starting for %d workspace(s)." % len(ids))
    for ws_id in ids:
        try:
            await sync_market_trends(ws_id)
        except Exception as e:
            print("[intel_sync] market-trend sync failed for workspace %s: %s" % (ws_id, e))
        await asyncio.sleep(_DELAY_BETWEEN_WORKSPACES_SEC)
    print("[intel_sync] market-trend sync complete.")


def last_sync(db, workspace_id: int, kind: str):
    """The most recent run of one kind, for the "last refreshed" line in the UI."""
    import models
    return (db.query(models.SyncRun)
              .filter(models.SyncRun.workspace_id == workspace_id, models.SyncRun.kind == kind)
              .order_by(models.SyncRun.started_at.desc())
              .first())


def next_due(last: Optional[datetime], days: int) -> Optional[datetime]:
    return (last + timedelta(days=days)) if last else None
