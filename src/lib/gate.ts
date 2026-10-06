import { headers } from "next/headers";
import { getAuthInstance } from "@/lib/auth";
import { getDb } from "@/lib/db";

export interface Viewer {
  userId: string;
  kycStatus: string;
}

/**
 * Server-side viewer resolution for route guards (single source of
 * truth — every gated page asks here, never inline). Returns null when
 * signed out, otherwise the user id + KYC status (default "pending").
 */
export async function getViewer(): Promise<Viewer | null> {
  const auth = await getAuthInstance();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  try {
    const { db } = getDb();
    const profile = await db.query.kycProfile.findFirst({
      where: (k, { eq }) => eq(k.userId, session.user.id),
      columns: { status: true },
    });
    return { userId: session.user.id, kycStatus: profile?.status ?? "pending" };
  } catch {
    return { userId: session.user.id, kycStatus: "pending" };
  }
}
