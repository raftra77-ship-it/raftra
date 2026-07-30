import sys, io, asyncio
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from database import SessionLocal
import models, httpx
db=SessionLocal(); conn=db.query(models.GitHubConnection).filter(models.GitHubConnection.workspace_id==4).first()
H={"Authorization":f"Bearer {conn.access_token}","Accept":"application/vnd.github+json"}; repo=conn.repo_full_name
async def main():
    async with httpx.AsyncClient(timeout=30) as c:
        pr=(await c.get(f"https://api.github.com/repos/{repo}/pulls/3",headers=H)).json()
        print("PR #3:", pr.get("title"), "|", pr.get("state"), "|", pr.get("html_url"))
        for f in (await c.get(f"https://api.github.com/repos/{repo}/pulls/3/files",headers=H)).json():
            print(f"  {f.get('filename')}  +{f.get('additions')}/-{f.get('deletions')}")
        # list open Raftra PRs so the user knows what's there
        opens=(await c.get(f"https://api.github.com/repos/{repo}/pulls?state=open",headers=H)).json()
        print("open PRs:", ", ".join(f"#{p['number']}" for p in opens))
asyncio.run(main()); db.close()
