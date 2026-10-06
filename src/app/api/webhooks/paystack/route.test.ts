import { createHmac } from "node:crypto";
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
const PAYSTACK_SECRET = "sk_test_fake0123456789";

function signed(event: unknown, secret = PAYSTACK_SECRET): Request {
	const raw = JSON.stringify(event);
	const sig = createHmac("sha512", secret).update(raw).digest("hex");
	return new Request("http://localhost/api/webhooks/paystack", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			"x-paystack-signature": sig,
		},
		body: raw,
	});
}

function successEvent(ref: string) {
	return {
		event: "charge.success",
		data: {
			reference: ref,
			status: "success",
			channel: "card",
			paid_at: "2026-01-02T00:00:00.000Z",
		},
	};
}

beforeEach(() => {
	process.env.PAYSTACK_SECRET_KEY = PAYSTACK_SECRET;
	(globalThis as any).__FAKE_STORE = freshStore();
	mockSettle.mockClear().mockResolvedValue(true);
	storeOf().payments.push({
		id: "p1",
		userId: "u1",
		reference: "amana-xyz",
		email: "x@y.z",
		amount: 15000,
		currency: "NGN",
		status: "pending",
		channel: null,
		metadata: JSON.stringify({ kind: "buy", phone: "2348012345678", asset: "SOL" }),
		paidAt: null,
		createdAt: new Date(),
		updatedAt: new Date(),
	});
});

describe("POST /api/webhooks/paystack", () => {
	it("rejects bad signature with 401 and no write", async () => {
		const res = await POST(signed(successEvent("amana-xyz"), "wrong-secret"));
		expect(res.status).toBe(401);
		expect(storeOf().payments[0].status).toBe("pending");
		expect(mockSettle).not.toHaveBeenCalled();
	});

	it("completes pending on charge.success and settles once, replay is a no-op", async () => {
		const first: any = await (await POST(signed(successEvent("amana-xyz")))).json();
		expect(first).toMatchObject({ ok: true, matched: true, status: "completed" });
		expect(storeOf().payments[0].status).toBe("completed");
		expect(storeOf().payments[0].channel).toBe("card");
		expect(mockSettle).toHaveBeenCalledTimes(1);
		expect(mockSettle.mock.calls[0]![0]).toBe("amana-xyz");

		const replay: any = await (await POST(signed(successEvent("amana-xyz")))).json();
		expect(replay).toMatchObject({ ok: true, alreadyProcessed: true });
		expect(mockSettle).toHaveBeenCalledTimes(1);
	});

	it("acks unknown reference with 200 and no write", async () => {
		const res: any = await (
			await POST(signed(successEvent("amana-nope")))
		).json();
		expect(res).toMatchObject({ ok: true, matched: false });
		expect(storeOf().payments).toHaveLength(1);
		expect(mockSettle).not.toHaveBeenCalled();
	});

	it("acks non-charge events with 200 and no write", async () => {
		const res: any = await (
			await POST(
				signed({ event: "transfer.success", data: { reference: "amana-xyz" } }),
			)
		).json();
		expect(res.ok).toBe(true);
		expect(storeOf().payments[0].status).toBe("pending");
		expect(mockSettle).not.toHaveBeenCalled();
	});
});
