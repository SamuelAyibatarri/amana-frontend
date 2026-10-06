import { describe, expect, it } from "vitest";
import { phoneFromEmail } from "@/lib/notify";

describe("phoneFromEmail", () => {
	it("extracts digits from phone-derived emails", () => {
		expect(phoneFromEmail("2348088848220@amana.whatsapp")).toBe("2348088848220");
	});

	it("rejects gmail, short, and long locals", () => {
		expect(phoneFromEmail("someone@gmail.com")).toBe(null);
		expect(phoneFromEmail("123@amana.whatsapp")).toBe(null);
		expect(phoneFromEmail(`${"1".repeat(16)}@amana.whatsapp`)).toBe(null);
	});
});
