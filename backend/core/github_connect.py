"""
GitHub connector: apply approved changes to the site's repository.

The main capability is publish_markdown(): it takes an approved piece of content
(e.g. a ContentDraft) and commits it to the repo on a NEW branch, then opens a
pull request. Nothing lands on the live site until a human merges the PR — which
keeps the "human review" guarantee even at the deploy step.

Requires (founder, one-time, in the GitHub OAuth App settings):
  - Authorization callback URL: {BACKEND_URL}/api/connectors/github/callback
  - The connecting user must have push access to the target repo.
"""
import os
import base64
import re
from typing import Optional
import httpx

GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8005")

REDIRECT_URI = f"{BACKEND_URL}/api/connectors/github/callback"
API = "https://api.github.com"
# 'repo' scope allows reading and writing repository contents (needed to commit + PR).
SCOPE = "repo"


def is_configured() -> bool:
    return bool(GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET)


def build_authorize_url(state: str) -> str:
    from urllib.parse import urlencode
    params = urlencode({
        "client_id": GITHUB_CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "scope": SCOPE,
        "state": state,
    })
    return f"https://github.com/login/oauth/authorize?{params}"


async def exchange_code(code: str) -> str:
    async with httpx.AsyncClient() as client:
        res = await client.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            data={
                "client_id": GITHUB_CLIENT_ID,
                "client_secret": GITHUB_CLIENT_SECRET,
                "code": code,
                "redirect_uri": REDIRECT_URI,
            },
        )
    if res.status_code != 200:
        raise RuntimeError(f"GitHub token exchange failed: {res.status_code} {res.text[:200]}")
    token = res.json().get("access_token")
    if not token:
        raise RuntimeError("GitHub did not return an access token.")
    return token


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"}


async def fetch_login(token: str) -> str:
    async with httpx.AsyncClient() as client:
        res = await client.get(f"{API}/user", headers=_headers(token))
    return res.json().get("login", "") if res.status_code == 200 else ""


async def get_repo_tree(token: str, repo: str, branch: str) -> dict:
    """Full recursive file tree for a branch — read-only, used by the Repository Scanner
    (publishing/repo_scanner.py) to understand project structure. Never modifies anything.
    Returns {"tree": [{"path": str, "type": "blob"|"tree"}], "truncated": bool} — GitHub
    truncates the response for very large repos rather than erroring, so `truncated` is
    surfaced rather than silently dropped.
    """
    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.get(f"{API}/repos/{repo}/git/trees/{branch}",
                               headers=_headers(token), params={"recursive": "1"})
    if res.status_code != 200:
        raise RuntimeError(f"Could not read repository tree: {res.status_code} {res.text[:200]}")
    data = res.json()
    return {
        "tree": [{"path": t["path"], "type": t["type"]} for t in data.get("tree", [])],
        "truncated": bool(data.get("truncated")),
    }


async def get_file_content(token: str, repo: str, path: str, ref: str) -> Optional[str]:
    """Read one file's text content (e.g. package.json, for framework detection) —
    read-only. Returns None if the file doesn't exist or isn't decodable as UTF-8 text."""
    async with httpx.AsyncClient(timeout=15) as client:
        res = await client.get(f"{API}/repos/{repo}/contents/{path}",
                               headers=_headers(token), params={"ref": ref})
    if res.status_code != 200:
        return None
    data = res.json()
    if data.get("encoding") == "base64" and data.get("content"):
        try:
            return base64.b64decode(data["content"]).decode("utf-8", errors="replace")
        except Exception:
            return None
    return None


async def list_repos(token: str) -> list:
    """Repos the user can push to, most-recently-updated first."""
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"{API}/user/repos",
            headers=_headers(token),
            params={"per_page": 100, "sort": "updated", "affiliation": "owner,collaborator,organization_member"},
        )
    if res.status_code != 200:
        raise RuntimeError(f"Could not list repos: {res.status_code} {res.text[:200]}")
    return [
        {"full_name": r["full_name"], "default_branch": r.get("default_branch", "main"), "private": r.get("private", False)}
        for r in res.json() if r.get("permissions", {}).get("push")
    ]


def _slugify(title: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", (title or "content").lower()).strip("-")
    return s[:60] or "content"


async def publish_markdown(conn, title: str, body: str, subdir: str = "content") -> dict:
    """Commit `body` as a markdown file on a new branch and open a PR.
    Returns {'pr_url': ..., 'branch': ..., 'path': ...}."""
    import time
    token = conn.access_token
    repo = conn.repo_full_name
    base_branch = conn.default_branch or "main"
    slug = _slugify(title)
    new_branch = f"raftra/{slug}-{int(time.time())}"
    path = f"{subdir}/{slug}.md"
    file_content = f"# {title}\n\n{body}\n" if not body.lstrip().startswith("#") else body

    async with httpx.AsyncClient(timeout=30) as client:
        # 1) SHA of the base branch tip.
        ref = await client.get(f"{API}/repos/{repo}/git/ref/heads/{base_branch}", headers=_headers(token))
        if ref.status_code != 200:
            raise RuntimeError(f"Could not read base branch '{base_branch}': {ref.status_code} {ref.text[:200]}")
        base_sha = ref.json()["object"]["sha"]

        # 2) Create the new branch.
        mk = await client.post(
            f"{API}/repos/{repo}/git/refs",
            headers=_headers(token),
            json={"ref": f"refs/heads/{new_branch}", "sha": base_sha},
        )
        if mk.status_code not in (200, 201):
            raise RuntimeError(f"Could not create branch: {mk.status_code} {mk.text[:200]}")

        # 3) Commit the file onto the new branch.
        put = await client.put(
            f"{API}/repos/{repo}/contents/{path}",
            headers=_headers(token),
            json={
                "message": f"Add {title} (via Raftra)",
                "content": base64.b64encode(file_content.encode("utf-8")).decode("ascii"),
                "branch": new_branch,
            },
        )
        if put.status_code not in (200, 201):
            raise RuntimeError(f"Could not commit file: {put.status_code} {put.text[:200]}")

        # 4) Open a pull request.
        pr = await client.post(
            f"{API}/repos/{repo}/pulls",
            headers=_headers(token),
            json={
                "title": f"[Raftra] {title}",
                "head": new_branch,
                "base": base_branch,
                "body": "Content generated and approved in Raftra. Review and merge to publish to the site.",
            },
        )
        if pr.status_code not in (200, 201):
            raise RuntimeError(f"Committed the file but could not open PR: {pr.status_code} {pr.text[:200]}")
        return {"pr_url": pr.json().get("html_url"), "branch": new_branch, "path": path}


async def commit_file_update(conn, path: str, new_content: str, commit_message: str,
                             pr_title: str, pr_body: str) -> dict:
    """Update an EXISTING repo file on a new branch and open a PR. Unlike publish_markdown
    (which creates a new file), this needs the file's current SHA to update it in place.
    Nothing lands on the live site until a human merges the PR. Returns {pr_url, branch, path}."""
    import time
    token = conn.access_token
    repo = conn.repo_full_name
    base_branch = conn.default_branch or "main"
    new_branch = f"raftra/seo-fixes-{int(time.time())}"

    async with httpx.AsyncClient(timeout=30) as client:
        # 1) SHA of the base branch tip.
        ref = await client.get(f"{API}/repos/{repo}/git/ref/heads/{base_branch}", headers=_headers(token))
        if ref.status_code != 200:
            raise RuntimeError(f"Could not read base branch '{base_branch}': {ref.status_code} {ref.text[:200]}")
        base_sha = ref.json()["object"]["sha"]

        # 2) Current SHA of the file being changed (required by the contents API to UPDATE it).
        cur = await client.get(f"{API}/repos/{repo}/contents/{path}",
                               headers=_headers(token), params={"ref": base_branch})
        if cur.status_code != 200:
            raise RuntimeError(f"Could not read file '{path}': {cur.status_code} {cur.text[:200]}")
        file_sha = cur.json().get("sha")

        # 3) Create the new branch.
        mk = await client.post(f"{API}/repos/{repo}/git/refs", headers=_headers(token),
                               json={"ref": f"refs/heads/{new_branch}", "sha": base_sha})
        if mk.status_code not in (200, 201):
            raise RuntimeError(f"Could not create branch: {mk.status_code} {mk.text[:200]}")

        # 4) Commit the updated file onto the new branch.
        put = await client.put(f"{API}/repos/{repo}/contents/{path}", headers=_headers(token), json={
            "message": commit_message,
            "content": base64.b64encode(new_content.encode("utf-8")).decode("ascii"),
            "branch": new_branch,
            "sha": file_sha,
        })
        if put.status_code not in (200, 201):
            raise RuntimeError(f"Could not commit change: {put.status_code} {put.text[:200]}")

        # 5) Open the pull request.
        pr = await client.post(f"{API}/repos/{repo}/pulls", headers=_headers(token), json={
            "title": pr_title, "head": new_branch, "base": base_branch, "body": pr_body,
        })
        if pr.status_code not in (200, 201):
            raise RuntimeError(f"Committed the change but could not open PR: {pr.status_code} {pr.text[:200]}")
        return {"pr_url": pr.json().get("html_url"), "branch": new_branch, "path": path}
