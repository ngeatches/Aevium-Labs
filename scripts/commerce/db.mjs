import { DatabaseSync, backup } from 'node:sqlite';
import { mkdirSync, chmodSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

// Ordered, append-only schema migrations. Never edit a released migration; add a new one.
// Migration 1 reproduces the October 13 handoff schema with IF NOT EXISTS so existing demo
// databases (which predate schema_migrations) are adopted without data changes.
export const migrations = [
  { id: 1, name: 'handoff-baseline', up(db) {
    db.exec(`CREATE TABLE IF NOT EXISTS customers (id TEXT PRIMARY KEY, phone TEXT NOT NULL UNIQUE, created INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY, owner TEXT NOT NULL, idem TEXT NOT NULL,
        created INTEGER NOT NULL, updated INTEGER NOT NULL, status TEXT NOT NULL,
        items TEXT NOT NULL, customer TEXT NOT NULL, total INTEGER NOT NULL,
        payment TEXT, shipping TEXT, events TEXT NOT NULL,
        UNIQUE(owner, idem)
      );
      CREATE TABLE IF NOT EXISTS proofs (order_id TEXT PRIMARY KEY REFERENCES orders(id), name TEXT NOT NULL, type TEXT NOT NULL, bytes BLOB NOT NULL);
      CREATE TABLE IF NOT EXISTS email_outbox (
        id TEXT PRIMARY KEY, event_key TEXT NOT NULL UNIQUE, order_id TEXT NOT NULL REFERENCES orders(id),
        kind TEXT NOT NULL, recipient TEXT NOT NULL, subject TEXT NOT NULL, text TEXT NOT NULL, html TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
        created INTEGER NOT NULL, available INTEGER NOT NULL, processed INTEGER, error TEXT
      );
      CREATE INDEX IF NOT EXISTS email_due ON email_outbox(status,available);`);
    const columns = db.prepare('PRAGMA table_info(orders)').all().map(c => c.name);
    for (const column of ['policy', 'instructions']) if (!columns.includes(column)) db.exec(`ALTER TABLE orders ADD COLUMN ${column} TEXT`);
    db.exec('CREATE INDEX IF NOT EXISTS orders_owner_created ON orders(owner,created); CREATE INDEX IF NOT EXISTS orders_status ON orders(status)');
  } },
  { id: 2, name: 'persistent-auth-and-throttles', up(db) {
    db.exec(`CREATE TABLE auth_challenges (
        id_hash TEXT PRIMARY KEY, role TEXT NOT NULL, phone TEXT NOT NULL, binding TEXT NOT NULL,
        secret TEXT, deliverable INTEGER NOT NULL DEFAULT 1, tries INTEGER NOT NULL DEFAULT 0,
        created INTEGER NOT NULL, expires INTEGER NOT NULL
      );
      CREATE INDEX auth_challenges_binding ON auth_challenges(binding, role);
      CREATE TABLE auth_sessions (
        token_hash TEXT PRIMARY KEY, role TEXT NOT NULL, subject TEXT NOT NULL, phone TEXT NOT NULL,
        binding TEXT, created INTEGER NOT NULL, expires INTEGER NOT NULL
      );
      CREATE INDEX auth_sessions_subject ON auth_sessions(role, subject);
      CREATE TABLE rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
      CREATE TABLE customer_phone_changes (
        id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id TEXT NOT NULL REFERENCES customers(id),
        old_phone TEXT NOT NULL, new_phone TEXT NOT NULL, changed_by TEXT NOT NULL, note TEXT NOT NULL, at INTEGER NOT NULL
      );`);
  } },
  { id: 3, name: 'email-delivery-tracking', up(db) {
    for (const sql of [
      'ALTER TABLE email_outbox ADD COLUMN provider TEXT',
      'ALTER TABLE email_outbox ADD COLUMN provider_id TEXT',
      'ALTER TABLE email_outbox ADD COLUMN lease_until INTEGER',
      'ALTER TABLE email_outbox ADD COLUMN first_attempt INTEGER',
      'ALTER TABLE email_outbox ADD COLUMN idem_round INTEGER NOT NULL DEFAULT 0',
      'ALTER TABLE email_outbox ADD COLUMN last_event TEXT',
      'ALTER TABLE email_outbox ADD COLUMN last_event_at INTEGER',
      'ALTER TABLE email_outbox ADD COLUMN delivered_at INTEGER',
      'ALTER TABLE email_outbox ADD COLUMN rejected INTEGER NOT NULL DEFAULT 0'
    ]) db.exec(sql);
    db.exec(`CREATE UNIQUE INDEX email_provider_id ON email_outbox(provider, provider_id) WHERE provider_id IS NOT NULL;
      CREATE TABLE webhook_events (
        id TEXT PRIMARY KEY, provider TEXT NOT NULL, type TEXT NOT NULL, provider_message_id TEXT,
        occurred INTEGER, received INTEGER NOT NULL, applied INTEGER NOT NULL DEFAULT 0, bounce_type TEXT
      );
      CREATE TABLE email_suppressions (recipient TEXT PRIMARY KEY, reason TEXT NOT NULL, at INTEGER NOT NULL, source_event TEXT);`);
  } },
  { id: 4, name: 'order-shipping-fee-and-pagination', up(db) {
    db.exec(`ALTER TABLE orders ADD COLUMN shipping_fee INTEGER NOT NULL DEFAULT 0;
      CREATE INDEX orders_created_id ON orders(created DESC, id DESC);
      CREATE INDEX orders_status_created ON orders(status, created DESC, id DESC);
      CREATE INDEX email_created ON email_outbox(created DESC, id DESC);`);
  } },
  // Accounts can belong to a phone number or an email address, and hold the sign-up profile.
  // Rebuilds customers (phone becomes optional), so it runs with foreign keys paused.
  { id: 5, name: 'customer-email-and-profile', foreignKeysOff: true, up(db) {
    db.exec(`CREATE TABLE customers_v5 (
        id TEXT PRIMARY KEY, phone TEXT UNIQUE, email TEXT UNIQUE, created INTEGER NOT NULL,
        first_name TEXT, last_name TEXT, birth_date TEXT, role TEXT,
        profile_completed INTEGER, terms_version TEXT,
        CHECK (phone IS NOT NULL OR email IS NOT NULL)
      );
      INSERT INTO customers_v5(id,phone,created) SELECT id,phone,created FROM customers;
      DROP TABLE customers;
      ALTER TABLE customers_v5 RENAME TO customers;`);
  } }
];

export function migrate(db, now = Date.now) {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL, checksum TEXT NOT NULL, applied INTEGER NOT NULL)');
  const applied = new Map(db.prepare('SELECT id, checksum FROM schema_migrations').all().map(row => [row.id, row.checksum]));
  const latest = Math.max(0, ...applied.keys());
  if (latest > migrations.at(-1).id) throw new Error(`Database schema ${latest} is newer than this application (${migrations.at(-1).id}). Deploy the newer release or restore a matching backup.`);
  const ran = [];
  for (const migration of migrations) {
    const checksum = createHash('sha256').update(migration.up.toString()).digest('hex').slice(0, 16);
    if (applied.has(migration.id)) continue;
    // Table rebuilds follow SQLite's documented procedure: foreign keys off outside the transaction,
    // then foreign_key_check before commit.
    const keysWereOn = migration.foreignKeysOff && db.prepare('PRAGMA foreign_keys').get().foreign_keys === 1;
    if (keysWereOn) db.exec('PRAGMA foreign_keys=OFF');
    db.exec('BEGIN IMMEDIATE');
    try {
      migration.up(db);
      if (migration.foreignKeysOff && db.prepare('PRAGMA foreign_key_check').all().length) throw new Error('foreign key check failed');
      db.prepare('INSERT INTO schema_migrations(id,name,checksum,applied) VALUES (?,?,?,?)').run(migration.id, migration.name, checksum, now());
      db.exec('COMMIT'); ran.push(migration.id);
    } catch (error) { db.exec('ROLLBACK'); throw new Error(`Migration ${migration.id} (${migration.name}) failed: ${error.message}`); }
    finally { if (keysWereOn) db.exec('PRAGMA foreign_keys=ON'); }
  }
  return ran;
}

export function openDatabase(filename, { now = Date.now } = {}) {
  if (filename !== ':memory:') mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(filename);
  if (filename !== ':memory:') {
    chmodSync(filename, 0o600);
    db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;');
  }
  db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  migrate(db, now);
  return db;
}

// Online, consistent copy using SQLite's backup API (safe while the server is running).
export async function backupDatabase(sourceFile, targetFile) {
  if (!existsSync(sourceFile)) throw new Error('Database file not found.');
  mkdirSync(path.dirname(targetFile), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(sourceFile, { readOnly: true });
  try { await backup(db, targetFile); } finally { db.close(); }
  chmodSync(targetFile, 0o600);
  const single = new DatabaseSync(targetFile);
  try { single.exec('PRAGMA journal_mode=DELETE'); } finally { single.close(); } // self-contained single file
  const check = new DatabaseSync(targetFile, { readOnly: true });
  try {
    const result = check.prepare('PRAGMA integrity_check').get();
    const value = Object.values(result)[0];
    if (value !== 'ok') throw new Error('Backup integrity check failed: ' + value);
    const tables = new Set(check.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row => row.name));
    return { schema: tables.has('schema_migrations') ? check.prepare('SELECT MAX(id) AS id FROM schema_migrations').get().id : 0, orders: tables.has('orders') ? check.prepare('SELECT COUNT(*) AS n FROM orders').get().n : 0 };
  } finally { check.close(); }
}
