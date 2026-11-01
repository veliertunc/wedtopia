import { pgTable, check, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { user } from "./auth-schema";

export const weddingPlans = pgTable("wedding_plans", t => ({
  id: t.uuid().primaryKey().defaultRandom(),
  userId: t.text().notNull().references(() => user.id, { onDelete: "cascade" }),
  data: t.jsonb().notNull(),
  createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
}));
// Requests, not confirmed bookings: vendors must confirm inventory and dates.
export const weddingRequests = pgTable("wedding_requests", t => ({
  id: t.uuid().primaryKey().defaultRandom(),
  userId: t.text().notNull().references(() => user.id, { onDelete: "cascade" }),
  idempotencyKey: t.uuid().notNull(),
  plan: t.jsonb().notNull(),
  total: t.integer().notNull(),
  status: t.text().default("pending_supplier_confirmation").notNull(),
  createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
}), t => [uniqueIndex("wedding_request_idempotency").on(t.userId, t.idempotencyKey), check("wedding_total_positive", sql`${t.total} > 0`)]);
export const weddingAiUsage = pgTable("wedding_ai_usage", t => ({
  model: t.text().primaryKey(),
  calls: t.integer().default(0).notNull(),
}));
