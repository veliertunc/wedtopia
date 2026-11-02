import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const flags = process.argv.slice(2);
if (flags.some((flag) => flag !== "--prepare-only"))
  throw new Error("Supported option: --prepare-only");
const modules = path.join(root, "node_modules", ".pnpm");
const tsx = (await readdir(modules)).find((name) => name.startsWith("tsx@"));
if (!tsx)
  throw new Error(
    "Install the repository's locked development dependencies first (tsx is already in the lockfile).",
  );
const loader = path.join(
  modules,
  tsx,
  "node_modules",
  "tsx",
  "dist",
  "loader.mjs",
);
const target = flags.includes("--prepare-only")
  ? "tests/helpers/check-wedding-schema.mjs"
  : "tests/weddings.integration.mjs";
// A sentinel prevents this isolated test process from ever using a real application database.
const child = spawn(
  process.execPath,
  [
    "--import",
    pathToFileURL(loader).href,
    ...(flags.includes("--prepare-only") ? [] : ["--test"]),
    target,
  ],
  {
    cwd: root,
    stdio: "inherit",
    shell: false,
    env: {
      ...process.env,
      POSTGRES_URL: "postgresql://fixture:fixture@localhost:1/wedtopia_test",
    },
  },
);
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
