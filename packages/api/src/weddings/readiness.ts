export const weddingSchemaColumns: Record<string, readonly string[]> = {
  user: ["id"],
  wedding_plans: ["id", "user_id", "data", "created_at"],
  wedding_requests: [
    "id",
    "user_id",
    "idempotency_key",
    "plan",
    "total",
    "status",
    "created_at",
  ],
  wedding_ai_usage: ["model", "calls"],
  wedding_rental_listings: [
    "id",
    "owner_id",
    "title",
    "business_name",
    "contact",
    "category",
    "city",
    "description",
    "price",
    "stock",
    "capacity",
    "published",
    "created_at",
  ],
  wedding_rental_bookings: [
    "id",
    "listing_id",
    "renter_id",
    "idempotency_key",
    "day",
    "quantity",
    "unit_price",
    "total",
    "title",
    "business_name",
    "contact",
    "note",
    "status",
    "created_at",
  ],
};
export interface SchemaColumn {
  table_name: string;
  column_name: string;
}
export type DatabaseState =
  | "ready"
  | "unconfigured"
  | "unavailable"
  | "migration_required";
export interface DatabaseReadiness {
  ready: boolean;
  state: DatabaseState;
  message: string;
}
export function missingWeddingColumns(columns: SchemaColumn[]): string[] {
  const present = new Set(
    columns.map((c) => `${c.table_name}.${c.column_name}`),
  );
  return Object.entries(weddingSchemaColumns).flatMap(([table, names]) =>
    names
      .filter((name) => !present.has(`${table}.${name}`))
      .map((name) => `${table}.${name}`),
  );
}
/** The public result never contains a connection string, provider error or schema names. */
export async function assessDatabaseReadiness(
  configured: boolean,
  probe: () => Promise<SchemaColumn[]>,
  timeoutMs = 8000,
): Promise<DatabaseReadiness> {
  if (!configured)
    return {
      ready: false,
      state: "unconfigured",
      message:
        "The rental service is being set up. Your inspiration plan is still available.",
    };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const columns = await Promise.race([
      probe(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Readiness timeout")),
          timeoutMs,
        );
      }),
    ]);
    if (missingWeddingColumns(columns).length)
      return {
        ready: false,
        state: "migration_required",
        message: "The rental service is being updated. Please try again later.",
      };
    return {
      ready: true,
      state: "ready",
      message: "The rental service is ready.",
    };
  } catch {
    return {
      ready: false,
      state: "unavailable",
      message:
        "The rental service is temporarily unavailable. Please try again later.",
    };
  } finally {
    clearTimeout(timer);
  }
}
