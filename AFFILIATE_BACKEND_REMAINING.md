# Affiliate Backend — Remaining APIs + Store-Only Tracking

Copy this entire document as a **implementation prompt** for your backend / storefront team.

---

## Product decision (updated)

Affiliates get **only two links**:

| Link | Example | Who uses it |
|------|---------|-------------|
| **Store link** | `https://your-store.com?ref=priya_sharma` | Customers — **all tracking & orders happen here** |
| **Dashboard link** | `https://admin-app.com/affiliate/priya_sharma` | Affiliate — password login, stats |

There is **no** `/r/:code` redirect on the admin app. Clicks and cookies are handled **on the storefront** when `?ref=` is present.

---

## Already implemented (verify these)

| Method | Path | Notes |
|--------|------|--------|
| GET | `/api/affiliates/admin/all` | Frontend list uses **`/all`** (alias `/admin` optional) |
| GET | `/api/affiliates/admin/analytics` | |
| POST | `/api/affiliates/admin` | Create affiliate + bcrypt password |
| PATCH | `/api/affiliates/admin/:id` | |
| DELETE | `/api/affiliates/admin/:id` | Soft-delete preferred |

Headers: `x-site-tag: w1`, `Authorization: Bearer <admin-jwt>`

Response envelope:

```json
{ "status": "success", "data": { ... } }
```

Errors:

```json
{ "status": "error", "message": "Human readable message" }
```

---

## APIs still to implement

### 1. Admin — affiliate orders

**`GET /api/affiliates/admin/:affiliateId/orders`**

Auth: admin + `x-site-tag`

Response:

```json
{
  "status": "success",
  "data": {
    "orders": [
      {
        "_id": "earning_mongo_id",
        "orderId": "order_object_id",
        "orderNumber": "ORD-1024",
        "customerEmail": "buyer@example.com",
        "orderTotal": 2500,
        "deliveryDeduction": 120,
        "commissionableAmount": 2380,
        "commissionAmount": 476,
        "status": "pending",
        "createdAt": "2026-05-16T10:00:00.000Z",
        "paidAt": null
      }
    ]
  }
}
```

Sort: `createdAt` desc. Limit 100.

---

### 2. Admin — mark single commission paid

**`POST /api/affiliates/admin/commissions/:earningId/mark-paid`**

Body (optional):

```json
{ "note": "UPI transfer May 2026" }
```

Logic:

1. Find `affiliate_order_earnings` by `_id` + `siteTag`.
2. If already `paid`, return 400.
3. Set `status: "paid"`, `paidAt: now`, `note`.
4. Atomically: `$inc` affiliate `stats.paidCommission` by `commissionAmount`, `$inc` `stats.pendingCommission` by `-commissionAmount`.

Response:

```json
{
  "status": "success",
  "data": {
    "commission": {
      "_id": "...",
      "affiliateId": "...",
      "amount": 476,
      "status": "paid",
      "paidAt": "...",
      "note": "..."
    }
  }
}
```

`:earningId` = document `_id` in `affiliate_order_earnings` (NOT `orderId`).

---

### 3. Admin — release all pending for one affiliate

**`POST /api/affiliates/admin/:affiliateId/release-pending`**

Logic:

1. Find all earnings for affiliate where `status` in `["pending", "approved"]`.
2. In a Mongo transaction: set all to `paid`, update affiliate stats totals.
3. Optional: create one `affiliate_commission_payouts` batch record.

Response:

```json
{
  "status": "success",
  "data": {
    "result": { "released": 3 }
  }
}
```

---

### 4. Public — affiliate dashboard login

**`POST /api/affiliates/public/:referralCode/login`**

- **No admin JWT.** Rate-limit (e.g. 10/min per IP).
- Body: `{ "password": "string" }`
- Find affiliate by `referralCode` + `siteTag` from `x-site-tag` (or default site).
- `bcrypt.compare(password, passwordHash)`
- Issue JWT or opaque token (7–30 days) containing `affiliateId`, `referralCode`, `siteTag`.

Response (either shape works — frontend supports both):

```json
{
  "status": "success",
  "data": {
    "auth": { "token": "eyJ..." }
  }
}
```

---

### 5. Public — affiliate dashboard data

**`GET /api/affiliates/public/:referralCode/dashboard?token=<token>`**

- Validate token → affiliate must match `:referralCode`.
- Return stats + last 50 order earnings.
- Do **not** return `passwordHash`.

Response:

```json
{
  "status": "success",
  "data": {
    "dashboard": {
      "affiliate": {
        "_id": "...",
        "name": "Priya Sharma",
        "email": "priya@example.com",
        "referralCode": "priya_sharma",
        "isActive": true
      },
      "stats": {
        "totalClicks": 120,
        "totalOrders": 8,
        "totalSales": 45000,
        "totalCommission": 8760,
        "paidCommission": 5000,
        "pendingCommission": 3760
      },
      "referralLink": "https://store.com?ref=priya_sharma",
      "dashboardLink": "https://admin.com/affiliate/priya_sharma",
      "orders": [ /* same as admin orders list */ ],
      "updatedAt": "2026-05-16T12:00:00.000Z"
    }
  }
}
```

Build `referralLink` from env `STOREFRONT_URL + ?ref=` + code.

---

### 6. Track click (call from STOREFRONT only)

**`POST /api/affiliates/track-click`**

Public, no admin auth. Called when customer lands with `?ref=`.

Body:

```json
{
  "referralCode": "priya_sharma",
  "landingPath": "/",
  "referrer": "https://instagram.com/..."
}
```

Logic:

1. Resolve active affiliate by `referralCode` + `x-site-tag`.
2. Insert `affiliate_clicks` (optional dedupe: same IP + code within 24h).
3. `$inc` `affiliates.stats.totalClicks`.
4. Return 200 (empty body or `{ status: "success" }`).

**Admin app does NOT call this anymore.** Only your eCommerce storefront should.

---

## Storefront changes (required for tracking)

Implement on **customer website** (not admin panel):

### On every page load (middleware or root layout)

```js
// Pseudocode
const ref = new URLSearchParams(location.search).get('ref');
if (ref) {
  const code = ref.toLowerCase().trim();
  // 30 days
  document.cookie = `aff_ref=${encodeURIComponent(code)}; path=/; max-age=2592000; SameSite=Lax`;

  // Optional: remove ?ref from URL without reload (cleaner share links)
  // history.replaceState({}, '', location.pathname);

  // Record click once per session
  if (!sessionStorage.getItem('aff_click_' + code)) {
    fetch('http://localhost:8081/api/affiliates/track-click', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-site-tag': 'w1',
      },
      body: JSON.stringify({
        referralCode: code,
        landingPath: location.pathname,
        referrer: document.referrer || undefined,
      }),
    }).catch(() => {});
    sessionStorage.setItem('aff_click_' + code, '1');
  }
}
```

### On checkout / create order

Read cookie and send to order API:

```json
{
  "referralCode": "priya_sharma"
}
```

Persist on order document: `order.referralCode`.

---

## Order attribution (backend order service)

When order status becomes **paid / confirmed** (your existing webhook or service):

```js
const code = order.referralCode || getCookieFromRequest('aff_ref');
if (!code) return;

const affiliate = await Affiliate.findOne({
  siteTag,
  referralCode: code.toLowerCase(),
  isActive: true,
});
if (!affiliate) return;

// Duplicate prevention
if (await AffiliateOrderEarning.exists({ orderId: order._id })) return;

// Self-referral fraud
if (
  sameEmail(affiliate.email, order.customerEmail) ||
  samePhone(affiliate.phone, order.customerPhone)
) {
  await createEarning({ status: 'rejected', fraudFlags: ['self_referral'], ... });
  return;
}

const orderTotal = order.grandTotal; // use your field
const commissionableAmount = Math.max(0, orderTotal - 120);
const commissionAmount = Math.round(commissionableAmount * 0.2 * 100) / 100;

await AffiliateOrderEarning.create({
  siteTag,
  affiliateId: affiliate._id,
  referralCode: code,
  orderId: order._id,
  orderNumber: order.orderNumber,
  customerEmail: order.customerEmail,
  orderTotal,
  deliveryDeduction: 120,
  commissionableAmount,
  commissionAmount,
  status: 'pending',
  createdAt: new Date(),
});

await Affiliate.updateOne(
  { _id: affiliate._id },
  {
    $inc: {
      'stats.totalOrders': 1,
      'stats.totalSales': orderTotal,
      'stats.totalCommission': commissionAmount,
      'stats.pendingCommission': commissionAmount,
    },
  },
);
```

Commission formula (fixed):

- Deduct **₹120** delivery per order
- Commission = **20%** of remainder

---

## MongoDB collections (minimum)

### `affiliates` — already have

Must include embedded `stats` object (all numbers, default 0).

### `affiliate_clicks` — new

```js
{
  siteTag, affiliateId, referralCode,
  ipHash, userAgent, landingPath, referrer,
  createdAt
}
```

### `affiliate_order_earnings` — new

```js
{
  siteTag, affiliateId, referralCode,
  orderId,        // UNIQUE index
  orderNumber, customerEmail,
  orderTotal, deliveryDeduction: 120,
  commissionableAmount, commissionAmount,
  status: 'pending' | 'paid' | 'rejected',
  fraudFlags: [],
  paidAt, note,
  createdAt, updatedAt
}
```

---

## List affiliates response — required fields

Frontend table breaks without `stats` on each row:

```json
{
  "data": {
    "affiliates": [
      {
        "_id": "...",
        "name": "...",
        "email": "...",
        "phone": "...",
        "referralCode": "priya_sharma",
        "isActive": true,
        "stats": {
          "totalClicks": 0,
          "totalOrders": 0,
          "totalSales": 0,
          "totalCommission": 0,
          "paidCommission": 0,
          "pendingCommission": 0
        }
      }
    ]
  }
}
```

---

## Analytics response

```json
{
  "data": {
    "analytics": {
      "totalAffiliates": 10,
      "activeAffiliates": 8,
      "totalClicks": 5000,
      "totalOrders": 200,
      "totalSales": 1200000,
      "totalCommission": 230000,
      "totalPaid": 180000,
      "totalPending": 50000,
      "conversionRate": 0.04
    }
  }
}
```

`conversionRate = totalOrders / Math.max(totalClicks, 1)`

---

## Implementation checklist

**Backend (port 8081)**

- [ ] `GET .../admin/:id/orders`
- [ ] `POST .../commissions/:earningId/mark-paid`
- [ ] `POST .../:affiliateId/release-pending`
- [ ] `POST .../public/:code/login`
- [ ] `GET .../public/:code/dashboard?token=`
- [ ] `POST .../track-click` (storefront calls this)
- [ ] Order-paid hook → create earning + update stats
- [ ] Fraud: self-referral + duplicate orderId

**Storefront**

- [ ] Read `?ref=` → set `aff_ref` cookie (30 days)
- [ ] Call `track-click` once per session
- [ ] Pass `referralCode` on order create from cookie

**Admin UI (done)**

- [ ] Only store link + dashboard link shown
- [ ] No `/r/:code` route

---

## Quick test flow

1. Admin creates affiliate `test_partner` / password `secret123`.
2. Open store: `https://store.com?ref=test_partner` → cookie set, click counted.
3. Place order while cookie active → earning `pending` appears in admin orders modal.
4. `POST mark-paid` → pending decreases, paid increases.
5. Affiliate opens `/affiliate/test_partner`, logs in, sees stats update.

---

## Env vars

| Service | Variable |
|---------|----------|
| Backend | `STOREFRONT_URL`, `AFFILIATE_COOKIE_NAME=aff_ref`, `AFFILIATE_COOKIE_MAX_AGE=2592000` |
| Admin (Vite) | `VITE_API_URL=http://localhost:8081`, `VITE_SITE_TAG=w1`, `VITE_STOREFRONT_URL=https://your-store.com` |
