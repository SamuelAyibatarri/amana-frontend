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
	return {
		eq: fake.eq,
		and: fake.and,
		or: (fake as any).or,
		desc: fake.desc,
		sql: fake.sql,
		gt: fake.gt,
	};
});

import { freshStore, storeOf } from "@/test/fake";
import { POST as createPOST } from "./create/route";
import { POST as respondPOST } from "./respond/route";
import { POST as cancelPOST } from "./cancel/route";
import { POST as settingsPOST } from "./settings/route";
import { POST as sweepPOST } from "./sweep/route";
import { POST as minePOST } from "./mine/route";

const SECRET = "test-shared-secret";
const A = "2348011111111"; // requester
const B = "2348022222222"; // recipient

function req(path: string, body: unknown, secret = SECRET): Request {
	return new Request(`http://localhost${path}`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			"x-amana-secret": secret,
		},
		body: JSON.stringify(body),
	});
}

function seedVerified(phone: string, id: string) {
	storeOf().users.push({
		id,
		name: phone,
		email: `${phone}@amana.whatsapp`,
		emailVerified: false,
		requestPrivacy: "contacts",
		createdAt: new Date(),
		updatedAt: new Date(),
	});
	storeOf().kycProfiles.push({ id: `k-${id}`, userId: id, status: "verified" });
}

function seedTransfer(from: string, to: string) {
	storeOf().transfers.push({
		id: `t-${from}-${to}`,
		senderUserId: from,
		recipientUserId: to,
		senderPhone: "x",
		recipientPhone: "y",
		amountMinor: 100,
		currency: "USDC",
		status: "completed",
	});
}

beforeEach(() => {
	process.env.SHARED_SECRET = SECRET;
	(globalThis as any).__FAKE_STORE = freshStore();
});

const CREATE = {
	requesterPhone: A,
	recipientPhone: B,
	amountMinor: 3_676_000,
	currency: "USDC",
	sendNgn: 5000,
};

describe("POST /api/requests/create", () => {
	it("401 without secret, 400 on bad input", async () => {
		expect((await createPOST(req("/api/requests/create", CREATE, "nope"))).status).toBe(401);
		expect((await createPOST(req("/api/requests/create", { ...CREATE, amountMinor: -1 }))).status).toBe(400);
		expect((await createPOST(req("/api/requests/create", { ...CREATE, requesterPhone: A, recipientPhone: A }))).status).toBe(400);
	});

	it("403 when requester unverified", async () => {
		seedVerified(B, "uB");
		storeOf().users.push({ id: "uA", email: `${A}@amana.whatsapp`, requestPrivacy: "contacts" });
		const res = await createPOST(req("/api/requests/create", CREATE));
		expect(res.status).toBe(403);
	});

	it("contacts-default stranger is refused silently", async () => {
		seedVerified(A, "uA");
		seedVerified(B, "uB");
		const res = await createPOST(req("/api/requests/create", CREATE));
		const body = (await res.json()) as any;
		expect(body.allowed).toBe(false);
		expect(storeOf().moneyRequests).toHaveLength(0);
	});

	it("prior transfer makes them contacts → allowed with flag", async () => {
		seedVerified(A, "uA");
		seedVerified(B, "uB");
		seedTransfer("uA", "uB");
		const res = await createPOST(req("/api/requests/create", CREATE));
		const body = (await res.json()) as any;
		expect(body.allowed).toBe(true);
		expect(body.contactKnown).toBe(true);
		expect(storeOf().moneyRequests).toHaveLength(1);
	});

	it("blocked recipient is refused (reason never reveals block)", async () => {
		seedVerified(A, "uA");
		seedVerified(B, "uB");
		seedTransfer("uA", "uB");
		storeOf().requestBlocks.push({ id: "b1", blockerUserId: "uB", blockedPhone: A });
		const res = await createPOST(req("/api/requests/create", CREATE));
		const body = (await res.json()) as any;
		expect(body.allowed).toBe(false);
		expect(body.error).toBe("Recipient unavailable.");
	});
});

describe("POST /api/requests/respond", () => {
	beforeEach(() => {
		seedVerified(A, "uA");
		seedVerified(B, "uB");
		storeOf().moneyRequests.push({
			id: "r1",
			requesterUserId: "uA",
			requesterPhone: A,
			recipientUserId: "uB",
			recipientPhone: B,
			amountMinor: 100,
			currency: "USDC",
			sendNgn: null,
			status: "pending",
			createdAt: new Date(),
			updatedAt: new Date(),
		});
	});

	it("404 for wrong id or wrong phone", async () => {
		expect((await respondPOST(req("/x", { id: "nope", phone: B, action: "reject" }))).status).toBe(404);
		expect((await respondPOST(req("/x", { id: "r1", phone: A, action: "reject" }))).status).toBe(404);
	});

	it("accept returns execution details, stays pending", async () => {
		const res = await respondPOST(req("/x", { id: "r1", phone: B, action: "accept" }));
		const body = (await res.json()) as any;
		expect(body.ok).toBe(true);
		expect(body.request.amountMinor).toBe(100);
		expect(storeOf().moneyRequests[0].status).toBe("pending");
	});

	it("reject marks rejected; reject-block also blocks", async () => {
		await respondPOST(req("/x", { id: "r1", phone: B, action: "reject" }));
		expect(storeOf().moneyRequests[0].status).toBe("rejected");
		expect(storeOf().requestBlocks).toHaveLength(0);
		storeOf().moneyRequests[0].status = "pending";
		await respondPOST(req("/x", { id: "r1", phone: B, action: "reject-block" }));
		expect(storeOf().moneyRequests[0].status).toBe("rejected");
		expect(storeOf().requestBlocks).toHaveLength(1);
		expect(storeOf().requestBlocks[0].blockedPhone).toBe(A);
	});

	it("replay on terminal state moves nothing", async () => {
		await respondPOST(req("/x", { id: "r1", phone: B, action: "reject" }));
		const res = await respondPOST(req("/x", { id: "r1", phone: B, action: "accept" }));
		const body = (await res.json()) as any;
		expect(body.replay).toBe(true);
		expect(body.status).toBe("rejected");
	});

	it("finalize-accept marks accepted", async () => {
		const res = await respondPOST(req("/x", { id: "r1", phone: B, action: "finalize-accept" }));
		const body = (await res.json()) as any;
		expect(body.status).toBe("accepted");
		expect(body.requesterPhone).toBe(A);
	});
});

describe("POST /api/requests/cancel + mine", () => {
	beforeEach(() => {
		seedVerified(A, "uA");
		seedVerified(B, "uB");
		storeOf().moneyRequests.push({
			id: "r1",
			requesterUserId: "uA",
			requesterPhone: A,
			recipientUserId: "uB",
			recipientPhone: B,
			amountMinor: 100,
			currency: "USDC",
			status: "pending",
			createdAt: new Date(),
			updatedAt: new Date(),
		});
	});

	it("mine returns latest pending outgoing; cancel marks cancelled", async () => {
		const mine = (await (await minePOST(req("/x", { phone: A }))).json()) as any;
		expect(mine.request.id).toBe("r1");
		const cancel = await cancelPOST(req("/x", { id: "r1", phone: A }));
		const body = (await cancel.json()) as any;
		expect(body.status).toBe("cancelled");
		expect(body.recipientPhone).toBe(B);
	});

	it("cancel by non-requester 404s", async () => {
		expect((await cancelPOST(req("/x", { id: "r1", phone: B }))).status).toBe(404);
	});
});

describe("POST /api/requests/settings", () => {
	beforeEach(() => {
		seedVerified(B, "uB");
	});

	it("sets privacy modes, rejects junk", async () => {
		for (const mode of ["open", "contacts", "blocked"]) {
			const res = await settingsPOST(req("/x", { phone: B, privacy: mode }));
			expect(((await res.json()) as any).privacy).toBe(mode);
		}
		expect(((await settingsPOST(req("/x", { phone: B, privacy: "everyone" }))).status)).toBe(400);
		expect(storeOf().users[0].requestPrivacy).toBe("blocked");
	});

	it("unblock removes the row", async () => {
		storeOf().requestBlocks.push({ id: "b1", blockerUserId: "uB", blockedPhone: A });
		const res = await settingsPOST(req("/x", { phone: B, unblock: A }));
		expect(((await res.json()) as any).unblocked).toBe(A);
		expect(storeOf().requestBlocks).toHaveLength(0);
	});
});

describe("POST /api/requests/sweep", () => {
	const day = 24 * 60 * 60 * 1000;
	beforeEach(() => {
		const now = Date.now();
		storeOf().moneyRequests.push(
			{ id: "old", requesterPhone: A, recipientPhone: B, amountMinor: 1, currency: "USDC", status: "pending", createdAt: new Date(now - 8 * day), updatedAt: new Date(now - 8 * day) },
			{ id: "due", requesterPhone: A, recipientPhone: B, amountMinor: 2, currency: "USDC", status: "pending", createdAt: new Date(now - 2 * day), updatedAt: new Date(now - 2 * day) },
			{ id: "fresh", requesterPhone: A, recipientPhone: B, amountMinor: 3, currency: "USDC", status: "pending", createdAt: new Date(now - 3600_000), updatedAt: new Date(now - 3600_000) },
		);
	});

	it("expires old, nudges due once, skips fresh", async () => {
		const first = (await (await sweepPOST(req("/x", {}))).json()) as any;
		expect(first.expired).toBe(1);
		expect(first.nudge.map((n: any) => n.id)).toEqual(["due"]);
		const second = (await (await sweepPOST(req("/x", {}))).json()) as any;
		expect(second.expired).toBe(0);
		expect(second.nudge).toEqual([]);
		const byId = Object.fromEntries(storeOf().moneyRequests.map((r: any) => [r.id, r]));
		expect(byId.old.status).toBe("expired");
		expect(byId.due.nudgedAt).toBeDefined();
	});
});
