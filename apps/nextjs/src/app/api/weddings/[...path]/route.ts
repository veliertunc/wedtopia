import type { NextRequest } from "next/server";

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  if (path.length !== 1 || !["catalog", "models", "plans", "requests", "ai", "places", "transport"].includes(path[0]!)) return Response.json({ error: "Not found" }, { status: 404 });
  try {
    const base = process.env.WEDDINGS_GATEWAY_URL ?? "http://localhost:3001";
    const url = new URL(`/api/weddings/${path[0]}`, base);
    const response = await fetch(url, { method: request.method, headers: { "Content-Type": "application/json", cookie: request.headers.get("cookie") ?? "", ...(request.headers.has("origin") ? { origin: request.headers.get("origin")! } : {}), ...(request.headers.has("authorization") ? { authorization: request.headers.get("authorization")! } : {}) }, body: request.method === "GET" ? undefined : await request.text(), cache: "no-store", signal: AbortSignal.timeout(90000) });
    return new Response(response.body, { status: response.status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "The wedding gateway is offline. Your local plan is available; start the TanStack Start gateway to connect live services." }, { status: 503 }); }
}
export const GET = proxy;
export const POST = proxy;
