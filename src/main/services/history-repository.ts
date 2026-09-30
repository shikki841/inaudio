import BetterSqlite3 from 'better-sqlite3';
import type { Database as DatabaseHandle, Statement } from 'better-sqlite3';
import {
  historyQuerySchema,
  transcriptSchema,
  type HistoryPage,
  type HistoryQuery,
  type Transcript,
} from '@shared/domain/history';

interface Row {
  id: string;
  text: string;
  model_id: string;
  duration_ms: number;
  inference_ms: number;
  language: string;
  created_at: number;
}

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

function toTranscript(row: Row): Transcript {
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
  private readonly db: DatabaseHandle;
  private readonly stmts: {
    insert: Statement<[Row]>;
    remove: Statement<[string]>;
    clear: Statement<[]>;
    page: Statement<[number, number], Row>;
    count: Statement<[], { n: number }>;
    search: Statement<[string, number, number], Row>;
    searchCount: Statement<[string], { n: number }>;
  };

  constructor(file: string) {
    this.db = new BetterSqlite3(file);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('secure_delete = ON');
    this.migrate();
    this.stmts = {
      insert: this.db.prepare(
        `INSERT INTO transcripts (id, text, model_id, duration_ms, inference_ms, language, created_at)
         VALUES (@id, @text, @model_id, @duration_ms, @inference_ms, @language, @created_at)`,
      ),
      remove: this.db.prepare('DELETE FROM transcripts WHERE id = ?'),
      clear: this.db.prepare('DELETE FROM transcripts'),
      page: this.db.prepare(
        'SELECT * FROM transcripts ORDER BY created_at DESC LIMIT ? OFFSET ?',
      ),
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
    const { search, limit, offset } = historyQuerySchema.parse(query);
    const fts = toFtsQuery(search);
    if (!fts) {
      return {
        items: this.stmts.page.all(limit, offset).map(toTranscript),
        total: this.stmts.count.get()?.n ?? 0,
      };
    }
    return {
      items: this.stmts.search.all(fts, limit, offset).map(toTranscript),
      total: this.stmts.searchCount.get(fts)?.n ?? 0,
    };
  }

  remove(id: string): void {
    this.stmts.remove.run(id);
  }

  clear(): void {
    this.db.transaction(() => {
      this.stmts.clear.run();
      this.db.exec("INSERT INTO transcripts_fts(transcripts_fts) VALUES ('rebuild')");
    })();
    this.db.exec('VACUUM');
  }

  close(): void {
    this.db.close();
  }

  private migrate(): void {
    const version = this.db.pragma('user_version', { simple: true }) as number;
    const pending = MIGRATIONS.slice(version);
    if (pending.length === 0) return;
    this.db.transaction(() => {
      pending.forEach((sql) => this.db.exec(sql));
      this.db.pragma(`user_version = ${MIGRATIONS.length}`);
    })();
  }
}
