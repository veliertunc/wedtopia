import { createFileRoute } from "@tanstack/react-router";

import { gateway } from "../../weddings/gateway";

export const Route = createFileRoute("/api/weddings/$")({
  server: {
    handlers: {
      GET: ({ request }) => gateway(request),
      POST: ({ request }) => gateway(request),
    },
  },
});
