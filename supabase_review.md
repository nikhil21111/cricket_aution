# Supabase Database & Storage Review

This document provides a comprehensive audit of the Supabase configuration required for **Cricket Auction Pro** to work flawlessly. 

---

## 1. Storage Buckets (Action Required)
Supabase Storage is used to store team logos and player photos. By default, these buckets **do not exist** and will throw `400 Bad Request (bucket not found)` errors when uploading files unless created and configured.

### Checklist
- [ ] Create a public storage bucket named `players` (for player photos).
- [ ] Create a public storage bucket named `logos` (for team logos).
- [ ] Set up Storage Row Level Security (RLS) policies for both buckets so the web client can read and write files.

---

## 2. Row Level Security (RLS) Policies (Optimization)
The original SQL schema allows public/anonymous users to read `teams`, `players`, and `auction_state` **only** while the auction is actively live (`is_live = true`). 

### The Problem
Once the auction is ended (i.e. the status becomes `completed` and `is_live = false`), public viewers opening the public live board page (`/live/:id`) will see an empty page with no teams, players, or stats, because RLS will block all read access.

### The Solution
Optimize the RLS read policies to allow public reads if:
1. The auction state is live (`is_live = true`), **OR**
2. The tournament status is `'completed'` (allowing viewers to inspect finished auction drafts).

---

## 3. SQL Setup Scripts (Copy & Paste)
To configure your database, open the **SQL Editor** in your Supabase Dashboard, create a **New Query**, paste the code below, and click **Run**.

```sql
-- =========================================================
-- 1. STORAGE BUCKET CREATION & POLICIES
-- =========================================================

-- Create storage buckets if they don't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('players', 'players', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- Enable public select (viewing) on both storage buckets
CREATE POLICY "Public Read Access for Players Bucket" ON storage.objects 
  FOR SELECT USING (bucket_id = 'players');

CREATE POLICY "Public Read Access for Logos Bucket" ON storage.objects 
  FOR SELECT USING (bucket_id = 'logos');

-- Enable public insert (uploading) on both storage buckets
CREATE POLICY "Public Write Access for Players Bucket" ON storage.objects 
  FOR INSERT WITH CHECK (bucket_id = 'players');

CREATE POLICY "Public Write Access for Logos Bucket" ON storage.objects 
  FOR INSERT WITH CHECK (bucket_id = 'logos');


-- =========================================================
-- 2. IMPROVED PUBLIC READ POLICIES (RLS)
-- =========================================================

-- DROP existing basic live-only public policies to recreate optimized ones
DROP POLICY IF EXISTS "Public can view live auction_state" ON auction_state;
DROP POLICY IF EXISTS "Public can view live teams" ON teams;
DROP POLICY IF EXISTS "Public can view live players" ON players;
DROP POLICY IF EXISTS "Public can view live tournaments" ON tournaments;
DROP VIEW IF EXISTS public_live_tournaments;

-- Teams public view policy: allow view if tournament is live or completed
CREATE POLICY "Public read teams when live or completed" ON teams
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tournaments t
      WHERE t.id = teams.tournament_id
      AND (
        t.status = 'completed' OR 
        EXISTS (SELECT 1 FROM auction_state a WHERE a.tournament_id = t.id AND a.is_live = TRUE)
      )
    )
  );

-- Players public view policy: allow view if tournament is live or completed
CREATE POLICY "Public read players when live or completed" ON players
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tournaments t
      WHERE t.id = players.tournament_id
      AND (
        t.status = 'completed' OR 
        EXISTS (SELECT 1 FROM auction_state a WHERE a.tournament_id = t.id AND a.is_live = TRUE)
      )
    )
  );

-- Auction State public view policy: allow view if live or completed
CREATE POLICY "Public read auction state when live or completed" ON auction_state
  FOR SELECT USING (
    is_live = TRUE OR 
    EXISTS (SELECT 1 FROM tournaments t WHERE t.id = auction_state.tournament_id AND t.status = 'completed')
  );

-- Tournaments public read view (for navigation/names)
CREATE VIEW public_live_tournaments AS
SELECT id, name, description, status
FROM tournaments
WHERE 
  status = 'completed' OR 
  id IN (SELECT tournament_id FROM auction_state WHERE is_live = TRUE);

GRANT SELECT ON public_live_tournaments TO anon;


-- =========================================================
-- 3. ENABLE SUPABASE REALTIME UPDATES
-- =========================================================
-- Ensure these tables broadcast updates to the organizer & viewer in real time.
-- This block is safe, idempotent, and runs without throwing any relation errors.
DO $$
BEGIN
  -- Create publication if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
  
  -- Add auction_state table if not already in publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr 
    JOIN pg_class c ON pr.prrelid = c.oid 
    JOIN pg_publication p ON pr.prpubid = p.oid 
    WHERE p.pubname = 'supabase_realtime' AND c.relname = 'auction_state'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE auction_state;
  END IF;

  -- Add teams table if not already in publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr 
    JOIN pg_class c ON pr.prrelid = c.oid 
    JOIN pg_publication p ON pr.prpubid = p.oid 
    WHERE p.pubname = 'supabase_realtime' AND c.relname = 'teams'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE teams;
  END IF;

  -- Add players table if not already in publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr 
    JOIN pg_class c ON pr.prrelid = c.oid 
    JOIN pg_publication p ON pr.prpubid = p.oid 
    WHERE p.pubname = 'supabase_realtime' AND c.relname = 'players'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE players;
  END IF;
END $$;
```

---

## 4. Full Codebase Review: Tables & Columns Audit
Below is a verification of column mappings between the React frontend queries and the PostgreSQL database tables:

| Table Name | PostgreSQL Schema Column | React Frontend Reference | Status |
| :--- | :--- | :--- | :--- |
| **tournaments** | `id` (UUID) | `tournamentId`, `id` | matches |
| | `user_id` (UUID) | `user.id` | matches |
| | `name` (TEXT) | `name` | matches |
| | `description` (TEXT) | `description` | matches |
| | `default_purse` (INT) | `default_purse` | matches |
| | `default_base_price` (INT) | `default_base_price` | matches |
| | `status` (TEXT) | `status` | matches |
| | `teams_count` (INT) | `teams_count` | matches |
| | `players_count` (INT) | `players_count` | matches |
| **teams** | `id` (UUID) | `team.id` | matches |
| | `tournament_id` (UUID) | `tournament_id` | matches |
| | `name` (TEXT) | `name` | matches |
| | `short_name` (TEXT) | `short_name` | matches |
| | `color` (TEXT) | `color` | matches |
| | `logo_url` (TEXT) | `logo_url` | matches |
| | `total_purse` (INT) | `total_purse` | matches |
| | `remaining_purse` (INT) | `remaining_purse` | matches |
| | `icon_player_count` (INT) | `icon_player_count` | matches |
| **players** | `id` (UUID) | `player.id` | matches |
| | `tournament_id` (UUID) | `tournament_id` | matches |
| | `team_id` (UUID) | `team_id` | matches |
| | `name` (TEXT) | `name` | matches |
| | `role` (TEXT) | `role` | matches |
| | `icon_role` (TEXT) | `icon_role` | matches |
| | `photo_url` (TEXT) | `photo_url` | matches |
| | `base_price` (INT) | `base_price` | matches |
| | `sold_price` (INT) | `sold_price` | matches |
| | `status` (TEXT) | `status` | matches |
| **auction_state** | `id` (UUID) | `id` | matches |
| | `tournament_id` (UUID) | `tournament_id` | matches |
| | `is_live` (BOOL) | `is_live` | matches |
| | `current_player_id` (UUID) | `current_player_id` | matches |
| | `highest_bid` (INT) | `highest_bid` | matches |
| | `highest_bidder_id` (UUID) | `highest_bidder_id` | matches |
| | `bid_history` (TEXT) | `bid_history` | matches |
