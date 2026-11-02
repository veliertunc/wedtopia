# Wedtopia

## Stack analysis

This is an existing create-t3-turbo monorepo, using pnpm workspaces and Turborepo. Next.js 16 / React 19 supplies the web client, TanStack Start supplies the gateway on port 3001, and Expo SDK 54 / React Native 0.81 supplies the mobile client. Tailwind CSS 4 and NativeWind are already installed. PostgreSQL is accessed through the existing Drizzle / `@vercel/postgres` client. Better Auth and Discord OAuth already exist alongside shared tRPC, Zod validators, and UI tooling.

Wedtopia keeps the existing stack, authentication and tRPC routers. Web and mobile screens live at `/weddings`. The web design uses scoped CSS alongside the existing Tailwind setup; mobile uses React Native styles. Shared planning modules and booking logic are accessed through pnpm workspace package exports.

## Workspace modules

Applications and tests import shared code through public package entry points:

| Import                           | Responsibility                                                    |
| -------------------------------- | ----------------------------------------------------------------- |
| `@acme/api`                      | Existing server tRPC router and inferred types                    |
| `@acme/api/weddings/domain`      | Client-safe catalog, plans, matching and installment calculations |
| `@acme/api/weddings/marketplace` | Client-safe rental/request types and booking rules                |
| `@acme/api/weddings/readiness`   | Shared service-status types and readiness assessment              |
| `@acme/api/weddings/saved-plans` | Saved-plan, request-history and place-result types                |
| `@acme/api/weddings/service`     | Server-only booking service, called by the TanStack gateway       |
| `@acme/db/weddings`              | Wedding plan, sample-request and usage tables                     |
| `@acme/db/wedding-marketplace`   | Supplier listing and reservation tables                           |
| `@acme/db/client`                | Existing PostgreSQL/Drizzle client                                |

The client-safe entry points do not import the server router, authentication or database client. Package exports follow the repository's existing convention: TypeScript declarations in `dist/`, runtime source in `src/`. Expo declares `@acme/api` in runtime dependencies; root tests declare their workspace dependencies explicitly. Files within one package can use ordinary relative imports; package consumers use `@acme/...` exports.

After installing dependencies, build the shared declarations with the existing dependency graph:

```powershell
pnpm exec turbo run build --filter=@acme/api...
```

Workspace modularization was verified with the shared-package build and all three app type checks, 15 tests using the public exports, schema preparation, and gateway catalog/validation/access checks. The lockfile changes only workspace links; external dependency versions are unchanged.

## Run locally

With the repository's existing dependencies installed and Node 22.21 or newer within Node 22, start the web and gateway together:

```powershell
node scripts/dev-weddings.mjs --demo
# Once your original .env is configured and the wedding schema is applied:
node scripts/dev-weddings.mjs
```

The demo runs device-only inspiration planning and disables database access and paid integrations in its child processes. The live marketplace displays a setup message rather than pretending to have an empty catalog. The launcher uses the additive gateway configuration, supplies the existing Tailwind plugin path, sets matching local origins and ports, and stops its own child processes together. Ports can be changed with `--web-port=3100 --gateway-port=3101`. It binds only to loopback; use the separate Expo/network instructions below for a physical phone.

This machine originally ran Node 26, outside the declared Node 22 engine range. A portable Node 22.21.0 executable was downloaded to the ignored workspace cache and verified against the [official Node.js SHA-256 manifest](https://nodejs.org/dist/v22.21.0/SHASUMS256.txt). The system installation was not changed. On this checkout you can use:

```powershell
.\.cache\wedtopia\node22\node.exe scripts/dev-weddings.mjs --demo
```

The cached executable is local setup, not a tracked project dependency; other checkouts should use their normal Node 22 installation.

Install the repository's existing dependencies with its pinned pnpm version if necessary. Copy the existing `.env.example` to `.env` and configure the original PostgreSQL and authentication variables. Apply the new wedding schema separately:

```powershell
cd packages/db
pnpm with-env drizzle-kit generate --config drizzle.weddings.config.ts
# Review the generated SQL, then apply it to your development database:
pnpm with-env drizzle-kit migrate --config drizzle.weddings.config.ts
```

The configuration includes both original and wedding tables. For an existing database, use your established migration baseline; do not apply a generated initial migration over tables that already exist. Alternatively, review `drizzle-kit push --config drizzle.weddings.config.ts` against a disposable development database. No database changes were run during implementation.

Start the gateway using the **new** configuration so the original generated route tree stays intact:

```powershell
cd apps/tanstack-start
pnpm with-env vite --config vite.weddings.config.ts
```

In separate terminals:

```powershell
pnpm --filter @acme/nextjs dev
pnpm --filter @acme/expo dev
```

Open the web app at `http://localhost:3000/weddings`. Open `/weddings` using Expo Router in the development client. On a physical mobile device set `EXPO_PUBLIC_WEDDINGS_GATEWAY_URL` to a reachable gateway URL and start Vite with `--host` on your trusted development network. The existing mobile home screen is preserved.

On this checkout, Next's CSS compiler could not resolve the already-installed Tailwind PostCSS plugin from the shared tooling package. This launch-time setting fixes resolution without modifying manifests or installed versions. Run it from the repository root before starting Next in the same terminal:

```powershell
$env:NODE_PATH = (Resolve-Path tooling/tailwind/node_modules).Path
pnpm --filter @acme/nextjs dev
```

The additive Vite configuration writes `src/weddings-routeTree.gen.ts` and redirects the starter router's import during compilation. The original `src/routeTree.gen.ts` and `vite.config.ts` remain unchanged. Use this configuration for gateway builds too: `pnpm with-env vite build --config vite.weddings.config.ts`. The ordinary starter command regenerates the original tree and should not be used when preserving that file is required.

## Service configuration

See `.env.weddings.example` for additional variables. Merge values into your environment; do not replace the existing environment configuration.

- `WEDDINGS_GATEWAY_URL`: server-only Next.js proxy destination. Defaults to `http://localhost:3001`.
- `WEDDINGS_ALLOWED_ORIGINS`: exact comma-separated browser origins. Match the deployed web and gateway origins.
- `EXPO_PUBLIC_WEDDINGS_GATEWAY_URL`: public gateway URL for mobile. Contains no credentials.
- `GOOGLE_MAPS_API_KEY`: server-only key with Places API (New) enabled and appropriate restrictions. Place search uses a field mask and returns Google Maps links and attribution.
- `UBER_CLIENT_ID`: optional identifier in the gateway's transport handoff. Uber controls fare review and final ride confirmation. No privileged ride-booking API is assumed; browser and mobile venue links use Uber universal links.
- `WEDDINGS_AI_MODELS`: JSON configuration for OpenAI Responses, Anthropic Messages, and other OpenAI-compatible providers. The provider's key is read from the named server environment variable. Specify an HTTPS `baseUrl` for compatible providers. Never put secrets in this JSON or public environment variables.
- `WEDDINGS_ENABLE_SAMPLE_REQUESTS`: defaults off. Set `true` only to exercise sample availability requests; these are not real vendor reservations.

Model identifiers and cost weights are deployment configuration, not frozen claims about current provider pricing. Confirm model availability in your provider account. Auto routing sorts by `inputCost + outputCost`, then the least number of previous attempts among ties. Weights are a ranking heuristic, not an exact token-price estimate or spend cap. Attempts are stored in PostgreSQL; automatic routing tries the next configured model after provider failure. Manual selection stays on the chosen model. Each call is limited to 1,000 output tokens and a 25-second provider timeout. Gateway users have a durable per-minute request limit. Clean up obsolete `limit:*` rows periodically; retain model count rows.

## Authentication

Live saving, availability requests, AI, place search and the transport endpoint require a gateway session. Web requests go through a same-origin Next.js proxy forwarding the session cookie. In local development, sign in on `localhost:3001` using the original gateway screen; the localhost cookie can then be forwarded by Next.js. The starter's web sign-in also uses the same authentication system/database. Mobile has a separate gateway-scoped Better Auth Expo client and a sign-in button. Keep `AUTH_SECRET` and the database consistent between services.

The starter hardcodes its OAuth production callback defaults and allows `expo://`. Configure its existing deployment environment variables and register the correct Discord callback. For production across unrelated hostnames, serve gateway authentication through a shared origin or configure an appropriate authentication domain strategy. This implementation does not silently relax the original authentication settings.

## What works

- Responsive rental catalog: venues, vehicles, installations, equipment, wedding dresses and suits/costumes; category/search/sort and web favorites.
- Local wedding drafts, rental bundle selection and removal, budget tracking, deterministic city/capacity/budget matching, and a JSON export on web.
- Exact-cent installment estimates for 1, 3, 6 or 12 payments. No financing or payment is executed.
- Authenticated PostgreSQL plan storage and opt-in sample availability requests with server-calculated totals, validation and idempotency.
- Web and mobile account panels reopen saved celebrations and show request history. Saving an opened plan updates that celebration after a gateway ownership check. A separate celebration can be started explicitly.
- A persistent text box during the session, manual model switching, recent conversation context and automatic provider fallback.
- Live Google Places search on web and mobile when configured, plus area links and Uber ride handoff. The mobile Places tab uses the authenticated gateway and displays attribution.

## Supplier marketplace

The live marketplace is separate from the sample inspiration collection. Open `/weddings/marketplace` on the web, or **Browse supplier rentals** in Expo. Suppliers use the web **Supplier studio** to create a draft listing and explicitly publish or archive it. The database stores supplier-owned listings and daily reservation requests. Listings are supplier-entered, not independently verified.

After applying the additive schema configuration, these gateway endpoints are available:

- `GET marketplace?day=YYYY-MM-DD&city=Istanbul`: published listings with remaining confirmed inventory for that day. City is optional. Returns the latest 100 matches; no sample fallback.
- `GET supplier`: the signed-in supplier's listings and incoming requests.
- `POST listing`: create a draft or publish/archive an owned listing.
- `GET bookings`: the signed-in renter's request history.
- `GET readiness`: a database-only readiness check (200 when ready, 503 otherwise). It checks the wedding tables' required columns, times out after eight seconds, coalesces requests for ten seconds, and never returns connection details or raw provider errors. It does not certify OAuth, payments or external AI/Maps services. Web and Expo show an ordinary service-status message with a retry action when live rentals are unavailable.
- `POST reservation`: request one rental day and an integer quantity, with a client idempotency key.
- `POST booking-decision`: suppliers confirm/decline pending requests; renters cancel pending requests.

Request creation snapshots the rental title, business name, public contact details and price. The server calculates the total. Reusing a request key for different details returns a conflict. Pending requests do not reserve stock. Supplier confirmation runs in a database transaction, locks the listing first, and checks confirmed units for the requested day before changing status. Archiving removes a listing from discovery without deleting its reservation history. Details and stock are immutable after creation; suppliers can archive and create a replacement offer. Confirmed cancellations require direct supplier agreement and are not automated.

No real listings are seeded or published during development. The marketplace needs the existing PostgreSQL and authentication configuration, but no paid external API to manage inventory. No payments are collected. Supplier verification, contracts, delivery, fitting appointments, deposits, refunds, tax, payouts and multi-day rentals remain outside this implementation. Database concurrency and authenticated write flows need testing against a configured development PostgreSQL instance.

## Boundaries before launch

The inspiration catalog, prices and coordinates are illustrative; coordinates identify general areas, not verified suppliers. Remote Unsplash imagery is used as visual illustration. The supplier marketplace has separate persistent inventory and supplier-confirmed daily reservations. Vendor verification, deposits, cancellation policies, payment-provider financing, refunds, supplier payouts and cross-device draft reconciliation still need product-specific provider integrations. Sample requests are disabled by default. The application never claims a payment occurred.

No keys, database URL or OAuth credentials are supplied. Offline draft planning works without those services; the original root layouts still require the starter environment to launch normally. Live integrations require account credentials and have not been verified against paid provider accounts.

## Checks

```powershell
node --test tests/weddings.test.mjs tests/weddings-drafts.test.mjs tests/weddings-marketplace.test.mjs tests/weddings-readiness.test.mjs
node node_modules/typescript/bin/tsc --noEmit -p apps/nextjs/tsconfig.json
node node_modules/typescript/bin/tsc --noEmit -p apps/tanstack-start/tsconfig.json
node node_modules/typescript/bin/tsc --noEmit -p apps/expo/tsconfig.json
```

Run gateway generation once with the additive Vite configuration before checking its types. Node 22.21 supports TypeScript stripping for the domain tests.

### Isolated PostgreSQL integration checks

```powershell
# Validate generated DDL and load the production marketplace without connecting to a database:
node tests/run-weddings-integration.mjs --prepare-only
# With a running Docker Linux engine:
node tests/run-weddings-integration.mjs
```

The runner uses the already-locked `tsx` development tool and the existing Drizzle / Vercel PostgreSQL driver; no package manifest or lockfile changes are needed. It creates a uniquely named, loopback-only, disposable PostgreSQL 17 container with no mounted volumes. DDL is generated directly from the actual Drizzle schema. A test-only loopback WebSocket bridge supports the existing driver's transport. The runner overrides the child process's database URL with a localhost sentinel and never connects to the application's database or reads an application `.env` file. Fixture cleanup removes only the container it created.

The integration suite calls the production marketplace handler with an injected isolated database and covers listing ownership, publication, server-calculated totals, concurrent idempotent requests, unauthorized decisions, concurrent stock confirmations, cancellation rules and request history after archiving. It does not bypass authentication in the deployed gateway; OAuth/session behavior is outside this direct service test. An unavailable Docker engine fails the suite rather than reporting skipped or passed database checks.

On this machine, Docker Desktop could not start. Schema preparation and the non-database checks can run, but the PostgreSQL integration suite remains unverified. No system virtualization settings were changed and no application database was migrated.

The readiness/launcher pass passed all three application TypeScript checks, all 15 non-database tests, and schema preparation under Node 22.21.0. The demo launcher started both services; direct and proxied readiness checks returned 503 with the expected unconfigured-service message, and the browser displayed that message with retry and inspiration controls. The database integration command failed at Docker preflight before creating or contacting a database; it is not counted as a passed integration suite.

Tests cover installment rounding and precision limits, rental matching, draft restoration and Google Maps links. AI/Google paid calls, authenticated database writes, payment processing, native-device rendering and production builds require service configuration and were not exercised.

The supplier-marketplace pass passed all three application TypeScript checks and 12 domain tests. Browser checks verified the rendered marketplace, required supplier fields and a phone-width layout without horizontal overflow. The gateway returned 400 for an invalid rental date and 401 for an unsigned supplier request after a clean restart. An earlier development restart failed in Nitro; no framework or dependency version was changed. Authenticated PostgreSQL writes and concurrent reservation confirmations remain untested until a development database and test accounts are configured.

Official integration references: [TanStack server routes](https://tanstack.com/start/latest/docs/framework/react/guide/server-routes), [OpenAI Responses](https://developers.openai.com/api/reference/responses/overview), [Anthropic Messages](https://platform.claude.com/docs/en/api/overview), [Google Places text search](https://developers.google.com/maps/documentation/places/web-service/text-search), [Uber deep links](https://developer.uber.com/docs/riders/ride-requests/tutorials/deep-links/introduction).
