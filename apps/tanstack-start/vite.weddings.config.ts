import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

// An additive launch configuration keeps the starter's config and generated tree intact.
export default defineConfig({
  server: { port: 3001 },
  plugins: [
    {
      name: "wedtopia-route-tree",
      enforce: "pre",
      transform(source, id) {
        if (id.replaceAll("\\", "/").split("?")[0]?.endsWith("/src/router.tsx"))
          return source.replace(
            '"./routeTree.gen"',
            '"./weddings-routeTree.gen"',
          );
      },
    },
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    nitro(),
    tanstackStart({
      router: { generatedRouteTree: "weddings-routeTree.gen.ts" },
    }),
    viteReact(),
    tailwindcss(),
  ],
});
