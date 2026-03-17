import { createClient, type Client } from "@libsql/client";

// ─── Client singleton ─────────────────────────────────────────────────────────

let _client: Client | null = null;
let _initPromise: Promise<void> | null = null;

function getClient(): Client {
  if (!_client) {
    const url = (process.env.TURSO_DATABASE_URL ?? "file:./zap.db").trim();
    const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
    _client = createClient({ url, authToken });
  }
  return _client;
}

async function ensureInit(): Promise<Client> {
  const db = getClient();
  if (!_initPromise) {
    _initPromise = (async () => {
      try {
        await db.batch(
          [
            `CREATE TABLE IF NOT EXISTS zaps (
              id                TEXT PRIMARY KEY,
              from_email        TEXT NOT NULL,
              to_email          TEXT NOT NULL,
              amount_raw        TEXT NOT NULL,
              token             TEXT NOT NULL DEFAULT 'STRK',
              claim_secret      TEXT NOT NULL,
              tx_hash           TEXT,
              status            TEXT NOT NULL DEFAULT 'pending',
              created_at        INTEGER NOT NULL,
              claimed_at        INTEGER,
              recipient_address TEXT,
              message           TEXT,
              type              TEXT NOT NULL DEFAULT 'send',
              group_id          TEXT,
              protocol_fee_raw  TEXT,
              yield_apy         REAL DEFAULT 0.05
            )`,
            `CREATE TABLE IF NOT EXISTS requests (
              id           TEXT PRIMARY KEY,
              from_email   TEXT NOT NULL,
              to_email     TEXT NOT NULL,
              amount_raw   TEXT NOT NULL,
              token        TEXT NOT NULL DEFAULT 'STRK',
              message      TEXT,
              status       TEXT NOT NULL DEFAULT 'pending',
              created_at   INTEGER NOT NULL,
              paid_zap_id  TEXT
            )`,
            `CREATE TABLE IF NOT EXISTS recurring (
              id             TEXT PRIMARY KEY,
              from_email     TEXT NOT NULL,
              to_email       TEXT NOT NULL,
              amount_raw     TEXT NOT NULL,
              token          TEXT NOT NULL DEFAULT 'STRK',
              message        TEXT,
              interval_days  INTEGER NOT NULL DEFAULT 30,
              next_at        INTEGER NOT NULL,
              active         INTEGER NOT NULL DEFAULT 1,
              created_at     INTEGER NOT NULL
            )`,
            `CREATE TABLE IF NOT EXISTS streams (
              id                    TEXT PRIMARY KEY,
              from_email            TEXT NOT NULL,
              to_email              TEXT NOT NULL,
              amount_per_second_raw TEXT NOT NULL,
              total_amount_raw      TEXT NOT NULL,
              token                 TEXT NOT NULL DEFAULT 'STRK',
              start_at              INTEGER NOT NULL,
              end_at                INTEGER NOT NULL,
              last_claimed_at       INTEGER NOT NULL,
              claimed_total_raw     TEXT NOT NULL DEFAULT '0',
              active                INTEGER NOT NULL DEFAULT 1,
              message               TEXT,
              created_at            INTEGER NOT NULL
            )`,
            `CREATE TABLE IF NOT EXISTS subscriptions (
              id               TEXT PRIMARY KEY,
              merchant_email   TEXT NOT NULL,
              subscriber_email TEXT,
              amount_raw       TEXT NOT NULL,
              token            TEXT NOT NULL DEFAULT 'STRK',
              interval_days    INTEGER NOT NULL DEFAULT 30,
              description      TEXT,
              authorized_at    INTEGER,
              next_pull_at     INTEGER,
              active           INTEGER NOT NULL DEFAULT 0,
              created_at       INTEGER NOT NULL
            )`,
            `CREATE TABLE IF NOT EXISTS contacts (
              id            TEXT PRIMARY KEY,
              owner_email   TEXT NOT NULL,
              contact_email TEXT NOT NULL,
              nickname      TEXT,
              created_at    INTEGER NOT NULL,
              UNIQUE(owner_email, contact_email)
            )`,
          ],
          "write"
        );
      } catch (err) {
        _initPromise = null;
        throw err;
      }
    })();
  }
  await _initPromise;
  return db;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Zap {
  id: string;
  from_email: string;
  to_email: string;
  amount_raw: string;
  token: string;
  claim_secret: string;
  tx_hash: string | null;
  status: "pending" | "funded" | "claimed" | "refunded";
  created_at: number;
  claimed_at: number | null;
  recipient_address: string | null;
  message: string | null;
  type: "send" | "request" | "split" | "stream" | "subscription";
  group_id: string | null;
  protocol_fee_raw: string | null;
  yield_apy: number;
}

export interface ZapRequest {
  id: string;
  from_email: string;
  to_email: string;
  amount_raw: string;
  token: string;
  message: string | null;
  status: "pending" | "paid" | "cancelled";
  created_at: number;
  paid_zap_id: string | null;
}

export interface Recurring {
  id: string;
  from_email: string;
  to_email: string;
  amount_raw: string;
  token: string;
  message: string | null;
  interval_days: number;
  next_at: number;
  active: number;
  created_at: number;
}

export interface Stream {
  id: string;
  from_email: string;
  to_email: string;
  amount_per_second_raw: string;
  total_amount_raw: string;
  token: string;
  start_at: number;
  end_at: number;
  last_claimed_at: number;
  claimed_total_raw: string;
  active: number;
  message: string | null;
  created_at: number;
}

export interface Subscription {
  id: string;
  merchant_email: string;
  subscriber_email: string | null;
  amount_raw: string;
  token: string;
  interval_days: number;
  description: string | null;
  authorized_at: number | null;
  next_pull_at: number | null;
  active: number;
  created_at: number;
}

export interface Contact {
  id: string;
  owner_email: string;
  contact_email: string;
  nickname: string | null;
  created_at: number;
}

// ─── Zaps ────────────────────────────────────────────────────────────────────

export async function createZap(
  zap: Omit<Zap, "status" | "claimed_at" | "recipient_address" | "protocol_fee_raw"> & { type?: string }
): Promise<Zap> {
  const db = await ensureInit();
  await db.execute({
    sql: `INSERT INTO zaps (id, from_email, to_email, amount_raw, token, claim_secret, tx_hash, status, created_at, message, type, group_id, yield_apy)
          VALUES (:id, :from_email, :to_email, :amount_raw, :token, :claim_secret, :tx_hash, 'pending', :created_at, :message, :type, :group_id, :yield_apy)`,
    args: {
      id: zap.id,
      from_email: zap.from_email,
      to_email: zap.to_email,
      amount_raw: zap.amount_raw,
      token: zap.token,
      claim_secret: zap.claim_secret,
      tx_hash: zap.tx_hash ?? null,
      created_at: zap.created_at,
      message: zap.message ?? null,
      type: zap.type ?? "send",
      group_id: zap.group_id ?? null,
      yield_apy: zap.yield_apy ?? 0.05,
    },
  });
  await upsertContact(zap.from_email, zap.to_email);
  await upsertContact(zap.to_email, zap.from_email);
  return (await getZap(zap.id))!;
}

export async function getZap(id: string): Promise<Zap | null> {
  const db = await ensureInit();
  const res = await db.execute({ sql: "SELECT * FROM zaps WHERE id = ?", args: [id] });
  return (res.rows[0] as unknown as Zap) ?? null;
}

export async function updateZapStatus(
  id: string,
  status: Zap["status"],
  extra?: { tx_hash?: string; recipient_address?: string; claimed_at?: number; protocol_fee_raw?: string }
): Promise<void> {
  const db = await ensureInit();
  if (extra) {
    const fields = Object.keys(extra).map((k) => `${k} = :${k}`).join(", ");
    await db.execute({
      sql: `UPDATE zaps SET status = :status, ${fields} WHERE id = :id`,
      args: { id, status, ...extra },
    });
  } else {
    await db.execute({ sql: "UPDATE zaps SET status = :status WHERE id = :id", args: { id, status } });
  }
}

export async function getAllZaps(): Promise<Zap[]> {
  const db = await ensureInit();
  const res = await db.execute("SELECT * FROM zaps ORDER BY created_at DESC");
  return res.rows as unknown as Zap[];
}

// ─── Requests ────────────────────────────────────────────────────────────────

export async function createRequest(req: Omit<ZapRequest, "status" | "paid_zap_id">): Promise<ZapRequest> {
  const db = await ensureInit();
  await db.execute({
    sql: `INSERT INTO requests (id, from_email, to_email, amount_raw, token, message, status, created_at)
          VALUES (:id, :from_email, :to_email, :amount_raw, :token, :message, 'pending', :created_at)`,
    args: {
      id: req.id,
      from_email: req.from_email,
      to_email: req.to_email,
      amount_raw: req.amount_raw,
      token: req.token,
      message: req.message ?? null,
      created_at: req.created_at,
    },
  });
  return (await getRequest(req.id))!;
}

export async function getRequest(id: string): Promise<ZapRequest | null> {
  const db = await ensureInit();
  const res = await db.execute({ sql: "SELECT * FROM requests WHERE id = ?", args: [id] });
  return (res.rows[0] as unknown as ZapRequest) ?? null;
}

export async function markRequestPaid(id: string, zapId: string): Promise<void> {
  const db = await ensureInit();
  await db.execute({
    sql: "UPDATE requests SET status = 'paid', paid_zap_id = :zapId WHERE id = :id",
    args: { id, zapId },
  });
}

export async function getAllRequests(): Promise<ZapRequest[]> {
  const db = await ensureInit();
  const res = await db.execute("SELECT * FROM requests ORDER BY created_at DESC");
  return res.rows as unknown as ZapRequest[];
}

// ─── Recurring ───────────────────────────────────────────────────────────────

export async function createRecurring(
  rec: Omit<Recurring, "active" | "created_at"> & { created_at?: number }
): Promise<Recurring> {
  const db = await ensureInit();
  const created_at = rec.created_at ?? Date.now();
  await db.execute({
    sql: `INSERT INTO recurring (id, from_email, to_email, amount_raw, token, message, interval_days, next_at, active, created_at)
          VALUES (:id, :from_email, :to_email, :amount_raw, :token, :message, :interval_days, :next_at, 1, :created_at)`,
    args: {
      id: rec.id,
      from_email: rec.from_email,
      to_email: rec.to_email,
      amount_raw: rec.amount_raw,
      token: rec.token,
      message: rec.message ?? null,
      interval_days: rec.interval_days,
      next_at: rec.next_at,
      created_at,
    },
  });
  return (await getRecurring(rec.id))!;
}

export async function getRecurring(id: string): Promise<Recurring | null> {
  const db = await ensureInit();
  const res = await db.execute({ sql: "SELECT * FROM recurring WHERE id = ?", args: [id] });
  return (res.rows[0] as unknown as Recurring) ?? null;
}

export async function getAllRecurring(): Promise<Recurring[]> {
  const db = await ensureInit();
  const res = await db.execute("SELECT * FROM recurring ORDER BY created_at DESC");
  return res.rows as unknown as Recurring[];
}

export async function getDueRecurring(): Promise<Recurring[]> {
  const db = await ensureInit();
  const res = await db.execute({
    sql: "SELECT * FROM recurring WHERE active = 1 AND next_at <= ?",
    args: [Date.now()],
  });
  return res.rows as unknown as Recurring[];
}

export async function updateRecurringNext(id: string, nextAt: number): Promise<void> {
  const db = await ensureInit();
  await db.execute({ sql: "UPDATE recurring SET next_at = :nextAt WHERE id = :id", args: { id, nextAt } });
}

export async function cancelRecurring(id: string): Promise<void> {
  const db = await ensureInit();
  await db.execute({ sql: "UPDATE recurring SET active = 0 WHERE id = ?", args: [id] });
}

// ─── Streams ─────────────────────────────────────────────────────────────────

export async function createStream(s: Omit<Stream, "claimed_total_raw" | "active">): Promise<Stream> {
  const db = await ensureInit();
  await db.execute({
    sql: `INSERT INTO streams (id, from_email, to_email, amount_per_second_raw, total_amount_raw, token, start_at, end_at, last_claimed_at, claimed_total_raw, active, message, created_at)
          VALUES (:id, :from_email, :to_email, :amount_per_second_raw, :total_amount_raw, :token, :start_at, :end_at, :last_claimed_at, '0', 1, :message, :created_at)`,
    args: {
      id: s.id,
      from_email: s.from_email,
      to_email: s.to_email,
      amount_per_second_raw: s.amount_per_second_raw,
      total_amount_raw: s.total_amount_raw,
      token: s.token,
      start_at: s.start_at,
      end_at: s.end_at,
      last_claimed_at: s.last_claimed_at,
      message: s.message ?? null,
      created_at: s.created_at,
    },
  });
  await upsertContact(s.from_email, s.to_email);
  await upsertContact(s.to_email, s.from_email);
  return (await getStream(s.id))!;
}

export async function getStream(id: string): Promise<Stream | null> {
  const db = await ensureInit();
  const res = await db.execute({ sql: "SELECT * FROM streams WHERE id = ?", args: [id] });
  return (res.rows[0] as unknown as Stream) ?? null;
}

export async function getAllStreams(): Promise<Stream[]> {
  const db = await ensureInit();
  const res = await db.execute("SELECT * FROM streams ORDER BY created_at DESC");
  return res.rows as unknown as Stream[];
}

export async function updateStreamClaimed(id: string, lastClaimedAt: number, claimedTotalRaw: string): Promise<void> {
  const db = await ensureInit();
  await db.execute({
    sql: "UPDATE streams SET last_claimed_at = :lastClaimedAt, claimed_total_raw = :claimedTotalRaw WHERE id = :id",
    args: { id, lastClaimedAt, claimedTotalRaw },
  });
}

export async function deactivateStream(id: string): Promise<void> {
  const db = await ensureInit();
  await db.execute({ sql: "UPDATE streams SET active = 0 WHERE id = ?", args: [id] });
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

export async function createSubscription(
  s: Omit<Subscription, "subscriber_email" | "authorized_at" | "next_pull_at" | "active">
): Promise<Subscription> {
  const db = await ensureInit();
  await db.execute({
    sql: `INSERT INTO subscriptions (id, merchant_email, amount_raw, token, interval_days, description, active, created_at)
          VALUES (:id, :merchant_email, :amount_raw, :token, :interval_days, :description, 0, :created_at)`,
    args: {
      id: s.id,
      merchant_email: s.merchant_email,
      amount_raw: s.amount_raw,
      token: s.token,
      interval_days: s.interval_days,
      description: s.description ?? null,
      created_at: s.created_at,
    },
  });
  return (await getSubscription(s.id))!;
}

export async function getSubscription(id: string): Promise<Subscription | null> {
  const db = await ensureInit();
  const res = await db.execute({ sql: "SELECT * FROM subscriptions WHERE id = ?", args: [id] });
  return (res.rows[0] as unknown as Subscription) ?? null;
}

export async function getAllSubscriptions(): Promise<Subscription[]> {
  const db = await ensureInit();
  const res = await db.execute("SELECT * FROM subscriptions ORDER BY created_at DESC");
  return res.rows as unknown as Subscription[];
}

export async function authorizeSubscription(
  id: string,
  subscriberEmail: string,
  now: number,
  nextPullAt: number
): Promise<void> {
  const db = await ensureInit();
  await db.execute({
    sql: "UPDATE subscriptions SET subscriber_email = :subscriberEmail, authorized_at = :now, next_pull_at = :nextPullAt, active = 1 WHERE id = :id",
    args: { id, subscriberEmail, now, nextPullAt },
  });
}

export async function updateSubscriptionNextPull(id: string, nextPullAt: number): Promise<void> {
  const db = await ensureInit();
  await db.execute({
    sql: "UPDATE subscriptions SET next_pull_at = :nextPullAt WHERE id = :id",
    args: { id, nextPullAt },
  });
}

export async function cancelSubscription(id: string): Promise<void> {
  const db = await ensureInit();
  await db.execute({ sql: "UPDATE subscriptions SET active = 0 WHERE id = ?", args: [id] });
}

export async function getDueSubscriptions(): Promise<Subscription[]> {
  const db = await ensureInit();
  const res = await db.execute({
    sql: "SELECT * FROM subscriptions WHERE active = 1 AND next_pull_at IS NOT NULL AND next_pull_at <= ?",
    args: [Date.now()],
  });
  return res.rows as unknown as Subscription[];
}

// ─── Contacts ────────────────────────────────────────────────────────────────

export async function upsertContact(ownerEmail: string, contactEmail: string): Promise<void> {
  if (ownerEmail === contactEmail) return;
  const db = await ensureInit();
  await db.execute({
    sql: `INSERT OR IGNORE INTO contacts (id, owner_email, contact_email, created_at)
          VALUES (lower(hex(randomblob(8))), :ownerEmail, :contactEmail, :now)`,
    args: { ownerEmail, contactEmail, now: Date.now() },
  });
}

export async function getContacts(ownerEmail: string): Promise<Contact[]> {
  const db = await ensureInit();
  const res = await db.execute({
    sql: "SELECT * FROM contacts WHERE owner_email = ? ORDER BY created_at DESC",
    args: [ownerEmail],
  });
  return res.rows as unknown as Contact[];
}

export async function setContactNickname(ownerEmail: string, contactEmail: string, nickname: string): Promise<void> {
  const db = await ensureInit();
  await db.execute({
    sql: "UPDATE contacts SET nickname = :nickname WHERE owner_email = :ownerEmail AND contact_email = :contactEmail",
    args: { nickname, ownerEmail, contactEmail },
  });
}

export async function getContactHistory(ownerEmail: string, contactEmail: string): Promise<Zap[]> {
  const db = await ensureInit();
  const res = await db.execute({
    sql: `SELECT * FROM zaps
          WHERE (from_email = :a AND to_email = :b) OR (from_email = :b AND to_email = :a)
          ORDER BY created_at DESC LIMIT 50`,
    args: { a: ownerEmail, b: contactEmail },
  });
  return res.rows as unknown as Zap[];
}
