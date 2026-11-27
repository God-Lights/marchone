-- 0003: location-based quests ("길 위의 부탁") and refund ledger support.
CREATE TABLE quest_progress (
  journey_id TEXT NOT NULL REFERENCES journey(id) ON DELETE CASCADE,
  quest_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('accepted', 'completed', 'declined')),
  accepted_at INTEGER,
  completed_at INTEGER,
  PRIMARY KEY (journey_id, quest_id)
);
CREATE INDEX idx_txn_type ON txn(journey_id, type);
