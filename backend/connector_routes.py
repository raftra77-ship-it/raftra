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
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, BackgroundTasks
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
async def gh_select_repo(workspace_id: int, body: RepoSelect, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    _require_workspace(workspace_id, db, current_user)
    conn = _get_gh(workspace_id, db)
    if not conn or not conn.access_token:
        raise HTTPException(status_code=400, detail="GitHub is not connected for this workspace.")
    conn.repo_full_name = body.repo_full_name
    conn.default_branch = body.default_branch or "main"
    db.commit()

    # Automatically scan the repo now that it's connected — read-only (file tree +
    # framework detection + page mapping), never modifies the repo. Best-effort: a scan
    # failure must never break repo selection itself.
    from publishing.repo_scanner import RepositoryScanner
    scan_result = {"framework": None, "pages_count": 0, "scan_status": "failed", "scanned_at": None}
    try:
        mapping = await RepositoryScanner(db).scan(workspace_id, conn)
        scan_result = {"framework": mapping.framework, "pages_count": mapping.pages_count,
                       "scan_status": mapping.status,
                       "scanned_at": mapping.scanned_at.isoformat() if mapping.scanned_at else None}
    except Exception as e:
        print(f"Repository scan failed for workspace {workspace_id}: {e}")

    return {"status": "success", "repo_full_name": conn.repo_full_name, "default_branch": conn.default_branch,
           **scan_result}


@router.get("/github/{workspace_id}/repository-mapping")
def gh_repository_mapping(workspace_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """The result of the automatic repository scan (backend/publishing/repo_scanner.py) —
    detected framework, branch, and page-by-page file mapping. Read-only; triggers no scan
    itself (re-selecting the repo, or a future explicit re-scan action, does that)."""
    _require_workspace(workspace_id, db, current_user)
    from publishing.repo_scanner import RepositoryScanner
    mapping = RepositoryScanner(db).get_mapping(workspace_id)
    if not mapping:
        return {"scanned": False}
    return {
        "scanned": True,
        "repo_full_name": mapping.repo_full_name,
        "framework": mapping.framework,
        "default_branch": mapping.default_branch,
        "pages_count": mapping.pages_count,
        "pages": mapping.pages or [],
        "status": mapping.status,
        "error": mapping.error,
        "truncated": mapping.truncated,
        "scanned_at": mapping.scanned_at.isoformat() if mapping.scanned_at else None,
    }


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


class ApplySeoFixesBody(BaseModel):
    page_url: Optional[str] = None   # which scanned page to fix; defaults to the first editable page
    dry_run: bool = False            # true = don't open a PR, just return the planned change


def _collect_onpage_fixes(audit: dict) -> list:
    """The audit recommendations that can be mechanically applied to a single HTML/template
    file — metadata, head/technical tags, structured data, accessibility. Content-strategy
    items (write more/better copy) are intentionally excluded: they can't be auto-applied."""
    seo = audit.get("seo") or {}
    applicable = {"Metadata", "Technical SEO", "Structured Data", "Accessibility"}
    fixes = []
    for c in seo.get("categories", []):
        if c.get("name") in applicable and c.get("status") == "verified":
            for r in (c.get("recommendations") or []):
                fixes.append(f"{c['name']}: {r}")
    return fixes[:12]


async def _apply_fixes_to_file(file_content: str, fixes: list, file_path: str) -> str:
    """Ask the LLM to apply the given SEO fixes to the file and return the FULL updated file.
    Conservative on purpose: apply only the listed fixes, preserve everything else."""
    import re as _re
    from core.providers.llm_providers import GeminiProvider
    system = (
        "You are a precise web engineer applying specific on-page SEO fixes to a source file. "
        "Apply ONLY the requested fixes. Preserve all existing content, structure, indentation, "
        "scripts and functionality exactly. Never invent content or remove working code. "
        "Return the COMPLETE updated file and nothing else — no explanations, no markdown fences."
    )
    prompt = (
        f"File path: {file_path}\n\nFIXES TO APPLY:\n" + "\n".join(f"- {f}" for f in fixes) +
        f"\n\nCURRENT FILE CONTENT:\n{file_content}\n\nReturn the full updated file only."
    )
    out = (await GeminiProvider().generate_text(prompt=prompt, system_prompt=system)).strip()
    if out.startswith("```"):
        out = _re.sub(r"^```[a-zA-Z0-9]*\n", "", out)
        out = _re.sub(r"\n```\s*$", "", out)
    return out.strip()


@router.post("/github/{workspace_id}/apply-seo-fixes")
async def gh_apply_seo_fixes(workspace_id: int, body: ApplySeoFixesBody,
                             db: Session = Depends(database.get_db),
                             current_user: models.User = Depends(auth.get_current_user)):
    """Apply the latest audit's on-page SEO fixes to the connected repo — as a PULL REQUEST
    the user reviews and merges. Nothing is pushed to the live site directly."""
    _require_workspace(workspace_id, db, current_user)
    conn = _get_gh(workspace_id, db)
    if not conn or not conn.access_token or not conn.repo_full_name:
        raise HTTPException(status_code=400, detail="Connect GitHub and select a repository first.")

    mapping = db.query(models.RepositoryMapping).filter(
        models.RepositoryMapping.workspace_id == workspace_id).first()
    if not mapping or mapping.status != "ready" or not mapping.pages:
        raise HTTPException(status_code=409, detail="The repository hasn't been scanned yet — re-select it to scan.")

    pages = [p for p in (mapping.pages or []) if p.get("file_path") and p.get("editable", True)]
    if not pages:
        raise HTTPException(status_code=409, detail="No editable page files were found in the repository scan.")
    target = None
    if body.page_url:
        target = next((p for p in pages if p.get("url") == body.page_url), None)
    target = target or pages[0]
    file_path = target["file_path"]

    rows = (db.query(models.SEOAudit)
            .filter(models.SEOAudit.workspace_id == workspace_id)
            .order_by(models.SEOAudit.created_at.desc()).all())
    audit_row = next((r for r in rows if (r.keywords_data or {}).get("pipeline") == "SEO"
                      and (r.keywords_data or {}).get("audit")), None)
    if not audit_row:
        raise HTTPException(status_code=409, detail="Run an SEO audit first — there are no fixes to apply.")
    fixes = _collect_onpage_fixes((audit_row.keywords_data or {}).get("audit") or {})
    if not fixes:
        raise HTTPException(status_code=409, detail="The latest audit has no on-page fixes that can be auto-applied.")

    content = await gh.get_file_content(conn.access_token, conn.repo_full_name, file_path, conn.default_branch or "main")
    if content is None:
        raise HTTPException(status_code=502, detail=f"Could not read {file_path} from the repository.")
    if len(content) > 60000:
        raise HTTPException(status_code=413, detail=f"{file_path} is too large to auto-edit safely — apply it manually.")

    try:
        new_content = await _apply_fixes_to_file(content, fixes, file_path)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not generate the fixed file: {e}")
    if not new_content or new_content.strip() == content.strip():
        raise HTTPException(status_code=422, detail="The audit fixes produced no change to this file.")

    if body.dry_run:
        return {"status": "preview", "file_path": file_path, "fixes": fixes,
                "size_change": len(new_content) - len(content)}

    try:
        result = await gh.commit_file_update(
            conn, file_path, new_content,
            commit_message="Apply on-page SEO fixes (via Raftra)",
            pr_title="[Raftra] Apply approved SEO fixes",
            pr_body=("Automated on-page SEO fixes from your Raftra audit. **Review the diff and merge to publish.**\n\n"
                     "Fixes applied:\n" + "\n".join(f"- {f}" for f in fixes)),
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not open the pull request: {e}")

    return {"status": "success", "pr_url": result["pr_url"], "branch": result["branch"],
            "file_path": file_path, "fixes": fixes,
            "message": f"Opened a pull request with {len(fixes)} fix(es) — review and merge to publish."}


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


@router.get("/shopify/{workspace_id}/theme-status")
async def shop_theme_status(workspace_id: int, db: Session = Depends(database.get_db),
                            current_user: models.User = Depends(auth.get_current_user)):
    """Whether this workspace's Shopify connection has theme access (read_themes/
    write_themes — added after the original read_content/write_content scope, so
    already-connected stores may not have it yet), and the current draft-theme
    duplication status, if any."""
    _require_workspace(workspace_id, db, current_user)
    conn = _get_shop(workspace_id, db)
    if not conn or not conn.access_token:
        return {"connected": False, "scope_ok": False, "draft": None}
    try:
        granted = await shop.get_granted_scopes(conn)
        scope_ok = "read_themes" in granted and "write_themes" in granted
    except Exception:
        scope_ok = False
    draft = db.query(models.ShopifyThemeDraft).filter(models.ShopifyThemeDraft.workspace_id == workspace_id).first()
    draft_out = None
    if draft:
        draft_out = {
            "status": draft.status, "draft_theme_id": draft.draft_theme_id,
            "draft_theme_name": draft.draft_theme_name, "live_theme_name": draft.live_theme_name,
            "assets_copied": draft.assets_copied, "assets_total": draft.assets_total, "error": draft.error,
        }
    return {"connected": True, "scope_ok": scope_ok, "draft": draft_out}


async def _run_theme_duplication(workspace_id: int, conn_id: int):
    """Background task body: duplicate the live theme into a fresh, unpublished draft.
    Owns its own DB session since the request that scheduled this has already returned."""
    from database import SessionLocal
    db = SessionLocal()
    try:
        conn = db.query(models.ShopifyConnection).filter(models.ShopifyConnection.id == conn_id).first()
        draft = db.query(models.ShopifyThemeDraft).filter(models.ShopifyThemeDraft.workspace_id == workspace_id).first()
        if not conn or not draft:
            return
        try:
            main_theme = await shop.get_main_theme(conn)
            draft.live_theme_id = main_theme["id"]
            draft.live_theme_name = main_theme["name"]
            db.commit()

            def on_progress(copied: int, total: int):
                draft.assets_copied = copied
                draft.assets_total = total
                db.commit()

            new_name = f"Raftra SEO Draft — {main_theme['name']}"
            new_id = await shop.duplicate_theme(conn, main_theme["id"], new_name, on_progress=on_progress)
            draft.draft_theme_id = new_id
            draft.draft_theme_name = new_name
            draft.status = "ready"
            db.commit()
        except Exception as e:
            draft.status = "failed"
            draft.error = str(e)
            db.commit()
    finally:
        db.close()


@router.post("/shopify/{workspace_id}/create-draft-theme")
async def shop_create_draft_theme(workspace_id: int, background_tasks: BackgroundTasks,
                                  db: Session = Depends(database.get_db),
                                  current_user: models.User = Depends(auth.get_current_user)):
    """Kicks off duplicating the live theme into a new, unpublished draft theme — the ONLY
    place theme-level SEO fixes are ever written; the live theme is never touched. Runs in
    the background (copying every asset can take a few minutes) — poll /theme-status for
    progress."""
    _require_workspace(workspace_id, db, current_user)
    conn = _get_shop(workspace_id, db)
    if not conn or not conn.access_token:
        raise HTTPException(status_code=400, detail="Connect Shopify first.")
    try:
        granted = await shop.get_granted_scopes(conn)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not verify Shopify permissions: {e}")
    if "read_themes" not in granted or "write_themes" not in granted:
        raise HTTPException(status_code=403, detail="Reconnect Shopify to grant theme access (read_themes, write_themes).")

    draft = db.query(models.ShopifyThemeDraft).filter(models.ShopifyThemeDraft.workspace_id == workspace_id).first()
    if not draft:
        draft = models.ShopifyThemeDraft(workspace_id=workspace_id)
        db.add(draft)
    draft.status = "duplicating"
    draft.assets_copied = 0
    draft.assets_total = 0
    draft.error = None
    draft.draft_theme_id = None
    db.commit()

    background_tasks.add_task(_run_theme_duplication, workspace_id, conn.id)
    return {"status": "duplicating", "message": "Duplicating your live theme into a draft — this can take a few minutes."}


@router.get("/shopify/{workspace_id}/draft-preview")
def shop_draft_preview(workspace_id: int, db: Session = Depends(database.get_db),
                       current_user: models.User = Depends(auth.get_current_user)):
    """The real Shopify preview URL for the draft theme — renders the live storefront using
    the draft theme's files, visible only via this link, without affecting what real
    visitors see on the live theme."""
    _require_workspace(workspace_id, db, current_user)
    conn = _get_shop(workspace_id, db)
    if not conn or not conn.shop_domain:
        raise HTTPException(status_code=400, detail="Connect Shopify first.")
    draft = db.query(models.ShopifyThemeDraft).filter(models.ShopifyThemeDraft.workspace_id == workspace_id).first()
    if not draft or draft.status != "ready" or not draft.draft_theme_id:
        raise HTTPException(status_code=409, detail="No ready draft theme yet — create one first.")
    return {"preview_url": f"https://{conn.shop_domain}/?preview_theme_id={draft.draft_theme_id}"}


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


class ApplyShopifySeoBody(BaseModel):
    page_id: Optional[int] = None    # which page to optimize; defaults to the first page
    dry_run: bool = False


async def _generate_seo_meta(brand_context: str, page_title: str, metadata_recs: list) -> dict:
    """Produce an improved SEO title (<=60) + meta description (<=155) from the brand context
    and the audit's metadata findings. Returns {seo_title, meta_description}."""
    import json as _json, re as _re
    from core.providers.llm_providers import GeminiProvider
    system = ("You write concise, compelling on-page SEO metadata. Return ONLY a JSON object: "
              '{"seo_title": "<=60 characters", "meta_description": "120-155 characters"}. '
              "No prose, no markdown fences.")
    prompt = (f"Brand / page context:\n{brand_context}\n\nPage title: {page_title}\n\n"
              "Audit findings to address:\n" + "\n".join(f"- {r}" for r in metadata_recs) +
              "\n\nWrite the SEO title and meta description as JSON.")
    out = (await GeminiProvider().generate_text(prompt=prompt, system_prompt=system)).strip()
    out = _re.sub(r"^```[a-zA-Z0-9]*\n", "", out)
    out = _re.sub(r"\n```\s*$", "", out)
    try:
        d = _json.loads(out)
    except Exception:
        d = {}
    title = (d.get("seo_title") or "").strip()[:60]
    desc = (d.get("meta_description") or "").strip()[:160]
    if not title and not desc:
        raise RuntimeError("The model did not return usable SEO metadata.")
    return {"seo_title": title, "meta_description": desc}


@router.post("/shopify/{workspace_id}/apply-seo-fixes")
async def shop_apply_seo_fixes(workspace_id: int, body: ApplyShopifySeoBody,
                               db: Session = Depends(database.get_db),
                               current_user: models.User = Depends(auth.get_current_user)):
    """Apply the audit's metadata fixes (SEO title + meta description) to a Shopify Page via the
    Admin API. `dry_run` returns the proposal for review; a real call writes it. Since Shopify
    has no pull request, the human review happens here in Raftra before anything is written."""
    _require_workspace(workspace_id, db, current_user)
    conn = _get_shop(workspace_id, db)
    if not conn or not conn.access_token or not conn.shop_domain:
        raise HTTPException(status_code=400, detail="Connect Shopify first.")

    try:
        pages = await shop.list_pages(conn)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not list Shopify pages: {e}")
    if not pages:
        raise HTTPException(status_code=409, detail="This Shopify store has no Pages to optimize yet.")
    target = None
    if body.page_id:
        target = next((p for p in pages if p.get("id") == body.page_id), None)
    target = target or pages[0]

    rows = (db.query(models.SEOAudit).filter(models.SEOAudit.workspace_id == workspace_id)
            .order_by(models.SEOAudit.created_at.desc()).all())
    audit_row = next((r for r in rows if (r.keywords_data or {}).get("pipeline") == "SEO"
                      and (r.keywords_data or {}).get("audit")), None)
    if not audit_row:
        raise HTTPException(status_code=409, detail="Run an SEO audit first — there are no fixes to apply.")
    metadata_recs = [f for f in _collect_onpage_fixes((audit_row.keywords_data or {}).get("audit") or {})
                     if f.startswith("Metadata")]
    if not metadata_recs:
        raise HTTPException(status_code=409, detail="The latest audit has no metadata fixes to apply.")

    from core.brand_context import get_brand_context
    brand = get_brand_context(workspace_id, query="SEO title and meta description")
    try:
        meta_seo = await _generate_seo_meta(brand, target.get("title", ""), metadata_recs)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not generate SEO metadata: {e}")

    if body.dry_run:
        return {"status": "preview",
                "page": {"id": target["id"], "title": target["title"]},
                "current": {"seo_title": target.get("seo_title"), "seo_description": target.get("seo_description")},
                "proposed": meta_seo, "fixes": metadata_recs}

    try:
        result = await shop.update_page_seo(conn, target["id"], meta_seo["seo_title"], meta_seo["meta_description"])
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not update the Shopify page: {e}")
    return {"status": "success", "admin_url": result["admin_url"],
            "page": {"id": target["id"], "title": target["title"]}, "applied": meta_seo,
            "message": "Updated the page's SEO title and meta description in Shopify."}


def _collect_content_fixes(audit: dict) -> list:
    """Fixes that map to fields WordPress core genuinely supports without a plugin — page
    title and body content. Restricted to the Content category only: Metadata-type fixes
    (meta title/description) need a specific SEO plugin's custom field (Yoast, RankMath...)
    whose presence we can't assume, so those stay manual for WordPress."""
    seo = audit.get("seo") or {}
    fixes = []
    for c in seo.get("categories", []):
        if c.get("name") == "Content" and c.get("status") == "verified":
            for r in (c.get("recommendations") or []):
                fixes.append(f"Content: {r}")
    return fixes[:8]


async def _apply_fixes_to_wp_page(current_title: str, current_content: str, fixes: list) -> dict:
    """Ask the LLM to apply the given content-related SEO fixes to a WordPress page's title
    and/or body. Returns {"title": str, "content": str}."""
    import json as _json, re as _re
    from core.providers.llm_providers import GeminiProvider
    system = (
        "You are a precise web editor applying specific on-page SEO fixes to a WordPress "
        "page's title and body content (HTML). Apply ONLY the requested fixes. Preserve all "
        "existing structure, links, and formatting not related to the fixes. Never invent "
        "facts or remove working content. Return ONLY a JSON object: "
        '{"title": "...", "content": "..."} — no prose, no markdown fences.'
    )
    prompt = (
        f"Current title: {current_title}\n\nFIXES TO APPLY:\n" + "\n".join(f"- {f}" for f in fixes) +
        f"\n\nCURRENT CONTENT (HTML):\n{current_content}\n\nReturn the updated title and content as JSON."
    )
    out = (await GeminiProvider().generate_text(prompt=prompt, system_prompt=system)).strip()
    out = _re.sub(r"^```[a-zA-Z0-9]*\n", "", out)
    out = _re.sub(r"\n```\s*$", "", out)
    try:
        d = _json.loads(out)
    except Exception:
        raise RuntimeError("The model did not return valid JSON for the page update.")
    title = (d.get("title") or "").strip() or current_title
    content = (d.get("content") or "").strip() or current_content
    return {"title": title, "content": content}


class ApplyWordPressSeoBody(BaseModel):
    page_id: Optional[int] = None    # which page to fix; defaults to the first page
    dry_run: bool = False


@router.post("/wordpress/{workspace_id}/apply-seo-fixes")
async def wp_apply_seo_fixes(workspace_id: int, body: ApplyWordPressSeoBody,
                             db: Session = Depends(database.get_db),
                             current_user: models.User = Depends(auth.get_current_user)):
    """Apply the latest audit's content/title fixes to a WordPress Page directly via the REST
    API (dry_run previews first). Restricted to fields WP core genuinely supports — title and
    body content — never a guessed SEO-plugin meta field. Since WordPress pages have no
    pull-request concept, human review happens via the dry_run preview in Raftra, same as
    Shopify."""
    _require_workspace(workspace_id, db, current_user)
    conn = _get_wp(workspace_id, db)
    if not conn or not conn.app_password or not conn.site_url:
        raise HTTPException(status_code=400, detail="Connect WordPress first.")

    try:
        pages = await wp.list_pages(conn)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not list WordPress pages: {e}")
    if not pages:
        raise HTTPException(status_code=409, detail="This WordPress site has no Pages to optimize yet.")
    target = None
    if body.page_id:
        target = next((p for p in pages if p.get("id") == body.page_id), None)
    target = target or pages[0]

    rows = (db.query(models.SEOAudit).filter(models.SEOAudit.workspace_id == workspace_id)
            .order_by(models.SEOAudit.created_at.desc()).all())
    audit_row = next((r for r in rows if (r.keywords_data or {}).get("pipeline") == "SEO"
                      and (r.keywords_data or {}).get("audit")), None)
    if not audit_row:
        raise HTTPException(status_code=409, detail="Run an SEO audit first — there are no fixes to apply.")
    fixes = _collect_content_fixes((audit_row.keywords_data or {}).get("audit") or {})
    if not fixes:
        raise HTTPException(status_code=409, detail="The latest audit has no content fixes that can be auto-applied.")

    try:
        current = await wp.get_page_content(conn, target["id"])
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not read the WordPress page: {e}")

    try:
        updated = await _apply_fixes_to_wp_page(current["title"], current["content"], fixes)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not generate the updated page: {e}")

    if updated["title"] == current["title"] and updated["content"].strip() == current["content"].strip():
        raise HTTPException(status_code=422, detail="The audit fixes produced no change to this page.")

    if body.dry_run:
        return {"status": "preview", "page": {"id": target["id"], "title": target["title"]},
                "current": current, "proposed": updated, "fixes": fixes}

    try:
        result = await wp.update_page_content(conn, target["id"], updated["title"], updated["content"])
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not update the WordPress page: {e}")
    return {"status": "success", "edit_url": result["edit_url"], "link": result["link"],
            "page": {"id": target["id"], "title": target["title"]}, "fixes": fixes,
            "message": "Updated the page's title/content in WordPress."}


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
