import { describe, expect, it } from 'vitest';
import {
  ContestCaptionSchema,
  EventModeSchema,
  GuestAliasSchema,
  PhotoSectionSchema,
  WEDDING_CONFIG,
} from './index.js';

describe('@wedding/shared domain contracts', () => {
  describe('GuestAliasSchema (Apodo)', () => {
    it('trims whitespace and accepts friendly names between 2 and 30 characters', () => {
      const parsed = GuestAliasSchema.parse('  Tía Marta  ');
      expect(parsed).toBe('Tía Marta');
    });

    it('rejects empty, whitespace-only, single-character, or overly long names', () => {
      expect(GuestAliasSchema.safeParse('').success).toBe(false);
      expect(GuestAliasSchema.safeParse('   ').success).toBe(false);
      expect(GuestAliasSchema.safeParse('J').success).toBe(false);
      expect(GuestAliasSchema.safeParse('A'.repeat(31)).success).toBe(false);
    });
  });

  describe('ContestCaptionSchema (Postulación epígrafe)', () => {
    it('normalizes blank strings or undefined to null and trims valid captions', () => {
      expect(ContestCaptionSchema.parse(undefined)).toBeNull();
      expect(ContestCaptionSchema.parse('   ')).toBeNull();
      expect(ContestCaptionSchema.parse('  El look de la Abu Rosa  ')).toBe(
        'El look de la Abu Rosa',
      );
    });

    it('rejects captions longer than 80 characters', () => {
      expect(ContestCaptionSchema.safeParse('x'.repeat(81)).success).toBe(false);
    });
  });

  describe('EventModeSchema & PhotoSectionSchema', () => {
    it('validates canonical Event Modes and Photo Sections', () => {
      expect(EventModeSchema.parse('live')).toBe('live');
      expect(EventModeSchema.parse('read_only')).toBe('read_only');
      expect(EventModeSchema.parse('closed')).toBe('closed');
      expect(EventModeSchema.safeParse('paused').success).toBe(false);

      expect(PhotoSectionSchema.parse('general')).toBe('general');
      expect(PhotoSectionSchema.parse('best_outfit')).toBe('best_outfit');
      expect(PhotoSectionSchema.parse('best_bloopers')).toBe('best_bloopers');
      expect(PhotoSectionSchema.safeParse('stories').success).toBe(false);
    });
  });

  describe('WEDDING_CONFIG', () => {
    it('exposes Joa & Maga event parameters and contest limits', () => {
      expect(WEDDING_CONFIG.couple).toEqual({ partnerOne: 'Joa', partnerTwo: 'Maga' });
      expect(WEDDING_CONFIG.dateDisplay).toBe('07 · 11 · 2026');
      expect(WEDDING_CONFIG.limits.maxEntriesPerContestSession).toBe(3);
      expect(WEDDING_CONFIG.limits.maxBatchUploadGeneral).toBe(10);
      expect(WEDDING_CONFIG.polling.intervalMs).toBe(20_000);
    });
  });
});
