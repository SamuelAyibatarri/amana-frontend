/**
 * Mocked KYC rule for the hackathon.
 *
 * No real BVN/NIN vendor is called. Verification is deterministic:
 * - both BVN and NIN are exactly 11 digits -> "verified"
 * - nothing submitted yet (both empty) -> "pending"
 * - anything else -> "failed"
 *
 * This module is intentionally pure (no D1/Auth imports) so it can run
 * in the OpenNext Worker, in server actions, and in unit tests.
 */

export type KycStatus = "pending" | "verified" | "failed";

const ELEVEN_DIGITS = /^\d{11}$/;

function normalize(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** True when value is exactly 11 ASCII digits. */
export function isElevenDigitId(value: unknown): boolean {
  return ELEVEN_DIGITS.test(normalize(value));
}

export interface MockKycInput {
  bvn?: unknown;
  nin?: unknown;
}

export interface MockKycResult {
  status: KycStatus;
  bvn: string;
  nin: string;
  mocked: true;
  reason: string;
}

/**
 * Apply the mocked BVN+NIN rule.
 *
 * @example
 * mockVerifyBvnNin({ bvn: "12345678901", nin: "12345678901" })
 * // -> { status: "verified", ... }
 */
export function mockVerifyBvnNin(input: MockKycInput): MockKycResult {
  const bvn = normalize(input.bvn);
  const nin = normalize(input.nin);

  if (!bvn && !nin) {
    return {
      status: "pending",
      bvn,
      nin,
      mocked: true,
      reason: "BVN and NIN not submitted yet.",
    };
  }

  if (isElevenDigitId(bvn) && isElevenDigitId(nin)) {
    return {
      status: "verified",
      bvn,
      nin,
      mocked: true,
      reason: "Mock pass: both BVN and NIN are 11 digits.",
    };
  }

  return {
    status: "failed",
    bvn,
    nin,
    mocked: true,
    reason:
      "Mock fail: BVN and NIN must each be exactly 11 digits (0-9).",
  };
}

/**
 * Build a `kyc_profile` row payload matching `src/db/schema.ts`.
 * The caller owns the D1 upsert; this helper only shapes the data.
 */
export function buildKycProfileRow(args: {
  id: string;
  userId: string;
  bvn: string;
  nin: string;
  status: KycStatus;
  now: Date;
}) {
  return {
    id: args.id,
    userId: args.userId,
    bvn: args.bvn,
    nin: args.nin,
    status: args.status,
    mocked: true as const,
    createdAt: args.now,
    updatedAt: args.now,
  };
}
