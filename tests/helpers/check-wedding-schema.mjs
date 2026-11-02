import assert from "node:assert/strict";

import { weddingSchemaSQL } from "./wedding-postgres.mjs";

const sql = (await weddingSchemaSQL()).join("\n");
for (const name of [
  "wedding_plans",
  "wedding_requests",
  "wedding_ai_usage",
  "wedding_rental_listings",
  "wedding_rental_bookings",
  "rental_booking_idempotency",
  "rental_booking_status",
  "rental_booking_amount",
])
  assert.ok(sql.includes(name), `Missing generated schema item: ${name}`);
const { marketplace } = await import("@acme/api/weddings/service");
assert.equal(typeof marketplace, "function");
console.log(
  "Schema preparation passed: actual Drizzle tables and constraints generated; production marketplace module loaded. No database connection was made.",
);
