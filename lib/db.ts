import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'budget.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = fs.readFileSync(path.join(process.cwd(), 'lib', 'schema.sql'), 'utf-8');
db.exec(schema);

// Migrations — safe to run on every startup
const migrations: string[] = [
  `ALTER TABLE accounts ADD COLUMN starred INTEGER DEFAULT 0`,
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    totp_secret TEXT,
    totp_enabled INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS vaults (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS vault_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vault_id INTEGER NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('owner', 'member')),
    joined_at TEXT DEFAULT (datetime('now')),
    UNIQUE(vault_id, user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS vault_invites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vault_id INTEGER NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
    invited_by INTEGER NOT NULL REFERENCES users(id),
    token TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`,
  `ALTER TABLE accounts ADD COLUMN vault_id INTEGER REFERENCES vaults(id)`,
  `ALTER TABLE category_groups ADD COLUMN vault_id INTEGER REFERENCES vaults(id)`,
  `ALTER TABLE users ADD COLUMN avatar TEXT`,
  `ALTER TABLE transactions ADD COLUMN import_hash TEXT`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_import_hash ON transactions(import_hash) WHERE import_hash IS NOT NULL`,
  `ALTER TABLE categories ADD COLUMN color TEXT`,
  `ALTER TABLE accounts ADD COLUMN archived INTEGER DEFAULT 0`,
  `ALTER TABLE categories ADD COLUMN goal_date TEXT`,
  `ALTER TABLE categories ADD COLUMN is_hidden INTEGER DEFAULT 0`,
  `ALTER TABLE category_groups ADD COLUMN is_hidden INTEGER DEFAULT 0`,
  `CREATE TABLE IF NOT EXISTS scheduled_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    category_id INTEGER REFERENCES categories(id),
    payee TEXT,
    memo TEXT,
    amount REAL NOT NULL,
    frequency TEXT NOT NULL,
    next_date TEXT NOT NULL,
    cleared INTEGER DEFAULT 0,
    flag TEXT,
    vault_id INTEGER REFERENCES vaults(id),
    created_at TEXT DEFAULT (datetime('now'))
  )`,
];
for (const sql of migrations) {
  try { db.exec(sql); } catch { /* already exists */ }
}

// One-time migration: extend accounts CHECK constraint to include 'checking' and 'savings'.
// Guarded by app_config so it only runs once regardless of how many times the server starts.
const accountsTypeMigrated = db.prepare("SELECT value FROM app_config WHERE key = 'accounts_type_v2'").get();
if (!accountsTypeMigrated) {
  db.pragma('foreign_keys = OFF');
  db.exec(`
    BEGIN;
    CREATE TABLE accounts_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('cash', 'checking', 'savings', 'credit', 'tracking', 'closed')),
      balance REAL DEFAULT 0,
      on_budget INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      starred INTEGER DEFAULT 0,
      vault_id INTEGER REFERENCES vaults(id),
      archived INTEGER DEFAULT 0
    );
    INSERT INTO accounts_new SELECT id, name, type, balance, on_budget, created_at, starred, vault_id, archived FROM accounts;
    DROP TABLE accounts;
    ALTER TABLE accounts_new RENAME TO accounts;
    INSERT OR IGNORE INTO app_config (key, value) VALUES ('accounts_type_v2', '1');
    COMMIT;
  `);
  db.pragma('foreign_keys = ON');
}

// Generate and persist JWT secret on first run
const existingSecret = db.prepare('SELECT value FROM app_config WHERE key = ?').get('jwt_secret') as { value: string } | undefined;
if (!existingSecret) {
  db.prepare('INSERT INTO app_config (key, value) VALUES (?, ?)').run('jwt_secret', crypto.randomBytes(48).toString('hex'));
}

// Data migration: assign existing accounts/category_groups to a default vault
// Runs only if users exist but no vaults do (= pre-vault install)
const firstUser = db.prepare('SELECT id, name FROM users LIMIT 1').get() as { id: number; name: string } | undefined;
const vaultCount = (db.prepare('SELECT COUNT(*) as c FROM vaults').get() as { c: number }).c;
if (firstUser && vaultCount === 0) {
  const vaultName = `${firstUser.name}s Budget`;
  const vaultId = (db.prepare('INSERT INTO vaults (name) VALUES (?)').run(vaultName)).lastInsertRowid;
  db.prepare('INSERT OR IGNORE INTO vault_members (vault_id, user_id, role) VALUES (?, ?, ?)').run(vaultId, firstUser.id, 'owner');
  db.prepare('UPDATE accounts SET vault_id = ? WHERE vault_id IS NULL').run(vaultId);
  db.prepare('UPDATE category_groups SET vault_id = ? WHERE vault_id IS NULL').run(vaultId);
}

export default db;
