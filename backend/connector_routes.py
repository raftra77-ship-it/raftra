"""
Website/data connectors. First one: Google Search Console.

Flow:
  1. Frontend (logged in) calls GET .../authorize -> gets a Google consent URL and
     sends the browser there.
  2. Google redirects back to .../callback with a code + our signed state (which
     carries the workspace + user, since the callback itself is unauthenticated).
  3. We exchange the code for a refresh token and store it against the workspace.
  4. The workspace can then read real search performance and submit sitemaps.
"""
import os
import datetime
import jwt
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
from fastapi.responses import RedirectResponse
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session
from pydantic import BaseModel

import database, auth, models
from core import search_console as gsc
from core import github_connect as gh
from core import meta_ads as meta
from core import campaign_optimizer as optimizer
from core import shopify_connect as shop
from core import wordpress_connect as wp

router = APIRouter(prefix="/api/connectors", tags=["connectors"])

_STATE_TTL_MIN = 15


def _require_workspace(workspace_id: int, db: Session, user: models.User) -> models.Workspace:
    ws = db.query(models.Workspace).filter(
        models.Workspace.id == workspace_id, models.Workspace.user_id == user.id
    ).first()
    if not ws:
        raise HTTPException(status_code=403, detail="Workspace access denied")
    return ws


def _get_conn(workspace_id: int, db: Session) -> "models.SearchConsoleConnection | None":
    return db.query(models.SearchConsoleConnection).filter(
        models.SearchConsoleConnection.workspace_id == workspace_id
    ).first()


class SiteSelect(BaseModel):
    site_url: str


class SitemapSubmit(BaseModel):
    sitemap_url: str


class GA4Property(BaseModel):
    property_id: str


class RepoSelect(BaseModel):
    repo_full_name: str
    default_branch: str = "main"


class PublishDraft(BaseModel):
    draft_id: int


class ShopSelect(BaseModel):
    shop: str


class BlogSelect(BaseModel):
    blog_id: int


class WordPressConnect(BaseModel):
    site_url: str
    username: str
    app_password: str


def _get_gh(workspace_id: int, db: Session):
    return db.query(models.GitHubConnection).filter(
        models.GitHubConnection.workspace_id == workspace_id
    ).first()


def _get_meta(workspace_id: int, db: Session):
    return db.query(models.MetaAdsConnection).filter(
        models.MetaAdsConnection.workspace_id == workspace_id
    ).first()


class MetaAccountSelect(BaseModel):
    ad_account_id: str


class PublishCampaign(BaseModel):
    campaign_id: int


class CampaignStatusBody(BaseModel):
    status: str  # PAUSED | ACTIVE


class CampaignBudgetBody(BaseModel):
    daily_budget: float  # major currency units (e.g. rupees)


class LaunchCampaignBody(BaseModel):
    name: str
    objective: str = "traffic"
    daily_budget: float = 200.0
    page_id: str
    link_url: str
    country: str = "IN"
    cta: str = "LEARN_MORE"
    # Creative source: either an AdAsset from the Creative Studio library (asset_id), or an
    # already-uploaded image (image_hash), or a hosted image URL. Text falls back to the asset.
    asset_id: Optional[int] = None
    headline: Optional[str] = None
    primary_text: Optional[str] = None
    image_url: Optional[str] = None
    image_hash: Optional[str] = None


def _get_shop(workspace_id: int, db: Session):
    return db.query(models.ShopifyConnection).filter(
        models.ShopifyConnection.workspace_id == workspace_id
    ).first()


def _get_wp(workspace_id: int, db: Session):
    return db.query(models.WordPressConnection).filter(
        models.WordPressConnection.workspace_id == workspace_id
    ).first()


# ---------------------------------------------------------------- status
@router.get("/search-console/{workspace_id}/status")
def gsc_status(workspace_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    _require_workspace(workspace_id, db, current_user)
    conn = _get_conn(workspace_id, db)
    return {
        "configured": gsc.is_configured(),   # are Google client creds set on the server?
        "connected": bool(conn and conn.refresh_token),
        "email": conn.connected_email if conn else None,
        "site_url": conn.site_url if conn else None,
        "ga4_property_id": conn.ga4_property_id if conn else None,
    }


# ---------------------------------------------------------------- authorize
@router.get("/search-console/{workspace_id}/authorize")
def gsc_authorize(workspace_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    _require_workspace(workspace_id, db, current_user)
    if not gsc.is_configured():
        raise HTTPException(status_code=503, detail="Search Console is not configured on the server (GOOGLE_CLIENT_ID/SECRET missing).")
    state = jwt.encode({
        "purpose": "gsc_oauth",
        "workspace_id": workspace_id,
        "user_id": current_user.id,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(minutes=_STATE_TTL_MIN),
    }, auth.SECRET_KEY, algorithm=auth.ALGORITHM)
    return {"url": gsc.build_authorize_url(state)}


# ---------------------------------------------------------------- callback (public)
@router.get("/search-console/callback")
async def gsc_callback(state: str, code: str = None, error: str = None, db: Session = Depends(database.get_db)):
    frontend = os.getenv("FRONTEND_URL", "http://localhost:5173")
    if error or not code:
        return RedirectResponse(f"{frontend}/dashboard?gsc=error")
    try:
        payload = jwt.decode(state, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        if payload.get("purpose") != "gsc_oauth":
            raise ValueError("bad purpose")
        workspace_id = int(payload["workspace_id"])
    except Exception:
        return RedirectResponse(f"{frontend}/dashboard?gsc=error")

    try:
        tokens = await gsc.exchange_code(code)
    except Exception as e:
        print(f"GSC token exchange failed: {e}")
        return RedirectResponse(f"{frontend}/dashboard?gsc=error")

    refresh_token = tokens.get("refresh_token")
    access_token = tokens.get("access_token")
    expires_in = tokens.get("expires_in", 3600)
    email = (await gsc.fetch_userinfo(access_token)).get("email") if access_token else None

    conn = _get_conn(workspace_id, db)
    if not conn:
        conn = models.SearchConsoleConnection(workspace_id=workspace_id)
        db.add(conn)
    # Google only returns a refresh_token on the first consent; keep the existing
    # one if a re-auth omits it.
    if refresh_token:
        conn.refresh_token = refresh_token
    conn.access_token = access_token
    conn.token_expiry = datetime.datetime.utcnow() + datetime.timedelta(seconds=int(expires_in))
    conn.connected_email = email
    conn.scopes = " ".join(gsc.SCOPES)
    db.commit()
    return RedirectResponse(f"{frontend}/dashboard?gsc=connected")


# ---------------------------------------------------------------- list sites
@router.get("/search-console/{workspace_id}/sites")
async def gsc_sites(workspace_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    _require_workspace(workspace_id, db, current_user)
    conn = _get_conn(workspace_id, db)
    if not conn or not conn.refresh_token:
        raise HTTPException(status_code=400, detail="Search Console is not connected for this workspace.")
    try:
        sites = await run_in_threadpool(gsc.list_sites, conn)
        db.commit()  # persist any refreshed access token
        return {"sites": sites}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not list Search Console sites: {e}")


# ---------------------------------------------------------------- select site
@router.post("/search-console/{workspace_id}/site")
def gsc_select_site(workspace_id: int, body: SiteSelect, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    _require_workspace(workspace_id, db, current_user)
    conn = _get_conn(workspace_id, db)
    if not conn or not conn.refresh_token:
        raise HTTPException(status_code=400, detail="Search Console is not connected for this workspace.")
    conn.site_url = body.site_url
    db.commit()
    return {"status": "success", "site_url": conn.site_url}


# ---------------------------------------------------------------- performance (real rankings)
@router.get("/search-console/{workspace_id}/performance")
async def gsc_performance(workspace_id: int, days: int = 28, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    _require_workspace(workspace_id, db, current_user)
    conn = _get_conn(workspace_id, db)
    if not conn or not conn.refresh_token:
        raise HTTPException(status_code=400, detail="Search Console is not connected for this workspace.")
    if not conn.site_url:
        raise HTTPException(status_code=400, detail="No Search Console property selected yet.")
    try:
        data = await run_in_threadpool(gsc.fetch_search_analytics, conn, days)
        db.commit()
        return data
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not fetch Search Console data: {e}")


# ---------------------------------------------------------------- submit sitemap (request indexing)
@router.post("/search-console/{workspace_id}/submit-sitemap")
async def gsc_submit_sitemap(workspace_id: int, body: SitemapSubmit, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    _require_workspace(workspace_id, db, current_user)
    conn = _get_conn(workspace_id, db)
    if not conn or not conn.refresh_token or not conn.site_url:
        raise HTTPException(status_code=400, detail="Connect Search Console and select a property first.")
    try:
        await run_in_threadpool(gsc.submit_sitemap, conn, body.sitemap_url)
        db.commit()
        return {"status": "success", "message": f"Sitemap submitted to Google for {conn.site_url}."}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not submit sitemap: {e}")


# ---------------------------------------------------------------- GA4 (traffic)
@router.post("/ga4/{workspace_id}/property")
def ga4_select_property(workspace_id: int, body: GA4Property, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    _require_workspace(workspace_id, db, current_user)
    conn = _get_conn(workspace_id, db)
    if not conn or not conn.refresh_token:
        raise HTTPException(status_code=400, detail="Connect Google (via Search Console) first.")
    conn.ga4_property_id = body.property_id.strip()
    db.commit()
    return {"status": "success", "ga4_property_id": conn.ga4_property_id}


@router.get("/ga4/{workspace_id}/traffic")
async def ga4_traffic(workspace_id: int, days: int = 28, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    _require_workspace(workspace_id, db, current_user)
    conn = _get_conn(workspace_id, db)
    if not conn or not conn.refresh_token:
        raise HTTPException(status_code=400, detail="Google is not connected for this workspace.")
    if not conn.ga4_property_id:
        raise HTTPException(status_code=400, detail="No GA4 property selected yet.")
    from core import ga4
    try:
        data = await run_in_threadpool(ga4.fetch_traffic, conn, days)
        db.commit()
        return data
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not fetch GA4 traffic: {e}")


# ================================================================ GitHub
@router.get("/github/{workspace_id}/status")
def gh_status(workspace_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    _require_workspace(workspace_id, db, current_user)
    conn = _get_gh(workspace_id, db)
    return {
        "configured": gh.is_configured(),
        "connected": bool(conn and conn.access_token),
        "login": conn.login if conn else None,
        "repo_full_name": conn.repo_full_name if conn else None,
    }


@router.get("/github/{workspace_id}/authorize")
def gh_authorize(workspace_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    _require_workspace(workspace_id, db, current_user)
    if not gh.is_configured():
        raise HTTPException(status_code=503, detail="GitHub is not configured on the server (GITHUB_CLIENT_ID/SECRET missing).")
    state = jwt.encode({
        "purpose": "github_oauth",
        "workspace_id": workspace_id,
        "user_id": current_user.id,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(minutes=_STATE_TTL_MIN),
    }, auth.SECRET_KEY, algorithm=auth.ALGORITHM)
    return {"url": gh.build_authorize_url(state)}


@router.get("/github/callback")
async def gh_callback(state: str, code: str = None, error: str = None, db: Session = Depends(database.get_db)):
    frontend = os.getenv("FRONTEND_URL", "http://localhost:5173")
    if error or not code:
        return RedirectResponse(f"{frontend}/dashboard?github=error")
    try:
        payload = jwt.decode(state, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        if payload.get("purpose") != "github_oauth":
            raise ValueError("bad purpose")
        workspace_id = int(payload["workspace_id"])
    except Exception:
        return RedirectResponse(f"{frontend}/dashboard?github=error")

    try:
        token = await gh.exchange_code(code)
        login = await gh.fetch_login(token)
    except Exception as e:
        print(f"GitHub OAuth failed: {e}")
        return RedirectResponse(f"{frontend}/dashboard?github=error")

    conn = _get_gh(workspace_id, db)
    if not conn:
        conn = models.GitHubConnection(workspace_id=workspace_id)
        db.add(conn)
    conn.access_token = token
    conn.login = login
    db.commit()
    return RedirectResponse(f"{frontend}/dashboard?github=connected")


@router.get("/github/{workspace_id}/repos")
async def gh_repos(workspace_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    _require_workspace(workspace_id, db, current_user)
    conn = _get_gh(workspace_id, db)
    if not conn or not conn.access_token:
        raise HTTPException(status_code=400, detail="GitHub is not connected for this workspace.")
    try:
        repos = await gh.list_repos(conn.access_token)
        return {"repos": repos}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not list repositories: {e}")


@router.post("/github/{workspace_id}/repo")
def gh_select_repo(workspace_id: int, body: RepoSelect, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    _require_workspace(workspace_id, db, current_user)
    conn = _get_gh(workspace_id, db)
    if not conn or not conn.access_token:
        raise HTTPException(status_code=400, detail="GitHub is not connected for this workspace.")
    conn.repo_full_name = body.repo_full_name
    conn.default_branch = body.default_branch or "main"
    db.commit()
    return {"status": "success", "repo_full_name": conn.repo_full_name, "default_branch": conn.default_branch}


@router.post("/github/{workspace_id}/publish-draft")
async def gh_publish_draft(workspace_id: int, body: PublishDraft, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    _require_workspace(workspace_id, db, current_user)
    conn = _get_gh(workspace_id, db)
    if not conn or not conn.access_token or not conn.repo_full_name:
        raise HTTPException(status_code=400, detail="Connect GitHub and select a repository first.")
    draft = db.query(models.ContentDraft).filter(
        models.ContentDraft.id == body.draft_id, models.ContentDraft.workspace_id == workspace_id
    ).first()
    if not draft:
        raise HTTPException(status_code=404, detail="Content draft not found.")
    try:
        result = await gh.publish_markdown(conn, title=draft.title, body=draft.body)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not open a pull request: {e}")
    draft.status = "published"
    db.commit()
    return {"status": "success", "pr_url": result["pr_url"], "message": f"Opened a pull request: {result['pr_url']}"}


# ================================================================ Meta Ads
@router.get("/meta/{workspace_id}/status")
def meta_status(workspace_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    _require_workspace(workspace_id, db, current_user)
    conn = _get_meta(workspace_id, db)
    return {
        "configured": meta.is_configured(),
        "connected": bool(conn and conn.access_token),
        "name": conn.connected_name if conn else None,
        "ad_account_id": conn.ad_account_id if conn else None,
    }


@router.get("/meta/{workspace_id}/authorize")
def meta_authorize(workspace_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    _require_workspace(workspace_id, db, current_user)
    if not meta.is_configured():
        raise HTTPException(status_code=503, detail="Meta Ads is not configured on the server (META_APP_ID/SECRET missing).")
    state = jwt.encode({
        "purpose": "meta_oauth",
        "workspace_id": workspace_id,
        "user_id": current_user.id,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(minutes=_STATE_TTL_MIN),
    }, auth.SECRET_KEY, algorithm=auth.ALGORITHM)
    return {"url": meta.build_authorize_url(state)}


@router.get("/meta/callback")
async def meta_callback(state: str, code: str = None, error: str = None, db: Session = Depends(database.get_db)):
    frontend = os.getenv("FRONTEND_URL", "http://localhost:5173")
    if error or not code:
        return RedirectResponse(f"{frontend}/dashboard?meta=error")
    try:
        payload = jwt.decode(state, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        if payload.get("purpose") != "meta_oauth":
            raise ValueError("bad purpose")
        workspace_id = int(payload["workspace_id"])
    except Exception:
        return RedirectResponse(f"{frontend}/dashboard?meta=error")
    try:
        tok = await meta.exchange_code(code)
        name = await meta.fetch_user_name(tok["access_token"])
    except Exception as e:
        print(f"Meta OAuth failed: {e}")
        return RedirectResponse(f"{frontend}/dashboard?meta=error")
    conn = _get_meta(workspace_id, db)
    if not conn:
        conn = models.MetaAdsConnection(workspace_id=workspace_id)
        db.add(conn)
    conn.access_token = tok["access_token"]
    conn.token_expiry = datetime.datetime.utcnow() + datetime.timedelta(seconds=int(tok.get("expires_in", 5184000)))
    conn.connected_name = name
    db.commit()
    return RedirectResponse(f"{frontend}/dashboard?meta=connected")


@router.get("/meta/{workspace_id}/ad-accounts")
async def meta_ad_accounts(workspace_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    _require_workspace(workspace_id, db, current_user)
    conn = _get_meta(workspace_id, db)
    if not conn or not conn.access_token:
        raise HTTPException(status_code=400, detail="Meta is not connected for this workspace.")
    try:
        return {"ad_accounts": await meta.list_ad_accounts(conn.access_token)}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not list ad accounts: {e}")


@router.post("/meta/{workspace_id}/account")
def meta_select_account(workspace_id: int, body: MetaAccountSelect, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    _require_workspace(workspace_id, db, current_user)
    conn = _get_meta(workspace_id, db)
    if not conn or not conn.access_token:
        raise HTTPException(status_code=400, detail="Meta is not connected for this workspace.")
    conn.ad_account_id = body.ad_account_id.replace("act_", "")
    db.commit()
    return {"status": "success", "ad_account_id": conn.ad_account_id}


@router.post("/meta/{workspace_id}/publish-campaign")
async def meta_publish_campaign(workspace_id: int, body: PublishCampaign, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    _require_workspace(workspace_id, db, current_user)
    conn = _get_meta(workspace_id, db)
    if not conn or not conn.access_token or not conn.ad_account_id:
        raise HTTPException(status_code=400, detail="Connect Meta and select an ad account first.")
    camp = db.query(models.Campaign).filter(
        models.Campaign.id == body.campaign_id, models.Campaign.workspace_id == workspace_id
    ).first()
    if not camp:
        raise HTTPException(status_code=404, detail="Campaign not found.")
    try:
        result = await meta.publish_campaign(conn, name=camp.name or "Raftra Campaign", objective=camp.objective or "")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not create Meta campaign: {e}")
    # Record the Meta campaign id + mark our campaign PAUSED (matches Meta's state).
    m = dict(camp.metrics or {})
    m["meta"] = {"campaign_id": result["campaign_id"], "objective": result["meta_objective"]}
    camp.metrics = m
    camp.status = "PAUSED"
    db.commit()
    return {"status": "success", "meta_campaign_id": result["campaign_id"], "url": result["url"],
            "message": "Campaign created in Meta Ads (PAUSED — activate it in Meta to start spending)."}


def _meta_ready(workspace_id: int, db: Session, need_account: bool = True) -> "models.MetaAdsConnection":
    """Return a connected Meta connection or raise a clear 400. When need_account is set,
    also require that an ad account has been selected."""
    conn = _get_meta(workspace_id, db)
    if not conn or not conn.access_token:
        raise HTTPException(status_code=400, detail="Meta is not connected for this workspace.")
    if need_account and not conn.ad_account_id:
        raise HTTPException(status_code=400, detail="Select a Meta ad account first.")
    return conn


@router.get("/meta/{workspace_id}/campaigns")
async def meta_campaigns(workspace_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Live campaigns on the connected ad account."""
    _require_workspace(workspace_id, db, current_user)
    conn = _meta_ready(workspace_id, db)
    try:
        return {"campaigns": await meta.list_campaigns(conn)}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not list campaigns: {e}")


@router.get("/meta/{workspace_id}/insights")
async def meta_insights(workspace_id: int, date_preset: str = "last_7d", db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Per-campaign performance (spend, CTR, CPC, ROAS, purchases) for the account."""
    _require_workspace(workspace_id, db, current_user)
    conn = _meta_ready(workspace_id, db)
    try:
        return {"insights": await meta.fetch_insights(conn, date_preset=date_preset), "date_preset": date_preset}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not fetch insights: {e}")


@router.get("/meta/{workspace_id}/recommendations")
async def meta_recommendations(workspace_id: int, date_preset: str = "last_7d",
                               target_roas: Optional[float] = None,
                               db: Session = Depends(database.get_db),
                               current_user: models.User = Depends(auth.get_current_user)):
    """The optimization feed: what's working, what to switch, what to kill, plus scale/trim
    suggestions — all computed from the real insights above (no invented numbers)."""
    _require_workspace(workspace_id, db, current_user)
    conn = _meta_ready(workspace_id, db)
    try:
        insights = await meta.fetch_insights(conn, date_preset=date_preset)
        campaigns = await meta.list_campaigns(conn)
        budgets = {c["id"]: c["daily_budget"] for c in campaigns if c.get("daily_budget")}
        result = optimizer.analyze(insights, current_budgets=budgets, target_roas=target_roas)
        result["date_preset"] = date_preset
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not build recommendations: {e}")


@router.post("/meta/{workspace_id}/campaign/{campaign_id}/status")
async def meta_set_status(workspace_id: int, campaign_id: str, body: CampaignStatusBody, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Pause (kill) or re-activate a campaign. The confirm step happens in the UI before this."""
    _require_workspace(workspace_id, db, current_user)
    conn = _meta_ready(workspace_id, db)
    try:
        res = await meta.set_campaign_status(conn, campaign_id, body.status)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not update campaign: {e}")
    # keep any local mirror in sync
    camp = db.query(models.Campaign).filter(models.Campaign.meta_campaign_id == campaign_id,
                                            models.Campaign.workspace_id == workspace_id).first()
    if camp:
        camp.status = res["status"]
        db.commit()
    return {"status": "success", **res}


@router.post("/meta/{workspace_id}/campaign/{campaign_id}/budget")
async def meta_set_budget(workspace_id: int, campaign_id: str, body: CampaignBudgetBody, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Set a campaign's daily budget (scale up a winner / trim an underperformer)."""
    _require_workspace(workspace_id, db, current_user)
    conn = _meta_ready(workspace_id, db)
    try:
        res = await meta.update_campaign_budget(conn, campaign_id, body.daily_budget)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not update budget: {e}")
    return {"status": "success", **res}


@router.get("/meta/{workspace_id}/pages")
async def meta_pages(workspace_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Facebook Pages the user manages (a Page is required to run an ad)."""
    _require_workspace(workspace_id, db, current_user)
    conn = _meta_ready(workspace_id, db, need_account=False)
    try:
        return {"pages": await meta.list_pages(conn)}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not list pages: {e}")


@router.post("/meta/{workspace_id}/upload-image")
async def meta_upload_image(workspace_id: int, file: UploadFile = File(...), db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Upload a creative image to the ad account; returns image_hash for use when launching."""
    _require_workspace(workspace_id, db, current_user)
    conn = _meta_ready(workspace_id, db)
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file.")
    try:
        image_hash = await meta.upload_ad_image(conn, data, filename=file.filename or "creative.jpg")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Image upload failed: {e}")
    return {"status": "success", "image_hash": image_hash}


@router.post("/meta/{workspace_id}/launch")
async def meta_launch(workspace_id: int, body: LaunchCampaignBody, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Create a real (PAUSED) campaign + ad from a Creative Studio asset or an uploaded image.
    Nothing spends until the user activates it in Meta."""
    _require_workspace(workspace_id, db, current_user)
    conn = _meta_ready(workspace_id, db)

    headline, primary_text, image_url = body.headline, body.primary_text, body.image_url
    cta = body.cta
    # Pull copy/image from the chosen Creative Studio asset when given.
    if body.asset_id:
        asset = db.query(models.AdAsset).filter(models.AdAsset.id == body.asset_id,
                                                models.AdAsset.workspace_id == workspace_id).first()
        if not asset:
            raise HTTPException(status_code=404, detail="Creative asset not found.")
        headline = headline or asset.headline
        primary_text = primary_text or asset.body_text
        image_url = image_url or asset.image_url
        cta = cta or (asset.cta or "LEARN_MORE")

    if not (body.image_hash or image_url):
        raise HTTPException(status_code=400, detail="Provide a creative: pick a library asset, upload an image, or pass an image URL.")

    # 1) campaign (PAUSED) — reuse the existing helper.
    try:
        camp_res = await meta.publish_campaign(conn, name=body.name or "Raftra Campaign", objective=body.objective or "traffic")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not create Meta campaign: {e}")

    # 2) ad set + creative + ad (PAUSED).
    try:
        ad_res = await meta.create_ad(
            conn, campaign_id=camp_res["campaign_id"], page_id=body.page_id,
            headline=headline, primary_text=primary_text, link_url=body.link_url,
            cta=cta, image_hash=body.image_hash, image_url=image_url,
            daily_budget_major=body.daily_budget, country=body.country,
            meta_objective=camp_res["meta_objective"],
        )
    except Exception as e:
        # Campaign exists but the ad failed — report honestly with the campaign we did create.
        raise HTTPException(status_code=502,
                            detail=f"Campaign created ({camp_res['campaign_id']}) but ad creation failed: {e}")

    # Mirror locally so it shows up in the manual campaign list too.
    camp = models.Campaign(
        workspace_id=workspace_id, platform="Meta Ads", name=body.name,
        objective=body.objective, budget=body.daily_budget, daily_budget=body.daily_budget,
        status="PAUSED", meta_campaign_id=camp_res["campaign_id"],
        metrics={"meta": {"campaign_id": camp_res["campaign_id"], **ad_res}},
    )
    db.add(camp)
    db.commit()
    return {"status": "success", "meta_campaign_id": camp_res["campaign_id"], "url": camp_res["url"],
            **ad_res,
            "message": "Campaign + ad created in Meta (PAUSED — review and activate it in Meta to start spending)."}


# ---------------------------------------------------------------- Shopify
# Shopify OAuth is per-shop: the shop domain must be known before we can build the
# authorize URL, so the frontend passes it in (unlike GitHub/Google).

@router.get("/shopify/{workspace_id}/status")
def shop_status(workspace_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    _require_workspace(workspace_id, db, current_user)
    conn = _get_shop(workspace_id, db)
    return {
        "configured": shop.is_configured(),
        "connected": bool(conn and conn.access_token),
        "shop_domain": conn.shop_domain if conn else None,
        "shop_name": conn.shop_name if conn else None,
        "blog_id": conn.blog_id if conn else None,
    }


@router.post("/shopify/{workspace_id}/authorize")
def shop_authorize(workspace_id: int, body: ShopSelect, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    _require_workspace(workspace_id, db, current_user)
    if not shop.is_configured():
        raise HTTPException(status_code=503, detail="Shopify is not configured on the server (SHOPIFY_CLIENT_ID/SECRET missing).")
    try:
        shop_domain = shop.normalize_shop(body.shop)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    state = jwt.encode({
        "purpose": "shopify_oauth",
        "workspace_id": workspace_id,
        "user_id": current_user.id,
        "shop": shop_domain,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(minutes=_STATE_TTL_MIN),
    }, auth.SECRET_KEY, algorithm=auth.ALGORITHM)
    return {"url": shop.build_authorize_url(shop_domain, state)}


@router.get("/shopify/callback")
async def shop_callback(state: str, code: str = None, error: str = None, db: Session = Depends(database.get_db)):
    frontend = os.getenv("FRONTEND_URL", "http://localhost:5173")
    if error or not code:
        return RedirectResponse(f"{frontend}/dashboard?shopify=error")
    try:
        payload = jwt.decode(state, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        if payload.get("purpose") != "shopify_oauth":
            raise ValueError("bad purpose")
        workspace_id = int(payload["workspace_id"])
        shop_domain = payload["shop"]
    except Exception:
        return RedirectResponse(f"{frontend}/dashboard?shopify=error")

    try:
        token = await shop.exchange_code(shop_domain, code)
        info = await shop.fetch_shop_info(shop_domain, token)
    except Exception as e:
        print(f"Shopify OAuth failed: {e}")
        return RedirectResponse(f"{frontend}/dashboard?shopify=error")

    conn = _get_shop(workspace_id, db)
    if not conn:
        conn = models.ShopifyConnection(workspace_id=workspace_id)
        db.add(conn)
    conn.shop_domain = shop_domain
    conn.shop_name = info.get("name")
    conn.access_token = token
    db.commit()
    return RedirectResponse(f"{frontend}/dashboard?shopify=connected")


@router.get("/shopify/{workspace_id}/blogs")
async def shop_blogs(workspace_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    _require_workspace(workspace_id, db, current_user)
    conn = _get_shop(workspace_id, db)
    if not conn or not conn.access_token:
        raise HTTPException(status_code=400, detail="Shopify is not connected for this workspace.")
    try:
        return {"blogs": await shop.list_blogs(conn)}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not list Shopify blogs: {e}")


@router.post("/shopify/{workspace_id}/blog")
def shop_select_blog(workspace_id: int, body: BlogSelect, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    _require_workspace(workspace_id, db, current_user)
    conn = _get_shop(workspace_id, db)
    if not conn or not conn.access_token:
        raise HTTPException(status_code=400, detail="Shopify is not connected for this workspace.")
    conn.blog_id = body.blog_id
    db.commit()
    return {"status": "success", "blog_id": conn.blog_id}


@router.post("/shopify/{workspace_id}/publish-draft")
async def shop_publish_draft(workspace_id: int, body: PublishDraft, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    _require_workspace(workspace_id, db, current_user)
    conn = _get_shop(workspace_id, db)
    if not conn or not conn.access_token:
        raise HTTPException(status_code=400, detail="Connect Shopify first.")
    draft = db.query(models.ContentDraft).filter(
        models.ContentDraft.id == body.draft_id, models.ContentDraft.workspace_id == workspace_id
    ).first()
    if not draft:
        raise HTTPException(status_code=404, detail="Content draft not found.")
    try:
        result = await shop.publish_markdown(conn, title=draft.title, body=draft.body)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not create the Shopify article: {e}")
    draft.status = "published"
    db.commit()
    return {"status": "success", "admin_url": result["admin_url"],
            "message": "Created an unpublished Shopify article - review and publish it in Shopify."}


@router.delete("/shopify/{workspace_id}")
def shop_disconnect(workspace_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    _require_workspace(workspace_id, db, current_user)
    conn = _get_shop(workspace_id, db)
    if conn:
        db.delete(conn)
        db.commit()
    return {"status": "disconnected"}


# ---------------------------------------------------------------- WordPress
# Uses an Application Password (WP 5.6+) instead of OAuth - that is what self-hosted
# WordPress supports out of the box, so there is no app registration step.

@router.get("/wordpress/{workspace_id}/status")
def wp_status(workspace_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    _require_workspace(workspace_id, db, current_user)
    conn = _get_wp(workspace_id, db)
    return {
        "configured": True,  # nothing to configure server-side; the client supplies credentials
        "connected": bool(conn and conn.app_password),
        "site_url": conn.site_url if conn else None,
        "site_name": conn.site_name if conn else None,
        "username": conn.username if conn else None,
    }


@router.post("/wordpress/{workspace_id}/connect")
async def wp_connect(workspace_id: int, body: WordPressConnect, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    _require_workspace(workspace_id, db, current_user)
    try:
        info = await wp.verify_connection(body.site_url, body.username, body.app_password)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    conn = _get_wp(workspace_id, db)
    if not conn:
        conn = models.WordPressConnection(workspace_id=workspace_id)
        db.add(conn)
    conn.site_url = info["site_url"]
    conn.site_name = info.get("site")
    conn.username = body.username
    conn.app_password = body.app_password
    conn.display_name = info.get("name")
    db.commit()
    return {"status": "success", "site_url": conn.site_url, "site_name": conn.site_name,
            "connected_as": conn.display_name}


@router.post("/wordpress/{workspace_id}/publish-draft")
async def wp_publish_draft(workspace_id: int, body: PublishDraft, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    _require_workspace(workspace_id, db, current_user)
    conn = _get_wp(workspace_id, db)
    if not conn or not conn.app_password:
        raise HTTPException(status_code=400, detail="Connect WordPress first.")
    draft = db.query(models.ContentDraft).filter(
        models.ContentDraft.id == body.draft_id, models.ContentDraft.workspace_id == workspace_id
    ).first()
    if not draft:
        raise HTTPException(status_code=404, detail="Content draft not found.")
    try:
        result = await wp.publish_markdown(conn, title=draft.title, body=draft.body)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not create the WordPress post: {e}")
    draft.status = "published"
    db.commit()
    return {"status": "success", "edit_url": result["edit_url"],
            "message": "Created a WordPress draft - review and publish it in WordPress."}


@router.delete("/wordpress/{workspace_id}")
def wp_disconnect(workspace_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    _require_workspace(workspace_id, db, current_user)
    conn = _get_wp(workspace_id, db)
    if conn:
        db.delete(conn)
        db.commit()
    return {"status": "disconnected"}
