-- IRREVERSIBLE. Clears the spoken text of activations recorded before
-- server-side consent existed (migration 0004): those rows were written under
-- a client-supplied header, not a consent record, so their text has no basis.
-- Since 0004 every row that keeps text has speech_text_consented = true, so
-- this predicate selects exactly the pre-0004 rows that still carry text.
-- The count rows stay (usage reports are unchanged); only the text is cleared.
-- Idempotent: a second run matches nothing.
UPDATE "activation_events"
   SET "speech_text" = NULL
 WHERE "speech_text_consented" = false
   AND "speech_text" IS NOT NULL;
