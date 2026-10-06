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

vi.mock("@/lib/settle", () => ({ delegateSettle: vi.fn(async () => true) }));

import { delegateSettle } from "@/lib/settle";
import { freshStore, storeOf } from "@/test/fake";
import { POST } from "./route";

const mockSettle = vi.mocked(delegateSettle);
const SECRET = "test-shared-secret";
const PHONE = "2348012345678";

function paymeta(ref: string) {
	return JSON.stringify({ kind: "buy", phone: PHONE, asset: "SOL" });
}

function seedTwoPending() {
	const S = storeOf();
	S.users.push({ id: "u1", email: `${PHONE}@amana.whatsapp` });
	S.payments.push(
		{
			id: "p-old",
			userId: "u1",
			reference: "amana-old",
			email: "x@y.z",
			amount: 10000,
			currency: "NGN",
			status: "pending",
			metadata: paymeta("amana-old"),
			createdAt: new Date("2026-01-01T00:00:00.000Z"),
			updatedAt: new Date("2026-01-01T00:00:00.000Z"),
		},
		{
			id: "p-new",
			userId: "u1",
			reference: "amana-new",
			email: "x@y.z",
			amount: 20000,
			currency: "NGN",
			status: "pending",
			metadata: paymeta("amana-new"),
			createdAt: new Date("2026-06-01T00:00:00.000Z"),
			updatedAt: new Date("2026-06-01T00:00:00.000Z"),
		},
	);
}

function botReq(): Request {
	return new Request("http://localhost/api/payments/check", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			"x-amana-secret": SECRET,
		},
		body: JSON.stringify({ phone: PHONE }),
	});
}

beforeEach(() => {
	process.env.SHARED_SECRET = SECRET;
	process.env.PAYSTACK_SECRET_KEY = "sk_test_fake0123456789";
	(globalThis as any).__FAKE_STORE = freshStore();
	mockSettle.mockClear().mockResolvedValue(true);
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => ({
			json: async () => ({ status: true, data: { status: "success" } }),
		}) as any),
	);
});

describe("POST /api/payments/check", () => {
	it("settles the newest pending (latest-pending selection)", async () => {
		seedTwoPending();
		const res: any = await (await POST(botReq())).json();
		expect(res).toMatchObject({ ok: true, settled: true });
		expect(mockSettle).toHaveBeenCalledTimes(1);
		expect(mockSettle.mock.calls[0]![0]).toBe("amana-new");
		const now = storeOf().payments.find((p) => p.reference === "amana-new");
		expect(now.status).toBe("completed");
		expect(storeOf().payments.find((p) => p.reference === "amana-old").status).toBe(
			"pending",
		);
	});

	it("never re-settles: second check reports no-pending, settle still once", async () => {
		const S = storeOf();
		S.users.push({ id: "u1", email: `${PHONE}@amana.whatsapp` });
		S.payments.push({
			id: "p1",
			userId: "u1",
			reference: "amana-solo",
			email: "x@y.z",
			amount: 10000,
			currency: "NGN",
			status: "pending",
			metadata: paymeta("amana-solo"),
			createdAt: new Date("2026-01-01T00:00:00.000Z"),
			updatedAt: new Date("2026-01-01T00:00:00.000Z"),
		});
		await POST(botReq());
		const fetchCalls = (fetch as any).mock.calls.length;
		expect(fetchCalls).toBe(1);

		const second: any = await (await POST(botReq())).json();
		expect(second.settled).toBe(false);
		expect(second.reason).toBe("no-pending");
		expect(mockSettle).toHaveBeenCalledTimes(1);
		expect((fetch as any).mock.calls.length).toBe(1);
	});

	it("reports no-pending when nothing is owed", async () => {
		storeOf().users.push({ id: "u1", email: `${PHONE}@amana.whatsapp` });
		const res: any = await (await POST(botReq())).json();
		expect(res).toMatchObject({ ok: true, settled: false, reason: "no-pending" });
		expect(mockSettle).not.toHaveBeenCalled();
	});

	it("reports not-paid when Paystack disagrees", async () => {
		seedTwoPending();
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => ({
				json: async () => ({ status: true, data: { status: "abandoned" } }),
			}) as any),
		);
		const res: any = await (await POST(botReq())).json();
		expect(res).toMatchObject({ ok: true, settled: false, reason: "not-paid" });
		expect(mockSettle).not.toHaveBeenCalled();
	});
});
