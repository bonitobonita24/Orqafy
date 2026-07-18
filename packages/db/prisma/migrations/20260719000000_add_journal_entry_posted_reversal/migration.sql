-- Catch-up migration: journal_entries.posted_by_id + reversal_of_id are declared in
-- schema.prisma (postedBy/reversalOf relations) but the init migration
-- (20260506144956) predates them, so they were never created. Without these columns
-- ANY Prisma read of JournalEntry (journal-entries list, trial-balance, general-ledger)
-- fails with "column posted_by_id does not exist" — the Accounting module was broken in
-- every environment. This adds the two columns + their foreign keys. Idempotent.

ALTER TABLE "journal_entries" ADD COLUMN IF NOT EXISTS "posted_by_id" TEXT;
ALTER TABLE "journal_entries" ADD COLUMN IF NOT EXISTS "reversal_of_id" TEXT;

DO $$ BEGIN
  ALTER TABLE "journal_entries"
    ADD CONSTRAINT "journal_entries_posted_by_id_fkey"
    FOREIGN KEY ("posted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "journal_entries"
    ADD CONSTRAINT "journal_entries_reversal_of_id_fkey"
    FOREIGN KEY ("reversal_of_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
