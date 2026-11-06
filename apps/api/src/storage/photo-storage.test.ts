import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  InMemoryPhotoStorage,
  LocalDiskPhotoStorage,
  SupabasePhotoStorage,
  type PhotoStorage,
} from './photo-storage.js';

function runPhotoStorageContractSuite(
  name: string,
  createStorage: () => Promise<{ storage: PhotoStorage; cleanup?: () => Promise<void> }>,
) {
  describe(`PhotoStorage contract: ${name}`, () => {
    let cleanupFn: (() => Promise<void>) | undefined;

    afterEach(async () => {
      if (cleanupFn) {
        await cleanupFn();
        cleanupFn = undefined;
      }
    });

    it('stores full and thumb WebP buffers, reads them back, builds URLs, and deletes idempotently', async () => {
      const setup = await createStorage();
      cleanupFn = setup.cleanup;
      const { storage } = setup;

      await expect(storage.checkHealth()).resolves.toBeUndefined();

      const photoId = '0195f0a0-1234-7000-8000-000000000001';
      const fullBuffer = Buffer.from('fake-full-webp-bytes');
      const thumbBuffer = Buffer.from('fake-thumb-webp-bytes');

      const keys = await storage.putPhoto({
        id: photoId,
        fullBuffer,
        thumbBuffer,
      });

      expect(keys).toEqual({
        storageKeyFull: `full/${photoId}.webp`,
        storageKeyThumb: `thumb/${photoId}.webp`,
      });

      expect(storage.getPublicUrl(keys.storageKeyFull)).toBe(
        `/media/full/${photoId}.webp`,
      );
      expect(storage.getPublicUrl(keys.storageKeyThumb)).toBe(
        `/media/thumb/${photoId}.webp`,
      );

      await expect(storage.readPhoto(keys.storageKeyFull)).resolves.toEqual(fullBuffer);
      await expect(storage.readPhoto(keys.storageKeyThumb)).resolves.toEqual(thumbBuffer);

      await storage.deletePhoto(keys);

      await expect(storage.readPhoto(keys.storageKeyFull)).resolves.toBeNull();
      await expect(storage.readPhoto(keys.storageKeyThumb)).resolves.toBeNull();

      // Deleting again should not throw
      await expect(storage.deletePhoto(keys)).resolves.toBeUndefined();
    });

    it('returns null when reading a non-existent key and rejects path traversal attempts', async () => {
      const setup = await createStorage();
      cleanupFn = setup.cleanup;
      const { storage } = setup;

      await expect(storage.readPhoto('full/non-existent.webp')).resolves.toBeNull();
      await expect(storage.readPhoto('../secret.txt')).resolves.toBeNull();
    });
  });
}

runPhotoStorageContractSuite('InMemoryPhotoStorage', async () => ({
  storage: new InMemoryPhotoStorage(),
}));

runPhotoStorageContractSuite('LocalDiskPhotoStorage', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wedding-photos-test-'));
  return {
    storage: new LocalDiskPhotoStorage(tempDir),
    cleanup: async () => {
      await fs.rm(tempDir, { recursive: true, force: true });
    },
  };
});

describe('PhotoStorage adapter: SupabasePhotoStorage (Cloud Fallback)', () => {
  it('uploads, reads, builds public CDN URLs, checks health, and deletes against Supabase Storage REST API', async () => {
    const objects = new Map<string, Uint8Array>();

    const mockFetch: typeof fetch = async (input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url.endsWith('/storage/v1/bucket/wedding-photos') && method === 'GET') {
        return new Response(JSON.stringify({ id: 'wedding-photos' }), { status: 200 });
      }

      const prefix = 'https://example.supabase.co/storage/v1/object/wedding-photos/';
      if (url.startsWith(prefix)) {
        const key = url.slice(prefix.length);
        if (method === 'POST') {
          const bytes = new Uint8Array(init?.body as Uint8Array);
          objects.set(key, bytes);
          return new Response(JSON.stringify({ Key: key }), { status: 200 });
        }
        if (method === 'GET') {
          const found = objects.get(key);
          if (!found) return new Response('Not found', { status: 404 });
          return new Response(found, { status: 200 });
        }
        if (method === 'DELETE') {
          objects.delete(key);
          return new Response(JSON.stringify({ message: 'Deleted' }), { status: 200 });
        }
      }

      return new Response('Unhandled', { status: 500 });
    };

    const storage = new SupabasePhotoStorage({
      supabaseUrl: 'https://example.supabase.co/',
      serviceRoleKey: 'test-service-role-key',
      bucket: 'wedding-photos',
      fetchImpl: mockFetch,
    });

    await expect(storage.checkHealth()).resolves.toBeUndefined();

    const photoId = '0195f0a0-1234-7000-8000-000000000099';
    const fullBuffer = Buffer.from('supabase-full-webp');
    const thumbBuffer = Buffer.from('supabase-thumb-webp');

    const keys = await storage.putPhoto({ id: photoId, fullBuffer, thumbBuffer });
    expect(storage.getPublicUrl(keys.storageKeyFull)).toBe(
      `https://example.supabase.co/storage/v1/object/public/wedding-photos/full/${photoId}.webp`,
    );

    await expect(storage.readPhoto(keys.storageKeyFull)).resolves.toEqual(fullBuffer);
    await expect(storage.readPhoto('../etc/passwd')).resolves.toBeNull();

    await storage.deletePhoto(keys);
    await expect(storage.readPhoto(keys.storageKeyFull)).resolves.toBeNull();
  });
});
