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

CREATE TABLE IF NOT EXISTS snapshots (
 id TEXT PRIMARY KEY,
 created_by TEXT NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS snapshot_lines (
 snapshot_id TEXT NOT NULL REFERENCES snapshots(id),
 item_id TEXT NOT NULL REFERENCES items(id),
 qty REAL NOT NULL,
 PRIMARY KEY(snapshot_id,item_id)
);
CREATE TABLE IF NOT EXISTS guard_checks (ok INTEGER NOT NULL CHECK(ok=1));
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category,active);
CREATE INDEX IF NOT EXISTS idx_movements_created ON movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_requests_user ON supply_requests(created_by,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_exp ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS audit_events (
 id TEXT PRIMARY KEY,
 user_id TEXT REFERENCES users(id),
 actor_name TEXT NOT NULL,
 action TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '',
 device_id TEXT NOT NULL DEFAULT '',
 device_label TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_events_created ON audit_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_user ON audit_events(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS audit_undo (
 audit_id TEXT PRIMARY KEY REFERENCES audit_events(id),
 before_json TEXT NOT NULL,
 after_json TEXT NOT NULL,
 undone_at TEXT,
 undone_by TEXT REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_audit_undo_active ON audit_undo(undone_at);

-- Samostalni početni katalog; sve početne količine su 0, nisu stvarne zalihe.
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pivo-001','pivo','Veliko pivo','Ožujsko',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pivo-002','pivo','Veliko pivo','Staropramen',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pivo-003','pivo','Veliko pivo','Becks',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pivo-004','pivo','Veliko pivo','Vukovarsko',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pivo-005','pivo','Malo pivo','Ožujsko 0,33',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pivo-006','pivo','Malo pivo','Staropramen 0,33',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pivo-007','pivo','Malo pivo','Bavaria',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pivo-008','pivo','Tomislav i Radler','Tomislav',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pivo-009','pivo','Tomislav i Radler','Limun',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pivo-010','pivo','Tomislav i Radler','Grejp',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pivo-011','pivo','Ostala piva','Blue Moon',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pivo-012','pivo','Ostala piva','Madri',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pivo-013','pivo','Ostala piva','Stella',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pica-001','pica','Gazirani sok','Coca Cola',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pica-002','pica','Gazirani sok','Coca Cola Zero',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pica-003','pica','Gazirani sok','Schweppes Tangerina',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pica-004','pica','Gazirani sok','Schweppes Bitter Lemon',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pica-005','pica','Gazirani sok','Schweppes Tonic',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pica-006','pica','Gazirani sok','Cockta',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pica-007','pica','Gazirani sok','7up',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pica-008','pica','Gazirani sok','Orangina',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pica-009','pica','Mala mineralna','Jana 0,33',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pica-010','pica','Mala mineralna','Jamnica 0,33',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pica-011','pica','Sommersby','Aspall',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pica-012','pica','Sommersby','Sommersby',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pica-013','pica','Hidra','Limun',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pica-014','pica','Hidra','Vital',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pica-015','pica','Hidra','Naranča',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pica-016','pica','Jana Vitamin','Limun',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pica-017','pica','Jana Vitamin','Menta',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pica-018','pica','Jana Vitamin','Naranča',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pica-019','pica','Senzacija','Limeta',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pica-020','pica','Senzacija','Limunska trava',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pica-021','pica','Senzacija','Marakuja',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pica-022','pica','Senzacija','Bazga',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pica-023','pica','Okusi','Limunada',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pica-024','pica','Okusi','Narančada',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pica-025','pica','Ledeni čaj','Šumsko voće',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pica-026','pica','Ledeni čaj','Limun',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pica-027','pica','Ledeni čaj','Breskva',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pica-028','pica','Pago','Naranča',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pica-029','pica','Pago','Ananas',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pica-030','pica','Pago','Marelica',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pica-031','pica','Pago','Jagoda',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pica-032','pica','Pago','Crni ribiz',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pica-033','pica','Pago','Kruška',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pica-034','pica','Pago','Jabuka',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pica-035','pica','Mineralna','Jamnica',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pica-036','pica','Energetska pića','Red Bull',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pica-037','pica','Energetska pića','Red Bull White Peach',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pica-038','pica','Energetska pića','Red Bull Zero',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pica-039','pica','Cedevita','Naranča',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pica-040','pica','Cedevita','Limun',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pica-041','pica','Cedevita','Mango',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pica-042','pica','Cedevita','Bazga',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pica-043','pica','Cedevita','Limeta',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pica-044','pica','Cedevita','Limunska trava',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pica-045','pica','Cedevita','Grejp',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pica-046','pica','Vino','Bijelo Kutjevo',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pica-047','pica','Vino','Bijelo Erdut',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pica-048','pica','Vino','Bijelo Ilok',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-pica-049','pica','Vino','Crno Klikun',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-zesta-001','zesta','Žesta','Konjak',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-zesta-002','zesta','Žesta','Stock',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-zesta-003','zesta','Žesta','Gin',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-zesta-004','zesta','Žesta','Amaro 18',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-zesta-005','zesta','Žesta','Pelinkovac',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-zesta-006','zesta','Žesta','Pelin Antique',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-zesta-007','zesta','Žesta','Šljivovica',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-zesta-008','zesta','Žesta','Lozovača',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-zesta-009','zesta','Žesta','Roner Williams',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-zesta-010','zesta','Žesta','Liker borovnica',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-zesta-011','zesta','Žesta','Vodka',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-zesta-012','zesta','Žesta','Vigor Blueberry',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-zesta-013','zesta','Žesta','Medovača',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-zesta-014','zesta','Žesta','Martini bianco',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-zesta-015','zesta','Žesta','Jack Daniels',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-zesta-016','zesta','Žesta','Johnnie Walker',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-zesta-017','zesta','Žesta','Bacardi Rum',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-zesta-018','zesta','Žesta','Korlat Orahovac',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-zesta-019','zesta','Žesta','Korlat Dunja',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-zesta-020','zesta','Žesta','Korlat Vilja',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-zesta-021','zesta','Žesta','Jameson',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-zesta-022','zesta','Žesta','Bombay Gin',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-zesta-023','zesta','Žesta','Jegermeister',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-zesta-024','zesta','Žesta','Višnjevac',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-toplo-001','toplo','Cappuccino','Čokolada',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-toplo-002','toplo','Cappuccino','Vanilija',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-toplo-003','toplo','Cappuccino','Kokos',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-toplo-004','toplo','Cappuccino','Irish',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-toplo-005','toplo','Cappuccino','Bajadera',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-toplo-006','toplo','Cappuccino','Classic',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-toplo-007','toplo','Cappuccino','Nougat',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-toplo-008','toplo','Cappuccino','Ledena kava',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-toplo-009','toplo','Topli napitci','Kava',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-toplo-010','toplo','Topli napitci','Šećer',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-toplo-011','toplo','Topli napitci','Nesica',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-toplo-012','toplo','Topli napitci','Topla čokolada',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-toplo-013','toplo','Topli napitci','Kakao',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-toplo-014','toplo','Topli napitci','Mlijeko',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-toplo-015','toplo','Topli napitci','Šlag',0,5,0,NULL);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-fridge-001','fridge','Frižider','Ožujsko',0,5,0,24);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-fridge-002','fridge','Frižider','Staropramen',0,5,0,24);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-fridge-003','fridge','Frižider','Becks',0,5,0,24);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-fridge-004','fridge','Frižider','Vukovarsko',0,5,0,24);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-fridge-005','fridge','Frižider','Ožujsko 0,33',0,5,0,24);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-fridge-006','fridge','Frižider','Staropramen 0,33',0,5,0,24);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-fridge-007','fridge','Frižider','Bavaria',0,5,0,24);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-fridge-008','fridge','Frižider','Tomislav',0,5,0,24);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-fridge-009','fridge','Frižider','Limun',0,5,0,24);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-fridge-010','fridge','Frižider','Grejp',0,5,0,24);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-fridge-011','fridge','Frižider','Blue Moon',0,5,0,24);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-fridge-012','fridge','Frižider','Madri',0,5,0,24);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-fridge-013','fridge','Frižider','Stella',0,5,0,24);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-fridge-014','fridge','Frižider','Jana',0,5,0,24);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-fridge-015','fridge','Frižider','Jamnica',0,5,0,24);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-fridge-016','fridge','Frižider','Coca Cola',0,5,0,24);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-fridge-017','fridge','Frižider','Coca Cola Zero',0,5,0,24);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-fridge-018','fridge','Frižider','Red Bull',0,5,0,24);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-fridge-019','fridge','Frižider','Red Bull Zero',0,5,0,24);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-fridge-020','fridge','Frižider','Breskva',0,5,0,24);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-fridge-021','fridge','Frižider','Limun',0,5,0,24);
INSERT OR IGNORE INTO items(id,category,group_name,name,qty,min_qty,price,capacity) VALUES('seed-fridge-022','fridge','Frižider','Naranča',0,5,0,24);


-- Daily closing balances in Europe/Zagreb; the latest entry on an inactive day
-- is carried forward when comparing dates.
CREATE TABLE IF NOT EXISTS daily_stock_state (
 business_date TEXT PRIMARY KEY,
 payload TEXT NOT NULL,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
