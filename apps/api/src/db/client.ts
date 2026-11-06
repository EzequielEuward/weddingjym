import fs from 'node:fs/promises';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { sql } from 'drizzle-orm';
import { drizzle as drizzleNodePg, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { drizzle as drizzlePglite, type PgliteDatabase } from 'drizzle-orm/pglite';
import pg from 'pg';
import * as schema from './schema.js';

export type AppDatabase =
  | NodePgDatabase<typeof schema>
  | PgliteDatabase<typeof schema>;

export interface DatabaseConnection {
  db: AppDatabase;
  ping(): Promise<void>;
  close(): Promise<void>;
}

const BOOTSTRAP_DDL = `
DO $$ BEGIN
  CREATE TYPE event_mode AS ENUM ('live', 'read_only', 'closed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE photo_section AS ENUM ('general', 'best_outfit', 'best_bloopers');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE deleted_by_role AS ENUM ('author', 'moderator');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS event_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CONSTRAINT event_settings_singleton_chk CHECK (id = 1),
  mode event_mode NOT NULL DEFAULT 'live',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS guest_sessions (
  id UUID PRIMARY KEY,
  alias VARCHAR(30),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS photos (
  id UUID PRIMARY KEY,
  guest_session_id UUID NOT NULL REFERENCES guest_sessions(id),
  author_alias_snapshot VARCHAR(30) NOT NULL,
  section photo_section NOT NULL,
  caption VARCHAR(80),
  storage_key_full VARCHAR(255) NOT NULL,
  storage_key_thumb VARCHAR(255) NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  size_bytes INTEGER NOT NULL,
  deleted_at TIMESTAMPTZ,
  deleted_by deleted_by_role,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_photos_section_created
  ON photos (section, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS votes (
  id UUID PRIMARY KEY,
  photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  guest_session_id UUID NOT NULL REFERENCES guest_sessions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_votes_photo_guest_session
  ON votes (photo_id, guest_session_id);

CREATE INDEX IF NOT EXISTS idx_votes_photo_id
  ON votes (photo_id);

INSERT INTO event_settings (id, mode)
VALUES (1, 'live')
ON CONFLICT (id) DO NOTHING;
`;

export async function createDatabase(databaseUrl: string): Promise<DatabaseConnection> {
  if (databaseUrl.startsWith('pglite://')) {
    const target = databaseUrl.slice('pglite://'.length);
    let client: PGlite;

    if (target === 'memory' || target === '') {
      client = new PGlite();
    } else {
      const resolvedDir = path.resolve(target);
      await fs.mkdir(path.dirname(resolvedDir), { recursive: true });
      client = new PGlite(resolvedDir);
    }

    await client.exec(BOOTSTRAP_DDL);
    const db = drizzlePglite(client, { schema });

    return {
      db,
      async ping() {
        await db.execute(sql`SELECT 1`);
      },
      async close() {
        await client.close();
      },
    };
  }

  const pool = new pg.Pool({
    connectionString: databaseUrl,
    max: 10,
  });

  await pool.query(BOOTSTRAP_DDL);
  const db = drizzleNodePg(pool, { schema });

  return {
    db,
    async ping() {
      await db.execute(sql`SELECT 1`);
    },
    async close() {
      await pool.end();
    },
  };
}
