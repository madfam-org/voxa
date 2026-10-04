import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const boards = pgTable(
  'boards',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    profileId: text('profile_id').notNull(),
    ownerUserId: text('owner_user_id'),
    orgId: text('org_id'),
    grid: jsonb('grid').notNull(),
    // Optional board kind ('grid' | 'literacy-keyboard' | 'visual-schedule').
    layout: text('layout'),
    // Optional per-board display preferences (BoardDisplayPreferences).
    display: jsonb('display'),
    version: integer('version').notNull().default(1),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull(),
  },
  // Board list (owner or organization) and the plan's board-count limit.
  (table) => [
    index('boards_owner_user_idx').on(table.ownerUserId),
    index('boards_org_idx').on(table.orgId),
  ],
);

export const boardMembers = pgTable(
  'board_members',
  {
    id: text('id').primaryKey(),
    boardId: text('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    role: text('role').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull(),
  },
  (table) => [
    uniqueIndex('board_members_board_user_idx').on(table.boardId, table.userId),
    index('board_members_user_idx').on(table.userId),
  ],
);

export const syncEvents = pgTable(
  'sync_events',
  {
    id: text('id').primaryKey(),
    type: text('type').notNull(),
    boardId: text('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    actorUserId: text('actor_user_id').notNull(),
    timestamp: timestamp('timestamp', { withTimezone: true, mode: 'string' }).notNull(),
    payload: jsonb('payload'),
  },
  (table) => [index('sync_events_board_version_idx').on(table.boardId, table.version)],
);

export const activationEvents = pgTable(
  'activation_events',
  {
    id: text('id').primaryKey(),
    boardId: text('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    buttonId: text('button_id').notNull(),
    userId: text('user_id').notNull(),
    speechText: text('speech_text'),
    // True only when speech_text was written under an `utterance_text` consent
    // from a user whose organization is on the DPA allow-list. Rows written
    // before server-side consent existed keep false; the retention purge only
    // ever touches rows where this is true.
    speechTextConsented: boolean('speech_text_consented').notNull().default(false),
    recordedAt: timestamp('recorded_at', { withTimezone: true, mode: 'string' }).notNull(),
  },
  (table) => [index('activation_events_board_recorded_idx').on(table.boardId, table.recordedAt)],
);

/**
 * Current consent decision per user and purpose (see src/lib/consents.ts for
 * the purposes). One row per (user, purpose); every change is also appended to
 * consent_events.
 */
export const consents = pgTable(
  'consents',
  {
    userId: text('user_id').notNull(),
    purpose: text('purpose').notNull(),
    granted: boolean('granted').notNull(),
    policyVersion: text('policy_version').notNull(),
    grantedAt: timestamp('granted_at', { withTimezone: true, mode: 'string' }),
    revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'string' }),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.purpose] })],
);

/** Append-only audit trail of consent changes (who, which purpose, what, when). */
export const consentEvents = pgTable(
  'consent_events',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    purpose: text('purpose').notNull(),
    granted: boolean('granted').notNull(),
    policyVersion: text('policy_version').notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true, mode: 'string' }).notNull(),
  },
  (table) => [index('consent_events_user_recorded_idx').on(table.userId, table.recordedAt)],
);

export const mediaAssets = pgTable(
  'media_assets',
  {
    id: text('id').primaryKey(),
    boardId: text('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    ownerUserId: text('owner_user_id').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    data: text('data').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull(),
  },
  (table) => [
    index('media_assets_board_idx').on(table.boardId),
    // Per-user media quota: sum(size_bytes) by owner.
    index('media_assets_owner_user_idx').on(table.ownerUserId),
  ],
);
