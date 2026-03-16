import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "zap.db");
let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");

  _db.exec(`
    CREATE TABLE IF NOT EXISTS zaps (
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
    )
  `);

  // Migrations for existing installs
  const zapCols = (_db.prepare("PRAGMA table_info(zaps)").all() as Array<{ name: string }>).map((c) => c.name);
  if (!zapCols.includes("type"))             _db.exec("ALTER TABLE zaps ADD COLUMN type TEXT NOT NULL DEFAULT 'send'");
  if (!zapCols.includes("group_id"))         _db.exec("ALTER TABLE zaps ADD COLUMN group_id TEXT");
  if (!zapCols.includes("protocol_fee_raw")) _db.exec("ALTER TABLE zaps ADD COLUMN protocol_fee_raw TEXT");
  if (!zapCols.includes("yield_apy"))        _db.exec("ALTER TABLE zaps ADD COLUMN yield_apy REAL DEFAULT 0.05");

  _db.exec(`
    CREATE TABLE IF NOT EXISTS requests (
      id           TEXT PRIMARY KEY,
      from_email   TEXT NOT NULL,
      to_email     TEXT NOT NULL,
      amount_raw   TEXT NOT NULL,
      token        TEXT NOT NULL DEFAULT 'STRK',
      message      TEXT,
      status       TEXT NOT NULL DEFAULT 'pending',
      created_at   INTEGER NOT NULL,
      paid_zap_id  TEXT
    )
  `);

  _db.exec(`
    CREATE TABLE IF NOT EXISTS recurring (
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
    )
  `);

  // Salary streams — per-second drip
  _db.exec(`
    CREATE TABLE IF NOT EXISTS streams (
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
    )
  `);

  // Subscription pull payments — merchant collects from authorized subscribers
  _db.exec(`
    CREATE TABLE IF NOT EXISTS subscriptions (
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
    )
  `);

  // Contacts / social graph — auto-populated from zap history
  _db.exec(`
    CREATE TABLE IF NOT EXISTS contacts (
      id            TEXT PRIMARY KEY,
      owner_email   TEXT NOT NULL,
      contact_email TEXT NOT NULL,
      nickname      TEXT,
      created_at    INTEGER NOT NULL,
      UNIQUE(owner_email, contact_email)
    )
  `);

  return _db;
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

export function createZap(
  zap: Omit<Zap, "status" | "claimed_at" | "recipient_address" | "protocol_fee_raw"> & { type?: string }
): Zap {
  const db = getDb();
  db.prepare(`
    INSERT INTO zaps (id, from_email, to_email, amount_raw, token, claim_secret, tx_hash, status, created_at, message, type, group_id, yield_apy)
    VALUES (@id, @from_email, @to_email, @amount_raw, @token, @claim_secret, @tx_hash, 'pending', @created_at, @message, @type, @group_id, @yield_apy)
  `).run({ ...zap, type: zap.type ?? "send", group_id: zap.group_id ?? null, yield_apy: zap.yield_apy ?? 0.05 });

  // Auto-add to contacts for both parties
  upsertContact(zap.from_email, zap.to_email);
  upsertContact(zap.to_email, zap.from_email);

  return getZap(zap.id)!;
}

export function getZap(id: string): Zap | null {
  return getDb().prepare("SELECT * FROM zaps WHERE id = ?").get(id) as Zap | null;
}

export function updateZapStatus(
  id: string,
  status: Zap["status"],
  extra?: { tx_hash?: string; recipient_address?: string; claimed_at?: number; protocol_fee_raw?: string }
): void {
  const db = getDb();
  if (extra) {
    const fields = Object.entries(extra).map(([k]) => `${k} = @${k}`).join(", ");
    db.prepare(`UPDATE zaps SET status = @status, ${fields} WHERE id = @id`).run({ id, status, ...extra });
  } else {
    db.prepare("UPDATE zaps SET status = @status WHERE id = @id").run({ id, status });
  }
}

// ─── Requests ────────────────────────────────────────────────────────────────

export function createRequest(req: Omit<ZapRequest, "status" | "paid_zap_id">): ZapRequest {
  const db = getDb();
  db.prepare(`
    INSERT INTO requests (id, from_email, to_email, amount_raw, token, message, status, created_at)
    VALUES (@id, @from_email, @to_email, @amount_raw, @token, @message, 'pending', @created_at)
  `).run(req);
  return getRequest(req.id)!;
}

export function getRequest(id: string): ZapRequest | null {
  return getDb().prepare("SELECT * FROM requests WHERE id = ?").get(id) as ZapRequest | null;
}

export function markRequestPaid(id: string, zapId: string): void {
  getDb().prepare("UPDATE requests SET status = 'paid', paid_zap_id = ? WHERE id = ?").run(zapId, id);
}

// ─── Recurring ───────────────────────────────────────────────────────────────

export function createRecurring(rec: Omit<Recurring, "active" | "created_at"> & { created_at?: number }): Recurring {
  const db = getDb();
  const created_at = rec.created_at ?? Date.now();
  db.prepare(`
    INSERT INTO recurring (id, from_email, to_email, amount_raw, token, message, interval_days, next_at, active, created_at)
    VALUES (@id, @from_email, @to_email, @amount_raw, @token, @message, @interval_days, @next_at, 1, @created_at)
  `).run({ ...rec, created_at });
  return getRecurring(rec.id)!;
}

export function getRecurring(id: string): Recurring | null {
  return getDb().prepare("SELECT * FROM recurring WHERE id = ?").get(id) as Recurring | null;
}

export function getAllRecurring(): Recurring[] {
  return getDb().prepare("SELECT * FROM recurring ORDER BY created_at DESC").all() as Recurring[];
}

export function getDueRecurring(): Recurring[] {
  return getDb().prepare("SELECT * FROM recurring WHERE active = 1 AND next_at <= ?").all(Date.now()) as Recurring[];
}

export function updateRecurringNext(id: string, nextAt: number): void {
  getDb().prepare("UPDATE recurring SET next_at = ? WHERE id = ?").run(nextAt, id);
}

export function cancelRecurring(id: string): void {
  getDb().prepare("UPDATE recurring SET active = 0 WHERE id = ?").run(id);
}

// ─── Streams ─────────────────────────────────────────────────────────────────

export function createStream(s: Omit<Stream, "claimed_total_raw" | "active">): Stream {
  const db = getDb();
  db.prepare(`
    INSERT INTO streams (id, from_email, to_email, amount_per_second_raw, total_amount_raw, token, start_at, end_at, last_claimed_at, claimed_total_raw, active, message, created_at)
    VALUES (@id, @from_email, @to_email, @amount_per_second_raw, @total_amount_raw, @token, @start_at, @end_at, @last_claimed_at, '0', 1, @message, @created_at)
  `).run(s);
  upsertContact(s.from_email, s.to_email);
  upsertContact(s.to_email, s.from_email);
  return getStream(s.id)!;
}

export function getStream(id: string): Stream | null {
  return getDb().prepare("SELECT * FROM streams WHERE id = ?").get(id) as Stream | null;
}

export function getAllStreams(): Stream[] {
  return getDb().prepare("SELECT * FROM streams ORDER BY created_at DESC").all() as Stream[];
}

export function updateStreamClaimed(id: string, lastClaimedAt: number, claimedTotalRaw: string): void {
  getDb().prepare("UPDATE streams SET last_claimed_at = ?, claimed_total_raw = ? WHERE id = ?")
    .run(lastClaimedAt, claimedTotalRaw, id);
}

export function deactivateStream(id: string): void {
  getDb().prepare("UPDATE streams SET active = 0 WHERE id = ?").run(id);
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

export function createSubscription(s: Omit<Subscription, "subscriber_email" | "authorized_at" | "next_pull_at" | "active">): Subscription {
  const db = getDb();
  db.prepare(`
    INSERT INTO subscriptions (id, merchant_email, amount_raw, token, interval_days, description, active, created_at)
    VALUES (@id, @merchant_email, @amount_raw, @token, @interval_days, @description, 0, @created_at)
  `).run(s);
  return getSubscription(s.id)!;
}

export function getSubscription(id: string): Subscription | null {
  return getDb().prepare("SELECT * FROM subscriptions WHERE id = ?").get(id) as Subscription | null;
}

export function getAllSubscriptions(): Subscription[] {
  return getDb().prepare("SELECT * FROM subscriptions ORDER BY created_at DESC").all() as Subscription[];
}

export function authorizeSubscription(id: string, subscriberEmail: string, now: number, nextPullAt: number): void {
  getDb().prepare(`
    UPDATE subscriptions SET subscriber_email = ?, authorized_at = ?, next_pull_at = ?, active = 1 WHERE id = ?
  `).run(subscriberEmail, now, nextPullAt, id);
}

export function updateSubscriptionNextPull(id: string, nextPullAt: number): void {
  getDb().prepare("UPDATE subscriptions SET next_pull_at = ? WHERE id = ?").run(nextPullAt, id);
}

export function cancelSubscription(id: string): void {
  getDb().prepare("UPDATE subscriptions SET active = 0 WHERE id = ?").run(id);
}

export function getDueSubscriptions(): Subscription[] {
  return getDb().prepare(
    "SELECT * FROM subscriptions WHERE active = 1 AND next_pull_at IS NOT NULL AND next_pull_at <= ?"
  ).all(Date.now()) as Subscription[];
}

// ─── Contacts ────────────────────────────────────────────────────────────────

export function upsertContact(ownerEmail: string, contactEmail: string): void {
  if (ownerEmail === contactEmail) return;
  getDb().prepare(`
    INSERT OR IGNORE INTO contacts (id, owner_email, contact_email, created_at)
    VALUES (lower(hex(randomblob(8))), ?, ?, ?)
  `).run(ownerEmail, contactEmail, Date.now());
}

export function getContacts(ownerEmail: string): Contact[] {
  return getDb().prepare("SELECT * FROM contacts WHERE owner_email = ? ORDER BY created_at DESC").all(ownerEmail) as Contact[];
}

export function setContactNickname(ownerEmail: string, contactEmail: string, nickname: string): void {
  getDb().prepare("UPDATE contacts SET nickname = ? WHERE owner_email = ? AND contact_email = ?")
    .run(nickname, ownerEmail, contactEmail);
}

export function getContactHistory(ownerEmail: string, contactEmail: string) {
  return getDb().prepare(`
    SELECT * FROM zaps
    WHERE (from_email = ? AND to_email = ?) OR (from_email = ? AND to_email = ?)
    ORDER BY created_at DESC LIMIT 50
  `).all(ownerEmail, contactEmail, contactEmail, ownerEmail);
}
