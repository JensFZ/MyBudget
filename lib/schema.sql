CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('cash', 'credit', 'tracking', 'closed')),
  balance REAL DEFAULT 0,
  on_budget INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS category_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_hidden INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER REFERENCES category_groups(id),
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_goal INTEGER DEFAULT 0,
  goal_amount REAL,
  goal_type TEXT
);

CREATE TABLE IF NOT EXISTS budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER REFERENCES categories(id),
  month TEXT NOT NULL,
  assigned REAL DEFAULT 0,
  UNIQUE(category_id, month)
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER REFERENCES accounts(id),
  category_id INTEGER REFERENCES categories(id),
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  memo TEXT,
  payee TEXT,
  cleared INTEGER DEFAULT 0,
  flag TEXT,
  transfer_account_id INTEGER REFERENCES accounts(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  target_amount REAL NOT NULL,
  category_id INTEGER REFERENCES categories(id),
  created_at TEXT DEFAULT (datetime('now'))
);
