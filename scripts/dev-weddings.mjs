import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const root = fileURLToPath(new URL("../", import.meta.url));
const [major, minor] = process.versions.node.split(".").map(Number);
if (major !== 22 || minor < 21)
  throw new Error(
    "This repository requires Node 22.21 or newer within Node 22. Run this launcher with that runtime; no system installation will be changed.",
  );
const flags = process.argv.slice(2);
if (
  flags.some(
    (flag) => flag !== "--demo" && !/^--(web|gateway)-port=\d+$/.test(flag),
  )
)
  throw new Error("Options: --demo, --web-port=3000, --gateway-port=3001");
function port(name, fallback) {
  const matching = flags.filter((flag) => flag.startsWith(`--${name}-port=`));
  if (matching.length > 1) throw new Error(`Provide only one ${name} port.`);
  const value = matching.length ? Number(matching[0].split("=")[1]) : fallback;
  if (!Number.isInteger(value) || value < 1024 || value > 65535)
    throw new Error("Use a local port between 1024 and 65535.");
  return value;
}
const webPort = port("web", 3000),
  gatewayPort = port("gateway", 3001);
if (webPort === gatewayPort)
  throw new Error("Web and gateway ports must be different.");
const require = createRequire(import.meta.url);
const envRequire = createRequire(require.resolve("dotenv-cli/package.json"));
envRequire("dotenv").config({ path: path.join(root, ".env"), quiet: true });
const demo = flags.includes("--demo");
if (!demo) {
  const missing = [
    "POSTGRES_URL",
    "AUTH_SECRET",
    "AUTH_DISCORD_ID",
    "AUTH_DISCORD_SECRET",
  ].filter((key) => !process.env[key]);
  if (missing.length)
    throw new Error(
      `Complete your local environment first (${missing.join(", ")}), or use --demo for device-only inspiration planning.`,
    );
}
const webOrigin = `http://localhost:${webPort}`,
  gatewayOrigin = `http://localhost:${gatewayPort}`;
const allowed = new Set(
  (process.env.WEDDINGS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
for (const origin of [
  webOrigin,
  gatewayOrigin,
  `http://127.0.0.1:${webPort}`,
  `http://127.0.0.1:${gatewayPort}`,
])
  allowed.add(origin);
const environment = {
  ...process.env,
  NODE_PATH: [
    path.join(root, "tooling/tailwind/node_modules"),
    process.env.NODE_PATH,
  ]
    .filter(Boolean)
    .join(path.delimiter),
  WEDDINGS_GATEWAY_URL: gatewayOrigin,
  WEDDINGS_ALLOWED_ORIGINS: [...allowed].join(","),
};
// Framework workers may launch `node` by name; keep them on the same runtime too.
const pathKey = Object.keys(process.env).find(key => key.toLowerCase() === "path") ?? "PATH";
environment[pathKey] = [path.dirname(process.execPath), process.env[pathKey]].filter(Boolean).join(path.delimiter);
if (demo)
  Object.assign(environment, {
    CI: "1",
    POSTGRES_URL: "",
    WEDDINGS_AI_MODELS: "[]",
    GOOGLE_MAPS_API_KEY: "",
    WEDDINGS_ENABLE_SAMPLE_REQUESTS: "false",
  });
const definitions = [
  {
    name: "gateway",
    directory: "apps/tanstack-start",
    entry: "node_modules/vite/bin/vite.js",
    args: [
      "--config",
      "vite.weddings.config.ts",
      "--host",
      "127.0.0.1",
      "--port",
      String(gatewayPort),
      "--strictPort",
    ],
    port: gatewayPort,
  },
  {
    name: "web",
    directory: "apps/nextjs",
    entry: "node_modules/next/dist/bin/next",
    args: ["dev", "--hostname", "127.0.0.1", "--port", String(webPort)],
    port: webPort,
  },
];
for (const definition of definitions)
  if (!existsSync(path.join(root, definition.directory, definition.entry)))
    throw new Error(
      "Install the existing repository dependencies before starting Wedtopia.",
    );
console.log(
  `Starting Wedtopia: ${webOrigin}/weddings\nSupplier marketplace: ${webOrigin}/weddings/marketplace\nGateway: ${gatewayOrigin}`,
);
if (demo)
  console.log(
    "Demo mode: plans stay on this device. Live rentals, account storage and paid integrations are disabled.",
  );
const children = [];
let closing = false;
async function stop(code) {
  if (closing) return;
  closing = true;
  await Promise.all(
    children.map(async (child) => {
      if (!child.pid || child.exitCode !== null || child.signalCode !== null)
        return;
      if (process.platform === "win32")
        await promisify(execFile)(
          "taskkill",
          ["/PID", String(child.pid), "/T", "/F"],
          { windowsHide: true },
        ).catch(() => {});
      else child.kill("SIGTERM");
    }),
  );
  process.exit(code);
}
process.once("SIGINT", () => void stop(0));
process.once("SIGTERM", () => void stop(0));
for (const definition of definitions) {
  const child = spawn(
    process.execPath,
    [definition.entry, ...definition.args],
    {
      cwd: path.join(root, definition.directory),
      env: { ...environment, PORT: String(definition.port) },
      stdio: "inherit",
      shell: false,
      windowsHide: true,
    },
  );
  children.push(child);
  child.once("error", (error) => {
    console.error(`${definition.name} could not start: ${error.message}`);
    void stop(1);
  });
  child.once("exit", (code) => {
    if (!closing) void stop(code ?? 1);
  });
}
