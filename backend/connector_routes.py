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
from core import google_ads as gads
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


def _resolve_page_url(route: Optional[str], base_url: Optional[str]) -> str:
    """The repo scanner's page `url` (publishing/repo_scanner.py) is only ever a
    SITE-RELATIVE ROUTE derived from file-based routing (e.g. "/frontend", "/about") — never
    a live URL. Using it alone as a canonical/target URL produces garbage like "/frontend"
    instead of a real address. This resolves it against the workspace's actual base URL."""
    import urllib.parse as _urlparse
    if not base_url:
        return route or ""
    base = base_url.strip()
    if not base.lower().startswith(("http://", "https://")):
        base = f"https://{base}"
    return _urlparse.urljoin(base, route or "/")


def _get_approved_fixes(audit_row, categories: set) -> list:
    """Recommendations from the given categories that the user has actually approved or
    edited via the per-item decision endpoint (/seo/audits/{id}/decision) — NOT every
    "verified" recommendation in the raw audit. This is the real review/approval gate:
    nothing reaches a platform adapter unless a human explicitly approved it here first."""
    kd = audit_row.keywords_data or {}
    decisions = kd.get("decisions") or {}
    audit = kd.get("audit") or {}
    issues = audit.get("priority_issues") or audit.get("top_5_issues") or []
    by_key = {f"{it.get('area')}::{it.get('issue')}": it for it in issues}
    out = []
    for key, d in decisions.items():
        if d.get("decision") not in ("approved", "edited"):
            continue
        src = by_key.get(key, {})
        # area is "<Pipeline> · <Category>" e.g. "SEO · Metadata" (core/seo_scoring.py
        # build_audit/_build_issues) — match on the category name after the separator.
        area = src.get("area") or ""
        category = area.rsplit(" · ", 1)[-1]
        if category not in categories:
            continue
        text = d.get("edited_text") or src.get("issue")
        if text:
            out.append(f"{category}: {text}")
    return out[:12]


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

    # Structural/content fixes still go through a full-file LLM rewrite (they aren't tag
    # VALUES, so they don't fit the universal fix); Metadata + Structured Data go through
    # the universal fix -> adapter path everyone else uses. Technical SEO is further split:
    # "robots.txt"/"sitemap" recommendations ask for REAL SEPARATE FILES at the repo root,
    # not an edit to the scanned page — sending them into the same-file rewrite (the old
    # behavior) silently produced no useful change. Everything else (e.g. removing a noindex
    # meta tag) is a genuine same-file fix and stays on that path.
    all_technical = _get_approved_fixes(audit_row, {"Technical SEO"})
    accessibility_fixes = _get_approved_fixes(audit_row, {"Accessibility"})
    robots_fix = [f for f in all_technical if "robots.txt" in f.lower()]
    sitemap_fix = [f for f in all_technical if "sitemap" in f.lower() and "robots.txt" not in f.lower()]
    same_file_technical = [f for f in all_technical if f not in robots_fix and f not in sitemap_fix]
    same_file_fixes = same_file_technical + accessibility_fixes
    tag_fixes = _get_approved_fixes(audit_row, {"Metadata", "Structured Data"})
    if not same_file_fixes and not tag_fixes and not robots_fix and not sitemap_fix:
        raise HTTPException(status_code=409,
                            detail="No approved fixes yet — approve at least one recommendation in the audit report before applying.")

    content = await gh.get_file_content(conn.access_token, conn.repo_full_name, file_path, conn.default_branch or "main")
    if content is None:
        raise HTTPException(status_code=502, detail=f"Could not read {file_path} from the repository.")
    if len(content) > 60000:
        raise HTTPException(status_code=413, detail=f"{file_path} is too large to auto-edit safely — apply it manually.")

    new_content = content
    if same_file_fixes:
        try:
            new_content = await _apply_fixes_to_file(new_content, same_file_fixes, file_path)
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Could not generate the fixed file: {e}")

    universal_fix = None
    if tag_fixes:
        import re as _re
        from core.seo_fix_schema import generate_universal_seo_fix
        from core import seo_adapters
        from core.brand_context import get_brand_context
        title_match = _re.search(r"<title>(.*?)</title>", new_content, _re.IGNORECASE | _re.DOTALL)
        ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id).first()
        brand = get_brand_context(workspace_id, query="SEO title and meta description")
        universal_fix = await generate_universal_seo_fix(
            current_title=(title_match.group(1).strip() if title_match else ""),
            target_url=_resolve_page_url(target.get("url"), ws.company_url if ws else None),
            brand_context=brand,
            workspace_name=ws.name if ws else None,
            workspace_url=ws.company_url if ws else None,
            workspace_logo=ws.brand_logo if ws else None,
            approved_fixes=tag_fixes,
            page_content=new_content,
        )
        new_content = seo_adapters.apply_to_html(new_content, universal_fix)

    # Real site-level files — built only from data the repo scan and workspace already have
    # (the site's own domain, and the pages the scanner actually discovered), never invented.
    from core import site_files
    ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id).first()
    base_url = ws.company_url if ws else None
    files_to_commit = []
    if new_content.strip() != content.strip():
        files_to_commit.append({"path": file_path, "content": new_content})
    if robots_fix:
        files_to_commit.append({"path": "robots.txt", "content": site_files.build_robots_txt(base_url)})
    if sitemap_fix:
        routes = [p.get("url") for p in (mapping.pages or []) if p.get("type") == "page" and p.get("url")]
        files_to_commit.append({"path": "sitemap.xml", "content": site_files.build_sitemap_xml(base_url, routes)})

    fixes = same_file_fixes + tag_fixes + robots_fix + sitemap_fix
    if not files_to_commit:
        raise HTTPException(status_code=422, detail="The approved fixes produced no change to any file.")

    if body.dry_run:
        return {"status": "preview", "file_path": file_path, "fixes": fixes,
                "files": [f["path"] for f in files_to_commit],
                "universal_fix": universal_fix.dict() if universal_fix else None,
                "size_change": len(new_content) - len(content)}

    schema_note = universal_fix.schema_note if universal_fix else None
    pr_body = ("Automated on-page SEO fixes from your Raftra audit. **Review the diff and merge to publish.**\n\n"
              "Fixes applied:\n" + "\n".join(f"- {f}" for f in fixes) +
              "\n\nFiles changed:\n" + "\n".join(f"- {f['path']}" for f in files_to_commit))
    if schema_note:
        pr_body += f"\n\n**Note on structured data:** {schema_note}"
    try:
        result = await gh.commit_files_update(
            conn, files_to_commit,
            commit_message="Apply on-page SEO fixes (via Raftra)",
            pr_title="[Raftra] Apply approved SEO fixes",
            pr_body=pr_body,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not open the pull request: {e}")

    message = f"Opened a pull request with {len(fixes)} fix(es) across {len(files_to_commit)} file(s) — review and merge to publish."
    if schema_note:
        message += f" {schema_note}"
    return {"status": "success", "pr_url": result["pr_url"], "branch": result["branch"],
            "files": [f["path"] for f in files_to_commit], "fixes": fixes,
            "schema_note": schema_note, "message": message,
            "universal_fix": universal_fix.dict() if universal_fix else None}


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


# ================================================================ Google Ads
def _get_gads(workspace_id: int, db: Session):
    return db.query(models.GoogleAdsConnection).filter(
        models.GoogleAdsConnection.workspace_id == workspace_id
    ).first()


class GoogleAdsAccountSelect(BaseModel):
    customer_id: str


class GoogleAdsPublishCampaign(BaseModel):
    campaign_id: int


class GoogleAdsCampaignStatusBody(BaseModel):
    status: str  # PAUSED | ENABLED


class GoogleAdsCampaignBudgetBody(BaseModel):
    budget_resource_name: str
    daily_budget: float  # major currency units


@router.get("/google-ads/{workspace_id}/status")
def gads_status(workspace_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    _require_workspace(workspace_id, db, current_user)
    conn = _get_gads(workspace_id, db)
    return {
        "configured": gads.is_configured(),
        "connected": bool(conn and conn.refresh_token),
        "email": conn.connected_email if conn else None,
        "customer_id": conn.customer_id if conn else None,
    }


@router.get("/google-ads/{workspace_id}/authorize")
def gads_authorize(workspace_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    _require_workspace(workspace_id, db, current_user)
    if not gads.is_configured():
        raise HTTPException(status_code=503, detail="Google Ads is not configured on the server (GOOGLE_ADS_CLIENT_ID/SECRET/DEVELOPER_TOKEN missing).")
    state = jwt.encode({
        "purpose": "gads_oauth",
        "workspace_id": workspace_id,
        "user_id": current_user.id,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(minutes=_STATE_TTL_MIN),
    }, auth.SECRET_KEY, algorithm=auth.ALGORITHM)
    return {"url": gads.build_authorize_url(state)}


@router.get("/google-ads/callback")
async def gads_callback(state: str, code: str = None, error: str = None, db: Session = Depends(database.get_db)):
    frontend = os.getenv("FRONTEND_URL", "http://localhost:5173")
    if error or not code:
        return RedirectResponse(f"{frontend}/dashboard?gads=error")
    try:
        payload = jwt.decode(state, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        if payload.get("purpose") != "gads_oauth":
            raise ValueError("bad purpose")
        workspace_id = int(payload["workspace_id"])
    except Exception:
        return RedirectResponse(f"{frontend}/dashboard?gads=error")
    try:
        tok = await gads.exchange_code(code)
        email = await gads.fetch_user_email(tok["access_token"])
    except Exception as e:
        print(f"Google Ads OAuth failed: {e}")
        return RedirectResponse(f"{frontend}/dashboard?gads=error")
    conn = _get_gads(workspace_id, db)
    if not conn:
        conn = models.GoogleAdsConnection(workspace_id=workspace_id)
        db.add(conn)
    conn.access_token = tok["access_token"]
    # Google only returns a refresh_token on the first consent (with prompt=consent it always
    # should, but keep the existing one if a re-auth response happens to omit it).
    if tok.get("refresh_token"):
        conn.refresh_token = tok["refresh_token"]
    conn.token_expiry = datetime.datetime.utcnow() + datetime.timedelta(seconds=int(tok.get("expires_in", 3600)))
    conn.connected_email = email
    db.commit()
    return RedirectResponse(f"{frontend}/dashboard?gads=connected")


def _gads_ready(workspace_id: int, db: Session, need_account: bool = True) -> "models.GoogleAdsConnection":
    conn = _get_gads(workspace_id, db)
    if not conn or not conn.refresh_token:
        raise HTTPException(status_code=400, detail="Google Ads is not connected for this workspace.")
    if need_account and not conn.customer_id:
        raise HTTPException(status_code=400, detail="Select a Google Ads customer account first.")
    return conn


@router.get("/google-ads/{workspace_id}/accounts")
async def gads_accounts(workspace_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    _require_workspace(workspace_id, db, current_user)
    conn = _gads_ready(workspace_id, db, need_account=False)
    try:
        accounts = await gads.list_accessible_customers(conn)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not list accessible customers: {e}")
    db.commit()  # persist any access-token refresh from the calls above
    return {"accounts": accounts}


@router.post("/google-ads/{workspace_id}/account")
def gads_select_account(workspace_id: int, body: GoogleAdsAccountSelect, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    _require_workspace(workspace_id, db, current_user)
    conn = _gads_ready(workspace_id, db, need_account=False)
    conn.customer_id = body.customer_id.replace("-", "")
    db.commit()
    return {"status": "success", "customer_id": conn.customer_id}


@router.post("/google-ads/{workspace_id}/publish-campaign")
async def gads_publish_campaign(workspace_id: int, body: GoogleAdsPublishCampaign, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    _require_workspace(workspace_id, db, current_user)
    conn = _gads_ready(workspace_id, db)
    camp = db.query(models.Campaign).filter(
        models.Campaign.id == body.campaign_id, models.Campaign.workspace_id == workspace_id
    ).first()
    if not camp:
        raise HTTPException(status_code=404, detail="Campaign not found.")
    try:
        result = await gads.publish_campaign(conn, name=camp.name or "Raftra Campaign",
                                             objective=camp.objective or "", daily_budget_major=camp.daily_budget or 200.0)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not create Google Ads campaign: {e}")
    m = dict(camp.metrics or {})
    m["google_ads"] = {"campaign_id": result["campaign_id"]}
    camp.metrics = m
    camp.status = "PAUSED"
    db.commit()
    return {"status": "success", "google_campaign_id": result["campaign_id"], "url": result["url"],
            "message": "Campaign created in Google Ads (PAUSED — activate it in Google Ads to start spending)."}


@router.get("/google-ads/{workspace_id}/campaigns")
async def gads_campaigns(workspace_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Live campaigns on the connected customer account."""
    _require_workspace(workspace_id, db, current_user)
    conn = _gads_ready(workspace_id, db)
    try:
        campaigns = await gads.list_campaigns(conn)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not list campaigns: {e}")
    db.commit()
    return {"campaigns": campaigns}


@router.get("/google-ads/{workspace_id}/insights")
async def gads_insights(workspace_id: int, date_range: str = "LAST_7_DAYS", db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Per-campaign performance (impressions, clicks, cost, CTR, ROAS) for the account."""
    _require_workspace(workspace_id, db, current_user)
    conn = _gads_ready(workspace_id, db)
    try:
        insights = await gads.fetch_insights(conn, date_range=date_range)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not fetch insights: {e}")
    db.commit()
    return {"insights": insights, "date_range": date_range}


@router.post("/google-ads/{workspace_id}/campaign/{campaign_id}/status")
async def gads_set_status(workspace_id: int, campaign_id: str, body: GoogleAdsCampaignStatusBody, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Pause (kill) or re-activate a campaign."""
    _require_workspace(workspace_id, db, current_user)
    conn = _gads_ready(workspace_id, db)
    try:
        res = await gads.set_campaign_status(conn, campaign_id, body.status)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not update campaign: {e}")
    db.commit()
    return {"status": "success", **res}


@router.post("/google-ads/{workspace_id}/campaign/budget")
async def gads_set_budget(workspace_id: int, body: GoogleAdsCampaignBudgetBody, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Set a campaign's daily budget (scale up a winner / trim an underperformer). Needs the
    CampaignBudget resource name from /campaigns, since Google Ads budgets are a separate
    resource from the campaign itself."""
    _require_workspace(workspace_id, db, current_user)
    conn = _gads_ready(workspace_id, db)
    try:
        res = await gads.update_campaign_budget(conn, body.budget_resource_name, body.daily_budget)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not update budget: {e}")
    db.commit()
    return {"status": "success", **res}


@router.delete("/google-ads/{workspace_id}")
def gads_disconnect(workspace_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    _require_workspace(workspace_id, db, current_user)
    conn = _get_gads(workspace_id, db)
    if conn:
        db.delete(conn)
        db.commit()
    return {"status": "success"}


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

            # Apply the same universal fix -> adapter every other platform uses, restricted
            # to whatever the user has actually APPROVED for Metadata/Structured Data
            # (canonical/OG/twitter/schema — the fields that need real <head> control, which
            # only the theme has). Best-effort: a failure here still leaves a usable
            # duplicated draft theme, so it doesn't fail the whole task.
            try:
                ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id).first()
                audit_row = (db.query(models.SEOAudit)
                             .filter(models.SEOAudit.workspace_id == workspace_id)
                             .order_by(models.SEOAudit.created_at.desc()).first())
                tag_fixes = _get_approved_fixes(audit_row, {"Metadata", "Structured Data"}) if audit_row else []
                if tag_fixes and ws:
                    from core.seo_fix_schema import generate_universal_seo_fix
                    from core import seo_adapters
                    from core.brand_context import get_brand_context
                    brand = get_brand_context(workspace_id, query="SEO title and meta description")
                    fix = await generate_universal_seo_fix(
                        current_title=ws.name or "", target_url=ws.company_url or "",
                        brand_context=brand, workspace_name=ws.name,
                        workspace_url=ws.company_url, workspace_logo=ws.brand_logo,
                        approved_fixes=tag_fixes,
                    )
                    theme_asset = await shop.get_theme_asset(conn, new_id, "layout/theme.liquid")
                    new_html = seo_adapters.apply_to_shopify_theme(theme_asset.get("value") or "", fix)
                    await shop.put_theme_asset(conn, new_id, "layout/theme.liquid", value=new_html)
            except Exception as e:
                print(f"[shopify theme draft] Head tag injection failed (non-fatal): {e}")

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


@router.post("/shopify/{workspace_id}/apply-seo-fixes")
async def shop_apply_seo_fixes(workspace_id: int, body: ApplyShopifySeoBody,
                               db: Session = Depends(database.get_db),
                               current_user: models.User = Depends(auth.get_current_user)):
    """Apply the audit's APPROVED metadata fixes (SEO title + meta description) to a Shopify
    Page via the Admin API — via the shared universal fix -> Shopify adapter, same object
    every other platform consumes. `dry_run` returns the proposal for review; a real call
    writes it. Since Shopify has no pull request, the human review happens here in Raftra
    before anything is written."""
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
    metadata_fixes = _get_approved_fixes(audit_row, {"Metadata"})
    if not metadata_fixes:
        raise HTTPException(status_code=409,
                            detail="No approved Metadata fixes yet — approve at least one in the audit report before applying.")

    from core.seo_fix_schema import generate_universal_seo_fix
    from core import seo_adapters
    from core.brand_context import get_brand_context
    ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id).first()
    brand = get_brand_context(workspace_id, query="SEO title and meta description")
    try:
        fix = await generate_universal_seo_fix(
            current_title=target.get("title", ""),
            target_url=f"https://{conn.shop_domain}/pages/{target.get('handle', '')}",
            brand_context=brand,
            workspace_name=ws.name if ws else None,
            workspace_url=ws.company_url if ws else None,
            workspace_logo=ws.brand_logo if ws else None,
            approved_fixes=metadata_fixes,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not generate SEO metadata: {e}")

    page_fields = seo_adapters.apply_to_shopify_page(fix)
    if not page_fields["seo_title"] and not page_fields["meta_description"]:
        raise HTTPException(status_code=422, detail="The approved fixes produced no change to this page.")

    if body.dry_run:
        return {"status": "preview",
                "page": {"id": target["id"], "title": target["title"]},
                "current": {"seo_title": target.get("seo_title"), "seo_description": target.get("seo_description")},
                "proposed": page_fields, "fixes": metadata_fixes, "universal_fix": fix.dict()}

    try:
        result = await shop.update_page_seo(conn, target["id"], page_fields["seo_title"], page_fields["meta_description"])
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not update the Shopify page: {e}")
    return {"status": "success", "admin_url": result["admin_url"],
            "page": {"id": target["id"], "title": target["title"]}, "applied": page_fields,
            "message": "Updated the page's SEO title and meta description in Shopify.",
            "universal_fix": fix.dict()}


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
    API (dry_run previews first). Restricted to fields WP core genuinely supports — title,
    body content, and (if the audit flagged missing Structured Data) an Organization JSON-LD
    block embedded in the content — never a guessed SEO-plugin meta field. Since WordPress
    pages have no pull-request concept, human review happens via the dry_run preview in
    Raftra, same as Shopify."""
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
    # Two independent, approval-gated fix sources, same split as GitHub: Content-category
    # fixes are full-body rewrites (not tag values), Metadata/Structured Data go through the
    # shared universal fix -> WordPress adapter (title -> post title, schema -> JSON-LD in
    # content; meta_description/canonical/OG/twitter get reported as skipped, since WP core
    # has no real place to write them without a plugin).
    content_fixes = _get_approved_fixes(audit_row, {"Content"})
    tag_fixes = _get_approved_fixes(audit_row, {"Metadata", "Structured Data"})
    if not content_fixes and not tag_fixes:
        raise HTTPException(status_code=409,
                            detail="No approved fixes yet — approve at least one recommendation in the audit report before applying.")

    try:
        current = await wp.get_page_content(conn, target["id"])
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not read the WordPress page: {e}")

    if content_fixes:
        try:
            updated = await _apply_fixes_to_wp_page(current["title"], current["content"], content_fixes)
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Could not generate the updated page: {e}")
    else:
        updated = {"title": current["title"], "content": current["content"]}

    skipped = []
    schema_note = None
    fix = None
    if tag_fixes:
        from core.seo_fix_schema import generate_universal_seo_fix
        from core import seo_adapters
        from core.brand_context import get_brand_context
        ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id).first()
        brand = get_brand_context(workspace_id, query="SEO title and meta description")
        fix = await generate_universal_seo_fix(
            current_title=updated["title"], target_url=target.get("link") or "",
            brand_context=brand,
            workspace_name=ws.name if ws else None,
            workspace_url=ws.company_url if ws else None,
            workspace_logo=ws.brand_logo if ws else None,
            approved_fixes=tag_fixes,
            page_content=updated["content"],
        )
        schema_note = fix.schema_note
        adapted = seo_adapters.apply_to_wordpress(updated["title"], updated["content"], fix)
        updated = {"title": adapted["title"], "content": adapted["content"]}
        skipped = adapted["skipped"]

    fixes = content_fixes + tag_fixes
    if updated["title"] == current["title"] and updated["content"].strip() == current["content"].strip():
        raise HTTPException(status_code=422, detail="The approved fixes produced no change to this page.")

    if body.dry_run:
        return {"status": "preview", "page": {"id": target["id"], "title": target["title"]},
                "current": current, "proposed": updated, "fixes": fixes, "skipped": skipped,
                "schema_note": schema_note, "universal_fix": fix.dict() if fix else None}

    try:
        result = await wp.update_page_content(conn, target["id"], updated["title"], updated["content"])
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not update the WordPress page: {e}")
    message = "Updated the page's title/content in WordPress."
    if skipped:
        message += f" ({', '.join(skipped)} need an SEO plugin — not applied.)"
    if schema_note:
        message += f" {schema_note}"
    return {"status": "success", "edit_url": result["edit_url"], "link": result["link"],
            "page": {"id": target["id"], "title": target["title"]}, "fixes": fixes, "skipped": skipped,
            "schema_note": schema_note, "message": message, "universal_fix": fix.dict() if fix else None}


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
