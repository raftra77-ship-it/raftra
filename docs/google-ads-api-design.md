# Raftra — Google Ads API Tool Design Document

**Submitted for:** Google Ads API Basic Access application
**Company:** Raftra
**Website:** https://raftra.vercel.app/
**Manager account (MCC):** 903-324-7488
**Google Cloud project number:** 798802765552
**API contact:** raftra.77@gmail.com
**API version in use:** v22

---

## 1. Business model

Raftra is a SaaS marketing platform for small and mid-sized brands and the agencies that
serve them. Customers subscribe to the platform and use it to plan, generate and launch
advertising across channels from a single dashboard.

Revenue comes from platform subscriptions paid by the brand. Raftra does not resell ad
inventory, does not take a percentage of ad spend, and does not act as an intermediary in
the billing relationship between the advertiser and Google. Each customer's Google Ads
spend is billed by Google directly to that customer's own Google Ads account, under their
own payment method.

**Audience:** brands running their own advertising, and small agencies managing a handful
of client accounts. Access is external — customers of the platform, not internal employees.

---

## 2. What the tool does

The product is an AI-assisted campaign workflow. The customer describes their campaign
objective once; the platform drafts a full advertising strategy — audience, budget split,
ad copy and keywords — which the customer then reviews and edits before anything is sent
to Google.

The workflow is deliberately gated so that no campaign is created without explicit human
approval:

1. **Brief** — the customer describes the product, objective and budget.
2. **Strategy generation** — the platform drafts headlines, descriptions, keywords and a
   recommended campaign type.
3. **Human approval** — the customer reviews and must explicitly approve the strategy.
   Nothing is sent to Google before this step.
4. **Platform selection** — the customer chooses which channels to publish to.
5. **Per-platform review** — the exact campaign name, budget, ad copy, keywords and
   locations that will be created are shown for final editing.
6. **Explicit confirmation** — the customer ticks a confirmation checkbox and presses
   Publish.
7. **Creation** — the campaign is created in the customer's Google Ads account, **PAUSED**.

The customer then activates the campaign inside the Google Ads UI when they are ready.
Raftra never enables a campaign on the customer's behalf.

---

## 3. Authentication and authorisation model

Each customer connects **their own** Google Ads account through the standard OAuth 2.0
authorisation-code flow. Raftra never asks for, stores, or handles Google account
passwords.

- **Scope requested:** `https://www.googleapis.com/auth/adwords`, plus `openid email` to
  display which account is connected.
- **Consent:** `access_type=offline` and `prompt=consent`, so the customer sees the
  permission screen and a refresh token is issued.
- **Token storage:** the refresh token, access token and expiry are stored per workspace,
  in a `google_ads_connections` table, scoped to the customer who authorised it.
- **Token refresh:** access tokens are refreshed server-side against
  `https://oauth2.googleapis.com/token` when within two minutes of expiry.
- **Revocation:** the customer can disconnect at any time from the dashboard, which
  deletes the stored connection row and the selected customer ID.

Every API request carries three credentials:

| Header | Value | Purpose |
|---|---|---|
| `Authorization` | `Bearer <customer's access token>` | Identifies the authorising user |
| `developer-token` | Raftra's developer token | Identifies the application |
| `login-customer-id` | Manager account ID | Names the manager acted through |

**Account selection.** After connecting, Raftra calls
`customers:listAccessibleCustomers` and shows only the accounts that the authorising
Google user can already reach. The customer explicitly selects which account campaigns
should be created in. Raftra never infers or guesses an account, and never operates on an
account the customer has not selected.

---

## 4. Google Ads API services used

All calls are made over the REST interface of Google Ads API **v22**.

### Read operations

| Endpoint | Purpose |
|---|---|
| `customers:listAccessibleCustomers` | List the accounts the authorising user can access, for the account picker |
| `customers/{id}/googleAds:search` | Read account name and currency; read campaign lists, statuses, budgets; read performance metrics for reporting |
| `geoTargetConstants:suggest` | Resolve customer-entered location names (e.g. "Delhi") into geo target constants for campaign targeting |

Reporting queries select from `campaign` and `customer` resources — for example campaign
id, name, status, and metrics such as impressions, clicks, cost and conversions — to
render performance dashboards and to generate optimisation recommendations shown to the
customer.

### Write (mutate) operations

Campaign creation builds a complete, deliverable Search campaign in this order:

| Order | Service | Operation |
|---|---|---|
| 1 | `campaignBudgets:mutate` | Create the daily budget |
| 2 | `campaigns:mutate` | Create the Search campaign, **status PAUSED** |
| 3 | `campaignCriteria:mutate` | Add location targeting criteria |
| 4 | `adGroups:mutate` | Create the ad group |
| 5 | `adGroupCriteria:mutate` | Add keywords |
| 6 | `adGroupAds:mutate` | Create the responsive search ad (headlines + descriptions) |
| 7 | `assets:mutate` + `campaignAssets:mutate` | Attach sitelink and callout extensions |

Ongoing management operations, all initiated by the customer from the dashboard:

| Service | Operation |
|---|---|
| `campaigns:mutate` | Pause / enable / remove a campaign |
| `campaignBudgets:mutate` | Adjust the daily budget |

Raftra does **not** use the App Conversion Tracking and Remarketing API.

---

## 5. Safety and policy safeguards

**Campaigns are always created PAUSED.** The campaign create operation hardcodes a paused
status and there is no code path that enables a campaign at creation time. Activation —
and therefore any spend — is always a deliberate human action taken inside Google Ads.
This means a mistake in the platform can never cause unintended spend.

**Pre-flight validation.** Before any mutate call, the approved content is validated
against Google Ads limits — headline and description character limits, minimum headline
and description counts for a responsive search ad, a valid final URL, and a positive
budget. If validation fails, nothing is created and the customer is shown exactly which
field is at fault. A partially built campaign is never left behind.

**No silent fallback.** If a campaign fails to be created, the platform records the failure
and surfaces Google's error to the customer. It never reports a failed launch as a
success, and never substitutes a placeholder identifier for a real campaign ID.

**Error transparency.** Google Ads API authorisation errors are mapped to plain-language
explanations shown directly to the customer — for example `CUSTOMER_NOT_ENABLED`
("that account is not active — it may be closed, suspended, or missing billing") and
`USER_PERMISSION_DENIED` ("the connected Google account cannot access this Ads account").

**Rate and volume.** Campaign creation is user-initiated, one campaign per explicit
Publish action. Reporting reads are on-demand when a customer opens the dashboard. The
platform does not poll continuously, does not bulk-create campaigns, and does not run
automated jobs against the API on the customer's behalf without their action.

**Data handling.** Performance data retrieved from the API is used only to render that
customer's own dashboards and recommendations. It is not aggregated across customers, sold,
or shared with third parties.

---

## 6. Architecture

```
Browser (React SPA)
   │  HTTPS
   ▼
Raftra API (Python / FastAPI)
   │  - stores per-customer OAuth refresh tokens
   │  - validates approved content before any mutate
   │  - orchestrates the create sequence
   ▼
Google Ads API v22 (REST)
   │  Authorization: customer's OAuth token
   │  developer-token: Raftra's token
   │  login-customer-id: manager account
   ▼
The customer's own Google Ads account
```

- **Frontend:** React single-page application.
- **Backend:** Python (FastAPI). All Google Ads API calls are made server-side; the
  developer token is never exposed to the browser.
- **Database:** PostgreSQL, storing workspaces, campaigns, approved strategies and
  per-customer OAuth connections.
- **Hosting:** frontend on Vercel; API on a managed Python host.

---

## 7. Screenshots

> Attach screenshots of the following before submitting:
>
> 1. Campaign Manager — the account connection state and account picker
> 2. The generated strategy awaiting customer approval
> 3. The Google Ads review card showing the exact campaign, budget, ad copy and keywords
>    that will be created
> 4. The publish confirmation step, showing the explicit confirmation checkbox
> 5. The resulting campaign in Google Ads, showing status PAUSED
> 6. The reporting view built from Google Ads metrics
