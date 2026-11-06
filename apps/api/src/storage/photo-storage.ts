import fs from 'node:fs/promises';
import path from 'node:path';

export interface StoredPhotoKeys {
  storageKeyFull: string;
  storageKeyThumb: string;
}

export interface PhotoStorage {
  readonly driver: 'local' | 'supabase' | 'memory';
  putPhoto(input: {
    id: string;
    fullBuffer: Buffer;
    thumbBuffer: Buffer;
  }): Promise<StoredPhotoKeys>;
  readPhoto(storageKey: string): Promise<Buffer | null>;
  deletePhoto(keys: StoredPhotoKeys): Promise<void>;
  getPublicUrl(storageKey: string): string;
  checkHealth(): Promise<void>;
}

const SAFE_STORAGE_KEY_REGEX = /^(full|thumb)\/[a-zA-Z0-9_-]+\.webp$/;

function isSafeStorageKey(storageKey: string): boolean {
  return SAFE_STORAGE_KEY_REGEX.test(storageKey);
}

export class InMemoryPhotoStorage implements PhotoStorage {
  public readonly driver = 'memory' as const;
  private readonly files = new Map<string, Buffer>();

  async putPhoto(input: {
    id: string;
    fullBuffer: Buffer;
    thumbBuffer: Buffer;
  }): Promise<StoredPhotoKeys> {
    const storageKeyFull = `full/${input.id}.webp`;
    const storageKeyThumb = `thumb/${input.id}.webp`;
    this.files.set(storageKeyFull, Buffer.from(input.fullBuffer));
    this.files.set(storageKeyThumb, Buffer.from(input.thumbBuffer));
    return { storageKeyFull, storageKeyThumb };
  }

  async readPhoto(storageKey: string): Promise<Buffer | null> {
    if (!isSafeStorageKey(storageKey)) {
      return null;
    }
    const buf = this.files.get(storageKey);
    return buf ? Buffer.from(buf) : null;
  }

  async deletePhoto(keys: StoredPhotoKeys): Promise<void> {
    this.files.delete(keys.storageKeyFull);
    this.files.delete(keys.storageKeyThumb);
  }

  getPublicUrl(storageKey: string): string {
    return `/media/${storageKey}`;
  }

  async checkHealth(): Promise<void> {
    // In-memory storage is always healthy
  }
}

export class LocalDiskPhotoStorage implements PhotoStorage {
  public readonly driver = 'local' as const;
  private readonly baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = path.resolve(baseDir);
  }

  private resolveSafePath(storageKey: string): string | null {
    if (!isSafeStorageKey(storageKey)) {
      return null;
    }
    const resolved = path.resolve(this.baseDir, storageKey);
    const relative = path.relative(this.baseDir, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      return null;
    }
    return resolved;
  }

  private async ensureDirectories(): Promise<void> {
    await fs.mkdir(path.join(this.baseDir, 'full'), { recursive: true });
    await fs.mkdir(path.join(this.baseDir, 'thumb'), { recursive: true });
  }

  async putPhoto(input: {
    id: string;
    fullBuffer: Buffer;
    thumbBuffer: Buffer;
  }): Promise<StoredPhotoKeys> {
    await this.ensureDirectories();
    const storageKeyFull = `full/${input.id}.webp`;
    const storageKeyThumb = `thumb/${input.id}.webp`;

    const fullPath = this.resolveSafePath(storageKeyFull);
    const thumbPath = this.resolveSafePath(storageKeyThumb);
    if (!fullPath || !thumbPath) {
      throw new Error(`Invalid photo identifier: ${input.id}`);
    }

    await Promise.all([
      fs.writeFile(fullPath, input.fullBuffer),
      fs.writeFile(thumbPath, input.thumbBuffer),
    ]);

    return { storageKeyFull, storageKeyThumb };
  }

  async readPhoto(storageKey: string): Promise<Buffer | null> {
    const filePath = this.resolveSafePath(storageKey);
    if (!filePath) {
      return null;
    }
    try {
      return await fs.readFile(filePath);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw err;
    }
  }

  async deletePhoto(keys: StoredPhotoKeys): Promise<void> {
    const paths = [
      this.resolveSafePath(keys.storageKeyFull),
      this.resolveSafePath(keys.storageKeyThumb),
    ];
    await Promise.all(
      paths.map(async (filePath) => {
        if (!filePath) return;
        await fs.rm(filePath, { force: true });
      }),
    );
  }

  getPublicUrl(storageKey: string): string {
    return `/media/${storageKey}`;
  }

  async checkHealth(): Promise<void> {
    await this.ensureDirectories();
  }
}

export interface SupabasePhotoStorageConfig {
  supabaseUrl: string;
  serviceRoleKey: string;
  bucket: string;
  fetchImpl?: typeof fetch;
}

export class SupabasePhotoStorage implements PhotoStorage {
  public readonly driver = 'supabase' as const;
  private readonly baseUrl: string;
  private readonly serviceRoleKey: string;
  private readonly bucket: string;
  private readonly fetchFn: typeof fetch;

  constructor(config: SupabasePhotoStorageConfig) {
    this.baseUrl = config.supabaseUrl.replace(/\/+$/, '');
    this.serviceRoleKey = config.serviceRoleKey;
    this.bucket = config.bucket;
    this.fetchFn = config.fetchImpl ?? fetch;
  }

  private authHeaders(extra?: Record<string, string>): Record<string, string> {
    return {
      Authorization: `Bearer ${this.serviceRoleKey}`,
      apikey: this.serviceRoleKey,
      ...extra,
    };
  }

  private async uploadVariant(storageKey: string, buffer: Buffer): Promise<void> {
    if (!isSafeStorageKey(storageKey)) {
      throw new Error(`Invalid storage key: ${storageKey}`);
    }
    const url = `${this.baseUrl}/storage/v1/object/${encodeURIComponent(this.bucket)}/${storageKey}`;
    const res = await this.fetchFn(url, {
      method: 'POST',
      headers: this.authHeaders({
        'Content-Type': 'image/webp',
        'Cache-Control': '31536000',
        'x-upsert': 'true',
      }),
      body: new Uint8Array(buffer),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Supabase upload failed (${res.status}): ${detail}`);
    }
  }

  async putPhoto(input: {
    id: string;
    fullBuffer: Buffer;
    thumbBuffer: Buffer;
  }): Promise<StoredPhotoKeys> {
    const storageKeyFull = `full/${input.id}.webp`;
    const storageKeyThumb = `thumb/${input.id}.webp`;
    await Promise.all([
      this.uploadVariant(storageKeyFull, input.fullBuffer),
      this.uploadVariant(storageKeyThumb, input.thumbBuffer),
    ]);
    return { storageKeyFull, storageKeyThumb };
  }

  async readPhoto(storageKey: string): Promise<Buffer | null> {
    if (!isSafeStorageKey(storageKey)) {
      return null;
    }
    const url = `${this.baseUrl}/storage/v1/object/${encodeURIComponent(this.bucket)}/${storageKey}`;
    const res = await this.fetchFn(url, {
      method: 'GET',
      headers: this.authHeaders(),
    });

    if (res.status === 404 || res.status === 400) {
      return null;
    }
    if (!res.ok) {
      throw new Error(`Supabase read failed (${res.status})`);
    }
    const arrayBuf = await res.arrayBuffer();
    return Buffer.from(arrayBuf);
  }

  async deletePhoto(keys: StoredPhotoKeys): Promise<void> {
    const validKeys = [keys.storageKeyFull, keys.storageKeyThumb].filter(
      isSafeStorageKey,
    );
    await Promise.all(
      validKeys.map(async (key) => {
        const url = `${this.baseUrl}/storage/v1/object/${encodeURIComponent(this.bucket)}/${key}`;
        const res = await this.fetchFn(url, {
          method: 'DELETE',
          headers: this.authHeaders(),
        });
        if (!res.ok && res.status !== 404 && res.status !== 400) {
          throw new Error(`Supabase delete failed (${res.status})`);
        }
      }),
    );
  }

  getPublicUrl(storageKey: string): string {
    return `${this.baseUrl}/storage/v1/object/public/${encodeURIComponent(this.bucket)}/${storageKey}`;
  }

  async checkHealth(): Promise<void> {
    const url = `${this.baseUrl}/storage/v1/bucket/${encodeURIComponent(this.bucket)}`;
    const res = await this.fetchFn(url, {
      method: 'GET',
      headers: this.authHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Supabase bucket health check failed (${res.status})`);
    }
  }
}
