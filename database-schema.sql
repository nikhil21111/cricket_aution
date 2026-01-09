-- SQL Schema for Auction Pro App
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 1. CREATE TOURNAMENTS TABLE
-- =============================================
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

-- =============================================
-- 2. CREATE TEAMS TABLE
-- =============================================
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

-- =============================================
-- 3. CREATE PLAYERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS players (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'batsman' CHECK (role IN ('batsman', 'bowler', 'all-rounder', 'wicket-keeper')),
  icon_role TEXT DEFAULT 'none' CHECK (icon_role IN ('none', 'icon-batsman', 'icon-bowler', 'icon-allrounder', 'icon-keeper')),
  photo_url TEXT,
  base_price INTEGER DEFAULT 500,
  sold_price INTEGER,
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'sold', 'unsold')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 4. CREATE AUCTION_STATE TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS auction_state (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  is_live BOOLEAN DEFAULT FALSE,
  current_player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  highest_bid INTEGER DEFAULT 0,
  highest_bidder_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 5. CREATE INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_tournaments_user_id ON tournaments(user_id);
CREATE INDEX IF NOT EXISTS idx_teams_tournament_id ON teams(tournament_id);
CREATE INDEX IF NOT EXISTS idx_players_tournament_id ON players(tournament_id);
CREATE INDEX IF NOT EXISTS idx_auction_state_tournament_id ON auction_state(tournament_id);

-- =============================================
-- 6. ENABLE ROW LEVEL SECURITY
-- =============================================
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_state ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tournaments
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

-- RLS Policies for teams (based on tournament ownership)
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

-- RLS Policies for players (based on tournament ownership)
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

-- RLS Policies for auction_state (based on tournament ownership)
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

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for tournaments updated_at
DROP TRIGGER IF EXISTS update_tournaments_updated_at ON tournaments;
CREATE TRIGGER update_tournaments_updated_at
  BEFORE UPDATE ON tournaments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- 7. PUBLIC READ-ONLY POLICIES FOR LIVE VIEWER
-- =============================================
-- These allow anonymous/public users (anon key) to read live data when a tournament is live.
-- Writes remain restricted by the owner policies above.

-- auction_state public read when live
DROP POLICY IF EXISTS "Public can view live auction_state" ON auction_state;
CREATE POLICY "Public can view live auction_state" ON auction_state
  FOR SELECT USING (is_live = TRUE);

-- teams public read when tournament is live
DROP POLICY IF EXISTS "Public can view live teams" ON teams;
CREATE POLICY "Public can view live teams" ON teams
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auction_state a
      WHERE a.tournament_id = teams.tournament_id
      AND a.is_live = TRUE
    )
  );

-- players public read when tournament is live
DROP POLICY IF EXISTS "Public can view live players" ON players;
CREATE POLICY "Public can view live players" ON players
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auction_state a
      WHERE a.tournament_id = players.tournament_id
      AND a.is_live = TRUE
    )
  );

-- tournaments public read (name/description/status) when live
DROP POLICY IF EXISTS "Public can view live tournaments" ON tournaments;

-- Optional: create a public view to avoid recursion and keep RLS simple
DROP VIEW IF EXISTS public_live_tournaments;
CREATE VIEW public_live_tournaments AS
SELECT id, name, description, status
FROM tournaments
WHERE id IN (SELECT tournament_id FROM auction_state WHERE is_live = TRUE);

GRANT SELECT ON public_live_tournaments TO anon;

-- Enable Realtime publication for public viewer updates (run once)
ALTER PUBLICATION supabase_realtime ADD TABLE auction_state;
ALTER PUBLICATION supabase_realtime ADD TABLE teams;
ALTER PUBLICATION supabase_realtime ADD TABLE players;
