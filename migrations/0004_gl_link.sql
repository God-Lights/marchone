-- 0004: GL Account (account.officialgl.com) link. One GL user ↔ one MarchOne user.
CREATE TABLE gl_link (
  gl_user_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES "user"(id) ON DELETE CASCADE,
  linked_at INTEGER NOT NULL
);
