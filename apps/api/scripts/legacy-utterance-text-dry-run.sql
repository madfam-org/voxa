-- Count-only dry run for migration 0005_purge_legacy_utterance_text.
-- Read-only: returns counts and a date range, never any text or id.
-- After migration 0004 is applied (column speech_text_consented exists):
SELECT count(*)                  AS rows_with_text,
       count(DISTINCT user_id)   AS distinct_users,
       count(DISTINCT board_id)  AS distinct_boards,
       count(*) FILTER (WHERE board_id = 'demo-core') AS rows_on_demo_board,
       min(recorded_at)          AS earliest,
       max(recorded_at)          AS latest
  FROM activation_events
 WHERE speech_text_consented = false
   AND speech_text IS NOT NULL;
