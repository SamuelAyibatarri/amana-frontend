import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", async () => {
	const fake = await import("@/test/fake");
	return {
		envString: (k: string, fb = "") => (process.env[k] ?? fb) as string,
		getDb: () => ({
			db: fake.makeDb(fake.storeOf()),
			env: process.env as any,
		}),
		getEnv: () => process.env as any,
	};
});

vi.mock("drizzle-orm", async () => {
	const fake = await import("@/test/fake");
	return { eq: fake.eq, and: fake.and, desc: fake.desc, sql: fake.sql };
});

import { freshStore, storeOf } from "@/test/fake";
import { GET } from "./route";

const SECRET = "test-shared-secret";

function req(phone: string, secret = SECRET): Request {
	return new Request(
		`http://localhost/api/transfers/balance?phone=${encodeURIComponent(phone)}`,
		{ headers: { "x-amana-secret": secret } },
	);
}

function t(row: Record<string, unknown>) {
	return {
		id: `t-${Math.random().toString(36).slice(2)}`,
		status: "completed",
		createdAt: new Date(),
		updatedAt: new Date(),
		...row,
	};
}

beforeEach(() => {
	process.env.SHARED_SECRET = SECRET;
	(globalThis as any).__FAKE_STORE = freshStore();
	storeOf().users.push(
		{ id: "u1", email: "2348012345678@amana.whatsapp" },
		{ id: "u2", email: "2348099999999@amana.whatsapp" },
		{ id: "u3", email: "2348077777777@amana.whatsapp" },
	);
	const S = storeOf();
	// u1: SOL in 2.0, out 0.5, withdrawn 0.3 → net 1.2
	S.transfers.push(
		t({ senderUserId: null, recipientUserId: "u1", senderPhone: "PAYSTACK", amountMinor: 2_000_000_000, currency: "SOL" }),
		t({ senderUserId: "u1", recipientUserId: "u2", senderPhone: "2348012345678", amountMinor: 500_000_000, currency: "SOL" }),
		t({ senderUserId: "u1", recipientUserId: "u2", senderPhone: "2348012345678", amountMinor: 300_000_000, currency: "SOL", status: "withdrawn" }),
		t({ senderUserId: null, recipientUserId: "u1", senderPhone: "PAYSTACK", amountMinor: 100_000_000, currency: "USDC" }),
		t({ senderUserId: "u1", recipientUserId: "u2", senderPhone: "2348012345678", amountMinor: 25_000_000, currency: "USDC" }),
	);
	// u3: overdrawn → clamps to zero
	S.transfers.push(
		t({ senderUserId: null, recipientUserId: "u3", senderPhone: "PAYSTACK", amountMinor: 100, currency: "SOL" }),
		t({ senderUserId: "u3", recipientUserId: "u2", senderPhone: "2348077777777", amountMinor: 500, currency: "SOL" }),
	);
});

describe("GET /api/transfers/balance", () => {
	it("nets inbound minus outbound per currency", async () => {
		const res: any = await (await GET(req("2348012345678"))).json();
		expect(res.ok).toBe(true);
		expect(res.balances.SOL).toBe(1_200_000_000);
		expect(res.balances.USDC).toBe(75_000_000);
		expect(res.balances.NGN).toBe(0);
	});

	it("clamps negative nets to zero", async () => {
		const res: any = await (await GET(req("2348077777777"))).json();
		expect(res.balances.SOL).toBe(0);
	});

	it("returns zeros for unknown phone", async () => {
		const res: any = await (await GET(req("2348000000000"))).json();
		expect(res.ok).toBe(true);
		expect(res.balances).toEqual({ SOL: 0, USDC: 0, NGN: 0 });
	});
});
