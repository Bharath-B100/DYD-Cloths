# DYD-Clothes frontend

React storefront, account pages, 3D studio and administration. Use Node.js 22.12 or newer.

Run `npm ci` and `npm run dev`. Keep the backend running on port 5000. Vite proxies /api and /__ automatically. `npm test` runs workflow tests; `npm run lint` checks React; `npm run build` creates dist for Express to serve.

VITE_API_BASE_URL can override /api for separate hosting. Set VITE_FIREBASE_AUTH_DOMAIN for a deployed host serving the auth proxy. See the repository README and .env.example for setup.