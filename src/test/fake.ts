/**
 * Shared in-memory fake for route tests. Routes are tested with
 * `@/lib/db` (getDb/envString) and `drizzle-orm` (eq/and/desc/sql)
 * mocked; this module holds the predicate semantics + store.
 *
 * Store shape mirrors the D1 tables the routes touch:
 * users / kycProfiles / payments / transfers (plain objects).
 */

export interface FakeStore {
	users: any[];
	kycProfiles: any[];
	payments: any[];
	transfers: any[];
	verifications: any[];
	moneyRequests: any[];
	requestBlocks: any[];
	lastUserId?: string;
}

export function freshStore(): FakeStore {
	return { users: [], kycProfiles: [], payments: [], transfers: [], verifications: [], moneyRequests: [], requestBlocks: [] };
}

export function snakeToCamel(s: string): string {
	return s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

/** Resolve a column ref (fake proxy marker, real drizzle column, string) to a JS row key. */
export function keyOf(col: any): string {
	if (typeof col === "string") return col;
	if (col && typeof col === "object") {
		if (typeof col.__field === "string") return col.__field;
		if (typeof col.name === "string") return snakeToCamel(col.name);
	}
	return String(col);
}

export const eq = (a: any, b: any) => (row: any) => row?.[keyOf(a)] === b;

export const gt = (a: any, b: any) => (row: any) => row?.[keyOf(a)] > b;

export const and =
	(...ps: any[]) =>
	(row: any) =>
		ps.every((p) => (typeof p === "function" ? p(row) : true));

export const or =
	(...ps: any[]) =>
	(row: any) =>
		ps.some((p) => (typeof p === "function" ? p(row) : true));

export const desc = (a: any) => ({ __desc: keyOf(a) });

// Tag/no-op for the balance route's `sql` aggregate placeholders.
export const sql: any = (..._args: any[]) => ({ __sql: true });

export const proxy: any = new Proxy(
	{},
	{ get: (_t, p) => ({ __field: String(p) }) },
);

function resolvePred(where: any): any {
	// Callback style: (t, { eq }) => eq(...) — call to build the predicate.
	// Operator style: eq(...) already — a predicate; calling it with
	// (proxy, ops) would return a boolean and silently disable filtering.
	if (typeof where !== "function") return where;
	const out = where(proxy, { eq, and, desc, gt, or });
	return typeof out === "function" ? out : where;
}

function findFirst(store: FakeStore, tableKey: keyof FakeStore, args: any): any {
	let rows = [...((store[tableKey] as any[]) ?? [])];
	if (args?.where && typeof args.where === "function") {
		const pred = resolvePred(args.where);
		if (typeof pred === "function") rows = rows.filter(pred);
	}
	if (args?.orderBy && typeof args.orderBy === "function") {
		const out = args.orderBy(proxy, { desc });
		const markers = Array.isArray(out) ? out : [out];
		for (const m of markers) {
			if (m?.__desc) {
				const k = m.__desc;
				rows.sort((a, b) => (a[k] < b[k] ? 1 : a[k] > b[k] ? -1 : 0));
			}
		}
	}
	const row = rows[0];
	if (!row) return undefined;
	if (args?.columns && typeof args.columns === "object") {
		const out: any = {};
		for (const [k, v] of Object.entries(args.columns)) {
			if (v) out[k] = row[k];
		}
		return out;
	}
	return { ...row };
}

function findMany(store: FakeStore, args: any): any[] {
	let rows = [...((store as any).moneyRequests ?? [])];
	const pred = resolvePred(args?.where);
	if (typeof pred === "function") rows = rows.filter(pred);
	return rows.map((r) => ({ ...r }));
}

function tableName(t: any): string {
	try {
		return String(t?.[Symbol.for("drizzle:Name")] ?? "");
	} catch {
		return "";
	}
}

function insertInto(store: FakeStore, row: any): void {
	if (row && typeof row === "object") {
		if ("requesterPhone" in row) {
			(store.moneyRequests as any[]).push({ ...row });
			return;
		}
		if ("blockedPhone" in row) {
			(store.requestBlocks as any[]).push({ ...row });
			return;
		}
		if ("amountMinor" in row) {
			store.transfers.push({ ...row });
			return;
		}
		if ("reference" in row) {
			store.payments.push({ ...row });
			return;
		}
		if ("bvn" in row || "nin" in row || "fullName" in row) {
			store.kycProfiles.push({ ...row });
			return;
		}
		if ("email" in row) {
			store.users.push({ ...row });
			return;
		}
	}
	store.transfers.push({ ...row });
}

function pickTargets(store: FakeStore, patch: any): any[][] {
	const keys = Object.keys(patch ?? {});
	const has = (...ks: string[]) => ks.some((k) => keys.includes(k));
	if (has("bvn", "nin", "fullName", "mocked")) return [store.kycProfiles];
	if (
		has(
			"pinAttempts",
			"pinLockedUntil",
			"pinHash",
			"name",
			"contactEmail",
			"defaultCurrency",
			"resetOtpHash",
			"resetOtpExpiresAt",
			"resetOtpAttempts",
		)
	)
		return [store.users];
	if (has("status", "channel", "paidAt")) return [store.payments];
	return [store.users, store.payments, store.kycProfiles];
}

function applyUpdate(store: FakeStore, patch: any, pred: any): void {
	for (const arr of pickTargets(store, patch)) {
		for (const r of arr) {
			const match = typeof pred === "function" ? pred(r) : true;
			if (match) Object.assign(r, patch);
		}
	}
}

/** Balance-route aggregation: group transfers by (currency, status). */
function balanceRows(store: FakeStore): any[] {
	const uid = store.lastUserId;
	const groups = new Map<string, any>();
	for (const t of store.transfers) {
		const key = `${t.currency}||${t.status}`;
		if (!groups.has(key)) {
			groups.set(key, {
				currency: t.currency,
				status: t.status,
				inbound: 0,
				outbound: 0,
			});
		}
		const g = groups.get(key);
		if (t.recipientUserId === uid && t.status !== "withdrawn") {
			g.inbound += t.amountMinor ?? 0;
		}
		if (t.senderUserId === uid) g.outbound += t.amountMinor ?? 0;
	}
	return [...groups.values()];
}

export function makeDb(store: FakeStore): any {
	return {
		query: {
			user: {
				findFirst: (a: any) => {
					const r = findFirst(store, "users", a);
					if (r?.id) store.lastUserId = r.id;
					return r;
				},
			},
			kycProfile: { findFirst: (a: any) => findFirst(store, "kycProfiles", a) },
			payment: { findFirst: (a: any) => findFirst(store, "payments", a) },
			transfer: { findFirst: (a: any) => findFirst(store, "transfers", a) },
			verification: { findFirst: (a: any) => findFirst(store, "verifications", a) },
			moneyRequest: {
				findFirst: (a: any) => findFirst(store, "moneyRequests" as never, a),
				findMany: (a: any) => findMany(store, a),
			},
			requestBlock: {
				findFirst: (a: any) => findFirst(store, "requestBlocks" as never, a),
			},
		},
		delete: (_t: any) => ({
			where: async (pred: any) => {
				const drop = (arr: any[]) => {
					const keep = arr.filter(
						(r) => !(typeof pred === "function" ? pred(r) : true),
					);
					arr.length = 0;
					arr.push(...keep);
				};
				drop(store.verifications as any[]);
				drop(store.requestBlocks as any[]);
			},
		}),
		insert: (_t: any) => ({
			values: async (row: any) => {
				insertInto(store, row);
			},
		}),
		update: (_t: any) => ({
			set: (patch: any) => ({
				where: async (pred: any) => {
					const name = tableName(_t);
					if (name === "money_request" || name === "request_block") {
						const arr = (store as any)[
							name === "money_request" ? "moneyRequests" : "requestBlocks"
						] as any[];
						for (const r of arr) {
							if (typeof pred === "function" ? pred(r) : true) Object.assign(r, patch);
						}
						return;
					}
					applyUpdate(store, patch, pred);
				},
			}),
		}),
		select: (_s: any) => ({
			from: (_f: any) => ({
				groupBy: async (..._g: any[]) => balanceRows(store),
			}),
		}),
	};
}

export function storeOf(): FakeStore {
	return (globalThis as any).__FAKE_STORE as FakeStore;
}
