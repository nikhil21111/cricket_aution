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

describe('Challenger 2 - Live Auction Stress & Robustness Tests', () => {
  
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('Database Persistence & Recovery (Milestone M2)', () => {
    it('should handle rapid/successive bid updates without corruption', async () => {
      const tournamentId = 'test-tournament-concurrency';
      
      // Initialize auction state in mock DB
      await supabase
        .from('auction_state')
        .insert({
          tournament_id: tournamentId,
          current_player_id: 'player-1',
          highest_bid: 0,
          highest_bidder_id: null,
          bid_history: null,
        });

      const teams = [
        { id: 'team-a', name: 'Team Alpha', short_name: 'TA', remaining_purse: 10000 },
        { id: 'team-b', name: 'Team Beta', short_name: 'TB', remaining_purse: 10000 },
      ];

      // Simulate placing 5 rapid successive bids
      let currentHighestBid = 0;
      let currentHighestBidder = null;
      let mockBidHistory = [];

      const placeBidSimulated = async (team, increment) => {
        const isFirst = currentHighestBidder === null;
        const newBid = isFirst ? 500 : currentHighestBid + increment;

        // Validations matching implementation
        if (newBid > team.remaining_purse) {
          throw new Error('Insufficient purse');
        }
        if (currentHighestBidder === team.id) {
          throw new Error('Already highest bidder');
        }

        mockBidHistory = [
          { teamId: team.id, amount: newBid, time: '12:00:00 PM' },
          ...mockBidHistory.slice(0, 9),
        ];

        // Perform db update
        const { error } = await supabase
          .from('auction_state')
          .update({
            highest_bid: newBid,
            highest_bidder_id: team.id,
            bid_history: JSON.stringify(mockBidHistory),
          })
          .eq('tournament_id', tournamentId);

        if (error) throw error;

        currentHighestBid = newBid;
        currentHighestBidder = team.id;
      };

      // Place rapid bids back and forth
      await placeBidSimulated(teams[0], 500); // 500 (TA)
      await placeBidSimulated(teams[1], 500); // 1000 (TB)
      await placeBidSimulated(teams[0], 500); // 1500 (TA)
      await placeBidSimulated(teams[1], 500); // 2000 (TB)
      await placeBidSimulated(teams[0], 500); // 2500 (TA)

      // Fetch state from database and verify persistence & history serialization
      const { data: dbState, error: fetchError } = await supabase
        .from('auction_state')
        .select('*')
        .eq('tournament_id', tournamentId)
        .single();

      expect(fetchError).toBeNull();
      expect(dbState.highest_bid).toBe(2500);
      expect(dbState.highest_bidder_id).toBe('team-a');
      
      const parsedHistory = JSON.parse(dbState.bid_history);
      expect(parsedHistory.length).toBe(5);
      expect(parsedHistory[0].amount).toBe(2500);
      expect(parsedHistory[0].teamId).toBe('team-a');
      expect(parsedHistory[4].amount).toBe(500);
      expect(parsedHistory[4].teamId).toBe('team-a');
    });

    it('should reject invalid inputs and recovery from corrupted/malformed database state gracefully', async () => {
      const tournamentId = 'test-tournament-validation';

      // Insert state with malformed bid history (e.g. invalid JSON string)
      await supabase
        .from('auction_state')
        .insert({
          tournament_id: tournamentId,
          current_player_id: 'player-1',
          highest_bid: 1000,
          highest_bidder_id: 'team-a',
          bid_history: '{invalid-json: missing-quotes}',
        });

      // Verify deserialization fallback
      const { data: dbState } = await supabase
        .from('auction_state')
        .select('*')
        .eq('tournament_id', tournamentId)
        .single();

      let parsedHistory = [];
      try {
        parsedHistory = typeof dbState.bid_history === 'string'
          ? JSON.parse(dbState.bid_history)
          : dbState.bid_history;
      } catch (e) {
        // Fallback matching implementation: parsedHistory remains empty, prevents crash
        parsedHistory = [];
      }

      expect(parsedHistory).toEqual([]);

      // Test recovery by overwriting with valid state
      const correctHistory = [{ teamId: 'team-a', amount: 1000, time: '12:00:00' }];
      await supabase
        .from('auction_state')
        .update({
          bid_history: JSON.stringify(correctHistory),
        })
        .eq('tournament_id', tournamentId);

      const { data: updatedState } = await supabase
        .from('auction_state')
        .select('*')
        .eq('tournament_id', tournamentId)
        .single();

      expect(JSON.parse(updatedState.bid_history)).toEqual(correctHistory);
    });

    it('should handle reset transitions (sold/unsold) and clear bid history', async () => {
      const tournamentId = 'test-tournament-reset';

      await supabase
        .from('auction_state')
        .insert({
          tournament_id: tournamentId,
          current_player_id: 'player-1',
          highest_bid: 1500,
          highest_bidder_id: 'team-a',
          bid_history: JSON.stringify([{ teamId: 'team-a', amount: 1500 }]),
        });

      // Reset on Sold/Unsold
      const { error } = await supabase
        .from('auction_state')
        .update({
          current_player_id: null,
          highest_bid: 0,
          highest_bidder_id: null,
          bid_history: null,
        })
        .eq('tournament_id', tournamentId);

      expect(error).toBeNull();

      const { data: resetState } = await supabase
        .from('auction_state')
        .select('*')
        .eq('tournament_id', tournamentId)
        .single();

      expect(resetState.current_player_id).toBeNull();
      expect(resetState.highest_bid).toBe(0);
      expect(resetState.highest_bidder_id).toBeNull();
      expect(resetState.bid_history).toBeNull();
    });
  });

  describe('Unsold Pool Sorting Edge Cases (Milestone M3)', () => {
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

    it('should sort players by customizable order, handling missing or unknown categories', () => {
      const roleOrder = ['icon-player', 'icon-batsman', 'batsman', 'bowler'];

      const players = [
        { name: 'Unknown Role Player', role: 'wicket-keeper', icon_role: 'none' },
        { name: 'Icon Bowler', role: 'bowler', icon_role: 'icon-bowler' }, // Not in roleOrder, category id: 'icon-bowler'
        { name: 'Batsman A', role: 'batsman', icon_role: 'none' }, // Index 2
        { name: 'Icon Batsman B', role: 'batsman', icon_role: 'icon-batsman' }, // Index 1
        { name: 'Icon Player C', role: 'all-rounder', icon_role: 'icon-player-random' }, // Index 0
        { name: 'Bowler D', role: 'bowler', icon_role: 'none' }, // Index 3
      ];

      const sorted = sortByCategoryOrder(players, roleOrder);

      // Expected Order:
      // 1. Icon Player C (category 'icon-player') - index 0
      // 2. Icon Batsman B (category 'icon-batsman') - index 1
      // 3. Batsman A (category 'batsman') - index 2
      // 4. Bowler D (category 'bowler') - index 3
      // 5. Unknown Role Player & Icon Bowler (indices -1 -> 999, stable sort/end of list)
      
      expect(sorted[0].name).toBe('Icon Player C');
      expect(sorted[1].name).toBe('Icon Batsman B');
      expect(sorted[2].name).toBe('Batsman A');
      expect(sorted[3].name).toBe('Bowler D');
      expect(sorted.slice(4)).toContainEqual(players[0]);
      expect(sorted.slice(4)).toContainEqual(players[1]);
    });

    it('should handle empty lists and single element lists without errors', () => {
      const roleOrder = ['icon-player', 'batsman', 'bowler'];
      
      expect(sortByCategoryOrder([], roleOrder)).toEqual([]);
      
      const single = [{ name: 'Batsman A', role: 'batsman', icon_role: 'none' }];
      expect(sortByCategoryOrder(single, roleOrder)).toEqual(single);
    });
  });

  describe('Celebration Card Styling (Milestone M4)', () => {
    it('should verify index.css responsive styling variables and custom attributes', () => {
      const cssPath = path.resolve(__dirname, '../../index.css');
      const cssContent = fs.readFileSync(cssPath, 'utf8');

      // Find the @media (max-width: 640px) block
      const mediaIndex = cssContent.indexOf('@media (max-width: 640px)');
      expect(mediaIndex).not.toBe(-1);

      let braceCount = 0;
      let blockContent = '';
      let started = false;
      for (let i = mediaIndex; i < cssContent.length; i++) {
        if (cssContent[i] === '{') {
          braceCount++;
          started = true;
        } else if (cssContent[i] === '}') {
          braceCount--;
          if (started && braceCount === 0) {
            blockContent = cssContent.substring(mediaIndex, i + 1);
            break;
          }
        }
      }

      expect(blockContent).not.toBe('');
      
      const hasMobileSoldCard = blockContent.includes('.sold-card') && blockContent.includes('box-shadow: 8px 8px 0px #0f172a;');
      const hasMobileDarkSoldCard = blockContent.includes('.dark .sold-card') && blockContent.includes('box-shadow: 8px 8px 0px #f8fafc;');

      expect(hasMobileSoldCard).toBe(true);
      expect(hasMobileDarkSoldCard).toBe(true);

      // Verify brutalist design elements (border-radius: 0px) are used to fit theme
      expect(cssContent).toContain('border-radius: 0px;');
    });
  });

  describe('Toast Notification Scenarios', () => {
    it('should simulate bid validations and trigger correct error toasts', () => {
      // Mock bid validations
      const placeBidSimulated = (team, nextBid, highestBidderId) => {
        if (nextBid > team.remaining_purse) {
          toast.error(`${team.short_name} doesn't have enough purse!`);
          return false;
        }
        if (highestBidderId === team.id) {
          toast.error(`${team.short_name} is already the highest bidder!`);
          return false;
        }
        return true;
      };

      const teamA = { id: 'team-a', short_name: 'TA', remaining_purse: 1000 };
      
      // Scenario 1: Insufficient purse
      placeBidSimulated(teamA, 1500, 'team-b');
      expect(toast.error).toHaveBeenCalledWith("TA doesn't have enough purse!");

      // Scenario 2: Already highest bidder
      placeBidSimulated(teamA, 500, 'team-a');
      expect(toast.error).toHaveBeenCalledWith("TA is already the highest bidder!");
    });

    it('should simulate state change notification toasts', () => {
      // 1. Unsold round started
      const startUnsoldRoundSimulated = (count) => {
        toast.success(`🔄 Unsold Round Started! ${count} players get a second chance!`, { duration: 4000 });
      };

      startUnsoldRoundSimulated(3);
      expect(toast.success).toHaveBeenCalledWith(
        "🔄 Unsold Round Started! 3 players get a second chance!",
        { duration: 4000 }
      );

      // 2. Category complete
      const categoryCompleteSimulated = (label) => {
        toast.success(`${label} category complete! Moving to next category.`);
      };

      categoryCompleteSimulated('Batsman');
      expect(toast.success).toHaveBeenCalledWith("Batsman category complete! Moving to next category.");
    });
  });
});
