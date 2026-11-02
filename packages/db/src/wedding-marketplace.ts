import { sql } from "drizzle-orm";
import { check, index, pgTable, uniqueIndex } from "drizzle-orm/pg-core";

import { user } from "./auth-schema";

export const rentalListings = pgTable(
  "wedding_rental_listings",
  (t) => ({
    id: t.uuid().primaryKey().defaultRandom(),
    ownerId: t
      .text()
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    title: t.text().notNull(),
    businessName: t.text().notNull(),
    contact: t.text().notNull(),
    category: t.text().notNull(),
    city: t.text().notNull(),
    description: t.text().notNull(),
    price: t.integer().notNull(),
    stock: t.integer().notNull(),
    capacity: t.integer().notNull(),
    published: t.boolean().default(false).notNull(),
    createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
  }),
  (t) => [
    check("listing_price_positive", sql`${t.price} > 0`),
    check("listing_stock_positive", sql`${t.stock} > 0`),
    check("listing_capacity_positive", sql`${t.capacity} > 0`),
    index("listing_discovery").on(t.published, t.city),
  ],
);
export const rentalBookings = pgTable(
  "wedding_rental_bookings",
  (t) => ({
    id: t.uuid().primaryKey().defaultRandom(),
    listingId: t
      .uuid()
      .notNull()
      .references(() => rentalListings.id, { onDelete: "restrict" }),
    renterId: t
      .text()
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    idempotencyKey: t.uuid().notNull(),
    day: t.date({ mode: "string" }).notNull(),
    quantity: t.integer().notNull(),
    unitPrice: t.integer().notNull(),
    total: t.integer().notNull(),
    title: t.text().notNull(),
    businessName: t.text().notNull(),
    contact: t.text().notNull(),
    note: t.text().notNull(),
    status: t.text().default("pending").notNull(),
    createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
  }),
  (t) => [
    uniqueIndex("rental_booking_idempotency").on(t.renterId, t.idempotencyKey),
    index("rental_booking_day").on(t.listingId, t.day, t.status),
    check("rental_booking_quantity", sql`${t.quantity} > 0`),
    check(
      "rental_booking_amount",
      sql`${t.total} = ${t.unitPrice} * ${t.quantity} AND ${t.unitPrice} > 0`,
    ),
    check(
      "rental_booking_status",
      sql`${t.status} IN ('pending','confirmed','declined','cancelled')`,
    ),
  ],
);
