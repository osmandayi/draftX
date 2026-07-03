-- =============================================================================
-- Realtime UPDATE/DELETE events are RLS-authorized against the OLD row. Our
-- policies reference non-PK columns (drafts.captain_a/captain_b/creator_id,
-- players.draft_id), which are NOT written to the WAL under the default
-- replica identity — so Supabase can't evaluate RLS on the old row and drops
-- the event. Result: Captain B joining (drafts UPDATE) and picks landing
-- (players UPDATE) never reached the other client.
--
-- REPLICA IDENTITY FULL logs every column on update/delete, so the events are
-- authorized and delivered.
-- =============================================================================

alter table public.drafts replica identity full;
alter table public.players replica identity full;
