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
	return { eq: fake.eq, and: fake.and, desc: fake.desc, sql: fake.sql, gt: fake.gt };
});

const signInMagicLink = vi.fn();
vi.mock("@/lib/auth", () => ({
	getAuthInstance: async () => ({
		api: { signInMagicLink },
	}),
}));

import { freshStore, storeOf } from "@/test/fake";
import { POST } from "./route";

const SECRET = "test-shared-secret";
const PHONE = "2348012345678";

function req(body: unknown, secret = SECRET): Request {
	return new Request("http://localhost/api/auth/request-link", {
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
	signInMagicLink.mockReset();
	signInMagicLink.mockResolvedValue({ status: true });
});

describe("POST /api/auth/request-link", () => {
	it("401 without the bot secret", async () => {
		const res = await POST(req({ phone: PHONE }, "wrong"));
		expect(res.status).toBe(401);
		expect(signInMagicLink).not.toHaveBeenCalled();
	});

	it("400 on bad phone", async () => {
		for (const phone of ["123", "", "abcdef"]) {
			const res = await POST(req({ phone }));
			expect(res.status).toBe(400);
		}
		expect(signInMagicLink).not.toHaveBeenCalled();
	});

	it("mints with allowlisted callback and phone-derived email", async () => {
		const res = await POST(req({ phone: PHONE, callbackURL: "/kyc" }));
		expect(res.status).toBe(200);
		expect(signInMagicLink).toHaveBeenCalledTimes(1);
		expect(signInMagicLink.mock.calls[0][0].body).toEqual({
			email: `${PHONE}@amana.whatsapp`,
			callbackURL: "/kyc",
		});
	});

	it("defaults unlisted callbackURL to /dashboard (no open redirect)", async () => {
		const res = await POST(req({ phone: PHONE, callbackURL: "https://evil.example" }));
		expect(res.status).toBe(200);
		expect(signInMagicLink.mock.calls[0][0].body.callbackURL).toBe("/dashboard");
	});

	it("429 cooldown when a live link row exists", async () => {
		storeOf().verifications.push({
			id: "v1",
			identifier: `magic-link:${PHONE}@amana.whatsapp`,
			value: "token",
			expiresAt: new Date(Date.now() + 14 * 60 * 1000),
		});
		const res = await POST(req({ phone: PHONE }));
		expect(res.status).toBe(429);
		const body = (await res.json()) as { cooldown?: boolean; retryAfter?: number };
		expect(body.cooldown).toBe(true);
		expect(body.retryAfter).toBeGreaterThan(0);
		expect(signInMagicLink).not.toHaveBeenCalled();
	});

	it("expired rows do not trigger cooldown", async () => {
		storeOf().verifications.push({
			id: "v1",
			identifier: `magic-link:${PHONE}@amana.whatsapp`,
			value: "token",
			expiresAt: new Date(Date.now() - 1000),
		});
		const res = await POST(req({ phone: PHONE }));
		expect(res.status).toBe(200);
		expect(signInMagicLink).toHaveBeenCalledTimes(1);
	});

	it("relay failure returns 502 and strands no cooldown (retry succeeds)", async () => {
		signInMagicLink.mockRejectedValueOnce(new Error("WhatsApp delivery failed."));
		const fail = await POST(req({ phone: PHONE, callbackURL: "/kyc" }));
		expect(fail.status).toBe(502);
		const retry = await POST(req({ phone: PHONE, callbackURL: "/kyc" }));
		expect(retry.status).toBe(200);
		expect(signInMagicLink).toHaveBeenCalledTimes(2);
	});
});
