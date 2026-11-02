import assert from "node:assert/strict";
import test from "node:test";

import {
  initialPlan,
  installments,
  mapsLink,
  rentals,
  suggestBundle,
  totalFor,
  uberLink,
} from "../packages/api/src/weddings/domain.ts";

test("installments conserve every cent, including non-divisible totals", () => {
  for (const total of [0, 1, 100001, 250000])
    for (const months of [1, 3, 6, 12]) {
      const payments = installments(total, months);
      assert.equal(payments.length, months);
      assert.equal(
        payments.reduce((sum, p) => sum + Math.round(p * 100), 0),
        total * 100,
      );
      assert.ok(Math.max(...payments) - Math.min(...payments) < 0.011);
    }
});
test("installments reject invalid terms and negative or fractional totals", () => {
  for (const [total, months] of [
    [-1, 3],
    [1.5, 6],
    [100, 0],
    [100, 5],
    [NaN, 3],
  ])
    assert.throws(() => installments(total, months));
});
test("bundle respects city, guest capacity and budget with unique rental categories", () => {
  for (const city of ["Istanbul", "Izmir"])
    for (const budget of [1000, 70000, 250000])
      for (const guests of [100, 200, 500]) {
        const plan = { ...initialPlan, city, budget, guests };
        const result = suggestBundle(plan);
        assert.ok(result.every((r) => r.city === city));
        assert.ok(
          result.every((r) => r.category !== "Venues" || r.capacity >= guests),
        );
        assert.ok(totalFor(result.map((r) => r.id)) <= budget);
        assert.equal(
          new Set(result.map((r) => r.category)).size,
          result.length,
        );
      }
});
test("unknown inventory is excluded and repeated IDs cannot inflate totals", () => {
  assert.equal(totalFor(["missing"]), 0);
  assert.equal(totalFor([rentals[0].id, rentals[0].id]), rentals[0].price);
});
test("transport handoff encodes destination and never claims to book a ride", () => {
  const url = new URL(uberLink(rentals[0], "example-client"));
  assert.equal(url.hostname, "m.uber.com");
  assert.equal(url.searchParams.get("client_id"), "example-client");
  assert.equal(
    Number(url.searchParams.get("dropoff[latitude]")),
    rentals[0].lat,
  );
  assert.equal(url.searchParams.get("dropoff[nickname]"), rentals[0].name);
  assert.equal(new URL(mapsLink(rentals[0])).hostname, "www.google.com");
});
