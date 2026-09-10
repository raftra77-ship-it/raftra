"""
Brand-intelligence API: the brand kit, the competitor ad vault, the market-trend radar,
and the hybrid RAG query that reads across all three.

Every route resolves the workspace through `_require_workspace` before touching anything,
which is the tenancy boundary: a workspace belongs to exactly one user, so a request for
another tenant's ads is a 403 rather than an empty list. Vector reads are additionally
filtered on workspace_id inside core.rag, so an isolation bug would have to defeat both.
"""
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import nulls_last
from sqlalchemy.orm import Session

import auth
import database
import models
from core import tenancy

router = APIRouter(prefix="/api/workspaces", tags=["intelligence"])

# The cadences the pipeline promises, used to show when a refresh is next due. These must
# match the intervals registered in core/scheduler.py: market trends every 2 weeks,
# competitor ads every 4. They were the other way round in both places, so the screen also
# advertised the wrong refresh dates.
TREND_SYNC_DAYS = 14
AD_SYNC_DAYS = 28


def _require_workspace(workspace_id: int, db: Session, current_user: models.User):
    ws = (db.query(models.Workspace)
            .filter(models.Workspace.id == workspace_id,
                    tenancy.visible_workspace(current_user)).first())
    if not ws:
        raise HTTPException(status_code=403, detail="Workspace access denied")
    return ws


def _iso(dt: Optional[datetime]) -> Optional[str]:
    return dt.isoformat() if dt else None


def _sync_json(row, cadence_days: int) -> dict:
    if not row:
        return {"status": "never", "last_run_at": None, "next_due_at": None,
                "message": "", "items": 0}
    return {
        "status": row.status,
        "last_run_at": _iso(row.started_at),
        "next_due_at": _iso(row.started_at + timedelta(days=cadence_days)) if row.started_at else None,
        "message": row.message or "",
        "items": row.items or 0,
    }


# ---------------------------------------------------------------------- brand kit

@router.get("/{workspace_id}/brand-kit")
def get_brand_kit(workspace_id: int, db: Session = Depends(database.get_db),
                  current_user: models.User = Depends(auth.get_current_user)):
    """The full design + identity kit for this workspace.

    Everything here is read straight from Postgres rather than the vector store: design
    tokens are exact values a brief must reproduce byte for byte, and approximate nearest
    neighbours are the wrong tool for "what is the hex of the CTA colour".
    """
    ws = _require_workspace(workspace_id, db, current_user)
    bp = (db.query(models.BrandProfile)
            .filter(models.BrandProfile.workspace_id == workspace_id).first())
    guidelines = (bp.guidelines if bp else None) or {}

    return {
        "brand_name": ws.name,
        "website_url": ws.company_url,
        "brand_color": ws.brand_color,
        "brand_logo": ws.brand_logo,
        "is_onboarded": bool(bp.is_onboarded) if bp else False,
        "overview": guidelines.get("overview") or (bp.brand_guidelines_summary if bp else "") or "",
        "mission": guidelines.get("slogan") or "",
        "positioning": guidelines.get("competitive") or "",
        "business_model": guidelines.get("business_model") or "",
        "product_categories": guidelines.get("categories") or [],
        "usps": guidelines.get("usps") or "",
        "benefits": guidelines.get("features") or "",
        "personality": guidelines.get("personality") or "",
        "tone_of_voice": guidelines.get("tone_of_voice") or (
            [guidelines["tone"]] if guidelines.get("tone") else []),
        "key_messages": guidelines.get("key_messages") or [],
        "target_audience": (bp.target_audience if bp else "") or "",
        "target_audiences": guidelines.get("target_audiences") or [],
        "typography": (bp.typography if bp else None) or {},
        "color_palette": (bp.color_palette if bp else None) or [],
        "color_tokens": (bp.color_tokens if bp else None) or [],
        "logos": (bp.logos if bp else None) or [],
        "founded": guidelines.get("founded") or "",
        "rating": guidelines.get("rating") or None,
    }


# ------------------------------------------------------------------ competitor ads

@router.get("/{workspace_id}/competitor-ads")
def list_competitor_ads(workspace_id: int, db: Session = Depends(database.get_db),
                        current_user: models.User = Depends(auth.get_current_user)):
    """The ad vault, grouped by competitor, each with its strategy read.

    Ads are ordered by days_active because that ordering IS the insight: the top of each
    list is what the rival has been paying to run longest.
    """
    _require_workspace(workspace_id, db, current_user)

    ads = (db.query(models.CompetitorAd)
             .filter(models.CompetitorAd.workspace_id == workspace_id)
             .order_by(nulls_last(models.CompetitorAd.days_active.desc()))
             .all())
    strategies = {s.competitor_name: s for s in
                  db.query(models.CompetitorAdStrategy)
                    .filter(models.CompetitorAdStrategy.workspace_id == workspace_id).all()}

    grouped: dict = {}
    for ad in ads:
        grouped.setdefault(ad.competitor_name, []).append({
            "id": ad.id,
            "title": ad.ad_title or "",
            "copy": ad.ad_copy or "",
            "snapshot_url": ad.snapshot_url or "",
            "platforms": ad.platforms or [],
            "offers": ad.offers or {},
            "days_active": ad.days_active,
            "started_at": _iso(ad.started_at),
            "country": ad.country,
            "source": ad.source,
        })

    out = []
    for name, rows in grouped.items():
        s = strategies.get(name)
        out.append({
            "competitor": name,
            "ads": rows,
            "ad_count": len(rows),
            # The fatigue split the whole vault exists to show.
            "evergreen_count": sum(1 for r in rows if (r["days_active"] or 0) >= 45),
            "strategy": {
                "summary": s.summary or "",
                "offer_strategy": s.offer_strategy or "",
                "evergreen_winners": s.evergreen_winners or [],
                "fatiguing": s.fatiguing or [],
                "blue_ocean": s.blue_ocean or {},
                "red_ocean": s.red_ocean or {},
                "recommended_formats": s.recommended_formats or [],
                "ads_analysed": s.ads_analysed or 0,
                "synced_at": _iso(s.synced_at),
            } if s else None,
        })
    out.sort(key=lambda g: g["ad_count"], reverse=True)

    from core.intel_sync import last_sync
    from core import ad_library
    return {
        "competitors": out,
        "total_ads": len(ads),
        "sync": _sync_json(last_sync(db, workspace_id, "competitor_ads"), AD_SYNC_DAYS),
        "cadence_days": AD_SYNC_DAYS,
        "source_configured": ad_library.is_configured(),
    }


class AdSyncBody(BaseModel):
    country: Optional[str] = None
    competitors: Optional[List[str]] = None


@router.post("/{workspace_id}/competitor-ads/sync")
async def sync_ads_now(workspace_id: int, body: AdSyncBody = AdSyncBody(),
                       db: Session = Depends(database.get_db),
                       current_user: models.User = Depends(auth.get_current_user)):
    """Run the fortnightly competitor-ad sync now, for this workspace only."""
    _require_workspace(workspace_id, db, current_user)
    from core.intel_sync import sync_competitor_ads
    try:
        result = await sync_competitor_ads(workspace_id, body.country, body.competitors)
    except Exception as e:
        raise HTTPException(status_code=502, detail="Competitor ad sync failed: %s" % e)
    if result.get("status") == "failed":
        # 502 rather than 200-with-an-error: the caller asked for a refresh and did not get
        # one, and the UI should say so instead of showing a stale vault as if it were new.
        raise HTTPException(status_code=502,
                            detail="; ".join(result.get("errors") or []) or result.get("reason", "Sync failed"))
    return result


# -------------------------------------------------------------------- market trends

@router.get("/{workspace_id}/market-trends")
def list_market_trends(workspace_id: int, limit: int = 6,
                       db: Session = Depends(database.get_db),
                       current_user: models.User = Depends(auth.get_current_user)):
    """The latest trend report plus the headline of each earlier one, so the radar can be
    read against last month rather than in isolation."""
    _require_workspace(workspace_id, db, current_user)

    rows = (db.query(models.MarketTrendReport)
              .filter(models.MarketTrendReport.workspace_id == workspace_id)
              .order_by(models.MarketTrendReport.period_end.desc(),
                        models.MarketTrendReport.id.desc())
              .limit(max(1, min(limit, 24))).all())

    def full(r):
        return {
            "id": r.id,
            "report_title": r.report_title,
            "summary": r.summary or "",
            "region": r.region,
            "period_start": _iso(r.period_start),
            "period_end": _iso(r.period_end),
            "strategic_keywords": r.strategic_keywords or [],
            "winning_patterns": r.winning_patterns or [],
            "creative_formats": r.creative_formats or [],
            "creator_video_refs": r.creator_video_refs or [],
            "sources": r.sources or [],
            "created_at": _iso(r.created_at),
        }

    from core.intel_sync import last_sync
    from core import market_trends
    return {
        "latest": full(rows[0]) if rows else None,
        "history": [{"id": r.id, "report_title": r.report_title, "region": r.region,
                     "period_end": _iso(r.period_end),
                     "keyword_count": len(r.strategic_keywords or [])} for r in rows[1:]],
        "sync": _sync_json(last_sync(db, workspace_id, "market_trends"), TREND_SYNC_DAYS),
        "cadence_days": TREND_SYNC_DAYS,
        "source_configured": market_trends.is_configured(),
    }


class TrendSyncBody(BaseModel):
    region: Optional[str] = None
    extra_keywords: Optional[List[str]] = None


@router.post("/{workspace_id}/market-trends/sync")
async def sync_trends_now(workspace_id: int, body: TrendSyncBody = TrendSyncBody(),
                          db: Session = Depends(database.get_db),
                          current_user: models.User = Depends(auth.get_current_user)):
    """Run the four-weekly market-trend sync now, for this workspace only."""
    _require_workspace(workspace_id, db, current_user)
    from core.intel_sync import sync_market_trends
    result = await sync_market_trends(workspace_id, body.region, body.extra_keywords)
    if result.get("status") != "success":
        raise HTTPException(status_code=502, detail=result.get("reason", "Trend sync failed"))
    return result


# ---------------------------------------------------------------------- asset vault

ASSET_CATEGORIES = ("product_shots", "lifestyle", "banners", "logos")


def _asset_json(a) -> dict:
    return {
        "id": a.id,
        "category": a.category,
        "source": a.source,
        "filename": a.filename,
        "url": a.storage_url,
        "source_url": a.source_url,
        "alt_text": a.alt_text or "",
        # Vision-written, from core/asset_tagging.py. Empty until the asset is indexed.
        "description": getattr(a, "description", None) or "",
        "tagged_at": _iso(getattr(a, "tagged_at", None)),
        "format": a.file_format,
        "width": a.width,
        "height": a.height,
        "dimensions": ("%sx%s" % (a.width, a.height)) if a.width and a.height else "",
        "size_kb": a.file_size_kb,
        "tags": a.tags or [],
        "created_at": _iso(a.created_at),
    }


@router.get("/{workspace_id}/assets")
def list_assets(workspace_id: int, category: Optional[str] = None,
                source: Optional[str] = None,
                db: Session = Depends(database.get_db),
                current_user: models.User = Depends(auth.get_current_user)):
    """The Asset Vault for one workspace, newest first, optionally filtered."""
    _require_workspace(workspace_id, db, current_user)
    q = db.query(models.MediaAsset).filter(models.MediaAsset.workspace_id == workspace_id)
    if category:
        q = q.filter(models.MediaAsset.category == category)
    if source:
        q = q.filter(models.MediaAsset.source == source)
    rows = q.order_by(models.MediaAsset.created_at.desc()).all()

    counts = {c: 0 for c in ASSET_CATEGORIES}
    for a in db.query(models.MediaAsset).filter(
            models.MediaAsset.workspace_id == workspace_id).all():
        if a.category in counts:
            counts[a.category] += 1

    return {"assets": [_asset_json(a) for a in rows], "counts": counts, "total": len(rows)}


@router.post("/{workspace_id}/assets/index")
async def index_assets(workspace_id: int, limit: int = 40, retag: bool = False,
                       db: Session = Depends(database.get_db),
                       current_user: models.User = Depends(auth.get_current_user)):
    """Describe this workspace's vault images with a vision model and index them for search.

    Idempotent by default: only assets with no description yet cost a vision call, so this
    is safe to call straight after a harvest or a Drive import.
    """
    _require_workspace(workspace_id, db, current_user)
    from core import asset_tagging
    result = await asset_tagging.index_workspace_assets(workspace_id, limit=limit, retag=retag)
    return {"status": "success", **result}


@router.get("/{workspace_id}/assets/search")
def search_assets(workspace_id: int, q: str, limit: int = 12,
                  db: Session = Depends(database.get_db),
                  current_user: models.User = Depends(auth.get_current_user)):
    """Natural-language search over the Asset Vault ("lifestyle desk setup shots").

    Returns full asset rows in the same shape as GET /assets, ordered by relevance, each
    carrying the score and the passage it matched on. Assets that have never been indexed
    cannot match — `unindexed` says how many those are, so the UI can offer to index them
    rather than implying the vault is empty.
    """
    _require_workspace(workspace_id, db, current_user)
    from core import asset_tagging

    hits = asset_tagging.search_assets(workspace_id, q, limit)
    by_id = {h["asset_id"]: h for h in hits}
    rows = []
    if by_id:
        found = (db.query(models.MediaAsset)
                   .filter(models.MediaAsset.workspace_id == workspace_id,
                           models.MediaAsset.id.in_(list(by_id.keys()))).all())
        # Ranking comes from the vector store, not the database's row order.
        found.sort(key=lambda a: -(by_id[a.id].get("score") or 0))
        for a in found:
            rows.append({**_asset_json(a),
                         "score": by_id[a.id].get("score"),
                         "matched_on": by_id[a.id].get("matched_on", "")})

    unindexed = (db.query(models.MediaAsset)
                   .filter(models.MediaAsset.workspace_id == workspace_id,
                           models.MediaAsset.description.is_(None)).count())
    return {"query": q, "assets": rows, "total": len(rows), "unindexed": unindexed}


@router.post("/{workspace_id}/assets/harvest")
async def harvest_site_assets(workspace_id: int, max_images: int = 24,
                              max_pages: int = 6,
                              db: Session = Depends(database.get_db),
                              current_user: models.User = Depends(auth.get_current_user)):
    """Pull every usable image off the workspace's own website into the vault.

    Scraped rows are REPLACED, not appended: re-running after a site redesign should leave
    the vault reflecting the site as it is now, and appending would silently accumulate
    every product shot the brand has ever published.

    Assets from other sources (Drive imports, uploads, generated creatives) are untouched.
    """
    ws = _require_workspace(workspace_id, db, current_user)
    if not (ws.company_url or "").strip():
        raise HTTPException(status_code=400,
                            detail="This workspace has no website URL set, so there is nothing to harvest.")

    from core import site_images
    try:
        found = await site_images.harvest(ws.company_url, max_images=max_images,
                                          max_pages=max_pages)
    except site_images.SiteUnreachable as e:
        # Distinct from a harvest that ran and found nothing: the site blocked us or is
        # down, which the user can check, rather than an image-size problem they cannot.
        raise HTTPException(
            status_code=502,
            detail="Could not read %s - %s. If the site is behind bot protection it may be "
                   "refusing automated requests." % (ws.company_url, e))
    except Exception as e:
        raise HTTPException(status_code=502, detail="Could not read the site: %s" % e)

    if not found:
        return {"status": "success", "imported": 0, "replaced": 0,
                "note": "No images on %s met the size threshold (at least %dpx on both sides)."
                        % (ws.company_url, site_images.MIN_DIMENSION)}

    replaced = (db.query(models.MediaAsset)
                  .filter(models.MediaAsset.workspace_id == workspace_id,
                          models.MediaAsset.source == "scraped")
                  .delete(synchronize_session=False))

    for item in found:
        db.add(models.MediaAsset(
            workspace_id=workspace_id,
            category=item["category"],
            source="scraped",
            filename=item["filename"],
            storage_url=item["source_url"],
            source_url=ws.company_url,
            alt_text=item.get("alt") or None,
            mime_type=item.get("mime_type"),
            file_format=item.get("format"),
            width=item.get("width") or None,
            height=item.get("height") or None,
            file_size_kb=item.get("file_size_kb"),
            tags=[item["category"]],
        ))
    db.commit()

    return {"status": "success", "imported": len(found), "replaced": replaced}


class ImportedAsset(BaseModel):
    filename: str
    url: str
    category: Optional[str] = "lifestyle"
    source: Optional[str] = "gdrive"
    mime_type: Optional[str] = None
    file_format: Optional[str] = None
    size_kb: Optional[float] = None


@router.post("/{workspace_id}/assets/import")
def import_assets(workspace_id: int, items: List[ImportedAsset],
                  db: Session = Depends(database.get_db),
                  current_user: models.User = Depends(auth.get_current_user)):
    """Persist assets brought in from Google Drive or a device upload.

    The Drive picker already worked, but its results only ever reached React state - they
    were gone on refresh, which is why imported assets "did not appear correctly" in the
    vault. Existing rows with the same URL are skipped so re-importing a folder does not
    duplicate it.
    """
    _require_workspace(workspace_id, db, current_user)
    if not items:
        return {"status": "success", "imported": 0, "skipped": 0}

    existing = {a.storage_url for a in db.query(models.MediaAsset.storage_url)
                  .filter(models.MediaAsset.workspace_id == workspace_id).all()}
    imported = skipped = 0
    for it in items:
        if not it.url or it.url in existing:
            skipped += 1
            continue
        category = it.category if it.category in ASSET_CATEGORIES else "lifestyle"
        db.add(models.MediaAsset(
            workspace_id=workspace_id, category=category, source=it.source or "gdrive",
            filename=it.filename or "asset", storage_url=it.url,
            mime_type=it.mime_type, file_format=it.file_format,
            file_size_kb=it.size_kb, tags=[category],
        ))
        existing.add(it.url)
        imported += 1
    db.commit()
    return {"status": "success", "imported": imported, "skipped": skipped}


@router.delete("/{workspace_id}/assets/{asset_id}")
def delete_asset(workspace_id: int, asset_id: int,
                 db: Session = Depends(database.get_db),
                 current_user: models.User = Depends(auth.get_current_user)):
    _require_workspace(workspace_id, db, current_user)
    row = (db.query(models.MediaAsset)
             .filter(models.MediaAsset.id == asset_id,
                     models.MediaAsset.workspace_id == workspace_id).first())
    if not row:
        raise HTTPException(status_code=404, detail="Asset not found")
    db.delete(row)
    db.commit()
    return {"status": "deleted"}


# ------------------------------------------------------------------------- hybrid RAG

class IntelQuery(BaseModel):
    query: str
    include_ads: bool = True
    include_trends: bool = True


@router.post("/{workspace_id}/intelligence/query")
async def intelligence_query(workspace_id: int, body: IntelQuery,
                             db: Session = Depends(database.get_db),
                             current_user: models.User = Depends(auth.get_current_user)):
    """Answer a question over this workspace's brand kit, ad vault and trend radar.

    The router is the point: exact brand facts come from Postgres and semantic context from
    Qdrant, because asking a vector store for a hex code returns something that looks like
    a hex code rather than the right one.
    """
    _require_workspace(workspace_id, db, current_user)
    if not (body.query or "").strip():
        raise HTTPException(status_code=400, detail="Ask a question first.")

    from core.rag import answer_intelligence_query
    try:
        return await answer_intelligence_query(
            workspace_id, body.query, include_ads=body.include_ads,
            include_trends=body.include_trends)
    except Exception as e:
        raise HTTPException(status_code=502, detail="Intelligence query failed: %s" % e)


@router.get("/{workspace_id}/intelligence/status")
def intelligence_status(workspace_id: int, db: Session = Depends(database.get_db),
                        current_user: models.User = Depends(auth.get_current_user)):
    """One call for the dashboard header: what is configured, what has run, what is due."""
    _require_workspace(workspace_id, db, current_user)
    from core.intel_sync import last_sync
    from core import ad_library, market_trends
    from core.scheduler import intel_syncs_enabled

    return {
        "scheduled_syncs_enabled": intel_syncs_enabled(),
        "competitor_ads": {
            **_sync_json(last_sync(db, workspace_id, "competitor_ads"), AD_SYNC_DAYS),
            "cadence_days": AD_SYNC_DAYS,
            "source_configured": ad_library.is_configured(),
            "stored": db.query(models.CompetitorAd)
                        .filter(models.CompetitorAd.workspace_id == workspace_id).count(),
        },
        "market_trends": {
            **_sync_json(last_sync(db, workspace_id, "market_trends"), TREND_SYNC_DAYS),
            "cadence_days": TREND_SYNC_DAYS,
            "source_configured": market_trends.is_configured(),
            "stored": db.query(models.MarketTrendReport)
                        .filter(models.MarketTrendReport.workspace_id == workspace_id).count(),
        },
    }
