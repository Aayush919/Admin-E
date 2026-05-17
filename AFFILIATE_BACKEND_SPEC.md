# Affiliate Referral System — Backend API & Database Spec

Use this document to implement the Node/Express (or your stack) API that powers the **Admin-E** affiliate UI. All admin routes require existing admin auth (`Authorization: Bearer <token>` + `x-site-tag`). Public routes are unauthenticated except dashboard login/token.

---

## Business rules

| Rule | Value |
|------|--------|
| Delivery deduction (per order) | **₹120** fixed |
| Commission rate | **20%** of amount after deduction |
| Formula | `commission = round(max(0, orderTotal - 120) * 0.2, 2)` |
| Referral cookie name | `aff_ref` |
| Cookie / session TTL | **30 days** |
| Attribution window | Same 30 days from first click or `?ref=` landing |

**Fraud prevention (required):**

1. **Self-referral** — Reject attribution if order `customerEmail` or `customerPhone` matches affiliate email/phone (case-insensitive).
2. **Duplicate order** — One order can only ever be attributed to **one** affiliate (`orderId` unique in `affiliate_order_earnings`).
3. **Inactive affiliate** — Do not attribute if `isActive === false`.
4. **Cancelled/refunded orders** — Set earning status to `rejected` and subtract from pending stats (or exclude at creation if order status is already cancelled).

---

## MongoDB collections

### 1. `affiliates`

```js
{
  _id: ObjectId,
  siteTag: String,           // e.g. "w1" — scope all queries
  name: String,
  email: String,             // unique per siteTag
  phone: String,
  referralCode: String,      // unique per siteTag, lowercase, 3-32 chars [a-z0-9_-]
  passwordHash: String,      // bcrypt for dashboard login
  dashboardTokenHash: String, // optional long-lived token after login
  isActive: Boolean,
  stats: {
    totalClicks: Number,
    totalOrders: Number,
    totalSales: Number,
    totalCommission: Number,
    paidCommission: Number,
    pendingCommission: Number
  },
  createdAt: Date,
  updatedAt: Date
}
```

Indexes: `{ siteTag: 1, referralCode: 1 }` unique, `{ siteTag: 1, email: 1 }` unique.

---

### 2. `affiliate_clicks`

```js
{
  _id: ObjectId,
  siteTag: String,
  affiliateId: ObjectId,
  referralCode: String,
  sessionId: String,         // from cookie or generated
  ipHash: String,            // SHA256(ip + salt) — privacy
  userAgent: String,
  landingPath: String,
  referrer: String,
  createdAt: Date
}
```

Indexes: `{ affiliateId: 1, createdAt: -1 }`, `{ siteTag: 1, referralCode: 1, createdAt: -1 }`.

Increment `affiliates.stats.totalClicks` on insert (dedupe: max 1 click per `sessionId` + `referralCode` per 24h optional).

---

### 3. `affiliate_order_earnings`

One document per referred order (this is what the UI lists and marks paid).

```js
{
  _id: ObjectId,
  siteTag: String,
  affiliateId: ObjectId,
  referralCode: String,
  orderId: ObjectId,           // UNIQUE globally or per siteTag
  orderNumber: String,
  customerEmail: String,
  customerPhone: String,
  orderTotal: Number,          // gross order amount used for commission
  deliveryDeduction: 120,
  commissionableAmount: Number,
  commissionAmount: Number,
  status: "pending" | "approved" | "paid" | "rejected",
  fraudFlags: [String],      // e.g. "self_referral"
  attributedAt: Date,
  paidAt: Date,
  paidByAdminId: ObjectId,
  note: String,
  createdAt: Date,
  updatedAt: Date
}
```

Indexes: `{ orderId: 1 }` unique, `{ affiliateId: 1, status: 1 }`.

**On order paid (webhook or order service):**

1. Read `aff_ref` from cookie **or** order metadata `referralCode`.
2. Resolve affiliate by `referralCode` + `siteTag`.
3. Run fraud checks; if fail → `rejected` or skip.
4. Compute commission; insert earning with `status: "pending"`.
5. Update affiliate `stats` atomically (`$inc` orders, sales, commission, pending).

---

### 4. `affiliate_commission_payouts` (optional batch ledger)

For `release-pending` you may create a payout batch or only flip earning rows to `paid`.

```js
{
  _id: ObjectId,
  siteTag: String,
  affiliateId: ObjectId,
  amount: Number,
  earningIds: [ObjectId],
  status: "paid",
  paidByAdminId: ObjectId,
  note: String,
  createdAt: Date
}
```

---

## Referral tracking (storefront integration)

### A. Query param (storefront)

On every storefront request:

```
GET https://store.example.com/?ref=priya_sharma
```

1. Validate affiliate exists and is active.
2. Set cookie: `aff_ref=priya_sharma; Max-Age=2592000; Path=/; SameSite=Lax` (add `Domain` if subdomains share).
3. Optionally call `POST /api/affiliates/track-click`.

### B. Tracked redirect (admin app — already built)

```
GET https://admin.example.com/r/{referralCode}
```

Frontend sets `aff_ref` cookie and redirects to storefront `?ref=`. Storefront **must** also persist `ref` in its own cookie on first load.

### C. At checkout / order create

Send to order service:

```json
{
  "referralCode": "<from cookie aff_ref>",
  "referralSessionId": "<optional>"
}
```

Persist on `orders.referralCode` so attribution survives cookie loss.

---

## API endpoints

Base: `/api/affiliates`  
Headers: `x-site-tag`, admin routes + `Authorization`.

Standard envelope:

```json
{ "status": "success", "data": { ... }, "message": "optional" }
```

Errors: `{ "status": "error", "message": "..." }` with 4xx/5xx.

---

### Admin — affiliates CRUD

#### `GET /api/affiliates/admin/all`

Response:

```json
{
  "status": "success",
  "data": {
    "affiliates": [
      {
        "_id": "...",
        "name": "Priya Sharma",
        "email": "priya@example.com",
        "phone": "9876543210",
        "referralCode": "priya_sharma",
        "isActive": true,
        "stats": {
          "totalClicks": 120,
          "totalOrders": 8,
          "totalSales": 45000,
          "totalCommission": 8760,
          "paidCommission": 5000,
          "pendingCommission": 3760
        },
        "createdAt": "2026-05-01T00:00:00.000Z",
        "updatedAt": "2026-05-16T00:00:00.000Z"
      }
    ]
  }
}
```

#### `GET /api/affiliates/admin/analytics`

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

`conversionRate = totalOrders / max(totalClicks, 1)`.

#### `POST /api/affiliates/admin`

Body:

```json
{
  "name": "Priya Sharma",
  "email": "priya@example.com",
  "phone": "9876543210",
  "referralCode": "priya_sharma",
  "password": "dashboard-secret",
  "isActive": true
}
```

- Hash password with bcrypt.
- Normalize `referralCode` to lowercase.
- Initialize `stats` to zeros.

Response: `{ "data": { "affiliate": { ... } } }`

#### `PATCH /api/affiliates/admin/:id`

Partial update; if `password` sent, re-hash.

#### `DELETE /api/affiliates/admin/:id`

Soft-delete recommended (`isActive: false`) or hard delete if no earnings.

---

### Admin — orders & payouts

#### `GET /api/affiliates/admin/:affiliateId/orders`

```json
{
  "data": {
    "orders": [
      {
        "_id": "earningId",
        "orderId": "...",
        "orderNumber": "ORD-1024",
        "customerEmail": "buyer@example.com",
        "orderTotal": 2500,
        "deliveryDeduction": 120,
        "commissionableAmount": 2380,
        "commissionAmount": 476,
        "status": "pending",
        "createdAt": "...",
        "paidAt": null
      }
    ]
  }
}
```

#### `POST /api/affiliates/admin/commissions/:earningId/mark-paid`

Body: `{ "note": "UPI May 2026" }`

- Set earning `status: "paid"`, `paidAt: now`.
- `$inc` affiliate `stats.paidCommission` by amount, `$inc` `stats.pendingCommission` by `-amount`.

Response: `{ "data": { "commission": { ... } } }`

#### `POST /api/affiliates/admin/:affiliateId/release-pending`

Bulk approve: set all `pending` (and optionally `approved`) earnings to `paid`, update stats in transaction.

Response: `{ "data": { "result": { "released": 3 } } }`

---

### Public — affiliate dashboard

No admin token. Rate-limit login.

#### `POST /api/affiliates/public/:referralCode/login`

Body: `{ "password": "..." }`

- Verify bcrypt; issue JWT or opaque token (7–30 day expiry).
- Response: `{ "data": { "auth": { "token": "<token>" } } }`  
  (also accept `{ "data": { "token": "..." } }`)

#### `GET /api/affiliates/public/:referralCode/dashboard?token=...`

Response:

```json
{
  "data": {
    "dashboard": {
      "affiliate": {
        "_id": "...",
        "name": "Priya Sharma",
        "email": "priya@example.com",
        "referralCode": "priya_sharma",
        "isActive": true
      },
      "stats": { "...": "same as affiliate.stats" },
      "referralLink": "https://admin.../r/priya_sharma",
      "dashboardLink": "https://admin.../affiliate/priya_sharma",
      "orders": [ /* same shape as admin orders list, last 50 */ ],
      "updatedAt": "2026-05-16T12:00:00.000Z"
    }
  }
}
```

Do not return `passwordHash` or internal fraud flags to public API.

---

### Public — click tracking

#### `POST /api/affiliates/track-click`

Body:

```json
{
  "referralCode": "priya_sharma",
  "landingPath": "/r/priya_sharma",
  "referrer": "https://instagram.com/..."
}
```

- Resolve affiliate; insert `affiliate_clicks`; increment click stat.
- Optional response header: `Set-Cookie: aff_ref=...` when API and storefront share domain.

---

## Order service hook (implement in your existing order flow)

Pseudo-code when order transitions to **paid/confirmed**:

```js
const code = order.referralCode || req.cookies?.aff_ref;
if (!code) return;

const affiliate = await Affiliate.findOne({ siteTag, referralCode: code, isActive: true });
if (!affiliate) return;

if (await AffiliateOrderEarning.exists({ orderId: order._id })) return;

if (isSelfReferral(affiliate, order)) {
  await createEarning({ status: 'rejected', fraudFlags: ['self_referral'], ... });
  return;
}

const { commission, afterDelivery } = calcCommission(order.total);
await createEarning({
  status: 'pending',
  orderTotal: order.total,
  commissionableAmount: afterDelivery,
  commissionAmount: commission,
  ...
});
await Affiliate.updateOne({ _id: affiliate._id }, {
  $inc: {
    'stats.totalOrders': 1,
    'stats.totalSales': order.total,
    'stats.totalCommission': commission,
    'stats.pendingCommission': commission,
  }
});
```

```js
function calcCommission(orderTotal) {
  const afterDelivery = Math.max(0, orderTotal - 120);
  const commission = Math.round(afterDelivery * 0.2 * 100) / 100;
  return { afterDelivery, commission };
}
```

---

## Security checklist

- [ ] Admin routes: existing JWT + role check (`admin`).
- [ ] Public dashboard: bcrypt password + rate-limited login; validate token on dashboard GET.
- [ ] Never expose password hashes.
- [ ] Scope every query by `siteTag` from `x-site-tag`.
- [ ] Validate `referralCode` format on create.
- [ ] Use transactions for mark-paid / release-pending + stats updates.

---

## Environment variables (backend)

| Variable | Purpose |
|----------|---------|
| `AFFILIATE_COOKIE_NAME` | Default `aff_ref` |
| `AFFILIATE_COOKIE_MAX_AGE` | Seconds, default `2592000` |
| `AFFILIATE_DELIVERY_DEDUCTION` | `120` |
| `AFFILIATE_COMMISSION_RATE` | `0.2` |
| `BCRYPT_ROUNDS` | `10` |

## Frontend env (already used)

| Variable | Purpose |
|----------|---------|
| `VITE_API_URL` | API base |
| `VITE_SITE_TAG` | Default site tag |
| `VITE_STOREFRONT_URL` | Store URL for redirects |
| `VITE_APP_URL` | Admin app URL for link generation |

---

## Routes summary (quick reference)

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/affiliates/admin/all` | Admin |
| GET | `/api/affiliates/admin/analytics` | Admin |
| POST | `/api/affiliates/admin` | Admin |
| PATCH | `/api/affiliates/admin/:id` | Admin |
| DELETE | `/api/affiliates/admin/:id` | Admin |
| GET | `/api/affiliates/admin/:affiliateId/orders` | Admin |
| POST | `/api/affiliates/admin/commissions/:earningId/mark-paid` | Admin |
| POST | `/api/affiliates/admin/:affiliateId/release-pending` | Admin |
| POST | `/api/affiliates/public/:referralCode/login` | Public |
| GET | `/api/affiliates/public/:referralCode/dashboard` | Public + token |
| POST | `/api/affiliates/track-click` | Public |

---

## Admin UI routes (this repo)

| URL | Who |
|-----|-----|
| `/affiliates` | Admin — manage affiliates |
| `/affiliate/:referralCode` | Affiliate — password-protected dashboard |
| `/r/:referralCode` | Anyone — click tracker → storefront |

Implement the backend to match these contracts and the Admin-E affiliate pages will work without further frontend changes.
