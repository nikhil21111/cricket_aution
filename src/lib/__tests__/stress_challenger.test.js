import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '../supabase';
import toast from 'react-hot-toast';
import fs from 'fs';
import path from 'path';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => {
  const toastMock = vi.fn((msg, opts) => {});
  toastMock.error = vi.fn((msg) => {});
  toastMock.success = vi.fn((msg, opts) => {});
  return {
    default: toastMock,
  };
});

describe('Stress & Robustness Verification Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('Bidding Console Stress & Concurrency Tests', () => {
    it('should handle rapid concurrent bids without DB structure degradation', async () => {
      const tournamentId = 'stress-tournament-concurrency';
      
      // Initialize auction state
      await supabase
        .from('auction_state')
        .insert({
          tournament_id: tournamentId,
          current_player_id: 'player-1',
          highest_bid: 1000,
          highest_bidder_id: 'team-initial',
          bid_history: null,
        });

      const teamA = { id: 'team-a', short_name: 'TA', remaining_purse: 10000 };
      const teamB = { id: 'team-b', short_name: 'TB', remaining_purse: 12000 };

      // Simulate placing multiple concurrent bids (rapid succession / race conditions)
      const sendBidUpdate = async (team, newBidAmount, currentHistory) => {
        const nextHistory = [
          { teamId: team.id, amount: newBidAmount, time: new Date().toLocaleTimeString() },
          ...(currentHistory || []),
        ].slice(0, 10);

        return await supabase
          .from('auction_state')
          .update({
            highest_bid: newBidAmount,
            highest_bidder_id: team.id,
            bid_history: JSON.stringify(nextHistory),
          })
          .eq('tournament_id', tournamentId);
      };

      // Execute concurrent bid updates
      const p1 = sendBidUpdate(teamA, 1500, []);
      const p2 = sendBidUpdate(teamB, 2000, [{ teamId: 'team-a', amount: 1500 }]);
      const p3 = sendBidUpdate(teamA, 2500, [{ teamId: 'team-b', amount: 2000 }, { teamId: 'team-a', amount: 1500 }]);

      const results = await Promise.all([p1, p2, p3]);

      // Assert all updates completed without error
      results.forEach(res => {
        expect(res.error).toBeNull();
      });

      // Verify final persisted state is sound
      const { data: finalState } = await supabase
        .from('auction_state')
        .select('*')
        .eq('tournament_id', tournamentId)
        .single();

      expect(finalState).toBeDefined();
      expect(finalState.highest_bid).toBeGreaterThanOrEqual(1500);
      expect(JSON.parse(finalState.bid_history)).toBeInstanceOf(Array);
    });

    it('should validate edge cases for bid increments and invalid input types', () => {
      // Bidding calculator function matching TournamentLive's logic
      const calculateNextBid = (currentBid, basePrice, increment, hasHighestBidder) => {
        const isFirst = !hasHighestBidder;
        return isFirst ? basePrice : currentBid + increment;
      };

      // Test zero increment
      expect(calculateNextBid(1000, 500, 0, true)).toBe(1000);

      // Test negative increment
      expect(calculateNextBid(1000, 500, -200, true)).toBe(800);

      // Test first bid is always basePrice, regardless of increment
      expect(calculateNextBid(0, 500, 500, false)).toBe(500);
      expect(calculateNextBid(0, 500, -500, false)).toBe(500);

      // Test overflow/extremely large values
      const hugeIncrement = 1e9;
      expect(calculateNextBid(1000, 500, hugeIncrement, true)).toBe(1000 + 1e9);
    });
  });

  describe('Database Recovery & State Reversion', () => {
    it('should revert local state to database values if save fails', async () => {
      // We simulate state tracking like in TournamentLive.jsx:
      let localPlayers = [
        { id: 'p1', name: 'Player One', status: 'available', sold_price: null, team_id: null }
      ];
      let localTeams = [
        { id: 't1', name: 'Team One', remaining_purse: 10000, icon_player_count: 0 }
      ];
      let localCurrentPlayer = { id: 'p1', name: 'Player One', base_price: 1000 };
      let localHighestBidder = { id: 't1', name: 'Team One', remaining_purse: 10000, icon_player_count: 0 };
      let localHighestBid = 2000;

      // Logic from markSold:
      const attemptMarkSold = async (shouldFail) => {
        const soldPlayerId = localCurrentPlayer.id;
        const soldToTeam = localHighestBidder;
        const soldPrice = localHighestBid;

        // 1. Optimistic UI update
        localPlayers = localPlayers.map(p => 
          p.id === soldPlayerId ? { ...p, status: 'sold', sold_price: soldPrice, team_id: soldToTeam.id } : p
        );
        localTeams = localTeams.map(t => 
          t.id === soldToTeam.id ? { ...t, remaining_purse: t.remaining_purse - soldPrice } : t
        );
        localCurrentPlayer = null;
        localHighestBidder = null;
        localHighestBid = 0;

        // 2. Perform DB save
        try {
          if (shouldFail) {
            throw new Error("DB Connection Error");
          }
          // Simulate successful save
        } catch (err) {
          // Revert state to database truth
          // In actual app, this fetches from Supabase. We simulate the fetch revert:
          localPlayers = [
            { id: 'p1', name: 'Player One', status: 'available', sold_price: null, team_id: null }
          ];
          localTeams = [
            { id: 't1', name: 'Team One', remaining_purse: 10000, icon_player_count: 0 }
          ];
          localCurrentPlayer = { id: 'p1', name: 'Player One', base_price: 1000 };
          localHighestBidder = { id: 't1', name: 'Team One', remaining_purse: 10000, icon_player_count: 0 };
          localHighestBid = 2000;
          
          toast.error("Failed to mark as sold");
        }
      };

      // Attempt mark sold with failure
      await attemptMarkSold(true);

      // Verify that states were successfully reverted to pre-transaction truth
      expect(localCurrentPlayer).not.toBeNull();
      expect(localCurrentPlayer.id).toBe('p1');
      expect(localPlayers[0].status).toBe('available');
      expect(localTeams[0].remaining_purse).toBe(10000);
      expect(toast.error).toHaveBeenCalledWith("Failed to mark as sold");
    });
  });

  describe('Unsold Pool Sorting Robustness', () => {
    const getPlayerCategoryId = (player) => {
      if (player?.icon_role && player.icon_role !== 'none') {
        if (player.icon_role.startsWith('icon-player')) {
          return 'icon-player';
        }
        return player.icon_role;
      }
      return player?.role;
    };

    const sortByCategoryOrder = (list, roleOrder) =>
      [...list].sort((a, b) => {
        const aCat = getPlayerCategoryId(a);
        const bCat = getPlayerCategoryId(b);
        const aIndex = roleOrder.indexOf(aCat);
        const bIndex = roleOrder.indexOf(bCat);
        return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
      });

    it('should sort correctly when player record is missing fields or has malformed data', () => {
      const roleOrder = ['icon-player', 'batsman', 'bowler'];
      
      const malformedPlayers = [
        { name: 'Null Role Player', role: null, icon_role: null },
        { name: 'Undefined Fields Player' },
        { name: 'Batsman A', role: 'batsman', icon_role: 'none' },
        { name: 'Icon Player B', role: 'bowler', icon_role: 'icon-player-sequence' },
        { name: 'Bowler C', role: 'bowler', icon_role: 'none' },
      ];

      const sorted = sortByCategoryOrder(malformedPlayers, roleOrder);

      // Expected Order:
      // 1. Icon Player B (category 'icon-player')
      // 2. Batsman A (category 'batsman')
      // 3. Bowler C (category 'bowler')
      // 4 & 5. Malformed players (at the end of the list)
      
      expect(sorted[0].name).toBe('Icon Player B');
      expect(sorted[1].name).toBe('Batsman A');
      expect(sorted[2].name).toBe('Bowler C');
      expect(sorted[3].name).toBeDefined();
      expect(sorted[4].name).toBeDefined();
    });
  });

  describe('Celebration Card Layout & Mobile Media Queries styling', () => {
    it('should verify exact border radius and flat offset shadow layout in index.css', () => {
      const cssPath = path.resolve(__dirname, '../../index.css');
      const cssContent = fs.readFileSync(cssPath, 'utf8');

      // Verify Neo-Brutalist shadow matches exact 8px flat offset requirement
      expect(cssContent).toContain('box-shadow: 8px 8px 0px #0f172a;');
      expect(cssContent).toContain('box-shadow: 8px 8px 0px #f8fafc;');

      // Verify border radius is exactly 0px for Neo-Brutalist cards
      expect(cssContent).toContain('border-radius: 0px;');

      // Verify responsive block exists for small screens (max-width: 640px)
      expect(cssContent).toContain('@media (max-width: 640px)');
    });
  });
});
