import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { createDatabase, type DatabaseConnection } from './db/client.js';
import { InMemoryPhotoStorage } from './storage/photo-storage.js';
import { createTestAgent } from './test-utils/in-memory-agent.js';

async function makeTestImageBuffer(color = { r: 220, g: 180, b: 140 }): Promise<Buffer> {
  return sharp({
    create: {
      width: 800,
      height: 1000,
      channels: 3,
      background: color,
    },
  })
    .jpeg({ quality: 85 })
    .toBuffer();
}

describe('Wedding App End-to-End API Flows (QR Gate, Uploads, Best Outfit, Votes, Moderator)', () => {
  let conn: DatabaseConnection | undefined;

  afterEach(async () => {
    if (conn) {
      await conn.close();
      conn = undefined;
    }
  });

  async function setupTestApp(requireQrGate = true) {
    conn = await createDatabase('pglite://memory');
    const storage = new InMemoryPhotoStorage();
    const app = createApp({
      db: conn.db,
      storage,
      cookieSecret: 'super-secret-cookie-signing-key-2026-joa-maga',
      qrGateToken: 'qr-salon-aldeano-2026',
      moderatorPin: '071126',
      requireQrGate,
    });
    return { app, storage };
  }

  it('enforces QR gate when enabled and provisions separate guest sessions from the same shared QR URL', async () => {
    const { app } = await setupTestApp(true);

    const stranger = createTestAgent(app, '203.0.113.5');
    const blockedRes = await stranger.get('/api/photos?section=general');
    expect(blockedRes.status).toBe(401);

    const badQr = await stranger.get('/entrar?evento=wrong-token');
    expect(badQr.status).toBe(403);

    // Guest A and Guest B scan the EXACT SAME printed QR code on venue shared Wi-Fi IP
    const agentA = createTestAgent(app, '198.51.100.20');
    const agentB = createTestAgent(app, '198.51.100.20');

    const enterA = await agentA.get('/entrar?evento=qr-salon-aldeano-2026');
    expect(enterA.status).toBe(302);
    expect(enterA.headers.location).toBe('/');

    const enterB = await agentB.get('/entrar?evento=qr-salon-aldeano-2026');
    expect(enterB.status).toBe(302);

    expect((await agentA.put('/api/session/alias', { alias: 'Tía Marta' })).status).toBe(
      200,
    );
    expect((await agentB.put('/api/session/alias', { alias: 'Lucas' })).status).toBe(200);

    const sessionA = await agentA.get('/api/session');
    const sessionB = await agentB.get('/api/session');

    expect(sessionA.body.alias).toBe('Tía Marta');
    expect(sessionB.body.alias).toBe('Lucas');
    expect(sessionA.body.hasGateAccess).toBe(true);
  });

  it('uploads batch photos to Muro General, rejects corrupt files, and enforces author-only deletion', async () => {
    const { app } = await setupTestApp(false);
    const marta = createTestAgent(app);
    const lucas = createTestAgent(app);

    await marta.put('/api/session/alias', { alias: 'Marta' });
    await lucas.put('/api/session/alias', { alias: 'Lucas' });

    const img1 = await makeTestImageBuffer({ r: 240, g: 220, b: 200 });
    const img2 = await makeTestImageBuffer({ r: 180, g: 200, b: 210 });

    const badUpload = await marta.request({
      method: 'POST',
      url: '/api/photos',
      fields: { section: 'general' },
      files: [
        {
          fieldName: 'files',
          buffer: Buffer.from('not-a-real-image'),
          filename: 'exploit.jpg',
          contentType: 'image/jpeg',
        },
      ],
    });
    expect(badUpload.status).toBe(400);

    const uploadRes = await marta.request({
      method: 'POST',
      url: '/api/photos',
      fields: { section: 'general' },
      files: [
        {
          fieldName: 'files',
          buffer: img1,
          filename: 'foto1.jpg',
          contentType: 'image/jpeg',
        },
        {
          fieldName: 'files',
          buffer: img2,
          filename: 'foto2.jpg',
          contentType: 'image/jpeg',
        },
      ],
    });

    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.photos).toHaveLength(2);
    const photoId = uploadRes.body.photos[0].id as string;

    const listForMarta = await marta.get('/api/photos?section=general');
    expect(listForMarta.body.photos).toHaveLength(2);
    expect(listForMarta.body.photos[0].isOwnPhoto).toBe(true);

    const listForLucas = await lucas.get('/api/photos?section=general');
    expect(listForLucas.body.photos[0].isOwnPhoto).toBe(false);

    expect((await lucas.delete(`/api/photos/${photoId}`)).status).toBe(403);
    expect((await marta.delete(`/api/photos/${photoId}`)).status).toBe(200);

    const afterDelete = await marta.get('/api/photos?section=general');
    expect(afterDelete.body.photos).toHaveLength(1);
  });

  it('enforces max 3 entries per phone in Best Outfit, recovers slot on delete, and supports heart voting + Top ranking', async () => {
    const { app } = await setupTestApp(false);
    const guest1 = createTestAgent(app, '198.51.100.55');
    const guest2 = createTestAgent(app, '198.51.100.55'); // Same venue Wi-Fi IP!

    await guest1.put('/api/session/alias', { alias: 'Sofi' });
    await guest2.put('/api/session/alias', { alias: 'Nico' });

    const img = await makeTestImageBuffer();

    const ids: string[] = [];
    for (const caption of ['Mi look', 'Look de la Abu', 'Look del Tío']) {
      const res = await guest1.request({
        method: 'POST',
        url: '/api/photos',
        fields: { section: 'best_outfit', caption },
        files: [
          {
            fieldName: 'files',
            buffer: img,
            filename: 'outfit.jpg',
            contentType: 'image/jpeg',
          },
        ],
      });
      expect(res.status).toBe(201);
      ids.push(res.body.photos[0].id as string);
    }

    const fourth = await guest1.request({
      method: 'POST',
      url: '/api/photos',
      fields: { section: 'best_outfit' },
      files: [
        {
          fieldName: 'files',
          buffer: img,
          filename: 'extra.jpg',
          contentType: 'image/jpeg',
        },
      ],
    });
    expect(fourth.status).toBe(400);
    expect(fourth.body.error.code).toBe('CONTEST_LIMIT_REACHED');

    expect((await guest1.delete(`/api/photos/${ids[2]}`)).status).toBe(200);

    const recovered = await guest1.request({
      method: 'POST',
      url: '/api/photos',
      fields: { section: 'best_outfit', caption: 'Look corregido' },
      files: [
        {
          fieldName: 'files',
          buffer: img,
          filename: 'fixed.jpg',
          contentType: 'image/jpeg',
        },
      ],
    });
    expect(recovered.status).toBe(201);

    const targetId = ids[1]!;
    const v1 = await guest1.post(`/api/photos/${targetId}/vote`);
    expect(v1.status).toBe(200);
    expect(v1.body).toEqual({ photoId: targetId, votedByMe: true, voteCount: 1 });

    const v2 = await guest2.post(`/api/photos/${targetId}/vote`);
    expect(v2.status).toBe(200);
    expect(v2.body).toEqual({ photoId: targetId, votedByMe: true, voteCount: 2 });

    const topRes = await guest2.get('/api/photos?section=best_outfit&sort=top');
    expect(topRes.status).toBe(200);
    expect(topRes.body.photos[0].id).toBe(targetId);
    expect(topRes.body.photos[0].voteCount).toBe(2);
    expect(topRes.body.photos[0].votedByMe).toBe(true);

    const unvote = await guest2.post(`/api/photos/${targetId}/vote`);
    expect(unvote.status).toBe(200);
    expect(unvote.body).toEqual({ photoId: targetId, votedByMe: false, voteCount: 1 });
  });

  it('protects Moderator PIN with brute-force rate limit, allows moderating any photo, and freezes writes in read_only mode', async () => {
    const { app } = await setupTestApp(false);
    const guest = createTestAgent(app, '192.0.2.10');
    const mod = createTestAgent(app, '192.0.2.20');

    await guest.put('/api/session/alias', { alias: 'Invitado' });
    const img = await makeTestImageBuffer();
    const up = await guest.request({
      method: 'POST',
      url: '/api/photos',
      fields: { section: 'general' },
      files: [
        {
          fieldName: 'files',
          buffer: img,
          filename: 'pic.jpg',
          contentType: 'image/jpeg',
        },
      ],
    });
    expect(up.status).toBe(201);
    const guestPhotoId = up.body.photos[0].id as string;

    expect((await mod.post('/api/moderator/login', { pin: '071126' })).status).toBe(200);
    expect((await mod.delete(`/api/photos/${guestPhotoId}`)).status).toBe(200);
    expect(
      (await mod.put('/api/moderator/event-mode', { mode: 'read_only' })).status,
    ).toBe(200);

    expect((await guest.get('/api/photos?section=general')).status).toBe(200);
    const blockedUpload = await guest.request({
      method: 'POST',
      url: '/api/photos',
      fields: { section: 'general' },
      files: [
        {
          fieldName: 'files',
          buffer: img,
          filename: 'late.jpg',
          contentType: 'image/jpeg',
        },
      ],
    });
    expect(blockedUpload.status).toBe(403);

    const attacker = createTestAgent(app, '192.0.2.99');
    for (let i = 0; i < 5; i++) {
      const fail = await attacker.post('/api/moderator/login', { pin: '000000' });
      expect(fail.status).toBe(401);
    }
    const sixth = await attacker.post('/api/moderator/login', { pin: '000000' });
    expect(sixth.status).toBe(429);
  });

  it('returns combined non-deleted photos across sections for Slideshow Mode (section=all) preserving horizontal and vertical dimensions', async () => {
    const { app } = await setupTestApp(false);
    const guest = createTestAgent(app, '192.0.2.50');
    await guest.put('/api/session/alias', { alias: 'Maga' });

    const verticalImg = await sharp({
      create: { width: 720, height: 1280, channels: 3, background: { r: 210, g: 190, b: 170 } },
    })
      .jpeg({ quality: 85 })
      .toBuffer();

    const horizontalImg = await sharp({
      create: { width: 1280, height: 720, channels: 3, background: { r: 170, g: 195, b: 210 } },
    })
      .jpeg({ quality: 85 })
      .toBuffer();

    const upGeneral = await guest.request({
      method: 'POST',
      url: '/api/photos',
      fields: { section: 'general' },
      files: [
        {
          fieldName: 'files',
          buffer: horizontalImg,
          filename: 'brunch-wide.jpg',
          contentType: 'image/jpeg',
        },
      ],
    });
    expect(upGeneral.status).toBe(201);

    const upOutfit = await guest.request({
      method: 'POST',
      url: '/api/photos',
      fields: { section: 'best_outfit', caption: 'Look de civil' },
      files: [
        {
          fieldName: 'files',
          buffer: verticalImg,
          filename: 'outfit-portrait.jpg',
          contentType: 'image/jpeg',
        },
      ],
    });
    expect(upOutfit.status).toBe(201);

    // Subir a section='all' debe rechazarse
    const invalidUploadAll = await guest.request({
      method: 'POST',
      url: '/api/photos',
      fields: { section: 'all' },
      files: [
        {
          fieldName: 'files',
          buffer: verticalImg,
          filename: 'invalid.jpg',
          contentType: 'image/jpeg',
        },
      ],
    });
    expect(invalidUploadAll.status).toBe(400);

    const allRes = await guest.get('/api/photos?section=all&sort=recent');
    expect(allRes.status).toBe(200);
    expect(allRes.body.photos).toHaveLength(2);

    const outfitItem = allRes.body.photos.find(
      (p: { section: string }) => p.section === 'best_outfit',
    );
    const generalItem = allRes.body.photos.find(
      (p: { section: string }) => p.section === 'general',
    );
    expect(outfitItem).toBeDefined();
    expect(outfitItem.height).toBeGreaterThan(outfitItem.width);
    expect(outfitItem.caption).toBe('Look de civil');
    expect(generalItem).toBeDefined();
    expect(generalItem.width).toBeGreaterThan(generalItem.height);

    // Si se borra una foto, deja de aparecer en la presentación
    await guest.delete(`/api/photos/${generalItem.id}`);
    const afterDelete = await guest.get('/api/photos?section=all');
    expect(afterDelete.status).toBe(200);
    expect(afterDelete.body.photos).toHaveLength(1);
    expect(afterDelete.body.photos[0].id).toBe(outfitItem.id);
  });
});
