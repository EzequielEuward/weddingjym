import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
export const MONOREPO_ROOT = path.resolve(currentDir, '../../../..');

// Carga .env desde la raíz del monorepo (y permite override local en apps/api/.env)
dotenv.config({ path: path.resolve(MONOREPO_ROOT, '.env') });
dotenv.config();

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    COOKIE_SECRET: z
      .string()
      .min(32, 'COOKIE_SECRET debe tener al menos 32 caracteres.')
      .default('dev-only-cookie-secret-key-joaymaga-07112026'),
    QR_GATE_TOKEN: z
      .string()
      .min(8, 'QR_GATE_TOKEN debe tener al menos 8 caracteres.')
      .default('joaymaga-2026-dev'),
    MODERATOR_PIN: z
      .string()
      .min(4, 'MODERATOR_PIN debe tener al menos 4 caracteres.')
      .default('071126'),
    DATABASE_URL: z
      .string()
      .min(1, 'DATABASE_URL es obligatorio.')
      .default('pglite://./data/pgdata'),
    STORAGE_DRIVER: z.enum(['local', 'supabase']).default('local'),
    LOCAL_STORAGE_PATH: z.string().default('./data/photos'),
    SUPABASE_URL: z.string().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
    SUPABASE_BUCKET: z.string().default('wedding-photos'),
  })
  .superRefine((val, ctx) => {
    if (val.NODE_ENV === 'production') {
      if (val.COOKIE_SECRET === 'dev-only-cookie-secret-key-joaymaga-07112026') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['COOKIE_SECRET'],
          message: 'Debés definir un COOKIE_SECRET propio en producción.',
        });
      }
      if (val.QR_GATE_TOKEN === 'joaymaga-2026-dev') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['QR_GATE_TOKEN'],
          message: 'Debés definir un QR_GATE_TOKEN propio en producción.',
        });
      }
    }

    if (val.STORAGE_DRIVER === 'supabase') {
      if (!val.SUPABASE_URL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SUPABASE_URL'],
          message: 'SUPABASE_URL es obligatorio cuando STORAGE_DRIVER=supabase.',
        });
      }
      if (!val.SUPABASE_SERVICE_ROLE_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SUPABASE_SERVICE_ROLE_KEY'],
          message:
            'SUPABASE_SERVICE_ROLE_KEY es obligatorio cuando STORAGE_DRIVER=supabase.',
        });
      }
    }
  });

export type AppEnv = z.infer<typeof EnvSchema>;

export function loadEnv(raw: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = EnvSchema.parse(raw);

  // Resolver rutas relativas respecto a la raíz del monorepo para que ./data viva en un único lugar
  let normalizedDbUrl = parsed.DATABASE_URL;
  if (normalizedDbUrl.startsWith('pglite://')) {
    const sub = normalizedDbUrl.slice('pglite://'.length);
    if (sub && sub !== 'memory' && !path.isAbsolute(sub)) {
      normalizedDbUrl = `pglite://${path.resolve(MONOREPO_ROOT, sub)}`;
    }
  }

  const normalizedStoragePath = path.isAbsolute(parsed.LOCAL_STORAGE_PATH)
    ? parsed.LOCAL_STORAGE_PATH
    : path.resolve(MONOREPO_ROOT, parsed.LOCAL_STORAGE_PATH);

  return {
    ...parsed,
    DATABASE_URL: normalizedDbUrl,
    LOCAL_STORAGE_PATH: normalizedStoragePath,
  };
}
