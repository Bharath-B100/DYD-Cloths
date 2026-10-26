# DYD-Clothes

T-shirt storefront with React/Vite, Express and MongoDB. The previous static frontend remains in frontend-legacy for migration reference; production serves frontend/dist.

## Local development

Use Node.js 22.12 or newer. Install with `npm ci --prefix backend` and `npm ci --prefix frontend`. Copy backend/.env.example to backend/.env and configure MongoDB and JWT. Never commit environment secrets.

Run `npm run dev --prefix backend` and `npm run dev --prefix frontend` in separate terminals. Vite proxies the API on port 5000. MongoDB must be reachable; /api/health reports 503 otherwise.

Checkout requires a MongoDB replica set (MongoDB Atlas supports this) so stock, coupon usage and order creation can commit atomically. A standalone MongoDB server is not sufficient for checkout. Failed initial database connections retry with backoff, up to 30 seconds between attempts.

Create an administrator with `npm run create-admin --prefix backend` after configuring ADMIN_EMAIL, ADMIN_NAME and ADMIN_PASSWORD. Existing data is preserved. Demo seed/clear commands delete data, require ALLOW_DATABASE_RESET=yes and refuse production.

## Verification

Build before running the backend HTTP smoke tests:

```
npm run build --prefix frontend
npm test --prefix frontend
npm run lint --prefix frontend
npm test --prefix backend
```

Tests use isolated mocks and never send email, charge payments or modify production data.

Backend tests also launch a disposable local MongoDB replica set in a new temporary directory. Install `mongod` on PATH, or set `MONGOD_BINARY` to its executable. Tests never connect to `MONGODB_URI` and do not touch the store database. Temporary test database files are retained under the system temporary directory for diagnostics.

The frontend test command now runs both unit and browser tests and starts its own Vite server. Browser tests require Playwright and Microsoft Edge. Install Playwright locally with `npm install --no-save --package-lock=false --prefix frontend playwright`, or set `PLAYWRIGHT_MODULE_PATH` to an existing installation. Use `BROWSER_CHANNEL` to select another installed Chromium channel. Missing prerequisites fail the command instead of silently skipping tests. `npm run test:unit --prefix frontend` runs only the unit tests.

## Deployment

The Render Blueprint is render.yaml. For an existing service, set the root directory to the repository root, build command to `npm ci --prefix backend && npm ci --prefix frontend --include=dev && npm run build --prefix frontend`, start command to `npm start --prefix backend`, health path to /api/health, and Node version to 22.12 or newer. A Blueprint commit does not automatically change existing service settings.

Configure MONGODB_URI, JWT_SECRET, PUBLIC_SITE_URL and ALLOWED_ORIGINS in the host environment. Set TRUST_PROXY=1 only behind one trusted reverse proxy. Authorize the public domain in Firebase/Google OAuth and set VITE_FIREBASE_AUTH_DOMAIN to the host serving the /__/auth proxy. Supply Cloudinary for uploads, SMTP for password recovery and optional REMOVE_BG_API_KEY for background removal. SMTP configuration follows Nodemailer's SMTP transport: https://nodemailer.com/smtp.

Cash on delivery is the current customer checkout. Razorpay backend verification is hardened, but online checkout/resume, gateway webhooks and automated refund reconciliation are follow-up work. Paid cancellations flag refundRequired; cancellation does not itself refund a payment. Missing SMTP/background-removal configuration is reported honestly as unavailable.

See docs/WORKFLOW_AUDIT.md for changes, test coverage and remaining limitations.

### Email verification

Password signup creates an active but unverified account and never issues a session. Verification emails contain a hashed-at-rest, single-use token valid for 30 minutes. The verification page requires confirmation; simply fetching the link does not activate an account. Resends have a 60-second per-account cooldown and authentication endpoint rate limits. Email delivery uses the same SMTP configuration as password recovery.

Existing unverified accounts must use Resend verification email before password login; existing sessions are also checked. Verified Google identities can activate their accounts through Google sign-in. Password reset is available only for verified accounts. Profile editing does not change a verified email address. No existing accounts are automatically marked verified.
