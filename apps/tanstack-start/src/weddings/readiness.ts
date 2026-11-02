import type {
  DatabaseReadiness,
  SchemaColumn,
} from "@acme/api/weddings/readiness";
import {
  assessDatabaseReadiness,
  weddingSchemaColumns,
} from "@acme/api/weddings/readiness";
import { sql } from "@acme/db";
import { db } from "@acme/db/client";

let cached: { until: number; result: Promise<DatabaseReadiness> } | undefined;
export async function weddingReadiness(): Promise<Response> {
  if (!cached || cached.until < Date.now()) {
    cached = {
      until: Date.now() + 10000,
      result: assessDatabaseReadiness(!!process.env.POSTGRES_URL, async () => {
        const tables = Object.keys(weddingSchemaColumns);
        const result = await db.execute(
          sql`select table_name, column_name from information_schema.columns where table_schema = current_schema() and table_name in (${sql.join(
            tables.map((name) => sql`${name}`),
            sql`, `,
          )})`,
        );
        return result.rows as unknown as SchemaColumn[];
      }),
    };
  }
  const status = await cached.result;
  return Response.json(status, {
    status: status.ready ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
