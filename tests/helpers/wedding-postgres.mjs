import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import net from "node:net";
import { promisify } from "node:util";

const execute = promisify(execFile);
const dbRequire = createRequire(import.meta.resolve("@acme/db/client"));
const driverRequire = createRequire(dbRequire.resolve("@vercel/postgres"));
export async function weddingSchemaSQL() {
  const { generateDrizzleJson, generateMigration } =
    dbRequire("drizzle-kit/api");
  const auth = await import("@acme/db/schema");
  const wedding = await import("@acme/db/weddings");
  const market = await import("@acme/db/wedding-marketplace");
  const previous = generateDrizzleJson({}, undefined, undefined, "snake_case");
  const current = generateDrizzleJson(
    { ...auth, ...wedding, ...market },
    undefined,
    undefined,
    "snake_case",
  );
  return generateMigration(previous, current);
}
export async function isolatedWeddingDatabase() {
  try {
    await execute("docker", ["info", "--format", "{{.ServerVersion}}"], {
      timeout: 20000,
    });
  } catch {
    throw new Error(
      "Integration checks require a running Docker Linux engine. No application database was contacted.",
    );
  }
  const name = `wedtopia-integration-${randomUUID()}`;
  let pool, server, closing;
  const sockets = new Set();
  function close() {
    return (closing ??= (async () => {
      try {
        if (pool)
          await Promise.race([
            pool.end().catch(() => {}),
            new Promise((resolve) => setTimeout(resolve, 3000)),
          ]);
        for (const socket of sockets) socket.destroy();
        if (server) {
          for (const client of server.clients) client.terminate();
          await Promise.race([
            new Promise((resolve) => server.close(resolve)),
            new Promise((resolve) => setTimeout(resolve, 3000)),
          ]);
        }
      } finally {
        // Only the unique container created by this fixture can be removed. It has no volumes.
        await execute("docker", ["rm", "--force", name], {
          timeout: 15000,
        }).catch(() => {});
      }
    })());
  }
  try {
    await execute(
      "docker",
      [
        "run",
        "--detach",
        "--rm",
        "--name",
        name,
        "--label",
        "wedtopia.integration=true",
        "--publish",
        "127.0.0.1::5432",
        "--env",
        "POSTGRES_HOST_AUTH_METHOD=trust",
        "--env",
        "POSTGRES_USER=wedtopia",
        "--env",
        "POSTGRES_DB=wedtopia_test",
        "postgres:17-alpine",
      ],
      { timeout: 120000 },
    );
    let ready = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        await execute(
          "docker",
          ["exec", name, "pg_isready", "-U", "wedtopia", "-d", "wedtopia_test"],
          { timeout: 5000 },
        );
        ready = true;
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
    if (!ready)
      throw new Error("The isolated PostgreSQL instance did not become ready.");
    const { stdout } = await execute("docker", ["port", name, "5432/tcp"], {
      timeout: 10000,
    });
    const match = /^127\.0\.0\.1:(\d+)\s*$/.exec(stdout);
    if (!match)
      throw new Error("The test database must be bound only to loopback.");
    const postgresPort = Number(match[1]);
    const { WebSocketServer } = driverRequire("ws");
    const { neonConfig } = driverRequire("@neondatabase/serverless");
    // The existing Vercel driver speaks PostgreSQL over WebSockets. This loopback-only
    // bridge lets the same driver test a disposable standard PostgreSQL container.
    server = new WebSocketServer({ host: "127.0.0.1", port: 0 });
    server.on("connection", (ws) => {
      const tcp = net.connect({ host: "127.0.0.1", port: postgresPort });
      sockets.add(tcp);
      ws.on("message", (bytes) => tcp.write(bytes));
      tcp.on("data", (bytes) => {
        if (ws.readyState === 1) ws.send(bytes);
      });
      tcp.on("error", () => ws.terminate());
      tcp.on("close", () => {
        sockets.delete(tcp);
        ws.close();
      });
      ws.on("close", () => tcp.destroy());
      ws.on("error", () => tcp.destroy());
    });
    await new Promise((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("No test WebSocket address.");
    neonConfig.wsProxy = () => `127.0.0.1:${address.port}/v2`;
    neonConfig.useSecureWebSocket = false;
    neonConfig.pipelineConnect = false;
    neonConfig.pipelineTLS = false;
    neonConfig.poolQueryViaFetch = false;
    const { createPool } = dbRequire("@vercel/postgres");
    pool = createPool({
      connectionString: `postgresql://wedtopia:fixture@localhost:${postgresPort}/wedtopia_test`,
      ssl: false,
      max: 6,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 1000,
    });
    for (const statement of await weddingSchemaSQL())
      await pool.query(statement);
    const { drizzle } = dbRequire("drizzle-orm/vercel-postgres");
    const schema = await import("@acme/db/schema");
    return {
      db: drizzle({ client: pool, schema, casing: "snake_case" }),
      close,
    };
  } catch (error) {
    await close();
    throw error;
  }
}
