import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

export function createDatabase(databasePath: string): DatabaseSync {
  if (databasePath !== ":memory:") {
    mkdirSync(dirname(databasePath), { recursive: true });
  }

  const database = new DatabaseSync(databasePath);
  database.exec("PRAGMA journal_mode = WAL;");
  database.exec("PRAGMA foreign_keys = ON;");
  migrate(database);
  return database;
}

function migrate(database: DatabaseSync): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS proposals (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      status TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      payload_hash TEXT NOT NULL,
      requester_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      expires_at TEXT,
      status_reason TEXT,
      approval_json TEXT,
      rejection_json TEXT,
      execution_json TEXT,
      version INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS proposals_status_idx ON proposals (status);
    CREATE INDEX IF NOT EXISTS proposals_kind_idx ON proposals (kind);
    CREATE INDEX IF NOT EXISTS proposals_expires_idx ON proposals (expires_at);

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      proposal_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT,
      actor_json TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      metadata_json TEXT,
      FOREIGN KEY (proposal_id) REFERENCES proposals(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS audit_log_proposal_idx ON audit_log (proposal_id, timestamp);
  `);
}
