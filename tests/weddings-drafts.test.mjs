import assert from "node:assert/strict";
import test from "node:test";

import {
  initialPlan,
  installments,
  readWeddingPlan,
  safePlaceUrl,
} from "../packages/api/src/weddings/domain.ts";

test("persisted drafts are validated and copied before loading", () => {
  const value = {
    ...initialPlan,
    rentalIds: ["bosphorus"],
    extra: "discarded",
  };
  const parsed = readWeddingPlan(value);
  assert.ok(parsed);
  assert.deepEqual(parsed.rentalIds, ["bosphorus"]);
  assert.notEqual(parsed.rentalIds, value.rentalIds);
  assert.equal("extra" in parsed, false);
  assert.ok(
    readWeddingPlan({ ...initialPlan, date: "2020-01-01" }),
    "past drafts can still be reopened",
  );
});
test("corrupt drafts cannot introduce invalid dates, money, counts or inventory", () => {
  for (const value of [
    null,
    [],
    {},
    { ...initialPlan, names: " " },
    { ...initialPlan, date: "2027-02-30" },
    { ...initialPlan, budget: NaN },
    { ...initialPlan, budget: -1 },
    { ...initialPlan, budget: 12.5 },
    { ...initialPlan, guests: 0 },
    { ...initialPlan, guests: Infinity },
    { ...initialPlan, months: 5 },
    { ...initialPlan, city: "unknown" },
    { ...initialPlan, rentalIds: ["missing"] },
    { ...initialPlan, rentalIds: ["bosphorus", "bosphorus"] },
  ])
    assert.equal(readWeddingPlan(value), null);
});
test("place links accept only HTTPS Google Maps destinations", () => {
  assert.ok(safePlaceUrl("https://maps.google.com/?q=Istanbul"));
  assert.ok(safePlaceUrl("https://www.google.com/maps/place/example"));
  for (const value of [
    undefined,
    "javascript:alert(1)",
    "http://www.google.com/maps",
    "https://www.google.com.evil.example/maps",
    "https://evil.example",
  ])
    assert.equal(safePlaceUrl(value), null);
});
test("installment precision cannot overflow safe integer cents", () => {
  assert.throws(() => installments(Number.MAX_SAFE_INTEGER, 3));
});
