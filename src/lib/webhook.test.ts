import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { signaturesEqual, signWebhookBody } from "@/lib/webhook";

describe("signWebhookBody", () => {
	it("matches the known HMAC-SHA256 vector", async () => {
		const expected = createHmac("sha256", "s3cret").update("hello").digest("hex");
		await expect(signWebhookBody("hello", "s3cret")).resolves.toBe(expected);
	});

	it("is deterministic and secret-sensitive", async () => {
		const a = await signWebhookBody("body", "one");
		const b = await signWebhookBody("body", "one");
		const c = await signWebhookBody("body", "two");
		expect(a).toBe(b);
		expect(a).not.toBe(c);
	});
});

describe("signaturesEqual", () => {
	it("accepts equal digests", () => {
		expect(signaturesEqual("abc123", "abc123")).toBe(true);
	});

	it("rejects unequal, length-mismatch, and empty", () => {
		expect(signaturesEqual("abc123", "abc124")).toBe(false);
		expect(signaturesEqual("abc", "abcd")).toBe(false);
		expect(signaturesEqual("", "")).toBe(false);
		expect(signaturesEqual("", "abc")).toBe(false);
	});
});
