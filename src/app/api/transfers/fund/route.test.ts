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
import { POST } from "./route";

const SECRET = "test-shared-secret";
const PHONE = "2348012345678";

function req(body: unknown, secret = SECRET): Request {
	return new Request("http://localhost/api/transfers/fund", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			"x-amana-secret": secret,
		},
		body: JSON.stringify(body),
	});
}

beforeEach(() => {
	process.env.SHARED_SECRET = SECRET;
	(globalThis as any).__FAKE_STORE = freshStore();
	storeOf().users.push({
		id: "u1",
		name: PHONE,
		email: `${PHONE}@amana.whatsapp`,
		emailVerified: false,
		createdAt: new Date(),
		updatedAt: new Date(),
	});
});

describe("POST /api/transfers/fund", () => {
	it("funds once: same reference twice is a duplicate no-op", async () => {
		const body = {
			phone: PHONE,
			amount: 0.5,
			currency: "SOL",
			reference: "amana-abc123",
		};
		const first: any = await (await POST(req(body))).json();
		expect(first.ok).toBe(true);
		expect(first.transferId).toBe("fund-amana-abc123");

		const second: any = await (await POST(req(body))).json();
		expect(second.ok).toBe(true);
		expect(second.duplicate).toBe(true);
		expect(storeOf().transfers).toHaveLength(1);
		expect(storeOf().transfers[0].amountMinor).toBe(500_000_000);
		expect(storeOf().transfers[0].senderPhone).toBe("PAYSTACK");
	});

	it("rejects bad secret with 401", async () => {
		const res = await POST(req({ phone: PHONE }, "wrong"));
		expect(res.status).toBe(401);
	});

	it("rejects missing fields with 400", async () => {
		const res = await POST(req({ phone: PHONE }));
		expect(res.status).toBe(400);
	});
});
