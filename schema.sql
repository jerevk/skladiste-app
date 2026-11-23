PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('ADMIN','KONOBAR')),
 active INTEGER NOT NULL DEFAULT 1, pin_salt TEXT NOT NULL, pin_hash TEXT NOT NULL,
 failed_attempts INTEGER NOT NULL DEFAULT 0, locked_until INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
 expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS items (
 id TEXT PRIMARY KEY, category TEXT NOT NULL CHECK(category IN ('pivo','pica','zesta','toplo','fridge')),
 group_name TEXT NOT NULL, name TEXT NOT NULL, qty REAL NOT NULL DEFAULT 0 CHECK(qty>=0),
 min_qty REAL NOT NULL DEFAULT 5 CHECK(min_qty>=0), price REAL NOT NULL DEFAULT 0 CHECK(price>=0),
 capacity REAL, linked_item_id TEXT REFERENCES items(id), active INTEGER NOT NULL DEFAULT 1,
 version INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS movements (
 id TEXT PRIMARY KEY, item_id TEXT NOT NULL REFERENCES items(id),
 movement_type TEXT NOT NULL, delta REAL NOT NULL, before_qty REAL NOT NULL, after_qty REAL NOT NULL,
 actor_id TEXT NOT NULL REFERENCES users(id), note TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS supply_requests (
 id TEXT PRIMARY KEY, created_by TEXT NOT NULL REFERENCES users(id),
 confirmed_by TEXT REFERENCES users(id), status TEXT NOT NULL DEFAULT 'CEKA',
 note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 confirmed_at TEXT
);
CREATE TABLE IF NOT EXISTS supply_lines (
 id TEXT PRIMARY KEY, request_id TEXT NOT NULL REFERENCES supply_requests(id),
 item_id TEXT NOT NULL REFERENCES items(id), qty REAL NOT NULL CHECK(qty>0),
 decision TEXT NOT NULL DEFAULT '', stock_before REAL, stock_after REAL
);
CREATE TABLE IF NOT EXISTS guard_checks (ok INTEGER NOT NULL CHECK(ok=1));
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category,active);
CREATE INDEX IF NOT EXISTS idx_movements_created ON movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_requests_user ON supply_requests(created_by,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_exp ON sessions(expires_at);
