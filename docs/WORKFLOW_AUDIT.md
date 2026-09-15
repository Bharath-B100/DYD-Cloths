# Workflow audit and improvements

Reviewed the active React frontend, Express controllers/routes/models, persistence and payment logic, configuration, migration redirects, and maintenance scripts. Existing migration changes were preserved. The legacy frontend is reference material, not a second maintained application.

## Implemented

| Area | Findings addressed |
| --- | --- |
| Catalog | All catalog pages accessible; selling-price filters/sorting; zero-stock handling; explicit colour selection; usable search suggestions and error/retry states. |
| Cart | Immutable updates, artwork-specific line identity, stock checks across variants, account-scoped storage and serialized synchronization. |
| Checkout | Server quote module, server-owned prices/shipping/coupons, saved addresses, PIN/phone validation, retry request IDs, direct confirmation navigation after cart clear. |
| Inventory/orders | Conditional reservations and ledger release, forward-only stages, ownership checks, honest refund-required state, permanent order deletion blocked. |
| Payments | Internal-order binding, amount/currency/captured-state validation, timing-safe signatures, payment-creation locking and replay handling. |
| Studio | Preserve decoded images in undo, reliable front/back snapshots, text metadata, local draft save/import/export, artwork/quantity limits and renderer cleanup. |
| Account | Address CRUD/default selection; SMTP password recovery and reset pages; password-change session versioning; deactivated Google users blocked. |
| Admin | Pagination, inactive products, coupon editing/expiry/deactivation, shipment tracking form, COD collection, bulk-stock completion response and validated pricing, safe invoice HTML. |
| Reporting | Correct export date filters; paid-sales filters; cancelled orders excluded from sales analytics. |
| Settings/support | Defaults without seeding, type validation, truthful background-removal availability, email contact action and newsletter unsubscribe UI. |
| Application/operations | Lazy page loading, error boundary, authenticated redirects, 404 page, restricted CORS, database health/503 responses, sitemap paths, guarded maintenance commands and non-destructive admin creation. |

## Misleading behaviour corrected

Contact forms no longer pretend to send discarded messages. Missing background-removal credentials no longer return the unchanged image as successful processing. Password recovery no longer claims delivery without a sender. Placeholder social links and unsupported payment-brand icons were removed. Arbitrary quick-add defaults were removed. Seed scripts no longer print a database connection string. Financial order records are retained instead of exposing a destructive delete action.

## Verification scope

Regression tests cover cart variants/mutation, draft validation/image preservation, invoice escaping, navigation, quoted prices/stock, reservation predicates, cancellation/refund state, payment binding/capture, bulk stock, admin deactivation and date filters. HTTP smoke tests cover SPA entry points, offline readiness and CORS. Tests use isolated mocks, not production databases or payment/email services.

## Remaining work

- Online checkout/resume, signed payment webhooks, automated refunds and reconciliation remain incomplete; customer checkout remains COD-only.
- Test indexes and concurrent orders against staging MongoDB. Reservations use compensating operations, not a transaction. A process crash between reservation and order save requires orphan-reservation recovery; legacy orders without ledgers need reconciliation.
- Configure/test SMTP, Firebase authorized domains, Cloudinary and optional background removal on the actual deployment.
- Return-request and support-ticket modules need defined eligibility/refund rules and service ownership. Existing policy pages are brief store copy, not a complete operational returns process.
- Add variant-level stock if size/colour quantities differ, abandoned-online-order expiry, backup/restore drills and production monitoring.
- Large catalogs still load all pages for client filtering. Move filters/pagination fully to the server at scale. The 3D dependency remains a large lazy-loaded bundle.
- Firebase configuration is project-specific. Newsletter subscription storage exists, but campaign delivery does not.

These are explicit limitations, not a claim that every possible commerce module is complete. A Git push only becomes a live deployment if the hosting service is connected, builds successfully and becomes healthy.
