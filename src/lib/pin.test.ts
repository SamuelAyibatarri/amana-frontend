import { describe, expect, it } from "vitest";
import {
	OTP_RE,
	PIN_RE,
	checkPin,
	hashOtp,
	hashPin,
	makeOtp,
} from "@/lib/pin";

describe("PIN_RE / OTP_RE", () => {
	it("accepts 4-digit PINs only", () => {
		expect(PIN_RE.test("1234")).toBe(true);
		expect(PIN_RE.test("4444")).toBe(true);
		expect(PIN_RE.test("123")).toBe(false);
		expect(PIN_RE.test("12345")).toBe(false);
		expect(PIN_RE.test("12a4")).toBe(false);
		expect(PIN_RE.test("")).toBe(false);
		expect(PIN_RE.test(" 1234")).toBe(false);
	});

	it("accepts 6-digit OTPs only", () => {
		expect(OTP_RE.test("123456")).toBe(true);
		expect(OTP_RE.test("12345")).toBe(false);
		expect(OTP_RE.test("1234567")).toBe(false);
		expect(OTP_RE.test("12345a")).toBe(false);
	});
});

describe("hashPin / checkPin", () => {
	it("emits v1$ + 64-hex and stays deterministic per user", async () => {
		const h = await hashPin("1234", "u1");
		expect(h.startsWith("v1$")).toBe(true);
		expect(/^v1\$[0-9a-f]{64}$/.test(h)).toBe(true);
		await expect(hashPin("1234", "u1")).resolves.toBe(h);
	});

	it("salts per user", async () => {
		const a = await hashPin("1234", "u1");
		const b = await hashPin("1234", "u2");
		expect(a).not.toBe(b);
	});

	it("verifies true/false", async () => {
		const h = await hashPin("1234", "u1");
		await expect(checkPin("1234", "u1", h)).resolves.toBe(true);
		await expect(checkPin("9999", "u1", h)).resolves.toBe(false);
	});

	it("rejects legacy unprefixed hashes", async () => {
		await expect(checkPin("1234", "u1", "deadbeef")).resolves.toBe(false);
	});
});

describe("hashOtp / makeOtp", () => {
	it("hashes OTPs in a separate domain from PINs", async () => {
		const o = await hashOtp("123456", "u1");
		const p = await hashPin("123456", "u1");
		expect(o.startsWith("v1$")).toBe(true);
		expect(o).not.toBe(p);
	});

	it("makes 6-digit numeric OTPs in range", () => {
		for (let i = 0; i < 20; i++) {
			const otp = makeOtp();
			expect(/^\d{6}$/.test(otp)).toBe(true);
			const n = Number(otp);
			expect(n).toBeGreaterThanOrEqual(100_000);
			expect(n).toBeLessThanOrEqual(999_999);
		}
	});
});
