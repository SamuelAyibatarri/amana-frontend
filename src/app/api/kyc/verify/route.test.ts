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

vi.mock("@/lib/auth", () => ({ getAuthInstance: vi.fn() }));

import { getAuthInstance } from "@/lib/auth";
import { freshStore, storeOf } from "@/test/fake";
import { POST } from "./route";

const mockAuth = vi.mocked(getAuthInstance);

function session(uid = "u1") {
	return {
		user: { id: uid, email: "2348012345678@amana.whatsapp" },
	};
}

function req(body: unknown): Request {
	return new Request("http://localhost/api/kyc/verify", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body),
	});
}

beforeEach(() => {
	process.env.AZURE_BACKEND_URL = "";
	process.env.KYC_WEBHOOK_URL = "";
	(globalThis as any).__FAKE_STORE = freshStore();
	storeOf().users.push({ id: "u1", name: "2348012345678", email: "2348012345678@amana.whatsapp" });
	mockAuth.mockResolvedValue({
		api: { getSession: async () => session() },
	} as any);
});

describe("POST /api/kyc/verify", () => {
	it("requires a session (401)", async () => {
		mockAuth.mockResolvedValue({
			api: { getSession: async () => null },
		} as any);
		const res = await POST(req({ bvn: "12345678901", nin: "98765432109", fullName: "Ada Lovelace" }));
		expect(res.status).toBe(401);
	});

	it("rejects bad input with 400", async () => {
		const empty = await POST(req({ fullName: "Ada Lovelace" }));
		expect(empty.status).toBe(400);
		const nameless = await POST(
			req({ bvn: "12345678901", nin: "98765432109", fullName: "X" }),
		);
		expect(nameless.status).toBe(400);
		expect(storeOf().kycProfiles).toHaveLength(0);
	});

	it("verifies 11-digit IDs and stores last4 only", async () => {
		const res: any = await (
			await POST(
				req({ bvn: "12345678901", nin: "98765432109", fullName: "Ada Lovelace" }),
			)
		).json();
		expect(res.ok).toBe(true);
		expect(res.status).toBe("verified");
		expect(storeOf().kycProfiles).toHaveLength(1);
		expect(storeOf().kycProfiles[0]).toMatchObject({
			userId: "u1",
			bvn: "8901",
			nin: "2109",
			status: "verified",
		});
		expect(storeOf().users[0].name).toBe("Ada Lovelace");
	});

	it("second verify overwrites (upsert, still one row)", async () => {
		await POST(
			req({ bvn: "12345678901", nin: "98765432109", fullName: "Ada Lovelace" }),
		);
		const res: any = await (
			await POST(
				req({ bvn: "11111111111", nin: "22222222222", fullName: "Grace Hopper" }),
			)
		).json();
		expect(res.status).toBe("verified");
		expect(storeOf().kycProfiles).toHaveLength(1);
		expect(storeOf().kycProfiles[0]).toMatchObject({ bvn: "1111", nin: "2222" });
		expect(storeOf().users[0].name).toBe("Grace Hopper");
	});
});
