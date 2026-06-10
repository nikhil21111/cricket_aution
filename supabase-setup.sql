-- SQL Schema for Auction Pro App
-- Run this in Supabase SQL Editor to configure your entire project

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================
-- 1. TABLE CREATION
-- =========================================================

-- Create Tournaments Table
CREATE TABLE IF NOT EXISTS tournaments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  default_purse INTEGER DEFAULT 10000,
  default_base_price INTEGER DEFAULT 500,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'setup', 'live', 'completed')),
  teams_count INTEGER DEFAULT 0,
  players_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Teams Table
CREATE TABLE IF NOT EXISTS teams (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  color TEXT DEFAULT '#0db9f2',
  logo_url TEXT,
  total_purse INTEGER DEFAULT 10000,
  remaining_purse INTEGER DEFAULT 10000,
  icon_player_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Players Table
CREATE TABLE IF NOT EXISTS players (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'batsman' CHECK (role IN ('batsman', 'bowler', 'all-rounder', 'wicket-keeper')),
  icon_role TEXT DEFAULT 'none' CHECK (icon_role IN ('none', 'icon-player', 'icon-player-sequence', 'icon-player-random', 'icon-batsman', 'icon-bowler', 'icon-allrounder', 'icon-keeper')),
  photo_url TEXT,
  base_price INTEGER DEFAULT 500,
  sold_price INTEGER,
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'sold', 'unsold')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Auction State Table
CREATE TABLE IF NOT EXISTS auction_state (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  is_live BOOLEAN DEFAULT FALSE,
  current_player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  highest_bid INTEGER DEFAULT 0,
  highest_bidder_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  bid_history TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================================
-- 2. CREATE INDEXES
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_tournaments_user_id ON tournaments(user_id);
CREATE INDEX IF NOT EXISTS idx_teams_tournament_id ON teams(tournament_id);
CREATE INDEX IF NOT EXISTS idx_players_tournament_id ON players(tournament_id);
CREATE INDEX IF NOT EXISTS idx_auction_state_tournament_id ON auction_state(tournament_id);

-- =========================================================
-- 3. STORAGE BUCKET CREATION & POLICIES
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
-- 4. ROW LEVEL SECURITY (RLS) & OWNER POLICIES
-- =========================================================
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_state ENABLE ROW LEVEL SECURITY;

-- Owner Policies for Tournaments
DROP POLICY IF EXISTS "Users can view their own tournaments" ON tournaments;
CREATE POLICY "Users can view their own tournaments" ON tournaments
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own tournaments" ON tournaments;
CREATE POLICY "Users can create their own tournaments" ON tournaments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own tournaments" ON tournaments;
CREATE POLICY "Users can update their own tournaments" ON tournaments
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own tournaments" ON tournaments;
CREATE POLICY "Users can delete their own tournaments" ON tournaments
  FOR DELETE USING (auth.uid() = user_id);

-- Owner Policies for Teams
DROP POLICY IF EXISTS "Users can view teams in their tournaments" ON teams;
CREATE POLICY "Users can view teams in their tournaments" ON teams
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tournaments 
      WHERE tournaments.id = teams.tournament_id 
      AND tournaments.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create teams in their tournaments" ON teams;
CREATE POLICY "Users can create teams in their tournaments" ON teams
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM tournaments 
      WHERE tournaments.id = tournament_id 
      AND tournaments.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update teams in their tournaments" ON teams;
CREATE POLICY "Users can update teams in their tournaments" ON teams
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM tournaments 
      WHERE tournaments.id = teams.tournament_id 
      AND tournaments.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete teams in their tournaments" ON teams;
CREATE POLICY "Users can delete teams in their tournaments" ON teams
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM tournaments 
      WHERE tournaments.id = teams.tournament_id 
      AND tournaments.user_id = auth.uid()
    )
  );

-- Owner Policies for Players
DROP POLICY IF EXISTS "Users can view players in their tournaments" ON players;
CREATE POLICY "Users can view players in their tournaments" ON players
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tournaments 
      WHERE tournaments.id = players.tournament_id 
      AND tournaments.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create players in their tournaments" ON players;
CREATE POLICY "Users can create players in their tournaments" ON players
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM tournaments 
      WHERE tournaments.id = tournament_id 
      AND tournaments.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update players in their tournaments" ON players;
CREATE POLICY "Users can update players in their tournaments" ON players
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM tournaments 
      WHERE tournaments.id = players.tournament_id 
      AND tournaments.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete players in their tournaments" ON players;
CREATE POLICY "Users can delete players in their tournaments" ON players
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM tournaments 
      WHERE tournaments.id = players.tournament_id 
      AND tournaments.user_id = auth.uid()
    )
  );

-- Owner Policies for Auction State
DROP POLICY IF EXISTS "Users can view auction state in their tournaments" ON auction_state;
CREATE POLICY "Users can view auction state in their tournaments" ON auction_state
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tournaments 
      WHERE tournaments.id = auction_state.tournament_id 
      AND tournaments.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update auction state in their tournaments" ON auction_state;
CREATE POLICY "Users can update auction state in their tournaments" ON auction_state
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM tournaments 
      WHERE tournaments.id = auction_state.tournament_id 
      AND tournaments.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert auction state in their tournaments" ON auction_state;
CREATE POLICY "Users can insert auction state in their tournaments" ON auction_state
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM tournaments 
      WHERE tournaments.id = tournament_id 
      AND tournaments.user_id = auth.uid()
    )
  );

-- =========================================================
-- 5. PUBLIC VIEWER POLICIES (LIVE OR COMPLETED)
-- =========================================================

-- Teams Public Read
DROP POLICY IF EXISTS "Public read teams when live or completed" ON teams;
DROP POLICY IF EXISTS "Public can view live teams" ON teams;
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

-- Players Public Read
DROP POLICY IF EXISTS "Public read players when live or completed" ON players;
DROP POLICY IF EXISTS "Public can view live players" ON players;
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

-- Auction State Public Read
DROP POLICY IF EXISTS "Public read auction state when live or completed" ON auction_state;
DROP POLICY IF EXISTS "Public can view live auction_state" ON auction_state;
CREATE POLICY "Public read auction state when live or completed" ON auction_state
  FOR SELECT USING (
    is_live = TRUE OR 
    EXISTS (SELECT 1 FROM tournaments t WHERE t.id = auction_state.tournament_id AND t.status = 'completed')
  );

-- Tournaments Public Read View
DROP VIEW IF EXISTS public_live_tournaments;
CREATE VIEW public_live_tournaments AS
SELECT id, name, description, status
FROM tournaments
WHERE 
  status = 'completed' OR 
  id IN (SELECT tournament_id FROM auction_state WHERE is_live = TRUE);

GRANT SELECT ON public_live_tournaments TO anon;

-- =========================================================
-- 6. TRIGGERS & TIMESTAMP FUNCTIONS
-- =========================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_tournaments_updated_at ON tournaments;
CREATE TRIGGER update_tournaments_updated_at
  BEFORE UPDATE ON tournaments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =========================================================
-- 7. ENABLE SUPABASE REALTIME UPDATES
-- =========================================================
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
