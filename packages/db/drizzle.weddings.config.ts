import type { Config } from "drizzle-kit";
if (!process.env.POSTGRES_URL) throw new Error("Set POSTGRES_URL before running migrations");
export default {
  schema: ["./src/schema.ts", "./src/weddings.ts"],
  out: "./drizzle-weddings", dialect: "postgresql", casing: "snake_case",
  dbCredentials: { url: process.env.POSTGRES_URL.replace(":6543", ":5433") .replace(":5433", ":5432") },
} satisfies Config;
