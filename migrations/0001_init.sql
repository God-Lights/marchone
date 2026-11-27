-- MarchOne initial schema
CREATE TABLE user (
  id TEXT PRIMARY KEY,
  home_currency TEXT NOT NULL DEFAULT 'KRW',
  settings_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE journey (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id),
  started_at INTEGER NOT NULL,
  time_scale REAL NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active',
  next_notify_at INTEGER,
  last_seen_at INTEGER
);
CREATE INDEX idx_journey_notify ON journey(next_notify_at) WHERE status = 'active';

CREATE TABLE leg (
  id TEXT PRIMARY KEY,
  journey_id TEXT NOT NULL REFERENCES journey(id),
  seq INTEGER NOT NULL,
  from_json TEXT NOT NULL,
  to_json TEXT NOT NULL,
  mode TEXT NOT NULL,
  pace TEXT NOT NULL DEFAULT 'normal',
  polyline_key TEXT,
  distance_m REAL,
  UNIQUE (journey_id, seq)
);

CREATE TABLE traveler (
  journey_id TEXT PRIMARY KEY REFERENCES journey(id),
  name TEXT NOT NULL DEFAULT '마치',
  level INTEGER NOT NULL DEFAULT 1,
  xp REAL NOT NULL DEFAULT 0,
  appearance_json TEXT NOT NULL DEFAULT '{}',
  culture_tags_json TEXT NOT NULL DEFAULT '{}',
  stat_stamina REAL NOT NULL DEFAULT 70,
  stat_mood REAL NOT NULL DEFAULT 70,
  stat_curiosity REAL NOT NULL DEFAULT 50,
  stat_culture REAL NOT NULL DEFAULT 50,
  stats_at INTEGER NOT NULL
);

CREATE TABLE wallet (
  journey_id TEXT NOT NULL REFERENCES journey(id),
  currency TEXT NOT NULL,
  balance REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (journey_id, currency)
);

CREATE TABLE txn (
  id TEXT PRIMARY KEY,
  journey_id TEXT NOT NULL REFERENCES journey(id),
  ts INTEGER NOT NULL,
  type TEXT NOT NULL,
  currency TEXT NOT NULL,
  amount REAL NOT NULL,
  ref_id TEXT
);

CREATE TABLE meal (
  id TEXT PRIMARY KEY,
  journey_id TEXT NOT NULL REFERENCES journey(id),
  ts_utc INTEGER NOT NULL,
  local_ts TEXT NOT NULL,
  dish_id TEXT NOT NULL,
  price REAL NOT NULL,
  auto INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE camp_item (
  journey_id TEXT NOT NULL REFERENCES journey(id),
  product_id TEXT NOT NULL,
  slot TEXT,
  x REAL,
  y REAL,
  acquired_at INTEGER NOT NULL
);

CREATE TABLE companion (
  id TEXT PRIMARY KEY,
  journey_id TEXT NOT NULL REFERENCES journey(id),
  species TEXT NOT NULL,
  met_region TEXT,
  met_at INTEGER NOT NULL
);

CREATE TABLE stamp (
  journey_id TEXT NOT NULL REFERENCES journey(id),
  kind TEXT NOT NULL,
  key TEXT NOT NULL,
  ts INTEGER NOT NULL,
  PRIMARY KEY (journey_id, kind, key)
);

CREATE TABLE postcard (
  id TEXT PRIMARY KEY,
  journey_id TEXT NOT NULL REFERENCES journey(id),
  ts INTEGER NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  text TEXT,
  r2_key TEXT
);

CREATE TABLE push_sub (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id),
  endpoint TEXT NOT NULL UNIQUE,
  keys_json TEXT NOT NULL
);
