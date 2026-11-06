import { randomUUID } from 'node:crypto';
import { HealthResponseSchema } from '@wedding/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { createDatabase, type DatabaseConnection } from './db/client.js';
import { eventSettings, guestSessions, photos, votes } from './db/schema.js';
import { InMemoryPhotoStorage } from './storage/photo-storage.js';
import { createTestAgent } from './test-utils/in-memory-agent.js';

describe('API Foundation: PostgreSQL schema, /api/health, and /media seam', () => {
  let conn: DatabaseConnection | undefined;

  afterEach(async () => {
    if (conn) {
      await conn.close();
      conn = undefined;
    }
  });

  it('responds 200 on GET /api/health with noindex header and healthy PostgreSQL + storage status', async () => {
    conn = await createDatabase('pglite://memory');
    const storage = new InMemoryPhotoStorage();
    const app = createApp({
      db: conn.db,
      storage,
      cookieSecret: 'test-cookie-secret-at-least-32-chars-long',
    });

    const agent = createTestAgent(app);
    const res = await agent.get('/api/health');

    expect(res.status).toBe(200);
    expect(res.headers['x-robots-tag']).toBe('noindex, nofollow');

    const parsed = HealthResponseSchema.parse(res.body);
    expect(parsed.status).toBe('ok');
    expect(parsed.database).toBe('ok');
    expect(parsed.storage).toBe('memory');
  });

  it('seeds singleton event_settings (mode = live) and enforces UNIQUE(photo_id, guest_session_id) in PostgreSQL', async () => {
    conn = await createDatabase('pglite://memory');
    const { db } = conn;

    const settings = await db.select().from(eventSettings);
    expect(settings).toHaveLength(1);
    expect(settings[0]?.id).toBe(1);
    expect(settings[0]?.mode).toBe('live');

    await expect(
      db.insert(eventSettings).values({ id: 2, mode: 'closed' }),
    ).rejects.toThrow();

    const sessionId = randomUUID();
    const photoId = randomUUID();

    await db.insert(guestSessions).values({
      id: sessionId,
      alias: 'Joa',
    });

    await db.insert(photos).values({
      id: photoId,
      guestSessionId: sessionId,
      authorAliasSnapshot: 'Joa',
      section: 'best_outfit',
      caption: 'Elegante sport',
      storageKeyFull: `full/${photoId}.webp`,
      storageKeyThumb: `thumb/${photoId}.webp`,
      width: 1080,
      height: 1350,
      sizeBytes: 320_000,
    });

    await db.insert(votes).values({
      id: randomUUID(),
      photoId,
      guestSessionId: sessionId,
    });

    await expect(
      db.insert(votes).values({
        id: randomUUID(),
        photoId,
        guestSessionId: sessionId,
      }),
    ).rejects.toThrow();
  });

  it('serves stored images via GET /media/:variant/:file with immutable caching when using local/memory storage', async () => {
    conn = await createDatabase('pglite://memory');
    const storage = new InMemoryPhotoStorage();
    const photoId = '0195f0a0-9999-7000-8000-000000000099';
    const fakeWebp = Buffer.from('RIFF-fake-webp-payload');

    await storage.putPhoto({
      id: photoId,
      fullBuffer: fakeWebp,
      thumbBuffer: fakeWebp,
    });

    const app = createApp({
      db: conn.db,
      storage,
      cookieSecret: 'test-cookie-secret-at-least-32-chars-long',
    });

    const agent = createTestAgent(app);
    const okRes = await agent.get(`/media/thumb/${photoId}.webp`);
    expect(okRes.status).toBe(200);
    expect(String(okRes.headers['content-type'])).toContain('image/webp');
    expect(okRes.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(okRes.rawBody).toEqual(fakeWebp);

    const missingRes = await agent.get('/media/thumb/does-not-exist.webp');
    expect(missingRes.status).toBe(404);
  });
});
