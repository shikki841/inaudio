import { DatabaseSync, type SQLInputValue, type StatementSync } from 'node:sqlite';
import {
  historyQuerySchema,
  transcriptSchema,
  type HistoryPage,
  type HistoryQuery,
  type Transcript,
} from '@shared/domain/history';

const MIGRATIONS = [
  `CREATE TABLE transcripts (
     id TEXT PRIMARY KEY,
     text TEXT NOT NULL CHECK (length(text) <= 20000),
     model_id TEXT NOT NULL,
     duration_ms INTEGER NOT NULL CHECK (duration_ms >= 0),
     inference_ms INTEGER NOT NULL CHECK (inference_ms >= 0),
     language TEXT NOT NULL DEFAULT '',
     created_at INTEGER NOT NULL
   ) STRICT;
   CREATE INDEX transcripts_created_at ON transcripts (created_at DESC);
   CREATE VIRTUAL TABLE transcripts_fts USING fts5(text, content='transcripts', content_rowid='rowid');
   CREATE TRIGGER transcripts_ai AFTER INSERT ON transcripts BEGIN
     INSERT INTO transcripts_fts(rowid, text) VALUES (new.rowid, new.text);
   END;
   CREATE TRIGGER transcripts_ad AFTER DELETE ON transcripts BEGIN
     INSERT INTO transcripts_fts(transcripts_fts, rowid, text) VALUES ('delete', old.rowid, old.text);
   END;`,
];

/**
 * Turns free text into an FTS5 prefix query. Each token is quoted, so user
 * input can never be read as FTS operators or SQL.
 */
export function toFtsQuery(search: string): string | null {
  const tokens = search
    .normalize('NFKC')
    .split(/\s+/)
    .map((t) => t.replace(/"/g, '').trim())
    .filter(Boolean)
    .slice(0, 12);
  if (tokens.length === 0) return null;
  return tokens.map((t) => `"${t}"*`).join(' ');
}

function toTranscript(row: Record<string, unknown>): Transcript {
  return transcriptSchema.parse({
    id: row.id,
    text: row.text,
    modelId: row.model_id,
    durationMs: row.duration_ms,
    inferenceMs: row.inference_ms,
    language: row.language,
    createdAt: row.created_at,
  });
}

export class HistoryRepository {
  private readonly db: DatabaseSync;
  private closed = false;
  private readonly stmts: {
    insert: StatementSync;
    remove: StatementSync;
    clear: StatementSync;
    page: StatementSync;
    count: StatementSync;
    search: StatementSync;
    searchCount: StatementSync;
  };

  constructor(file: string) {
    this.db = new DatabaseSync(file);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      PRAGMA secure_delete = ON;
      PRAGMA busy_timeout = 5000;
    `);
    this.migrate();
    this.stmts = {
      insert: this.db.prepare(
        `INSERT INTO transcripts (id, text, model_id, duration_ms, inference_ms, language, created_at)
         VALUES (@id, @text, @model_id, @duration_ms, @inference_ms, @language, @created_at)`,
      ),
      remove: this.db.prepare('DELETE FROM transcripts WHERE id = ?'),
      clear: this.db.prepare('DELETE FROM transcripts'),
      page: this.db.prepare('SELECT * FROM transcripts ORDER BY created_at DESC LIMIT ? OFFSET ?'),
      count: this.db.prepare('SELECT count(*) AS n FROM transcripts'),
      search: this.db.prepare(
        `SELECT t.* FROM transcripts_fts f JOIN transcripts t ON t.rowid = f.rowid
         WHERE transcripts_fts MATCH ? ORDER BY t.created_at DESC LIMIT ? OFFSET ?`,
      ),
      searchCount: this.db.prepare(
        'SELECT count(*) AS n FROM transcripts_fts WHERE transcripts_fts MATCH ?',
      ),
    };
  }

  add(transcript: Transcript): void {
    this.assertOpen();
    const t = transcriptSchema.parse(transcript);
    this.stmts.insert.run({
      id: t.id,
      text: t.text,
      model_id: t.modelId,
      duration_ms: t.durationMs,
      inference_ms: t.inferenceMs,
      language: t.language,
      created_at: t.createdAt,
    });
  }

  list(query: HistoryQuery): HistoryPage {
    this.assertOpen();
    const { search, limit, offset } = historyQuerySchema.parse(query);
    const fts = toFtsQuery(search);
    if (!fts) {
      return {
        items: this.stmts.page.all(limit, offset).map(toTranscript),
        total: this.readCount(this.stmts.count),
      };
    }
    return {
      items: this.stmts.search.all(fts, limit, offset).map(toTranscript),
      total: this.readCount(this.stmts.searchCount, fts),
    };
  }

  remove(id: string): void {
    this.assertOpen();
    this.stmts.remove.run(id);
  }

  clear(): void {
    this.assertOpen();
    this.transaction(() => {
      this.stmts.clear.run();
      this.db.exec("INSERT INTO transcripts_fts(transcripts_fts) VALUES ('rebuild')");
    });
    this.db.exec('VACUUM');
  }

  close(): void {
    if (this.closed) return;
    this.db.close();
    this.closed = true;
  }

  private migrate(): void {
    const row = this.db.prepare('PRAGMA user_version').get() as
      { user_version?: unknown } | undefined;
    const version = row?.user_version;
    if (
      typeof version !== 'number' ||
      !Number.isSafeInteger(version) ||
      version < 0 ||
      version > MIGRATIONS.length
    ) {
      throw new Error('Invalid history database migration version');
    }
    const pending = MIGRATIONS.slice(version);
    if (pending.length === 0) return;
    this.transaction(() => {
      pending.forEach((sql) => this.db.exec(sql));
      this.db.exec(`PRAGMA user_version = ${MIGRATIONS.length}`);
    });
  }

  private transaction(fn: () => void): void {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      fn();
      this.db.exec('COMMIT');
    } catch (error) {
      try {
        this.db.exec('ROLLBACK');
      } catch (rollbackError) {
        throw new Error('History database rollback failed', { cause: rollbackError });
      }
      throw error;
    }
  }

  private readCount(statement: StatementSync, ...params: SQLInputValue[]): number {
    const row = statement.get(...params) as { n?: unknown } | undefined;
    if (!row || typeof row.n !== 'number' || !Number.isSafeInteger(row.n) || row.n < 0) {
      throw new Error('Invalid history database count');
    }
    return row.n;
  }

  private assertOpen(): void {
    if (this.closed) throw new Error('History database is closed');
  }
}
