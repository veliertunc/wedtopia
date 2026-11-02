# Wedtopia

## Stack analysis

This is an existing create-t3-turbo monorepo, using pnpm workspaces and Turborepo. Next.js 16 / React 19 supplies the web client, TanStack Start supplies the gateway on port 3001, and Expo SDK 54 / React Native 0.81 supplies the mobile client. Tailwind CSS 4 and NativeWind are already installed. PostgreSQL is accessed through the existing Drizzle / `@vercel/postgres` client. Better Auth and Discord OAuth already exist alongside shared tRPC, Zod validators, and UI tooling.

Wedtopia adds files to that architecture without replacing starter screens, manifests, dependencies, authentication, tRPC routers, or existing configuration. Web and mobile screens live at `/weddings`. The web design uses scoped CSS alongside the existing Tailwind setup; mobile uses React Native styles. Shared, dependency-free rental and planning logic is in `packages/api/src/weddings/domain.ts`.

## Run locally

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

## Boundaries before launch

The catalog, prices and coordinates are illustrative; coordinates identify general areas, not verified suppliers. Remote Unsplash imagery is used as visual illustration. Real vendor onboarding, inventory/size calendars, confirmed reservations, deposits, cancellation policies, payment-provider financing, refunds, supplier payouts, and cross-device draft reconciliation need product-specific provider integrations. Sample requests are disabled by default. The application never claims a reservation or payment occurred.

No keys, database URL or OAuth credentials are supplied. Offline draft planning works without those services; the original root layouts still require the starter environment to launch normally. Live integrations require account credentials and have not been verified against paid provider accounts.

## Checks

```powershell
node --test tests/weddings.test.mjs tests/weddings-drafts.test.mjs
node node_modules/typescript/bin/tsc --noEmit -p apps/nextjs/tsconfig.json
node node_modules/typescript/bin/tsc --noEmit -p apps/tanstack-start/tsconfig.json
node node_modules/typescript/bin/tsc --noEmit -p apps/expo/tsconfig.json
```

Run gateway generation once with the additive Vite configuration before checking its types. Node 22.21 supports TypeScript stripping for the domain tests.

Tests cover installment rounding and precision limits, rental matching, draft restoration and Google Maps links. AI/Google paid calls, authenticated database writes, payment processing, native-device rendering and production builds require service configuration and were not exercised.

Official integration references: [TanStack server routes](https://tanstack.com/start/latest/docs/framework/react/guide/server-routes), [OpenAI Responses](https://developers.openai.com/api/reference/responses/overview), [Anthropic Messages](https://platform.claude.com/docs/en/api/overview), [Google Places text search](https://developers.google.com/maps/documentation/places/web-service/text-search), [Uber deep links](https://developer.uber.com/docs/riders/ride-requests/tutorials/deep-links/introduction).
