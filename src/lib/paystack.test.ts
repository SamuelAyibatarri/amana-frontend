import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { paystackEventToStatus, verifyPaystackSignature } from "@/lib/paystack";

const SECRET = "sk_test_vector_secret";
const BODY = '{"event":"charge.success","data":{"reference":"amana-x"}}';
const EXPECTED = createHmac("sha512", SECRET).update(BODY).digest("hex");

describe("verifyPaystackSignature", () => {
	it("accepts the known HMAC-SHA512 vector", async () => {
		await expect(verifyPaystackSignature(BODY, SECRET, EXPECTED)).resolves.toBe(
			true,
		);
	});

	it("accepts uppercase signature (normalized)", async () => {
		await expect(
			verifyPaystackSignature(BODY, SECRET, EXPECTED.toUpperCase()),
		).resolves.toBe(true);
	});

	it("rejects wrong signature and body", async () => {
		const bad =
			EXPECTED.slice(0, -1) + (EXPECTED.endsWith("0") ? "1" : "0");
		await expect(verifyPaystackSignature(BODY, SECRET, bad)).resolves.toBe(
			false,
		);
		await expect(
			verifyPaystackSignature(BODY + "!", SECRET, EXPECTED),
		).resolves.toBe(false);
	});

	it("rejects empty inputs", async () => {
		await expect(verifyPaystackSignature("", SECRET, EXPECTED)).resolves.toBe(
			false,
		);
		await expect(verifyPaystackSignature(BODY, "", EXPECTED)).resolves.toBe(
			false,
		);
		await expect(verifyPaystackSignature(BODY, SECRET, "")).resolves.toBe(
			false,
		);
	});
});

describe("paystackEventToStatus", () => {
	it("maps charge.success to completed", () => {
		expect(
			paystackEventToStatus({ event: "charge.success", data: {} }),
		).toBe("completed");
	});

	it("maps failures and disputes to failed", () => {
		expect(paystackEventToStatus({ event: "charge.failed", data: {} })).toBe(
			"failed",
		);
		expect(paystackEventToStatus({ event: "charge.dispute", data: {} })).toBe(
			"failed",
		);
		expect(
			paystackEventToStatus({
				event: "charge.pending",
				data: { status: "failed" },
			}),
		).toBe("failed");
	});

	it("ignores everything else", () => {
		expect(paystackEventToStatus({ event: "transfer.success", data: {} })).toBe(
			null,
		);
		expect(
			paystackEventToStatus({ event: "charge.pending", data: {} }),
		).toBe(null);
	});
});
