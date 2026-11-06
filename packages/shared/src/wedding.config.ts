export type ModuleAvailability = 'active' | 'coming_soon' | 'hidden';

export const WEDDING_CONFIG = {
  couple: {
    partnerOne: 'Joa',
    partnerTwo: 'Maga',
  },
  titleDisplay: 'Joa & Maga',
  subtitle: '10 años juntos, miles de aventuras y una más por empezar.',
  dateDisplay: '07 · 11 · 2026',
  dateLong: '7 de noviembre de 2026',
  venue: 'Aldeano · Laguna Azul, La Calera',
  dressCode: 'Elegante sport',
  modules: {
    general: 'active' as ModuleAvailability,
    best_outfit: 'active' as ModuleAvailability,
    best_bloopers: 'coming_soon' as ModuleAvailability,
    bingo: 'coming_soon' as ModuleAvailability,
  },
  limits: {
    maxBatchUploadGeneral: 10,
    maxEntriesPerContestSession: 3,
    maxCaptionLength: 80,
    maxAliasLength: 30,
    minAliasLength: 2,
    maxFileSizeBytes: 5 * 1024 * 1024,
  },
  polling: {
    intervalMs: 20_000,
  },
  slideshow: {
    intervalMs: 6_000,
  },
} as const;
