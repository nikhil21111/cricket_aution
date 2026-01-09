# Auction Pro

## Supabase environment
Set these in Vercel (or `.env.local` when running locally):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

The client falls back to the baked-in keys for development but will log a warning. Always set env vars in production.

## Public live viewer (read-only)
To let unauthenticated viewers load `/live/:id`, run these **SELECT-only** RLS policies (writes remain organizer-only):

```sql
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

-- tournaments public read when live
DROP POLICY IF EXISTS "Public can view live tournaments" ON tournaments;
CREATE POLICY "Public can view live tournaments" ON tournaments
	FOR SELECT USING (
		EXISTS (
			SELECT 1 FROM auction_state a
			WHERE a.tournament_id = tournaments.id
			AND a.is_live = TRUE
		)
	);
```

If you prefer a stricter approach, expose a dedicated view with only the columns you want public and grant SELECT on that view to anon.

## Public live link
Shareable viewer URL: `https://<your-domain>/live/<tournament-id>`. Owners can copy the link from the dashboard hero or sidebar.
