import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";

const DECIMALS: Record<string, number> = { SOL: 9, USDC: 6, NGN: 2 };

/** Public receipt: masked phones, full amounts, no login required. */
function maskPhone(e164: string | null): string {
  if (!e164) return "—";
  const local = e164.startsWith("234") ? `0${e164.slice(3)}` : e164;
  return local.length >= 7 ? `${local.slice(0, 3)}…${local.slice(-3)}` : "…";
}

function shortAddr(addr: string | null): string {
  if (!addr) return "—";
  return addr.length > 12 ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : addr;
}

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { db } = getDb();
  const row = await db.query.transfer.findFirst({
    where: (t, { eq }) => eq(t.id, id),
  });
  if (!row) notFound();
  const decimals = DECIMALS[row.currency] ?? 2;
  const major = (row.amountMinor / 10 ** decimals).toLocaleString("en-US", {
    maximumFractionDigits: decimals,
  });
  const when = row.createdAt.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#F6F1E7",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <article
        style={{
          maxWidth: 520,
          width: "100%",
          background: "#fff",
          borderRadius: 24,
          overflow: "hidden",
          border: "1px solid #EAD9C2",
        }}
      >
        <header style={{ background: "#161009", padding: "32px 32px 28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                background: "#FC5800",
              }}
            />
            <span
              style={{
                color: "#fff",
                fontWeight: 700,
                letterSpacing: 4,
                fontSize: 20,
              }}
            >
              AMANA
            </span>
          </div>
          <h1
            style={{ color: "#fff", fontSize: 28, margin: "20px 0 0" }}
          >
            {row.status === "withdrawn" ? "Withdrawal receipt" : "Transfer receipt"}
          </h1>
        </header>
        <div style={{ padding: "8px 32px 32px" }}>
          <p style={{ fontSize: 44, fontWeight: 800, color: "#2A2118" }}>
            {major}{" "}
            <span style={{ color: "#FC5800", fontSize: 24 }}>{row.currency}</span>
          </p>
          {[
            ["From", maskPhone(row.senderPhone)],
            ["To", row.recipientPhone ? maskPhone(row.recipientPhone) : shortAddr(row.recipientAddress)],
            ["Transfer ID", shortAddr(row.id)],
            ["Date", when],
            ["Status", row.status === "withdrawn" ? "Settled on-chain" : "Completed"],
          ].map(([label, value]) => (
            <div
              key={label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "14px 0",
                borderBottom: "1px solid #EAD9C2",
              }}
            >
              <span style={{ color: "#8A7B66" }}>{label}</span>
              <strong style={{ color: "#2A2118" }}>{value}</strong>
            </div>
          ))}
          <p style={{ color: "#8A7B66", fontSize: 14, marginTop: 20 }}>
            Liability-matched on Solana devnet — reserve supply always equals
            total user balances per currency.
          </p>
        </div>
      </article>
    </main>
  );
}
