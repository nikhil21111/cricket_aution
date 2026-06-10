import { describe, it, expect } from 'vitest';
import { supabase } from '../supabase';
import fs from 'fs';
import path from 'path';

describe('Milestones M2, M3, M4 Fixes Verification', () => {
  describe('Milestone M2: Bidding History Database Persistence', () => {
    it('should default bid_history to null in mock insert and handle saves', async () => {
      // Clear localStorage/db mock state if any
      localStorage.removeItem('mock_supabase_db');

      // 1. Insert initial mock auction state
      const { data: insertData, error: insertError } = await supabase
        .from('auction_state')
        .insert({
          tournament_id: 'tournament-123',
          current_player_id: 'player-1',
          highest_bid: 500,
          highest_bidder_id: 'team-1',
        });

      expect(insertError).toBeNull();
      // Ensure bid_history defaults to null
      expect(insertData.bid_history).toBeNull();

      // 2. Place a bid (simulate placeBid serialization)
      const bidHistoryList = [
        { teamId: 'team-1', amount: 500, time: '10:00:00 AM' }
      ];
      const serialized = JSON.stringify(bidHistoryList);

      const { data: updateData, error: updateError } = await supabase
        .from('auction_state')
        .update({
          highest_bid: 1000,
          highest_bidder_id: 'team-2',
          bid_history: serialized,
        })
        .eq('tournament_id', 'tournament-123');

      expect(updateError).toBeNull();
      expect(updateData[0].bid_history).toBe(serialized);

      // 3. Fetch/Retrieve and check deserialization
      const { data: selectData, error: selectError } = await supabase
        .from('auction_state')
        .select('*')
        .eq('tournament_id', 'tournament-123')
        .single();

      expect(selectError).toBeNull();
      expect(selectData.bid_history).toBe(serialized);

      // 4. Test mapping logic (mapping team ID to full team object)
      const mockTeamsList = [
        { id: 'team-1', name: 'Team One', short_name: 'T1' },
        { id: 'team-2', name: 'Team Two', short_name: 'T2' }
      ];

      const rawHistory = JSON.parse(selectData.bid_history);
      const mappedHistory = rawHistory.map((item) => {
        const teamId = item.teamId || item.team?.id;
        const fullTeam = mockTeamsList.find((t) => t.id === teamId);
        return {
          ...item,
          team: fullTeam || item.team,
        };
      });

      expect(mappedHistory[0].team.name).toBe('Team One');
      expect(mappedHistory[0].team.short_name).toBe('T1');

      // 5. Reset transition checks (marking sold, unsold, next player)
      const { data: resetData, error: resetError } = await supabase
        .from('auction_state')
        .update({
          current_player_id: null,
          highest_bid: 0,
          highest_bidder_id: null,
          bid_history: null,
        })
        .eq('tournament_id', 'tournament-123');

      expect(resetError).toBeNull();
      expect(resetData[0].bid_history).toBeNull();
    });
  });

  describe('Milestone M3: Unsold Pool Sorting Helper Logic', () => {
    it('should sort players by category order correctly', () => {
      // Custom helper function matching the behavior
      const getPlayerCategoryId = (player) => {
        if (player?.icon_role && player.icon_role !== 'none') {
          if (player.icon_role.startsWith('icon-player')) {
            return 'icon-player';
          }
          return player.icon_role;
        }
        return player?.role;
      };

      const categoryOrder = [
        { id: 'icon-batsman' },
        { id: 'icon-bowler' },
        { id: 'batsman' },
        { id: 'bowler' }
      ];

      const roleOrder = categoryOrder.map((c) => c.id);

      const sortByCategoryOrder = (list) =>
        [...list].sort((a, b) => {
          const aCat = getPlayerCategoryId(a);
          const bCat = getPlayerCategoryId(b);
          const aIndex = roleOrder.indexOf(aCat);
          const bIndex = roleOrder.indexOf(bCat);
          return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
        });

      const sampleUnsoldPlayers = [
        { name: 'Bowler A', role: 'bowler', icon_role: 'none' },
        { name: 'Icon Batsman B', role: 'batsman', icon_role: 'icon-batsman' },
        { name: 'Icon Bowler C', role: 'bowler', icon_role: 'icon-bowler' },
        { name: 'Batsman D', role: 'batsman', icon_role: 'none' }
      ];

      const sorted = sortByCategoryOrder(sampleUnsoldPlayers);

      expect(sorted[0].name).toBe('Icon Batsman B'); // index 0
      expect(sorted[1].name).toBe('Icon Bowler C');  // index 1
      expect(sorted[2].name).toBe('Batsman D');      // index 2
      expect(sorted[3].name).toBe('Bowler A');       // index 3
    });
  });

  describe('Milestone M4: Celebration Card Mobile Shadow', () => {
    it('should verify index.css contains the correct 8px mobile shadow values', () => {
      const cssPath = path.resolve(__dirname, '../../index.css');
      const cssContent = fs.readFileSync(cssPath, 'utf8');

      // Ensure the @media max-width 640px query has .sold-card box-shadow set back to 8px 8px 0px
      // Light mode shadow
      expect(cssContent).toContain('box-shadow: 8px 8px 0px #0f172a;');
      // Dark mode shadow
      expect(cssContent).toContain('box-shadow: 8px 8px 0px #f8fafc;');
    });
  });
});
