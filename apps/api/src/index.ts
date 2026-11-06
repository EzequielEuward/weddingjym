import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pino from 'pino';
import { createApp } from './app.js';
import { loadEnv } from './config/env.js';
import { createDatabase } from './db/client.js';
import {
  LocalDiskPhotoStorage,
  SupabasePhotoStorage,
  type PhotoStorage,
} from './storage/photo-storage.js';

const logger = pino({ name: 'wedding-api' });

async function main() {
  const env = loadEnv();
  const dbConn = await createDatabase(env.DATABASE_URL);

  let storage: PhotoStorage;
  if (env.STORAGE_DRIVER === 'local') {
    storage = new LocalDiskPhotoStorage(env.LOCAL_STORAGE_PATH);
  } else {
    storage = new SupabasePhotoStorage({
      supabaseUrl: env.SUPABASE_URL!,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY!,
      bucket: env.SUPABASE_BUCKET,
    });
  }

  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const defaultWebDist = path.resolve(currentDir, '../../web/dist');
  const isProduction = env.NODE_ENV === 'production';

  const app = createApp({
    db: dbConn.db,
    storage,
    cookieSecret: env.COOKIE_SECRET,
    qrGateToken: env.QR_GATE_TOKEN,
    moderatorPin: env.MODERATOR_PIN,
    requireQrGate: isProduction,
    isProduction,
    staticWebDistDir: isProduction ? defaultWebDist : undefined,
  });

  const server = app.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, env: env.NODE_ENV, storage: storage.driver },
      'Wedding API running',
    );
  });

  const shutdown = async () => {
    logger.info('Shutting down server...');
    server.close();
    await dbConn.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  logger.error({ err }, 'Failed to start Wedding API');
  process.exit(1);
});
