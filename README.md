# Shree Shuddham — Vercel deployment

This is a static storefront with Vercel Node.js Functions and MongoDB Atlas. Product, coupon, order and admin records are served by `/api`; the browser is not the source of truth for prices or order status. Payment is intentionally simulated: **no Razorpay SDK, key, charge, or payment verification is configured.**

## Deploy

1. Push this project to a private GitHub repository and import it into Vercel. The project root is this directory; no build command or output directory is required. Vercel runs Node.js Functions from `api/` and serves the HTML, CSS, JavaScript, and `assets/` files as static assets.
2. Create a MongoDB Atlas database and a database user with read/write access to that database. Configure Atlas network access for the Vercel project using the outbound/static IP feature available on your Vercel plan. Only use a broad Atlas IP allow-list for a short-lived test deployment, never for production.
3. In Vercel → Project → Settings → Environment Variables, set these values for Production (and separately Preview if needed):
   - `MONGODB_URI` — Atlas connection URI. Keep it private.
   - `MONGODB_DB` — `shree_shuddham` (or your chosen database name).
   - `ADMIN_USERNAME` — the bootstrap administrator ID.
   - `ADMIN_PASSWORD_HASH` — bcrypt hash for a new, unique administrator password.
   - `NODE_ENV` — `production`.
4. Generate the password hash locally, in a terminal, after installing dependencies with `npm install`, by running `npm run hash-admin-password`. The prompt does not echo the password. Copy only the resulting bcrypt hash into Vercel. Use a new password; never reuse or publish a password previously shared in chat. The application does not contain or deploy the supplied plaintext credentials.
5. Deploy. On the first API request, the backend creates MongoDB indexes and seeds the starter products and coupon codes if those collections are empty.
6. In Vercel → Project → Settings → Domains, add `admin.shreeshuddham.com` to this same project and create the exact DNS record Vercel displays at your DNS provider. The host rewrite serves `admin.html` at the admin subdomain root. Wait for Vercel to issue HTTPS before testing admin login.
7. Test the storefront on its production domain and the dashboard at `https://admin.shreeshuddham.com`. Confirm products load, create a test order with fictional customer data, start the demo payment, download the invoice, and accept/decline and update delivery from the dashboard. Remove test orders from the database before launch if any were created.

Before customers can order, sign in to the admin dashboard and add the six-digit PIN codes your business serves. New PIN codes are active by default; deactivated or removed codes cannot be used for new orders. Checkout checks availability before continuing, and the order API verifies it again before saving.

Copy `.env.example` when configuring a local environment; never commit `.env` or production credentials. The bootstrap `ADMIN_USERNAME` and `ADMIN_PASSWORD_HASH` are used only to create the initial admin record. After that, use Account settings to change credentials; changes are stored as a bcrypt hash in MongoDB and invalidate all current admin sessions.

## API

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/health` | Public | Check API/database availability |
| `GET` | `/api/products` | Public | Active catalogue |
| `GET` | `/api/products?includeInactive=true` | Admin | Admin catalogue |
| `POST` | `/api/products` | Admin | Add a product |
| `PATCH` / `DELETE` | `/api/products/:id` | Admin | Update or deactivate a product |
| `GET` | `/api/coupons` | Public | Active coupon codes |
| `GET` | `/api/coupons?includeInactive=true` | Admin | Admin coupon list |
| `POST` | `/api/coupons` | Admin | Generate a coupon |
| `PATCH` / `DELETE` | `/api/coupons/:code` | Admin | Enable, disable, or deactivate a coupon |
| `GET` | `/api/pincodes` | Public | Active serviceable PIN codes |
| `GET` | `/api/pincodes?pin=######` | Public | Check whether a PIN code is serviceable |
| `GET` | `/api/pincodes?includeInactive=true` | Admin | View all delivery PIN codes |
| `POST` | `/api/pincodes` | Admin | Add a delivery PIN code and optional area label |
| `PATCH` / `DELETE` | `/api/pincodes/:pin` | Admin | Activate/deactivate or permanently remove a PIN code |
| `POST` | `/api/orders` | Public | Create a server-priced order from product IDs and a validated delivery address |
| `POST` | `/api/orders/:id/demo-payment` | Public | Record demo payment initiation and move the order to admin review |
| `GET` | `/api/orders` | Admin | Review the newest 100 orders; pass the returned `nextCursor` as `?cursor=` to load older orders. Dashboard order totals cover all records. |
| `PATCH` | `/api/orders/:id` | Admin | Accept/decline or update delivery status and agent |
| `POST` | `/api/admin/login` | Public, rate-limited | Start an eight-hour HttpOnly admin session |
| `GET` | `/api/admin/session` | Admin | Check current session |
| `POST` | `/api/admin/logout` | Admin | End session |
| `PATCH` | `/api/admin/credentials` | Admin | Change ID/password after current-password verification |

Admin sessions use random opaque tokens stored only as SHA-256 hashes in MongoDB, secure HttpOnly SameSite cookies, origin checks on mutations, bcrypt password hashes, and database-backed login/order-creation rate limits. Customer orders are priced and coupon-discounted on the server, not from browser-submitted totals. Unpaid checkout records expire after 24 hours.

## Payment and launch readiness

The checkout intentionally moves forward using the simulated payment choice and clearly marks orders/invoices as demo-only. Its `paymentStatus` is **not proof of payment**; do not fulfil or account for demo-paid orders as real revenue. To enable Razorpay later, add server-side order creation and signature/webhook verification, store secrets only in Vercel environment variables, and move orders to review only after verified payment.

Before accepting real customer information, configure Atlas backups and network access, establish privacy/retention and support processes, test Vercel production/preview environment separation, and publish accurate business, refund, tax, and delivery policies. The invoice is a downloadable prototype document and is explicitly not a tax invoice.
