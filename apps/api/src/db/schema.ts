import { index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const boards = pgTable('boards', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  profileId: text('profile_id').notNull(),
  grid: jsonb('grid').notNull(),
  version: integer('version').notNull().default(1),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull(),
});

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
