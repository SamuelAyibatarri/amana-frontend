import * as schema from "@/db/schema";
import { envString, getDb } from "@/lib/db";
import { signaturesEqual } from "@/lib/webhook";

/**
 * GET /api/transfers/history?phone=234...&limit=10 — recent transfers
 * involving the phone (sent, received, funded, withdrawn). Bot-guarded.
 * Phones unmasked here (chat layer masks); amounts in minor units.
 */
export async function GET(request: Request) {
  if (!signaturesEqual(request.headers.get("x-amana-secret") ?? "", envString("SHARED_SECRET"))) {
    return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const phone = (searchParams.get("phone") ?? "").replace(/\D/g, "");
  const limit = Math.min(
    Math.max(Number(searchParams.get("limit") ?? "10") || 10, 1),
    25,
  );
  if (!phone) {
    return Response.json({ ok: false, error: "Bad phone." }, { status: 400 });
  }
  const { db } = getDb();
  const person = await db.query.user.findFirst({
    where: (u, { eq }) => eq(u.email, `${phone}@amana.whatsapp`),
    columns: { id: true },
  });
  if (!person) {
    return Response.json({ ok: true, items: [] });
  }
  const rows = await db.query.transfer.findMany({
    where: (t, { eq, or }) =>
      or(eq(t.senderUserId, person.id), eq(t.recipientUserId, person.id)),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
    limit,
    columns: {
      id: true,
      senderUserId: true,
      recipientUserId: true,
      senderPhone: true,
      recipientPhone: true,
      recipientAddress: true,
      amountMinor: true,
      currency: true,
      status: true,
      createdAt: true,
    },
  });
  return Response.json({
    ok: true,
    items: rows.map(
      ({
        senderUserId,
        recipientUserId,
        createdAt,
        ...r
      }) => ({
        ...r,
        createdAt: createdAt.toISOString(),
        direction:
          recipientUserId === person.id && r.status !== "withdrawn"
            ? "in"
            : "out",
        self: senderUserId === person.id && recipientUserId === person.id,
      }),
    ),
  });
}
