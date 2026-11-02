import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { marketplace, MarketplaceError } from "@acme/api/weddings/service";
import { user } from "@acme/db/schema";
import { rentalBookings } from "@acme/db/wedding-marketplace";

import { isolatedWeddingDatabase } from "./helpers/wedding-postgres.mjs";

test(
  "marketplace booking workflow against isolated PostgreSQL using the production driver",
  { timeout: 240000 },
  async (t) => {
    const fixture = await isolatedWeddingDatabase();
    t.after(() => fixture.close());
    const day = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const url = new URL(`http://localhost/api/weddings/marketplace?day=${day}`);
    const call = async (action, actor, body = null, query = url) =>
      (await marketplace(action, actor, body, query, fixture.db)).data;
    const expectStatus = (status) => (error) =>
      error instanceof MarketplaceError && error.status === status;
    let listing, first, second, winner, loser;
    try {
      await fixture.db.insert(user).values(
        ["supplier", "other-supplier", "renter-a", "renter-b"].map((id) => ({
          id,
          name: id,
          email: `${id}@example.invalid`,
          emailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      );
      await t.test(
        "ownership, draft publication and public inventory",
        async () => {
          ({ listing } = await call("listing", "supplier", {
            operation: "create",
            title: "Integration garden",
            businessName: "Fixture supplier",
            contact: "supplier@example.invalid",
            category: "Venues",
            city: "Istanbul",
            description: "A test-only garden listing in an isolated database.",
            price: 50000,
            stock: 1,
            capacity: 150,
            ownerId: "other-supplier",
            published: true,
          }));
          assert.equal(listing.ownerId, "supplier");
          assert.equal(listing.published, false);
          assert.equal((await call("marketplace", null)).listings.length, 0);
          await assert.rejects(
            call("listing", "other-supplier", {
              operation: "publish",
              id: listing.id,
            }),
            expectStatus(404),
          );
          await call("listing", "supplier", {
            operation: "publish",
            id: listing.id,
          });
          const publicRental = (await call("marketplace", null)).listings[0];
          assert.equal(publicRental.available, 1);
          assert.equal("ownerId" in publicRental, false);
          await assert.rejects(
            call("reservation", "supplier", {
              listingId: listing.id,
              day,
              quantity: 1,
              idempotencyKey: randomUUID(),
            }),
            expectStatus(400),
          );
        },
      );
      await t.test("request totals, replay safety and ownership", async () => {
        const body = {
          listingId: listing.id,
          day,
          quantity: 1,
          note: "A test request",
          idempotencyKey: randomUUID(),
          total: 1,
          status: "confirmed",
        };
        const duplicate = await Promise.all([
          call("reservation", "renter-a", body),
          call("reservation", "renter-a", body),
        ]);
        first = duplicate[0].booking;
        assert.equal(duplicate[1].booking.id, first.id);
        assert.equal(first.total, 50000);
        assert.equal(first.status, "pending");
        assert.equal(
          (await fixture.db.select().from(rentalBookings)).length,
          1,
        );
        await assert.rejects(
          call("reservation", "renter-a", {
            ...body,
            note: "Different details",
          }),
          expectStatus(409),
        );
        await assert.rejects(
          call("booking-decision", "renter-b", {
            id: first.id,
            decision: "cancelled",
          }),
          expectStatus(404),
        );
        await assert.rejects(
          call("booking-decision", "other-supplier", {
            id: first.id,
            decision: "confirmed",
          }),
          expectStatus(404),
        );
        second = (
          await call("reservation", "renter-b", {
            listingId: listing.id,
            day,
            quantity: 1,
            note: "Second request",
            idempotencyKey: randomUUID(),
          })
        ).booking;
      });
      await t.test(
        "concurrent confirmations cannot oversell a single unit",
        async () => {
          const results = await Promise.allSettled(
            [first, second].map((b) =>
              call("booking-decision", "supplier", {
                id: b.id,
                decision: "confirmed",
              }),
            ),
          );
          assert.equal(
            results.filter((r) => r.status === "fulfilled").length,
            1,
          );
          assert.equal(
            results.filter(
              (r) => r.status === "rejected" && expectStatus(409)(r.reason),
            ).length,
            1,
          );
          winner = results[0].status === "fulfilled" ? first : second;
          loser = winner.id === first.id ? second : first;
          assert.equal(
            (await call("marketplace", null)).listings[0].available,
            0,
          );
          const repeated = await call("booking-decision", "supplier", {
            id: winner.id,
            decision: "confirmed",
          });
          assert.equal(repeated.booking.status, "confirmed");
          await assert.rejects(
            call("booking-decision", winner.renterId, {
              id: winner.id,
              decision: "cancelled",
            }),
            expectStatus(409),
          );
          const cancelled = await call("booking-decision", loser.renterId, {
            id: loser.id,
            decision: "cancelled",
          });
          assert.equal(cancelled.booking.status, "cancelled");
        },
      );
      await t.test(
        "archiving preserves request snapshots and blocks new requests",
        async () => {
          await call("listing", "supplier", {
            operation: "archive",
            id: listing.id,
          });
          assert.equal((await call("marketplace", null)).listings.length, 0);
          await assert.rejects(
            call("reservation", "renter-a", {
              listingId: listing.id,
              day,
              quantity: 1,
              idempotencyKey: randomUUID(),
            }),
            expectStatus(404),
          );
          const history = await call("bookings", winner.renterId);
          assert.equal(history.bookings[0].contact, "supplier@example.invalid");
          assert.equal(history.bookings[0].status, "confirmed");
          assert.equal(
            (await call("supplier", "other-supplier")).bookings.length,
            0,
          );
        },
      );
    } finally {
      await fixture.close();
    }
  },
);
