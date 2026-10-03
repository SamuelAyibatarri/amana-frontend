import { getAuthInstance } from "@/lib/auth";

// Proven bizzo-admin pattern: forward the raw Request to Better Auth.
// (Docs suggest toNextJsHandler; auth.handler(request) is equivalent and
// verified working on the OpenNext/Cloudflare runtime.)
export async function GET(request: Request) {
  const auth = await getAuthInstance();
  return auth.handler(request);
}

export async function POST(request: Request) {
  const auth = await getAuthInstance();
  return auth.handler(request);
}
