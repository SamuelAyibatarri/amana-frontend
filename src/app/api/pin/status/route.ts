import { getAuthInstance } from "@/lib/auth";
import { getDb } from "@/lib/db";

/** GET /api/pin/status — whether a transaction PIN is set. */
export async function GET(request: Request) {
  const auth = await getAuthInstance();
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  const { db } = getDb();
  const person = await db.query.user.findFirst({
    where: (u, { eq }) => eq(u.id, session.user.id),
    columns: { pinHash: true },
  });
  return Response.json({ ok: true, set: !!person?.pinHash });
}
