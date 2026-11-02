import { z } from "zod/v4";

import { and, desc, eq, inArray, sql } from "@acme/db";
import { db } from "@acme/db/client";

import type { BookingStatus } from "../../../../packages/api/src/weddings/marketplace";
import {
  availableUnits,
  bookingTotal,
  canTransition,
  liveCategories,
} from "../../../../packages/api/src/weddings/marketplace";
import {
  rentalBookings,
  rentalListings,
} from "../../../../packages/db/src/wedding-marketplace";

export class MarketplaceError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const daySchema = z.iso
  .date()
  .refine(
    (day) => day >= new Date().toISOString().slice(0, 10),
    "Choose today or a future date",
  );
const reply = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
const publicFields = {
  id: rentalListings.id,
  title: rentalListings.title,
  businessName: rentalListings.businessName,
  contact: rentalListings.contact,
  category: rentalListings.category,
  city: rentalListings.city,
  description: rentalListings.description,
  price: rentalListings.price,
  stock: rentalListings.stock,
  capacity: rentalListings.capacity,
  published: rentalListings.published,
  createdAt: rentalListings.createdAt,
};

export async function marketplace(
  action: string,
  userId: string | null,
  body: unknown,
  url: URL,
): Promise<Response> {
  if (action === "marketplace") {
    const day = daySchema.parse(url.searchParams.get("day"));
    const city = z
      .string()
      .max(100)
      .parse(url.searchParams.get("city") ?? "");
    const listings = await db
      .select(publicFields)
      .from(rentalListings)
      .where(
        city
          ? and(
              eq(rentalListings.published, true),
              eq(rentalListings.city, city),
            )
          : eq(rentalListings.published, true),
      )
      .orderBy(desc(rentalListings.createdAt))
      .limit(100);
    if (!listings.length) return reply({ listings: [], day });
    const booked = await db
      .select({
        listingId: rentalBookings.listingId,
        quantity: sql<number>`coalesce(sum(${rentalBookings.quantity}),0)::integer`,
      })
      .from(rentalBookings)
      .where(
        and(
          inArray(
            rentalBookings.listingId,
            listings.map((l) => l.id),
          ),
          eq(rentalBookings.day, day),
          eq(rentalBookings.status, "confirmed"),
        ),
      )
      .groupBy(rentalBookings.listingId);
    const counts = new Map(booked.map((b) => [b.listingId, b.quantity]));
    return reply({
      listings: listings.map((l) => ({
        ...l,
        available: availableUnits(l.stock, counts.get(l.id) ?? 0),
      })),
      day,
    });
  }
  if (!userId)
    throw new MarketplaceError(
      401,
      "Sign in to your account to manage rentals.",
    );
  if (action === "supplier") {
    const listings = await db
      .select()
      .from(rentalListings)
      .where(eq(rentalListings.ownerId, userId))
      .orderBy(desc(rentalListings.createdAt))
      .limit(100);
    const bookings = listings.length
      ? await db
          .select({ booking: rentalBookings })
          .from(rentalBookings)
          .innerJoin(
            rentalListings,
            eq(rentalBookings.listingId, rentalListings.id),
          )
          .where(eq(rentalListings.ownerId, userId))
          .orderBy(desc(rentalBookings.createdAt))
          .limit(100)
      : [];
    return reply({ listings, bookings: bookings.map((b) => b.booking) });
  }
  if (action === "bookings")
    return reply({
      bookings: await db
        .select()
        .from(rentalBookings)
        .where(eq(rentalBookings.renterId, userId))
        .orderBy(desc(rentalBookings.createdAt))
        .limit(100),
    });
  if (action === "listing") {
    const command = z
      .discriminatedUnion("operation", [
        z.object({
          operation: z.literal("create"),
          title: z.string().trim().min(3).max(120),
          businessName: z.string().trim().min(2).max(120),
          contact: z.string().trim().min(3).max(200),
          category: z.enum(liveCategories),
          city: z.string().trim().min(2).max(100),
          description: z.string().trim().min(20).max(2000),
          price: z.number().int().min(1).max(10000000),
          stock: z.number().int().min(1).max(10000),
          capacity: z.number().int().min(1).max(10000),
        }),
        z.object({ operation: z.enum(["publish", "archive"]), id: z.uuid() }),
      ])
      .parse(body);
    if (command.operation === "create") {
      const { operation: _, ...values } = command;
      const [listing] = await db
        .insert(rentalListings)
        .values({ ...values, ownerId: userId })
        .returning();
      return reply({ listing }, 201);
    }
    const [listing] = await db
      .update(rentalListings)
      .set({ published: command.operation === "publish" })
      .where(
        and(
          eq(rentalListings.id, command.id),
          eq(rentalListings.ownerId, userId),
        ),
      )
      .returning();
    if (!listing)
      throw new MarketplaceError(
        404,
        "Rental not found in your supplier account.",
      );
    return reply({ listing });
  }
  if (action === "reservation") {
    const input = z
      .object({
        listingId: z.uuid(),
        day: daySchema,
        quantity: z.number().int().min(1).max(10000),
        note: z.string().trim().max(1000).default(""),
        idempotencyKey: z.uuid(),
      })
      .parse(body);
    const [existing] = await db
      .select()
      .from(rentalBookings)
      .where(
        and(
          eq(rentalBookings.renterId, userId),
          eq(rentalBookings.idempotencyKey, input.idempotencyKey),
        ),
      );
    if (existing) {
      if (
        existing.listingId !== input.listingId ||
        existing.day !== input.day ||
        existing.quantity !== input.quantity ||
        existing.note !== input.note
      )
        throw new MarketplaceError(
          409,
          "This request key was already used for different rental details.",
        );
      return reply({ booking: existing });
    }
    const [listing] = await db
      .select()
      .from(rentalListings)
      .where(
        and(
          eq(rentalListings.id, input.listingId),
          eq(rentalListings.published, true),
        ),
      );
    if (!listing)
      throw new MarketplaceError(404, "This rental is no longer published.");
    if (listing.ownerId === userId)
      throw new MarketplaceError(400, "You cannot request your own rental.");
    if (input.quantity > listing.stock)
      throw new MarketplaceError(
        409,
        "Requested quantity exceeds this rental's stock.",
      );
    if (listing.price * input.quantity > 2000000000)
      throw new MarketplaceError(
        400,
        "This request exceeds the supported rental amount.",
      );
    const total = bookingTotal(listing.price, input.quantity);
    await db
      .insert(rentalBookings)
      .values({
        listingId: listing.id,
        renterId: userId,
        idempotencyKey: input.idempotencyKey,
        day: input.day,
        quantity: input.quantity,
        unitPrice: listing.price,
        total,
        title: listing.title,
        businessName: listing.businessName,
        contact: listing.contact,
        note: input.note,
      })
      .onConflictDoNothing();
    const [booking] = await db
      .select()
      .from(rentalBookings)
      .where(
        and(
          eq(rentalBookings.renterId, userId),
          eq(rentalBookings.idempotencyKey, input.idempotencyKey),
        ),
      );
    if (
      !booking ||
      booking.listingId !== input.listingId ||
      booking.day !== input.day ||
      booking.quantity !== input.quantity ||
      booking.note !== input.note
    )
      throw new MarketplaceError(
        409,
        "This request key is already in use. Refresh your requests before retrying.",
      );
    return reply({ booking }, 201);
  }
  if (action === "booking-decision") {
    const input = z
      .object({
        id: z.uuid(),
        decision: z.enum(["confirmed", "declined", "cancelled"]),
      })
      .parse(body);
    const booking = await db.transaction(async (tx) => {
      // Every transition for one rental locks its inventory row first, serializing stock checks.
      const [lookup] = await tx
        .select({ listingId: rentalBookings.listingId })
        .from(rentalBookings)
        .where(eq(rentalBookings.id, input.id));
      if (!lookup) throw new MarketplaceError(404, "Request not found.");
      const [listing] = await tx
        .select()
        .from(rentalListings)
        .where(eq(rentalListings.id, lookup.listingId))
        .for("update");
      const [current] = await tx
        .select()
        .from(rentalBookings)
        .where(eq(rentalBookings.id, input.id))
        .for("update");
      if (!listing || !current)
        throw new MarketplaceError(404, "Request not found.");
      const actor = input.decision === "cancelled" ? "renter" : "supplier";
      if ((actor === "renter" ? current.renterId : listing.ownerId) !== userId)
        throw new MarketplaceError(404, "Request not found in your account.");
      if (current.status === input.decision) return current;
      if (
        !canTransition(current.status as BookingStatus, input.decision, actor)
      )
        throw new MarketplaceError(
          409,
          "This request is no longer pending. Confirmed reservations need an agreed cancellation with the supplier.",
        );
      if (input.decision === "confirmed") {
        if (current.day < new Date().toISOString().slice(0, 10))
          throw new MarketplaceError(409, "Past dates cannot be confirmed.");
        const [count] = await tx
          .select({
            units: sql<number>`coalesce(sum(${rentalBookings.quantity}),0)::integer`,
          })
          .from(rentalBookings)
          .where(
            and(
              eq(rentalBookings.listingId, listing.id),
              eq(rentalBookings.day, current.day),
              eq(rentalBookings.status, "confirmed"),
            ),
          );
        if (availableUnits(listing.stock, count?.units ?? 0) < current.quantity)
          throw new MarketplaceError(
            409,
            "There is no longer enough stock on this date.",
          );
      }
      const [saved] = await tx
        .update(rentalBookings)
        .set({ status: input.decision })
        .where(eq(rentalBookings.id, current.id))
        .returning();
      return saved;
    });
    return reply({ booking });
  }
  throw new MarketplaceError(404, "Marketplace action not found.");
}
