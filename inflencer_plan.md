# Raftra — Full Brand ↔ Influencer Marketplace Platform

## What This Builds

A complete **2-sided marketplace** where:
- **Brands** onboard → browse influencers → open private 1-on-1 chat → finalize deal → pay into Raftra Escrow Vault
- **Influencers/Creators** each have their own dashboard → see incoming brand messages in their private inbox → negotiate → accept deal → upload delivery proof → get payout to their bank

> [!IMPORTANT]
> Each creator's chat, deal, and payment is **100% isolated** from other creators. No shared state. Already fixed in the last session with per-handle localStorage keys.

---

## Architecture Overview

```
Brand (Role: brand)          Creator (Role: creator)
      │                              │
      ▼                              ▼
Brand Onboarding          Creator Registration
      │                              │
      ▼                              ▼
Influencer Marketplace    Creator Dashboard (per handle)
      │                              │
      ▼                    ┌─────────┘
1-on-1 Chat (per creator)  │  Creator Inbox (per chat key)
      │                    │
      ▼                    ▼
   Deal Proposed ──► Creator Accepts Deal
      │                    │
      ▼                    ▼
Escrow Locked (Vault)  Work Delivered
      │                    │
      ▼                    ▼
Brand Releases Payment  Creator Uploads Proof
      │                    │
      ▼                    ▼
  Email + WhatsApp    Human Review (Team Raftra)
  Number sent to            │
    Creator                 ▼
                      Bank Payout via Razorpay
```

---

## Proposed Changes

### 1. Backend — New Models & Routes

#### [MODIFY] [models.py](file:///c:/Users/Ambn/raftra/backend/models.py)

Add 2 new tables:

**`InfluencerDeal`** — tracks each finalized deal between a brand workspace and a creator
```python
class InfluencerDeal(Base):
    __tablename__ = "influencer_deals"
    id, workspace_id, influencer_handle, influencer_name
    amount, deliverables, status  # 'pending'|'active'|'delivered'|'paid'
    brand_release_token  # random secure token brand sends to creator on delivery approval
    escrow_locked_at, paid_at, created_at
```

**`CreatorPayoutRequest`** — creator submits proof for payout
```python
class CreatorPayoutRequest(Base):
    __tablename__ = "creator_payout_requests"
    id, creator_handle, deal_id
    screenshot_url, token_submitted
    bank_account_holder, bank_name, account_number, ifsc_code, upi_id
    status  # 'submitted'|'under_review'|'approved'|'paid'
    reviewed_by, payout_ref, created_at, reviewed_at
```

#### [NEW] [influencer_deal_routes.py](file:///c:/Users/Ambn/raftra/backend/influencer_deal_routes.py)

API routes:
- `POST /api/deals/propose` — brand proposes deal, stores in DB
- `POST /api/deals/{deal_id}/accept` — creator accepts, locks escrow
- `GET /api/deals/brand/{workspace_id}` — brand sees all their deals
- `GET /api/deals/creator/{handle}` — creator sees their deals
- `POST /api/deals/{deal_id}/release` — brand releases payment, generates token, sends WhatsApp notification

#### [NEW] [payout_routes.py](file:///c:/Users/Ambn/raftra/backend/payout_routes.py)

- `POST /api/payouts/submit` — creator submits proof (screenshot URL + token + bank details)
- `GET /api/payouts/creator/{handle}` — creator sees their payout requests
- `GET /api/payouts/admin/all` — admin (raftra.77@gmail.com) sees all pending reviews
- `POST /api/payouts/{payout_id}/approve` — admin approves, triggers Razorpay payout
- `POST /api/payouts/{payout_id}/reject` — admin rejects with reason

#### [MODIFY] [workspace_routes.py](file:///c:/Users/Ambn/raftra/backend/workspace_routes.py)

Update `POST /api/workspaces/{workspace_id}/influencers/{id}/chat` to:
- Save `InfluencerDeal` when a proposal message is sent
- Scope messages strictly by `influencer_handle` (not generic ID)

---

### 2. Frontend — Brand Side

#### [MODIFY] [WorkspaceInfluencer.tsx](file:///c:/Users/Ambn/raftra/src/components/workspaces/WorkspaceInfluencer.tsx)

- **Deal Card in Chat**: When brand sends `Finalize Deal`, a styled proposal card appears with amount + deliverables
- **Deal Status tracking**: After proposal, show "⏳ Awaiting Creator Acceptance" → "✅ Deal Active" → "🚀 Release Payment" button
- **Release Payment flow**: Brand clicks "Release Payment" → generates token → sent to creator via WhatsApp/email notification

#### [MODIFY] [BrandDashboard / pages/BrandDashboard.tsx](file:///c:/Users/Ambn/raftra/src/pages/BrandDashboard.tsx)

- **Active Deals Panel**: Shows all ongoing deals with status (pending / active / delivered / paid)
- Each deal row links to the 1-on-1 chat

---

### 3. Frontend — Creator Side

#### [MODIFY] [CreatorPortal.tsx](file:///c:/Users/Ambn/raftra/src/components/CreatorPortal.tsx)

**Dashboard Tab improvements:**
- Show active deals panel with brand name, amount, status
- Show payout history with amounts and dates

**Inbox Tab improvements:**
- Each brand conversation is already isolated (done ✅)
- `Accept Proposal` button creates a deal in DB (calls `POST /api/deals/{id}/accept`)
- After accepting, show deal status badge: `🔒 Escrow Locked ₹12,000`

**Payment Setup Tab improvements:**
- Show active deals that are in `delivered` state awaiting cashout
- Proof upload form: screenshot upload + token input field
- Bank details form: account holder, bank name, account number, IFSC, UPI ID
- Status tracker: `Submitted → Under Review → Approved → Paid`

---

### 4. Chat System — Proper 1-on-1 Isolation (already done ✅)

Chat key format: `raftra_chat_${creatorHandle}` (e.g. `raftra_chat_samairaa.r`)

Events: `raftra_live_chat_event` with `{ key, msgs }` — already scoped to creator handle

---

### 5. Notifications & WhatsApp

When brand releases payment (after delivery approval):
- Backend sends email to creator with: deal amount, brand name, WhatsApp number of brand contact
- Creator receives satisfactory notification in dashboard

---

## Verification Plan

### Build Verification
- `npx vite build` — zero errors

### Flow Verification
1. Brand logs in → sees Influencer Marketplace
2. Brand opens Charika's card → chat modal opens with `raftra_chat_charika.mehra` key
3. Brand sends "hi" — does NOT appear in Samaira's inbox
4. Brand proposes deal → creator's inbox shows deal card
5. Creator accepts → both dashboards update with deal status
6. Creator uploads proof → admin panel shows pending review
7. Admin approves → payout triggered

---

## Open Questions

> [!IMPORTANT]
> **Q1: WhatsApp notification method?** Do you have a WhatsApp Business API key (Twilio/WATI/Meta), or should the system just send the number via email for now?

> [!IMPORTANT]
> **Q2: Razorpay Payout (Transfer) API?** Payout to creator bank requires Razorpay Route/Transfer API with a fund account. Do you have this enabled on your Razorpay account, or should the payout show as "Pending Manual Transfer" in admin panel?

> [!IMPORTANT]
> **Q3: File uploads for proof?** Where should screenshots be stored — local `/uploads` folder, AWS S3, or Cloudinary?
