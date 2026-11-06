import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  ContestCaptionSchema,
  type EventMode,
  GuestAliasSchema,
  ModeratorPinInputSchema,
  type PhotoFilterSection,
  PhotoFilterSectionSchema,
  type PhotoItemDto,
  PhotoSectionSchema,
  PhotoSortSchema,
  SetAliasInputSchema,
  SetEventModeInputSchema,
  WEDDING_CONFIG,
} from '@wedding/shared';
import cookieParser from 'cookie-parser';
import { and, count, desc, eq, isNull, sql } from 'drizzle-orm';
import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import multer from 'multer';
import type { AppDatabase } from './db/client.js';
import { eventSettings, guestSessions, photos, votes } from './db/schema.js';
import { InvalidImageError, processUploadedImage } from './photos/image-ingest.js';
import {
  COOKIE_NAMES,
  SlidingWindowLimiter,
  clearModeratorCookie,
  safeCompareSecret,
  setGateCookie,
  setGuestSessionCookie,
  setModeratorCookie,
} from './security/auth.js';
import type { PhotoStorage } from './storage/photo-storage.js';

export interface CreateAppDependencies {
  db: AppDatabase;
  storage: PhotoStorage;
  cookieSecret: string;
  qrGateToken?: string;
  moderatorPin?: string;
  requireQrGate?: boolean;
  isProduction?: boolean;
  staticWebDistDir?: string;
}

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createApp(deps: CreateAppDependencies): Express {
  const {
    db,
    storage,
    cookieSecret,
    qrGateToken = 'dev-qr-token',
    moderatorPin = '071126',
    requireQrGate = false,
    isProduction = false,
    staticWebDistDir,
  } = deps;

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  const moderatorPinLimiter = new SlidingWindowLimiter(5, 15 * 60 * 1000);
  const uploadSessionLimiter = new SlidingWindowLimiter(25, 5 * 60 * 1000);

  const uploadMiddleware = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: WEDDING_CONFIG.limits.maxFileSizeBytes,
      files: WEDDING_CONFIG.limits.maxBatchUploadGeneral,
    },
  });

  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    next();
  });

  app.use(cookieParser(cookieSecret));
  app.use(express.json({ limit: '256kb' }));

  async function getEventMode(): Promise<EventMode> {
    const rows = await db
      .select({ mode: eventSettings.mode })
      .from(eventSettings)
      .where(eq(eventSettings.id, 1));
    return rows[0]?.mode ?? 'live';
  }

  function hasGateCookie(req: Request): boolean {
    if (!requireQrGate) {
      return true;
    }
    return (
      req.signedCookies?.[COOKIE_NAMES.gate] === 'granted' ||
      req.signedCookies?.[COOKIE_NAMES.moderator] === 'active'
    );
  }

  function isModeratorRequest(req: Request): boolean {
    return req.signedCookies?.[COOKIE_NAMES.moderator] === 'active';
  }

  function shouldUseSecureCookie(req: Request): boolean {
    if (!isProduction) return false;
    return req.secure || req.headers['x-forwarded-proto'] === 'https';
  }

  async function ensureGuestSession(
    req: Request,
    res: Response,
  ): Promise<{ id: string; alias: string | null }> {
    const rawCookieId = req.signedCookies?.[COOKIE_NAMES.guestSession];
    if (typeof rawCookieId === 'string' && UUID_V4_REGEX.test(rawCookieId)) {
      const existing = await db
        .select({ id: guestSessions.id, alias: guestSessions.alias })
        .from(guestSessions)
        .where(eq(guestSessions.id, rawCookieId));

      if (existing[0]) {
        return existing[0];
      }
    }

    const newSessionId = randomUUID();
    await db.insert(guestSessions).values({ id: newSessionId });
    setGuestSessionCookie(res, newSessionId, shouldUseSecureCookie(req));
    return { id: newSessionId, alias: null };
  }

  function requireGateMiddleware(req: Request, res: Response, next: NextFunction): void {
    if (!hasGateCookie(req)) {
      res.status(401).json({
        error: {
          code: 'QR_GATE_REQUIRED',
          message:
            'Acceso exclusivo para invitados de Joa & Maga. Escaneá el código QR en tu mesa para entrar.',
        },
      });
      return;
    }
    next();
  }

  app.get('/robots.txt', (_req: Request, res: Response) => {
    res.type('text/plain').send('User-agent: *\nDisallow: /\n');
  });

  app.get('/api/health', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      await db.execute(sql`SELECT 1`);
      await storage.checkHealth();
      res.status(200).json({
        status: 'ok',
        database: 'ok',
        storage: storage.driver,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  });

  // Puerta de entrada física del QR único del salón (/entrar?evento=... o URL corta /e?k=...)
  app.get(['/entrar', '/e'], async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = String(req.query.evento ?? req.query.k ?? '');
      if (!token || !safeCompareSecret(token, qrGateToken)) {
        res.status(403).json({
          error: {
            code: 'INVALID_QR_TOKEN',
            message: 'El código de acceso no es válido. Escaneá nuevamente el QR del salón.',
          },
        });
        return;
      }

      setGateCookie(res, shouldUseSecureCookie(req));
      await ensureGuestSession(req, res);
      res.redirect(302, '/');
    } catch (err) {
      next(err);
    }
  });

  // Estado de la sesión actual para hidratar la UI
  app.get('/api/session', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const gateOk = hasGateCookie(req);
      const eventMode = await getEventMode();
      const isModerator = isModeratorRequest(req);

      if (!gateOk) {
        res.status(200).json({
          hasGateAccess: false,
          alias: null,
          isModerator,
          eventMode,
        });
        return;
      }

      const session = await ensureGuestSession(req, res);
      res.status(200).json({
        hasGateAccess: true,
        alias: session.alias,
        isModerator,
        eventMode,
      });
    } catch (err) {
      next(err);
    }
  });

  // Guardar o corregir el Apodo del invitado (Lazy Onboarding)
  app.put(
    '/api/session/alias',
    requireGateMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const parsed = SetAliasInputSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            error: {
              code: 'INVALID_ALIAS',
              message:
                parsed.error.issues[0]?.message ?? 'Ingresá un nombre válido.',
            },
          });
          return;
        }

        const session = await ensureGuestSession(req, res);
        await db
          .update(guestSessions)
          .set({ alias: parsed.data.alias, lastSeenAt: new Date() })
          .where(eq(guestSessions.id, session.id));

        const eventMode = await getEventMode();
        res.status(200).json({
          hasGateAccess: true,
          alias: parsed.data.alias,
          isModerator: isModeratorRequest(req),
          eventMode,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  // Listado de fotos (Muro General, Competencias o Presentación combinada section=all)
  app.get(
    '/api/photos',
    requireGateMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const sectionResult = PhotoFilterSectionSchema.safeParse(
          req.query.section ?? 'general',
        );
        const sortResult = PhotoSortSchema.safeParse(req.query.sort ?? 'recent');

        if (!sectionResult.success || !sortResult.success) {
          res.status(400).json({
            error: {
              code: 'INVALID_QUERY',
              message: 'Parámetros de búsqueda inválidos.',
            },
          });
          return;
        }

        const section: PhotoFilterSection = sectionResult.data;
        const sort = sortResult.data;
        const session = await ensureGuestSession(req, res);

        const voteCountExpr = sql<number>`cast(count(${votes.id}) as int)`;
        const votedByMeExpr = sql<boolean>`coalesce(bool_or(${votes.guestSessionId} = ${session.id}), false)`;

        const whereCondition =
          section === 'all'
            ? isNull(photos.deletedAt)
            : and(eq(photos.section, section), isNull(photos.deletedAt));

        const rows = await db
          .select({
            id: photos.id,
            guestSessionId: photos.guestSessionId,
            authorAliasSnapshot: photos.authorAliasSnapshot,
            section: photos.section,
            caption: photos.caption,
            storageKeyFull: photos.storageKeyFull,
            storageKeyThumb: photos.storageKeyThumb,
            width: photos.width,
            height: photos.height,
            createdAt: photos.createdAt,
            voteCount: voteCountExpr,
            votedByMe: votedByMeExpr,
          })
          .from(photos)
          .leftJoin(votes, eq(votes.photoId, photos.id))
          .where(whereCondition)
          .groupBy(photos.id)
          .orderBy(
            ...(sort === 'top'
              ? [desc(voteCountExpr), desc(photos.createdAt)]
              : [desc(photos.createdAt)]),
          );

        const dtoList: PhotoItemDto[] = rows.map((r) => ({
          id: r.id,
          section: r.section,
          authorAlias: r.authorAliasSnapshot,
          caption: r.caption ?? null,
          thumbUrl: storage.getPublicUrl(r.storageKeyThumb),
          fullUrl: storage.getPublicUrl(r.storageKeyFull),
          width: r.width,
          height: r.height,
          createdAt: r.createdAt.toISOString(),
          isOwnPhoto: r.guestSessionId === session.id,
          voteCount: Number(r.voteCount ?? 0),
          votedByMe: Boolean(r.votedByMe),
        }));

        const myContestEntryCount =
          section === 'general' || section === 'all'
            ? 0
            : dtoList.filter((item) => item.isOwnPhoto).length;

        res.status(200).json({
          photos: dtoList,
          myContestEntryCount,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  // Subida de fotos (lote en Muro General; individual con tope de 3 en Competencias)
  app.post(
    '/api/photos',
    requireGateMiddleware,
    (req: Request, res: Response, next: NextFunction) => {
      uploadMiddleware.array('files', WEDDING_CONFIG.limits.maxBatchUploadGeneral)(
        req,
        res,
        (err: unknown) => {
          if (err instanceof multer.MulterError) {
            res.status(400).json({
              error: {
                code: 'UPLOAD_LIMIT_EXCEEDED',
                message:
                  err.code === 'LIMIT_FILE_SIZE'
                    ? 'Una de las fotos supera el tamaño máximo de 5 MB.'
                    : `Podés subir hasta ${WEDDING_CONFIG.limits.maxBatchUploadGeneral} fotos por tanda.`,
              },
            });
            return;
          }
          if (err) {
            next(err);
            return;
          }
          next();
        },
      );
    },
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const eventMode = await getEventMode();
        if (eventMode !== 'live') {
          res.status(403).json({
            error: {
              code: 'EVENT_NOT_LIVE',
              message:
                'La subida de fotos ya está cerrada, pero podés mirar y descargar todos los recuerdos.',
            },
          });
          return;
        }

        const sectionParsed = PhotoSectionSchema.safeParse(req.body?.section ?? 'general');
        if (!sectionParsed.success) {
          res.status(400).json({
            error: { code: 'INVALID_SECTION', message: 'Sección inválida.' },
          });
          return;
        }
        const section = sectionParsed.data;

        const uploadedFiles = (req.files as Express.Multer.File[] | undefined) ?? [];
        if (uploadedFiles.length === 0) {
          res.status(400).json({
            error: {
              code: 'NO_FILES',
              message: 'Elegí al menos una foto para subir.',
            },
          });
          return;
        }

        if (section !== 'general' && uploadedFiles.length > 1) {
          res.status(400).json({
            error: {
              code: 'SINGLE_PHOTO_CONTEST',
              message: 'En la competencia se sube de a 1 foto por postulación.',
            },
          });
          return;
        }

        const captionParsed = ContestCaptionSchema.safeParse(req.body?.caption);
        if (!captionParsed.success) {
          res.status(400).json({
            error: {
              code: 'INVALID_CAPTION',
              message:
                captionParsed.error.issues[0]?.message ?? 'Epígrafe demasiado largo.',
            },
          });
          return;
        }
        const caption = section === 'general' ? null : captionParsed.data;

        const session = await ensureGuestSession(req, res);
        let authorAlias = session.alias;

        // Permite guardar el apodo en el mismo viaje si fue enviado junto al formulario
        if (typeof req.body?.alias === 'string' && req.body.alias.trim().length > 0) {
          const inlineAlias = GuestAliasSchema.safeParse(req.body.alias);
          if (!inlineAlias.success) {
            res.status(400).json({
              error: {
                code: 'INVALID_ALIAS',
                message:
                  inlineAlias.error.issues[0]?.message ?? 'Ingresá tu nombre.',
              },
            });
            return;
          }
          authorAlias = inlineAlias.data;
          await db
            .update(guestSessions)
            .set({ alias: authorAlias, lastSeenAt: new Date() })
            .where(eq(guestSessions.id, session.id));
        }

        if (!authorAlias) {
          res.status(400).json({
            error: {
              code: 'ALIAS_REQUIRED',
              message: 'Contanos tu nombre antes de subir la foto.',
            },
          });
          return;
        }

        if (!uploadSessionLimiter.record(session.id, uploadedFiles.length)) {
          res.status(429).json({
            error: {
              code: 'RATE_LIMITED',
              message: 'Subiste muchas fotos seguidas. Esperá un minutito y seguí subiendo.',
            },
          });
          return;
        }

        if (section !== 'general') {
          const existingCountRows = await db
            .select({ total: count() })
            .from(photos)
            .where(
              and(
                eq(photos.section, section),
                eq(photos.guestSessionId, session.id),
                isNull(photos.deletedAt),
              ),
            );
          const currentActive = Number(existingCountRows[0]?.total ?? 0);
          if (currentActive >= WEDDING_CONFIG.limits.maxEntriesPerContestSession) {
            res.status(400).json({
              error: {
                code: 'CONTEST_LIMIT_REACHED',
                message: `Podés subir hasta ${WEDDING_CONFIG.limits.maxEntriesPerContestSession} looks desde tu celular. Si querés cambiar una foto, borrá primero la anterior.`,
              },
            });
            return;
          }
        }

        // Primero decodificamos todas con sharp para no persistir lotes a medias si 1 archivo es inválido
        const processedBatch = await Promise.all(
          uploadedFiles.map(async (file) => {
            const processed = await processUploadedImage(file.buffer);
            return {
              id: randomUUID(),
              processed,
            };
          }),
        );

        const createdDtos: PhotoItemDto[] = [];
        for (const item of processedBatch) {
          const keys = await storage.putPhoto({
            id: item.id,
            fullBuffer: item.processed.fullBuffer,
            thumbBuffer: item.processed.thumbBuffer,
          });

          const createdAt = new Date();
          try {
            await db.insert(photos).values({
              id: item.id,
              guestSessionId: session.id,
              authorAliasSnapshot: authorAlias,
              section,
              caption,
              storageKeyFull: keys.storageKeyFull,
              storageKeyThumb: keys.storageKeyThumb,
              width: item.processed.width,
              height: item.processed.height,
              sizeBytes: item.processed.sizeBytes,
              createdAt,
            });
          } catch (dbErr) {
            await storage.deletePhoto(keys);
            throw dbErr;
          }

          createdDtos.push({
            id: item.id,
            section,
            authorAlias,
            caption,
            thumbUrl: storage.getPublicUrl(keys.storageKeyThumb),
            fullUrl: storage.getPublicUrl(keys.storageKeyFull),
            width: item.processed.width,
            height: item.processed.height,
            createdAt: createdAt.toISOString(),
            isOwnPhoto: true,
            voteCount: 0,
            votedByMe: false,
          });
        }

        res.status(201).json({ photos: createdDtos });
      } catch (err) {
        if (err instanceof InvalidImageError) {
          res.status(400).json({
            error: {
              code: 'INVALID_IMAGE',
              message: err.message,
            },
          });
          return;
        }
        next(err);
      }
    },
  );

  // Votar / quitar corazón ❤️ en una competencia
  app.post(
    '/api/photos/:id/vote',
    requireGateMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const photoId = String(req.params.id ?? '');
        if (!UUID_V4_REGEX.test(photoId)) {
          res.status(400).json({
            error: { code: 'INVALID_PHOTO_ID', message: 'Foto inválida.' },
          });
          return;
        }

        const eventMode = await getEventMode();
        if (eventMode !== 'live') {
          res.status(403).json({
            error: {
              code: 'EVENT_NOT_LIVE',
              message: 'La votación ya finalizó.',
            },
          });
          return;
        }

        const session = await ensureGuestSession(req, res);
        if (!session.alias) {
          res.status(400).json({
            error: {
              code: 'ALIAS_REQUIRED',
              message: 'Ingresá tu nombre para votar.',
            },
          });
          return;
        }

        const targetRows = await db
          .select({ id: photos.id, section: photos.section })
          .from(photos)
          .where(and(eq(photos.id, photoId), isNull(photos.deletedAt)));

        const target = targetRows[0];
        if (!target) {
          res.status(404).json({
            error: { code: 'PHOTO_NOT_FOUND', message: 'La foto ya no está disponible.' },
          });
          return;
        }

        if (target.section === 'general') {
          res.status(400).json({
            error: {
              code: 'VOTING_NOT_ENABLED',
              message: 'Solo se votan las fotos de competencias.',
            },
          });
          return;
        }

        const existingVote = await db
          .select({ id: votes.id })
          .from(votes)
          .where(
            and(eq(votes.photoId, photoId), eq(votes.guestSessionId, session.id)),
          );

        let votedByMe: boolean;
        if (existingVote[0]) {
          await db.delete(votes).where(eq(votes.id, existingVote[0].id));
          votedByMe = false;
        } else {
          await db
            .insert(votes)
            .values({
              id: randomUUID(),
              photoId,
              guestSessionId: session.id,
            })
            .onConflictDoNothing();
          votedByMe = true;
        }

        const totalRows = await db
          .select({ total: count() })
          .from(votes)
          .where(eq(votes.photoId, photoId));

        res.status(200).json({
          photoId,
          votedByMe,
          voteCount: Number(totalRows[0]?.total ?? 0),
        });
      } catch (err) {
        next(err);
      }
    },
  );

  // Eliminación de foto (autor de la foto o Moderador con PIN)
  app.delete(
    '/api/photos/:id',
    requireGateMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const photoId = String(req.params.id ?? '');
        if (!UUID_V4_REGEX.test(photoId)) {
          res.status(400).json({
            error: { code: 'INVALID_PHOTO_ID', message: 'Foto inválida.' },
          });
          return;
        }

        const session = await ensureGuestSession(req, res);
        const isMod = isModeratorRequest(req);

        const targetRows = await db
          .select()
          .from(photos)
          .where(and(eq(photos.id, photoId), isNull(photos.deletedAt)));

        const target = targetRows[0];
        if (!target) {
          res.status(404).json({
            error: { code: 'PHOTO_NOT_FOUND', message: 'La foto ya fue eliminada.' },
          });
          return;
        }

        const isOwner = target.guestSessionId === session.id;
        if (!isOwner && !isMod) {
          res.status(403).json({
            error: {
              code: 'FORBIDDEN',
              message: 'Solo podés eliminar las fotos que subiste desde tu celular.',
            },
          });
          return;
        }

        await db
          .update(photos)
          .set({
            deletedAt: new Date(),
            deletedBy: isMod && !isOwner ? 'moderator' : 'author',
          })
          .where(eq(photos.id, photoId));

        await storage.deletePhoto({
          storageKeyFull: target.storageKeyFull,
          storageKeyThumb: target.storageKeyThumb,
        });

        res.status(200).json({ deleted: true, id: photoId });
      } catch (err) {
        next(err);
      }
    },
  );

  // Moderación in-situ con PIN
  app.post('/api/moderator/login', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ipKey = req.ip || 'unknown-ip';
      if (!moderatorPinLimiter.isAllowed(ipKey)) {
        res.status(429).json({
          error: {
            code: 'TOO_MANY_ATTEMPTS',
            message: 'Demasiados intentos fallidos. Esperá 15 minutos antes de volver a probar.',
          },
        });
        return;
      }

      const parsed = ModeratorPinInputSchema.safeParse(req.body);
      if (!parsed.success || !safeCompareSecret(parsed.data.pin, moderatorPin)) {
        moderatorPinLimiter.record(ipKey);
        res.status(401).json({
          error: {
            code: 'INVALID_PIN',
            message: 'El PIN ingresado no es correcto.',
          },
        });
        return;
      }

      moderatorPinLimiter.reset(ipKey);
      const secureCookie = shouldUseSecureCookie(req);
      setModeratorCookie(res, secureCookie);
      setGateCookie(res, secureCookie);
      const session = await ensureGuestSession(req, res);
      const eventMode = await getEventMode();

      res.status(200).json({
        hasGateAccess: true,
        alias: session.alias,
        isModerator: true,
        eventMode,
      });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/moderator/logout', (_req: Request, res: Response) => {
    clearModeratorCookie(res);
    res.status(200).json({ ok: true });
  });

  app.put(
    '/api/moderator/event-mode',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!isModeratorRequest(req)) {
          res.status(403).json({
            error: {
              code: 'MODERATOR_REQUIRED',
              message: 'Necesitás ingresar el PIN de moderador.',
            },
          });
          return;
        }

        const parsed = SetEventModeInputSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            error: { code: 'INVALID_MODE', message: 'Modo de evento inválido.' },
          });
          return;
        }

        await db
          .update(eventSettings)
          .set({ mode: parsed.data.mode, updatedAt: new Date() })
          .where(eq(eventSettings.id, 1));

        res.status(200).json({ mode: parsed.data.mode });
      } catch (err) {
        next(err);
      }
    },
  );

  // Servido inmutable de imágenes locales/memoria
  app.get(
    '/media/:variant/:filename',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const variant = String(req.params.variant ?? '');
        const filename = String(req.params.filename ?? '');
        const storageKey = `${variant}/${filename}`;
        const buffer = await storage.readPhoto(storageKey);

        if (!buffer) {
          res.status(404).json({
            error: {
              code: 'PHOTO_NOT_FOUND',
              message: 'No encontramos esta foto.',
            },
          });
          return;
        }

        res.setHeader('Content-Type', 'image/webp');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.status(200).send(buffer);
      } catch (err) {
        next(err);
      }
    },
  );

  if (staticWebDistDir && fs.existsSync(staticWebDistDir)) {
    const resolvedDist = path.resolve(staticWebDistDir);
    app.use(express.static(resolvedDist, { index: false }));

    app.get(/^(?!\/api\/|\/media\/).*/, (_req: Request, res: Response) => {
      res.sendFile(path.join(resolvedDist, 'index.html'));
    });
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message =
      err instanceof Error ? err.message : 'Ocurrió un error inesperado.';
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: isProduction
          ? 'Ocurrió un inconveniente temporal. Intentá de nuevo en unos segundos.'
          : message,
      },
    });
  });

  return app;
}
