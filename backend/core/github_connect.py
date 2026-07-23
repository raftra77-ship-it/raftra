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
