import assert from "node:assert/strict";
import test from "node:test";

import {
  availableUnits,
  bookingTotal,
  canTransition,
} from "../packages/api/src/weddings/marketplace.ts";

test("only pending rental requests can change state and only by the proper actor", () => {
  assert.equal(canTransition("pending", "confirmed", "supplier"), true);
  assert.equal(canTransition("pending", "declined", "supplier"), true);
  assert.equal(canTransition("pending", "cancelled", "renter"), true);
  assert.equal(canTransition("pending", "confirmed", "renter"), false);
  assert.equal(canTransition("pending", "declined", "renter"), false);
  assert.equal(canTransition("pending", "cancelled", "supplier"), false);
  for (const status of ["confirmed", "declined", "cancelled"])
    for (const next of ["pending", "confirmed", "declined", "cancelled"])
      for (const actor of ["renter", "supplier"])
        assert.equal(canTransition(status, next, actor), false);
});
test("inventory availability cannot become negative or accept malformed counts", () => {
  assert.equal(availableUnits(10, 3), 7);
  assert.equal(availableUnits(1, 1), 0);
  assert.equal(availableUnits(1, 2), 0);
  for (const [stock, confirmed] of [
    [-1, 0],
    [3, -1],
    [3, NaN],
    [3, 0.5],
  ])
    assert.throws(() => availableUnits(stock, confirmed));
});
test("rental totals use integer quantities and remain within PostgreSQL integer storage", () => {
  assert.equal(bookingTotal(12500, 3), 37500);
  for (const [price, quantity] of [
    [0, 1],
    [-1, 1],
    [100, 0],
    [100, 1.5],
    [NaN, 1],
    [10000000, 10000],
    [Number.MAX_SAFE_INTEGER, 2],
  ])
    assert.throws(() => bookingTotal(price, quantity));
});
