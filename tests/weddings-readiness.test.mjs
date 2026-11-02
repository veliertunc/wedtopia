import assert from "node:assert/strict";
import test from "node:test";

import {
  assessDatabaseReadiness,
  missingWeddingColumns,
  weddingSchemaColumns,
} from "@acme/api/weddings/readiness";

const complete = Object.entries(weddingSchemaColumns).flatMap(
  ([table_name, columns]) =>
    columns.map((column_name) => ({ table_name, column_name })),
);
test("missing configuration does not attempt a database connection", async () => {
  let called = false;
  const result = await assessDatabaseReadiness(false, async () => {
    called = true;
    return [];
  });
  assert.equal(result.state, "unconfigured");
  assert.equal(called, false);
});
test("readiness checks columns as well as table existence", async () => {
  assert.equal(
    (await assessDatabaseReadiness(true, async () => complete)).ready,
    true,
  );
  const oldSchema = complete.filter((c) => c.column_name !== "contact");
  assert.ok(
    missingWeddingColumns(oldSchema).includes(
      "wedding_rental_bookings.contact",
    ),
  );
  assert.equal(
    (await assessDatabaseReadiness(true, async () => oldSchema)).state,
    "migration_required",
  );
});
test("connection failures and timeouts do not disclose credentials", async () => {
  const failed = await assessDatabaseReadiness(true, async () => {
    throw new Error("postgres://private:secret@example");
  });
  assert.equal(failed.state, "unavailable");
  assert.ok(!JSON.stringify(failed).includes("secret"));
  const timedOut = await assessDatabaseReadiness(
    true,
    () => new Promise(() => {}),
    10,
  );
  assert.equal(timedOut.state, "unavailable");
});
