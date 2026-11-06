import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const eventModeEnum = pgEnum('event_mode', ['live', 'read_only', 'closed']);

export const photoSectionEnum = pgEnum('photo_section', [
  'general',
  'best_outfit',
  'best_bloopers',
]);

export const deletedByRoleEnum = pgEnum('deleted_by_role', ['author', 'moderator']);

export const eventSettings = pgTable(
  'event_settings',
  {
    id: integer('id').primaryKey().default(1),
    mode: eventModeEnum('mode').notNull().default('live'),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [check('event_settings_singleton_chk', sql`${table.id} = 1`)],
);

export const guestSessions = pgTable('guest_sessions', {
  id: uuid('id').primaryKey(),
  alias: varchar('alias', { length: 30 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const photos = pgTable(
  'photos',
  {
    id: uuid('id').primaryKey(),
    guestSessionId: uuid('guest_session_id')
      .notNull()
      .references(() => guestSessions.id),
    authorAliasSnapshot: varchar('author_alias_snapshot', { length: 30 }).notNull(),
    section: photoSectionEnum('section').notNull(),
    caption: varchar('caption', { length: 80 }),
    storageKeyFull: varchar('storage_key_full', { length: 255 }).notNull(),
    storageKeyThumb: varchar('storage_key_thumb', { length: 255 }).notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: deletedByRoleEnum('deleted_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_photos_section_created').on(table.section, table.createdAt),
  ],
);

export const votes = pgTable(
  'votes',
  {
    id: uuid('id').primaryKey(),
    photoId: uuid('photo_id')
      .notNull()
      .references(() => photos.id, { onDelete: 'cascade' }),
    guestSessionId: uuid('guest_session_id')
      .notNull()
      .references(() => guestSessions.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_votes_photo_guest_session').on(
      table.photoId,
      table.guestSessionId,
    ),
    index('idx_votes_photo_id').on(table.photoId),
  ],
);
