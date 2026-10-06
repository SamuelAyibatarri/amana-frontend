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

import { PIN_LOCK_MS } from "@/lib/pin";
import { freshStore, storeOf } from "@/test/fake";
import { POST } from "./route";

const SECRET = "test-shared-secret";
const PHONE = "2348012345678";

function req(body: unknown, secret = SECRET): Request {
	return new Request("http://localhost/api/pin/verify", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			"x-amana-secret": secret,
		},
		body: JSON.stringify(body),
	});
}

beforeEach(async () => {
	process.env.SHARED_SECRET = SECRET;
	process.env.PIN_PEPPER = process.env.PIN_PEPPER || "test-pepper-please-change-1234567890";
	(globalThis as any).__FAKE_STORE = freshStore();
	const { hashPin } = await import("@/lib/pin");
	storeOf().users.push(
		{
			id: "u1",
			email: `${PHONE}@amana.whatsapp`,
			pinHash: await hashPin("1234", "u1"),
			pinAttempts: 0,
			pinLockedUntil: null,
		},
		{ id: "u2", email: "2348099999999@amana.whatsapp", pinHash: null },
	);
});

describe("POST /api/pin/verify", () => {
	it("verifies the correct PIN", async () => {
		const res: any = await (await POST(req({ phone: PHONE, pin: "1234" }))).json();
		expect(res).toEqual({ ok: true, verified: true });
	});

	it("locks after 5 wrong attempts with a 15min window, then refuses correct PIN", async () => {
		for (let i = 0; i < 4; i++) {
			const r: any = await (
				await POST(req({ phone: PHONE, pin: "9999" }))
			).json();
			expect(r.locked).toBe(false);
		}
		const fifth: any = await (
			await POST(req({ phone: PHONE, pin: "9999" }))
		).json();
		expect(fifth).toEqual({ ok: false, locked: true });

		const lockedUntil = storeOf().users[0].pinLockedUntil as Date;
		const delta = lockedUntil.getTime() - Date.now();
		expect(delta).toBeGreaterThan(PIN_LOCK_MS - 60_000);
		expect(delta).toBeLessThanOrEqual(PIN_LOCK_MS);

		const after: any = await (
			await POST(req({ phone: PHONE, pin: "1234" }))
		).json();
		expect(after).toEqual({ ok: false, locked: true });
	});

	it("reports noPin when unset", async () => {
		const res: any = await (
			await POST(req({ phone: "2348099999999", pin: "1234" }))
		).json();
		expect(res).toEqual({ ok: false, noPin: true });
	});

	it("rejects bad secret with 401", async () => {
		const res = await POST(req({ phone: PHONE, pin: "1234" }, "wrong"));
		expect(res.status).toBe(401);
	});
});
