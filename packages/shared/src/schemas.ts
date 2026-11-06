import { z } from 'zod';
import { WEDDING_CONFIG } from './wedding.config.js';

export const EventModeSchema = z.enum(['live', 'read_only', 'closed']);
export type EventMode = z.infer<typeof EventModeSchema>;

export const PhotoSectionSchema = z.enum([
  'general',
  'best_outfit',
  'best_bloopers',
]);
export type PhotoSection = z.infer<typeof PhotoSectionSchema>;

export const PhotoFilterSectionSchema = z.enum([
  'all',
  'general',
  'best_outfit',
  'best_bloopers',
]);
export type PhotoFilterSection = z.infer<typeof PhotoFilterSectionSchema>;

export const PhotoSortSchema = z.enum(['recent', 'top']);
export type PhotoSort = z.infer<typeof PhotoSortSchema>;

export const GuestAliasSchema = z
  .string()
  .trim()
  .min(
    WEDDING_CONFIG.limits.minAliasLength,
    'Ingresá tu nombre o apodo (al menos 2 letras).',
  )
  .max(
    WEDDING_CONFIG.limits.maxAliasLength,
    'El nombre puede tener hasta 30 caracteres.',
  );
export type GuestAlias = z.infer<typeof GuestAliasSchema>;

export const SetAliasInputSchema = z.object({
  alias: GuestAliasSchema,
});

export const ContestCaptionSchema = z
  .string()
  .trim()
  .max(
    WEDDING_CONFIG.limits.maxCaptionLength,
    'El epígrafe puede tener hasta 80 caracteres.',
  )
  .optional()
  .nullable()
  .transform((val) => (val && val.length > 0 ? val : null));
export type ContestCaption = z.infer<typeof ContestCaptionSchema>;

export const ModeratorPinInputSchema = z.object({
  pin: z.string().trim().min(4, 'Ingresá un PIN válido.').max(64),
});

export const SetEventModeInputSchema = z.object({
  mode: EventModeSchema,
});

export const ApiErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;

export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  database: z.literal('ok'),
  storage: z.enum(['local', 'supabase', 'memory']),
  timestamp: z.string(),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const PhotoItemDtoSchema = z.object({
  id: z.string().uuid(),
  section: PhotoSectionSchema,
  authorAlias: z.string(),
  caption: z.string().nullable(),
  thumbUrl: z.string(),
  fullUrl: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  createdAt: z.string(),
  isOwnPhoto: z.boolean(),
  voteCount: z.number().int().nonnegative(),
  votedByMe: z.boolean(),
});
export type PhotoItemDto = z.infer<typeof PhotoItemDtoSchema>;

export const PhotoListResponseSchema = z.object({
  photos: z.array(PhotoItemDtoSchema),
  myContestEntryCount: z.number().int().nonnegative(),
});
export type PhotoListResponse = z.infer<typeof PhotoListResponseSchema>;

export const UploadPhotosResponseSchema = z.object({
  photos: z.array(PhotoItemDtoSchema),
});
export type UploadPhotosResponse = z.infer<typeof UploadPhotosResponseSchema>;

export const ToggleVoteResponseSchema = z.object({
  photoId: z.string().uuid(),
  votedByMe: z.boolean(),
  voteCount: z.number().int().nonnegative(),
});
export type ToggleVoteResponse = z.infer<typeof ToggleVoteResponseSchema>;

export const SessionStatusDtoSchema = z.object({
  hasGateAccess: z.boolean(),
  alias: z.string().nullable(),
  isModerator: z.boolean(),
  eventMode: EventModeSchema,
});
export type SessionStatusDto = z.infer<typeof SessionStatusDtoSchema>;
