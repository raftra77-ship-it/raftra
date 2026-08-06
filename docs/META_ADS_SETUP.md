# Meta (Facebook/Instagram) Ads — one-time setup

The Campaign Manager connects to a real **Meta Business Manager** ad account over OAuth, then
lets a workspace launch campaigns (created **paused**, so they never spend until you activate
them) and optimize based on real performance. None of that can talk to Meta until the founder
registers a Meta app **once**. This is that checklist.

Until these two env vars are set, the Campaign Manager shows an honest *"Meta isn't set up yet"*
state — it does not fake a connection.

---

## What you need

- A Facebook account that is an **admin** of a Meta Business Manager.
- An **ad account** and a **Facebook Page** inside that Business Manager (a Page is required to
  run any ad).

## Steps (≈15 min at developers.facebook.com)

1. **Create the app** → https://developers.facebook.com/apps → *Create App* → type **Business**.
2. **Add the Marketing API** product to the app (from the app dashboard, "Add product").
3. Copy the app's credentials:
   - **App ID** → this becomes `META_APP_ID`
   - **App Secret** (Settings → Basic → Show) → this becomes `META_APP_SECRET`
4. **Register the OAuth redirect URI.** In the app: *Facebook Login → Settings → Valid OAuth
   Redirect URIs*, add exactly:
   ```
   {BACKEND_URL}/api/connectors/meta/callback
   ```
   - Local dev: `http://localhost:8005/api/connectors/meta/callback`
   - Production: `https://your-api-domain.com/api/connectors/meta/callback`
5. Make sure the backend env has the matching `BACKEND_URL` and `FRONTEND_URL` (used to build the
   redirect and to bounce the user back to the dashboard after connecting).

## Add the env vars

Put these in the backend `.env` (never commit them):

```
META_APP_ID=xxxxxxxxxxxxxxx
META_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
BACKEND_URL=http://localhost:8005          # your real API origin in production
FRONTEND_URL=http://localhost:5173         # your real app origin in production
```

Restart the backend. The Campaign Manager will now show a **Connect Meta** button.

---

## Development mode vs. going live

- **In "Development" mode**, the app works immediately **for the app admin's own ad account** —
  perfect for testing end-to-end (connect → pick account → launch a paused campaign → read
  insights → optimize).
- To let **other users** (your customers) connect **their** ad accounts, the app must pass
  **App Review** for the `ads_management` and `ads_read` permissions, and be switched to Live.
  App Review typically means recording a short screencast of the connect + manage flow and a few
  form answers. Budget a few days for Meta to review.

## Scopes requested

`ads_management, ads_read` — enough to list ad accounts, read insights, create campaigns/ads, and
pause/adjust budgets. The app never moves money on its own: campaigns are created **paused**, and
kill/scale actions only run after you confirm them in the UI.

## Quick sanity check

After setting the env vars and connecting, these should return real data (they 400 with a clear
message until Meta is connected + an ad account is selected):

- `GET /api/connectors/meta/{workspace_id}/status` → `{ "configured": true, "connected": true, … }`
- `GET /api/connectors/meta/{workspace_id}/ad-accounts`
- `GET /api/connectors/meta/{workspace_id}/recommendations`

## Troubleshooting

- **"URL blocked" on connect** → the redirect URI in step 4 doesn't match `BACKEND_URL` exactly
  (scheme, host, port, path all must match).
- **No ad accounts listed** → the connected Facebook user isn't assigned to an ad account in
  Business Manager, or you're in Development mode connecting a non-admin account.
- **"A Facebook Page is required"** on launch → pick a Page in the launch form; the connected
  user must manage at least one Page.
- **Ad set/conversion errors** → for `Conversions/Sales` optimized delivery, Meta wants a Pixel +
  configured events. The app defaults new ad sets to link-click optimization so they create
  cleanly without a Pixel; refine to conversion optimization inside Meta Ads Manager once your
  Pixel is set up.
