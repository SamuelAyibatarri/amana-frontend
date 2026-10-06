import { describe, expect, it } from "vitest";
import {
	buildKycProfileRow,
	isElevenDigitId,
	mockVerifyBvnNin,
} from "@/lib/kyc";

describe("isElevenDigitId", () => {
	it("passes exactly 11 ASCII digits", () => {
		expect(isElevenDigitId("12345678901")).toBe(true);
		expect(isElevenDigitId("00000000000")).toBe(true);
	});

	it("fails 10 and 12 digits", () => {
		expect(isElevenDigitId("1234567890")).toBe(false);
		expect(isElevenDigitId("123456789012")).toBe(false);
	});

	it("fails letters and inner spaces", () => {
		expect(isElevenDigitId("1234567890a")).toBe(false);
		expect(isElevenDigitId("12345 678901")).toBe(false);
		expect(isElevenDigitId("")).toBe(false);
	});

	it("fails non-strings", () => {
		expect(isElevenDigitId(12345678901)).toBe(false);
		expect(isElevenDigitId(null)).toBe(false);
		expect(isElevenDigitId(undefined)).toBe(false);
	});
});

describe("mockVerifyBvnNin", () => {
	it("verifies when both are 11 digits", () => {
		const r = mockVerifyBvnNin({ bvn: "12345678901", nin: "98765432109" });
		expect(r.status).toBe("verified");
		expect(r.mocked).toBe(true);
		expect(r.reason).toMatch(/11 digits/);
	});

	it("pends when nothing submitted", () => {
		const r = mockVerifyBvnNin({});
		expect(r.status).toBe("pending");
		expect(r.reason).toMatch(/not submitted/);
	});

	it("fails on short/mismatched input", () => {
		expect(mockVerifyBvnNin({ bvn: "123", nin: "98765432109" }).status).toBe(
			"failed",
		);
		expect(mockVerifyBvnNin({ bvn: "12345678901", nin: "" }).status).toBe(
			"failed",
		);
		const r = mockVerifyBvnNin({ bvn: "abc", nin: "def" });
		expect(r.status).toBe("failed");
		expect(r.reason).toMatch(/11 digits/);
	});
});

describe("buildKycProfileRow", () => {
	it("shapes the kyc_profile row", () => {
		const now = new Date("2026-01-01T00:00:00.000Z");
		expect(
			buildKycProfileRow({
				id: "k1",
				userId: "u1",
				bvn: "12345678901",
				nin: "98765432109",
				status: "verified",
				now,
			}),
		).toEqual({
			id: "k1",
			userId: "u1",
			bvn: "12345678901",
			nin: "98765432109",
			status: "verified",
			mocked: true,
			createdAt: now,
			updatedAt: now,
		});
	});
});
