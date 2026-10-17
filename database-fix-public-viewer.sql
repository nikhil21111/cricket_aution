-- ============================================================
-- FIX: Public live viewer broken in production
-- Run this whole file in: Supabase Dashboard → SQL Editor → New query
-- Safe to re-run (idempotent). Found by automated E2E testing:
--   1. anon could see live tournaments in the view but got 0 teams / 0 players
--      → the public SELECT policies on teams/players are missing or broken.
--   2. a tournament with is_live=false + status=completed STILL appeared in
--      public_live_tournaments → the deployed view's filter is wrong/stale.
--   3. a completed tournament was left with is_live=true (stale live flag).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Recreate the public read-only policies for teams & players
--    (exactly as defined in database-schema.sql §7)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view live teams" ON teams;
CREATE POLICY "Public can view live teams" ON teams
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auction_state a
      WHERE a.tournament_id = teams.tournament_id
      AND a.is_live = TRUE
    )
  );

DROP POLICY IF EXISTS "Public can view live players" ON players;
CREATE POLICY "Public can view live players" ON players
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auction_state a
      WHERE a.tournament_id = players.tournament_id
      AND a.is_live = TRUE
    )
  );

-- auction_state public policy (recreate to be sure it matches)
DROP POLICY IF EXISTS "Public can view live auction_state" ON auction_state;
CREATE POLICY "Public can view live auction_state" ON auction_state
  FOR SELECT USING (is_live = TRUE);

-- ------------------------------------------------------------
-- 2. Recreate the public view with the CORRECT live-only filter
-- ------------------------------------------------------------
DROP VIEW IF EXISTS public_live_tournaments;
CREATE VIEW public_live_tournaments AS
SELECT id, name, description, status
FROM tournaments
WHERE id IN (SELECT tournament_id FROM auction_state WHERE is_live = TRUE);

GRANT SELECT ON public_live_tournaments TO anon;

-- ------------------------------------------------------------
-- 3. Clean up stale live flags on your real data
--    (a completed tournament was still flagged is_live = true
--     with a dangling bid of 200 and no active auction)
-- ------------------------------------------------------------
-- Inspect first (run alone to review before applying):
--   SELECT t.id, t.name, t.status, a.is_live, a.highest_bid, a.current_player_id
--   FROM auction_state a JOIN tournaments t ON t.id = a.tournament_id;

-- Reset any tournament that is completed/draft but still flagged live:
UPDATE auction_state a
SET is_live = FALSE, current_player_id = NULL, highest_bid = 0,
    highest_bidder_id = NULL, bid_history = NULL
FROM tournaments t
WHERE t.id = a.tournament_id
  AND a.is_live = TRUE
  AND t.status IN ('completed', 'draft');

-- ------------------------------------------------------------
-- 4. Make sure realtime is enabled for the public viewer
--    (skips silently if already added)
-- ------------------------------------------------------------
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE auction_state;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE teams;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE players;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
