import "server-only";

/** The extension calls the app from a chrome-extension:// origin, so those requests need CORS. */
export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowed = /^(chrome-extension|moz-extension|safari-web-extension):\/\/[\w-]+$/.test(origin);
  return allowed
    ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Max-Age": "600",
        Vary: "Origin",
      }
    : { Vary: "Origin" };
}

export const preflight = (req: Request) => new Response(null, { status: 204, headers: corsHeaders(req) });

export function withCors<T extends Response>(req: Request, res: T): T {
  for (const [k, v] of Object.entries(corsHeaders(req))) res.headers.set(k, v);
  return res;
}
