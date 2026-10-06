import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull(),
  image: text("image"),
  // Transaction PIN, set on the dashboard. SHA-256 hash (demo grade —
  // production wants a KDF + HSM). Null until the user sets one.
  pinHash: text("pin_hash"),
  pinAttempts: integer("pin_attempts").notNull().default(0),
  pinLockedUntil: integer("pin_locked_until", { mode: "timestamp" }),
  // PIN-reset OTP (6 digits, hashed). Delivered to WhatsApp on request.
  resetOtpHash: text("reset_otp_hash"),
  resetOtpExpiresAt: integer("reset_otp_expires_at", { mode: "timestamp" }),
  resetOtpAttempts: integer("reset_otp_attempts").notNull().default(0),
  // Contact email for receipts/notifications (identity stays phone-based).
  contactEmail: text("contact_email"),
  // Money-request privacy: open | contacts | blocked. Default contacts.
  requestPrivacy: text("request_privacy").notNull().default("contacts"),
  // Display + chat default currency (SOL/USDC/NGN). Ledger stays multi.
  defaultCurrency: text("default_currency").notNull().default("NGN"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});

// Hackathon mock. No real KYC vendor. Any 11-digit BVN + NIN passes.
export const kycProfile = sqliteTable("kyc_profile", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  bvn: text("bvn"),
  nin: text("nin"),
  // Real name collected at verification (required). Bot greets by this
  // first; WhatsApp pushName is the fallback.
  fullName: text("full_name"),
  status: text("status").notNull().default("pending"),
  mocked: integer("mocked", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// Money requests (chat-native). A request moves money FROM the recipient
// TO the requester on accept — the recipient's PIN gates it, same as sends.
// Amounts stored execution-ready (converted crypto minor units); sendNgn
// keeps the original fiat figure for display. Status: pending → accepted /
// rejected / cancelled / expired (7d, one nudge at 24h).
export const moneyRequest = sqliteTable("money_request", {
  id: text("id").primaryKey(),
  requesterUserId: text("requester_user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  requesterPhone: text("requester_phone").notNull(),
  recipientUserId: text("recipient_user_id").references(() => user.id),
  recipientPhone: text("recipient_phone").notNull(),
  amountMinor: integer("amount_minor").notNull(),
  currency: text("currency").notNull(),
  sendNgn: integer("send_ngn"),
  status: text("status").notNull().default("pending"),
  nudgedAt: integer("nudged_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// Request blocklist: blocker never hears from blockedPhone again.
// Checked before delivery; rejections never reveal the reason.
export const requestBlock = sqliteTable("request_block", {
  id: text("id").primaryKey(),
  blockerUserId: text("blocker_user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  blockedPhone: text("blocked_phone").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
// `reference` is Paystack's idempotency key — unique constraint enforces
// once-only crediting at the DB level. Amounts are in kobo (smallest unit).
// Paystack payments. Single store (D1) for web- and chat-initiated buys.
export const payment = sqliteTable("payment", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  reference: text("reference").notNull().unique(),
  email: text("email").notNull(),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull().default("NGN"),
  status: text("status").notNull().default("pending"),
  channel: text("channel"),
  metadata: text("metadata"),
  paidAt: integer("paid_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// Internal transfers (chat-initiated). Credits are immediate and final —
// the recipient owns the value at insert; withdrawal is gated on their
// KYC + PIN, not on this row. Amounts in smallest units
// (lamports / micro-USDC / kobo — see DECIMALS in the credit route).
export const transfer = sqliteTable("transfer", {
  id: text("id").primaryKey(),
  senderUserId: text("sender_user_id").references(() => user.id),
  recipientUserId: text("recipient_user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  senderPhone: text("sender_phone").notNull(),
  recipientPhone: text("recipient_phone"),
  recipientAddress: text("recipient_address"),
  amountMinor: integer("amount_minor").notNull(),
  currency: text("currency").notNull(),
  status: text("status").notNull().default("completed"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});
