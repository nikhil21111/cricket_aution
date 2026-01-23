import { useState, useEffect, useRef } from "react";
import { Fireworks } from "fireworks-js";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase, formatCurrency, formatShortCurrency } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

const TournamentLive = () => {
  const { id: tournamentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [tournament, setTournament] = useState(null);
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [auctionState, setAuctionState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [auctionStatus, setAuctionStatus] = useState("live"); // 'live', 'paused', 'ended'

  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [highestBid, setHighestBid] = useState(0);
  const [highestBidder, setHighestBidder] = useState(null);
  const [bidIncrement, setBidIncrement] = useState(500);
  const [bidHistory, setBidHistory] = useState([]);
  const [showCustomIncrement, setShowCustomIncrement] = useState(false);
  const [customIncrementValue, setCustomIncrementValue] = useState("");
  const [selectedRole, setSelectedRole] = useState("all");
  const [showCategoryOrder, setShowCategoryOrder] = useState(false);
  const [celebration, setCelebration] = useState(null);
  const [celebrationPlayer, setCelebrationPlayer] = useState(null);
  const celebrationTimeoutRef = useRef(null);
  const fireworksRef = useRef(null);
  const fireworksInstanceRef = useRef(null);

  // Check if random mode is enabled (persisted in localStorage)
  const getRandomMode = () => {
    try {
      return (
        localStorage.getItem(`auction_random_mode_${tournamentId}`) === "true"
      );
    } catch (e) {
      return false;
    }
  };
  const [randomMode, setRandomMode] = useState(getRandomMode);

  const toggleRandomMode = (enabled) => {
    setRandomMode(enabled);
    try {
      localStorage.setItem(
        `auction_random_mode_${tournamentId}`,
        enabled ? "true" : "false"
      );
    } catch (e) {
      console.error("Failed to save random mode:", e);
    }
  };

  // Check if auction has been started (persisted in localStorage)
  const getAuctionStarted = () => {
    try {
      return localStorage.getItem(`auction_started_${tournamentId}`) === "true";
    } catch (e) {
      return false;
    }
  };
  const [auctionStarted, setAuctionStarted] = useState(getAuctionStarted);

  const markAuctionStarted = () => {
    setAuctionStarted(true);
    try {
      localStorage.setItem(`auction_started_${tournamentId}`, "true");
    } catch (e) {
      console.error("Failed to save auction started state:", e);
    }
  };

  // Check if unsold round has been started (persisted in localStorage)
  const getUnsoldRoundStarted = () => {
    try {
      return localStorage.getItem(`unsold_round_${tournamentId}`) === "true";
    } catch (e) {
      return false;
    }
  };
  const [unsoldRoundStarted, setUnsoldRoundStarted] = useState(
    getUnsoldRoundStarted
  );

  const markUnsoldRoundStarted = () => {
    setUnsoldRoundStarted(true);
    try {
      localStorage.setItem(`unsold_round_${tournamentId}`, "true");
    } catch (e) {
      console.error("Failed to save unsold round state:", e);
    }
  };

  const roleMeta = {
    batsman: {
      label: "Batsman",
      color: "bg-blue-500",
      icon: "sports_cricket",
    },
    bowler: {
      label: "Bowler",
      color: "bg-green-500",
      icon: "sports_baseball",
    },
    "all-rounder": {
      label: "All-Rounder",
      color: "bg-orange-500",
      icon: "military_tech",
    },
    "wicket-keeper": {
      label: "Wicket Keeper",
      color: "bg-purple-500",
      icon: "sports_handball",
    },
  };

  const iconRoleMeta = {
    "icon-player": {
      label: "Icon Player",
      color: "bg-yellow-400",
      icon: "star",
      baseRole: null,
    },
    "icon-player-sequence": {
      label: "Icon Player",
      color: "bg-yellow-400",
      icon: "star",
      baseRole: null,
    },
    "icon-player-random": {
      label: "Icon Player",
      color: "bg-yellow-400",
      icon: "star",
      baseRole: null,
    },
    "icon-batsman": {
      label: "Icon Batsman",
      color: "bg-blue-400",
      icon: "workspace_premium",
      baseRole: "batsman",
    },
    "icon-bowler": {
      label: "Icon Bowler",
      color: "bg-green-400",
      icon: "workspace_premium",
      baseRole: "bowler",
    },
    "icon-allrounder": {
      label: "Icon All-Rounder",
      color: "bg-orange-400",
      icon: "workspace_premium",
      baseRole: "all-rounder",
    },
    "icon-keeper": {
      label: "Icon Wicket-Keeper",
      color: "bg-purple-400",
      icon: "workspace_premium",
      baseRole: "wicket-keeper",
    },
  };

  const getPlayerCategoryId = (player) => {
    if (player?.icon_role && player.icon_role !== "none") {
      // Group all icon-player variants under single category
      if (player.icon_role.startsWith("icon-player")) {
        return "icon-player";
      }
      return player.icon_role;
    }
    return player?.role;
  };

  const baseRoleCategories = Object.keys(roleMeta).map((key) => ({
    id: key,
    label: roleMeta[key].label,
    color: roleMeta[key].color,
    icon: roleMeta[key].icon,
  }));

  const buildDynamicCategories = (playersList = []) => {
    const iconRolesInUse = playersList
      .filter((p) => p.icon_role && p.icon_role !== "none")
      .map((p) => p.icon_role);

    // Group all icon-player variants under single "icon-player" category
    const normalizedIconRoles = Array.from(
      new Set(
        iconRolesInUse.map((role) =>
          role.startsWith("icon-player") ? "icon-player" : role
        )
      )
    );

    const iconCategories = normalizedIconRoles
      .map((iconId) => ({ id: iconId, ...iconRoleMeta[iconId] }))
      .filter((cat) => cat.label);

    const roleCategories = baseRoleCategories;

    return [...iconCategories, ...roleCategories];
  };

  // Default category order
  const defaultCategoryOrder = buildDynamicCategories();

  // Load saved category order from localStorage
  const getSavedCategoryOrder = () => {
    try {
      const saved = localStorage.getItem(
        `auction_category_order_${tournamentId}`
      );
      if (saved) {
        const parsed = JSON.parse(saved);
        // Validate that all categories exist
        if (
          parsed.length > 0 &&
          parsed.every((c) => c.id && c.label && c.color)
        ) {
          return parsed.map((cat) => ({
            ...cat,
            icon:
              cat.icon ||
              roleMeta[cat.id]?.icon ||
              iconRoleMeta[cat.id]?.icon ||
              "sports",
          }));
        }
      }
    } catch (e) {
      console.error("Failed to load category order:", e);
    }
    return defaultCategoryOrder;
  };

  // Customizable role order for sorting - loaded from localStorage
  const [categoryOrder, setCategoryOrder] = useState(getSavedCategoryOrder);

  // Save category order to localStorage whenever it changes
  const saveCategoryOrder = (newOrder) => {
    setCategoryOrder(newOrder);
    try {
      localStorage.setItem(
        `auction_category_order_${tournamentId}`,
        JSON.stringify(newOrder)
      );
    } catch (e) {
      console.error("Failed to save category order:", e);
    }
  };

  // Sync category list to include icon groups when present
  useEffect(() => {
    if (!players || players.length === 0) return;
    const dynamicCats = buildDynamicCategories(players);
    if (dynamicCats.length === 0) return;

    setCategoryOrder((prev) => {
      const existing = prev.filter((cat) =>
        dynamicCats.some((d) => d.id === cat.id)
      );
      const missing = dynamicCats.filter(
        (d) => !existing.some((cat) => cat.id === d.id)
      );
      const next = [...existing, ...missing];

      if (JSON.stringify(next) === JSON.stringify(prev)) return prev;

      try {
        localStorage.setItem(
          `auction_category_order_${tournamentId}`,
          JSON.stringify(next)
        );
      } catch (e) {
        console.error("Failed to save category order:", e);
      }

      return next;
    });
  }, [players, tournamentId]);

  // Get the role order array from categoryOrder state
  const roleOrder = categoryOrder.map((c) => c.id);

  const sortByCategoryOrder = (list) =>
    list.sort((a, b) => {
      const aCat = getPlayerCategoryId(a);
      const bCat = getPlayerCategoryId(b);
      const aIndex = roleOrder.indexOf(aCat);
      const bIndex = roleOrder.indexOf(bCat);
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    });

  // Get available players sorted by custom role/icon order
  const availablePlayers = sortByCategoryOrder(
    players.filter((p) => p.status === "available")
  );

  // Get unsold players sorted by custom role/icon order (for second chance round)
  const unsoldPlayers = sortByCategoryOrder(
    players.filter((p) => p.status === "unsold")
  );

  const triggerCelebration = (type, payload = {}) => {
    if (celebrationTimeoutRef.current) {
      clearTimeout(celebrationTimeoutRef.current);
    }

    setCelebration({ type, ...payload });
    celebrationTimeoutRef.current = setTimeout(
      () => {
        setCelebration(null);
        setCelebrationPlayer(null);
      },
      type === "sold" ? 5000 : 3200
    );
  };

  // Get current category being auctioned (first category with available players)
  const currentCategory = categoryOrder.find((cat) =>
    availablePlayers.some((p) => getPlayerCategoryId(p) === cat.id)
  );

  // Filter available players by selected role
  const filteredPlayers =
    selectedRole === "all"
      ? availablePlayers
      : availablePlayers.filter((p) => p.role === selectedRole);

  // Group players by current category list (includes icon groups)
  const playersByCategory = categoryOrder.reduce((acc, cat) => {
    acc[cat.id] = availablePlayers.filter(
      (p) => getPlayerCategoryId(p) === cat.id
    );
    return acc;
  }, {});

  // Move category up in order
  const moveCategoryUp = (index) => {
    if (index === 0) return;
    const newOrder = [...categoryOrder];
    [newOrder[index - 1], newOrder[index]] = [
      newOrder[index],
      newOrder[index - 1],
    ];
    saveCategoryOrder(newOrder);
  };

  // Move category down in order
  const moveCategoryDown = (index) => {
    if (index === categoryOrder.length - 1) return;
    const newOrder = [...categoryOrder];
    [newOrder[index], newOrder[index + 1]] = [
      newOrder[index + 1],
      newOrder[index],
    ];
    saveCategoryOrder(newOrder);
  };

  // Pause the auction
  const pauseAuction = async () => {
    try {
      await supabase
        .from("auction_state")
        .update({ is_live: false })
        .eq("tournament_id", tournamentId);

      setAuctionStatus("paused");
      toast("Auction paused", { icon: "⏸️" });
    } catch (error) {
      toast.error("Failed to pause auction");
    }
  };

  // Resume the auction
  const resumeAuction = async () => {
    try {
      await supabase
        .from("auction_state")
        .update({ is_live: true })
        .eq("tournament_id", tournamentId);

      setAuctionStatus("live");
      toast.success("Auction resumed!");
    } catch (error) {
      toast.error("Failed to resume auction");
    }
  };

  // End the auction
  const endAuction = async () => {
    if (
      !window.confirm(
        "Are you sure you want to end the auction? This will mark the tournament as completed."
      )
    ) {
      return;
    }

    try {
      await supabase
        .from("auction_state")
        .update({
          is_live: false,
          current_player_id: null,
          highest_bid: 0,
          highest_bidder_id: null,
        })
        .eq("tournament_id", tournamentId);

      await supabase
        .from("tournaments")
        .update({ status: "completed" })
        .eq("id", tournamentId);

      setAuctionStatus("ended");
      toast.success("Auction ended successfully!");
    } catch (error) {
      toast.error("Failed to end auction");
    }
  };

  // Sync auction status from auctionState
  useEffect(() => {
    if (auctionState) {
      if (tournament?.status === "completed") {
        setAuctionStatus("ended");
      } else if (auctionState.is_live) {
        setAuctionStatus("live");
      } else {
        setAuctionStatus("paused");
      }
    }
  }, [auctionState, tournament]);

  useEffect(() => {
    if (tournamentId) {
      fetchData();
      const cleanup = setupSubscriptions();
      return cleanup;
    }
  }, [tournamentId]);

  useEffect(() => {
    return () => {
      if (celebrationTimeoutRef.current) {
        clearTimeout(celebrationTimeoutRef.current);
      }
      if (fireworksInstanceRef.current) {
        fireworksInstanceRef.current.stop();
        fireworksInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (fireworksInstanceRef.current) {
      fireworksInstanceRef.current.stop();
      fireworksInstanceRef.current = null;
    }

    if (celebration?.type === "sold" && fireworksRef.current) {
      const fw = new Fireworks(fireworksRef.current, {
        autoresize: true,
        opacity: 0.2,
        acceleration: 1.08,
        friction: 0.96,
        gravity: 1.6,
        particles: 140,
        trace: 5,
        explosion: 6,
        rocketsPoint: { min: 25, max: 75 },
        brightness: { min: 50, max: 80 },
        decay: { min: 0.015, max: 0.03 },
        boundaries: {
          top: 0,
          left: 0,
          right: window.innerWidth,
          bottom: window.innerHeight,
        },
      });

      fw.start();
      fireworksInstanceRef.current = fw;
    }

    return () => {
      if (fireworksInstanceRef.current) {
        fireworksInstanceRef.current.stop();
        fireworksInstanceRef.current = null;
      }
    };
  }, [celebration]);

  const setupSubscriptions = () => {
    const teamsSubscription = supabase
      .channel(`teams-live-${tournamentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "teams",
          filter: `tournament_id=eq.${tournamentId}`,
        },
        fetchTeams
      )
      .subscribe();

    const playersSubscription = supabase
      .channel(`players-live-${tournamentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
          filter: `tournament_id=eq.${tournamentId}`,
        },
        fetchPlayers
      )
      .subscribe();

    const auctionSubscription = supabase
      .channel(`auction-live-${tournamentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "auction_state",
          filter: `tournament_id=eq.${tournamentId}`,
        },
        fetchAuctionState
      )
      .subscribe();

    return () => {
      teamsSubscription.unsubscribe();
      playersSubscription.unsubscribe();
      auctionSubscription.unsubscribe();
    };
  };

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([
      fetchTournament(),
      fetchTeams(),
      fetchPlayers(),
      fetchAuctionState(),
    ]);
    setLoading(false);
  };

  const fetchTournament = async () => {
    const { data, error } = await supabase
      .from("tournaments")
      .select("*")
      .eq("id", tournamentId)
      .single();
    if (error) {
      console.error("Failed to load tournament:", error);
      return;
    }
    if (data && data.user_id !== user?.id) {
      toast.error("You do not have access to manage this auction");
      navigate(`/live/${tournamentId}`);
      return;
    }

    if (data) setTournament(data);
  };

  const fetchTeams = async () => {
    const { data, error } = await supabase
      .from("teams")
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("created_at", { ascending: true });
    if (error) {
      console.error("Failed to load teams:", error);
      return;
    }
    if (data) setTeams(data);
  };

  const fetchPlayers = async () => {
    const { data, error } = await supabase
      .from("players")
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("created_at", { ascending: true });
    if (error) {
      console.error("Failed to load players:", error);
      return;
    }
    if (data) setPlayers(data);
  };

  const fetchAuctionState = async () => {
    const { data, error } = await supabase
      .from("auction_state")
      .select("*")
      .eq("tournament_id", tournamentId)
      .single();
    if (error) {
      console.error("Failed to load auction state:", error);
      return;
    }
    if (data) setAuctionState(data);
  };

  // Set current player from auction state
  useEffect(() => {
    if (auctionState?.current_player_id) {
      const player = players.find(
        (p) => p.id === auctionState.current_player_id
      );
      setCurrentPlayer(player || null);
      // Keep highest_bid as stored (could be 0 if no bids yet)
      setHighestBid(auctionState.highest_bid || 0);
      setHighestBidder(
        teams.find((t) => t.id === auctionState.highest_bidder_id) || null
      );
    } else {
      setCurrentPlayer(null);
      setHighestBid(0);
      setHighestBidder(null);
    }
  }, [auctionState, players, teams]);

  // Select a player for auction
  const selectPlayer = async (player) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("auction_state")
        .update({
          current_player_id: player.id,
          highest_bid: 0, // Start at 0, first bid will be base_price
          highest_bidder_id: null,
          is_live: true,
        })
        .eq("tournament_id", tournamentId);

      if (error) throw error;

      // Update tournament status to live
      await supabase
        .from("tournaments")
        .update({ status: "live" })
        .eq("id", tournamentId);

      setCurrentPlayer(player);
      setHighestBid(0); // First bid will be base_price
      setHighestBidder(null);
      setBidHistory([]);
      toast.success(`${player.name} is now up for auction!`);
    } catch (error) {
      toast.error("Failed to select player");
    } finally {
      setLoading(false);
    }
  };

  // Place a bid
  const placeBid = async (team) => {
    if (!currentPlayer) {
      toast.error("No player selected for auction");
      return;
    }

    // First bid is base price, subsequent bids add increment
    const isFirstBid = highestBidder === null;
    const newBid = isFirstBid
      ? currentPlayer.base_price
      : highestBid + bidIncrement;

    if (newBid > team.remaining_purse) {
      toast.error(`${team.short_name} doesn't have enough purse!`);
      return;
    }

    if (highestBidder?.id === team.id) {
      toast.error(`${team.short_name} is already the highest bidder!`);
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("auction_state")
        .update({
          highest_bid: newBid,
          highest_bidder_id: team.id,
        })
        .eq("tournament_id", tournamentId);

      if (error) throw error;

      setBidHistory((prev) => [
        {
          team,
          amount: newBid,
          time: new Date().toLocaleTimeString(),
        },
        ...prev.slice(0, 9),
      ]);

      setHighestBid(newBid);
      setHighestBidder(team);
      toast.success(`${team.short_name} bids ${formatShortCurrency(newBid)}!`, {
        id: `bid-${newBid}-${team.id}`,
      });
    } catch (error) {
      toast.error("Failed to place bid");
    } finally {
      setLoading(false);
    }
  };

  // Mark player as SOLD
  const markSold = async () => {
    if (!currentPlayer || !highestBidder) {
      toast.error("No valid bid to confirm");
      return;
    }

    const soldPlayerId = currentPlayer.id;
    const soldPlayerName = currentPlayer.name;
    const soldToTeam = highestBidder;
    const soldPrice = highestBid;
    const newRemainingPurse = soldToTeam.remaining_purse - soldPrice;
    const isIconPlayer =
      currentPlayer.icon_role && currentPlayer.icon_role !== "none";
    const newIconCount =
      (soldToTeam.icon_player_count || 0) + (isIconPlayer ? 1 : 0);

    setLoading(true);
    try {
      setCelebrationPlayer({
        player: currentPlayer,
        bidder: highestBidder,
        amount: highestBid,
      });

      // Immediately update local players state to prevent loop
      setPlayers((prev) =>
        prev.map((p) =>
          p.id === soldPlayerId
            ? {
                ...p,
                status: "sold",
                sold_price: soldPrice,
                team_id: soldToTeam.id,
              }
            : p
        )
      );

      // Immediately update local teams state to reflect reduced purse
      setTeams((prev) =>
        prev.map((t) =>
          t.id === soldToTeam.id
            ? {
                ...t,
                remaining_purse: newRemainingPurse,
                icon_player_count: newIconCount,
              }
            : t
        )
      );

      // Clear current player immediately
      setCurrentPlayer(null);
      setHighestBid(0);
      setHighestBidder(null);
      setBidHistory([]);

      await supabase
        .from("players")
        .update({
          status: "sold",
          sold_price: soldPrice,
          team_id: soldToTeam.id,
        })
        .eq("id", soldPlayerId);

      await supabase
        .from("teams")
        .update({
          remaining_purse: newRemainingPurse,
          icon_player_count: newIconCount,
        })
        .eq("id", soldToTeam.id);

      await supabase
        .from("auction_state")
        .update({
          current_player_id: null,
          highest_bid: 0,
          highest_bidder_id: null,
        })
        .eq("tournament_id", tournamentId);

      triggerCelebration("sold", {
        player: soldPlayerName,
        team: soldToTeam.short_name,
        amount: soldPrice,
      });

      toast.success(
        `${soldPlayerName} SOLD to ${soldToTeam.name} for ${formatShortCurrency(
          soldPrice
        )}!`,
        {
          id: `sold-${soldPlayerId}`,
          icon: "🎉",
          duration: 4000,
        }
      );
    } catch (error) {
      // Revert local state on error
      fetchPlayers();
      fetchTeams();
      toast.error("Failed to mark as sold");
    } finally {
      setLoading(false);
    }
  };

  // Mark player as UNSOLD
  const markUnsold = async () => {
    if (!currentPlayer) {
      toast.error("No player selected");
      return;
    }

    const unsoldPlayerId = currentPlayer.id;
    const unsoldPlayerName = currentPlayer.name;

    setLoading(true);
    try {
      setCelebrationPlayer({
        player: currentPlayer,
        bidder: null,
        amount: highestBid || currentPlayer.base_price || 0,
      });

      // Immediately update local players state to prevent loop
      setPlayers((prev) =>
        prev.map((p) =>
          p.id === unsoldPlayerId ? { ...p, status: "unsold" } : p
        )
      );

      // Clear current player immediately
      setCurrentPlayer(null);
      setHighestBid(0);
      setHighestBidder(null);
      setBidHistory([]);

      await supabase
        .from("players")
        .update({ status: "unsold" })
        .eq("id", unsoldPlayerId);

      await supabase
        .from("auction_state")
        .update({
          current_player_id: null,
          highest_bid: 0,
          highest_bidder_id: null,
        })
        .eq("tournament_id", tournamentId);

      triggerCelebration("unsold", { player: unsoldPlayerName });

      toast(`${unsoldPlayerName} goes UNSOLD`, {
        id: `unsold-${unsoldPlayerId}`,
        icon: "😔",
      });
    } catch (error) {
      // Revert local state on error
      fetchPlayers();
      toast.error("Failed to mark as unsold");
    } finally {
      setLoading(false);
    }
  };

  // Start unsold round - move all unsold players back to available
  const startUnsoldRound = async () => {
    if (unsoldPlayers.length === 0) {
      toast.error("No unsold players!");
      return;
    }

    const unsoldCount = unsoldPlayers.length;

    setLoading(true);
    try {
      // Immediately update local players state to show unsold players as available
      setPlayers((prev) =>
        prev.map((p) =>
          p.status === "unsold" ? { ...p, status: "available" } : p
        )
      );

      // Update all unsold players to available status for second chance
      const { error } = await supabase
        .from("players")
        .update({ status: "available" })
        .eq("tournament_id", tournamentId)
        .eq("status", "unsold");

      if (error) throw error;

      markUnsoldRoundStarted();
      toast.success(
        `🔄 Unsold Round Started! ${unsoldCount} players get a second chance!`,
        {
          duration: 4000,
        }
      );
    } catch (error) {
      // Revert local state on error
      fetchPlayers();
      toast.error("Failed to start unsold round");
    } finally {
      setLoading(false);
    }
  };

  const nextPlayer = () => {
    // Filter out the current player being auctioned (to prevent loop when player was just sold/unsold)
    const currentPlayerId =
      currentPlayer?.id || auctionState?.current_player_id;
    const eligiblePlayers = availablePlayers.filter(
      (p) => p.id !== currentPlayerId
    );

    if (eligiblePlayers.length === 0) {
      toast.error("No more players available!");
      return;
    }

    // Mark auction as started
    if (!auctionStarted) {
      markAuctionStarted();
    }

    // Check for icon players first - they should be auctioned before regular players
    const iconPlayers = eligiblePlayers.filter(
      (p) => p.icon_role && p.icon_role.startsWith("icon-player")
    );

    if (iconPlayers.length > 0) {
      // Check if any icon player is set to random
      const hasRandomIconPlayer = iconPlayers.some(
        (p) => p.icon_role === "icon-player-random"
      );
      // Check if any icon player is set to sequence
      const hasSequenceIconPlayer = iconPlayers.some(
        (p) =>
          p.icon_role === "icon-player-sequence" ||
          p.icon_role === "icon-player"
      );

      // If all are random, pick randomly
      if (hasRandomIconPlayer && !hasSequenceIconPlayer) {
        const randomIndex = Math.floor(Math.random() * iconPlayers.length);
        selectPlayer(iconPlayers[randomIndex]);
        return;
      }

      // If all are sequence or mixed, prioritize sequence players first
      const sequencePlayers = iconPlayers.filter(
        (p) =>
          p.icon_role === "icon-player-sequence" ||
          p.icon_role === "icon-player"
      );
      const randomPlayers = iconPlayers.filter(
        (p) => p.icon_role === "icon-player-random"
      );

      if (sequencePlayers.length > 0) {
        // Pick first sequence player (in order they were added)
        selectPlayer(sequencePlayers[0]);
        return;
      } else if (randomPlayers.length > 0) {
        // All remaining icon players are random
        const randomIndex = Math.floor(Math.random() * randomPlayers.length);
        selectPlayer(randomPlayers[randomIndex]);
        return;
      }
    }

    // Check if we just finished all icon players - show notification
    const allPlayers = players.filter((p) => p.status === "available");
    const hadIconPlayers = allPlayers.some(
      (p) => p.icon_role && p.icon_role.startsWith("icon-player")
    );
    const currentWasIconPlayer =
      currentPlayer?.icon_role &&
      currentPlayer.icon_role.startsWith("icon-player");
    if (
      currentWasIconPlayer &&
      !iconPlayers.length &&
      hadIconPlayers === false
    ) {
      toast.success("⭐ All Icon Players complete! Moving to regular players.");
    }

    // No icon players left, proceed with regular category-based logic
    // Get players from current category first (excluding current player)
    const currentCategoryPlayers = currentCategory
      ? eligiblePlayers.filter(
          (p) => getPlayerCategoryId(p) === currentCategory.id
        )
      : eligiblePlayers;

    if (currentCategoryPlayers.length > 0) {
      if (randomMode) {
        // Random mode within category - pick random player from current category
        const randomIndex = Math.floor(
          Math.random() * currentCategoryPlayers.length
        );
        selectPlayer(currentCategoryPlayers[randomIndex]);
      } else {
        // Sequential mode - pick next player in order
        // Find the index of current player in the ORIGINAL available list to determine next
        const allCategoryPlayers = currentCategory
          ? availablePlayers.filter(
              (p) => getPlayerCategoryId(p) === currentCategory.id
            )
          : availablePlayers;

        const currentIndex = currentPlayerId
          ? allCategoryPlayers.findIndex((p) => p.id === currentPlayerId)
          : -1;

        if (
          currentIndex !== -1 &&
          currentIndex < allCategoryPlayers.length - 1
        ) {
          // Get the next player after current in original list
          const nextInOriginal = allCategoryPlayers[currentIndex + 1];
          if (nextInOriginal && nextInOriginal.id !== currentPlayerId) {
            selectPlayer(nextInOriginal);
          } else {
            selectPlayer(currentCategoryPlayers[0]);
          }
        } else if (currentCategoryPlayers.length > 0) {
          // Current player was last in category or not found, check if category has more eligible players
          const nextCategoryPlayer = eligiblePlayers.find(
            (p) => getPlayerCategoryId(p) !== currentCategory?.id
          );
          if (
            nextCategoryPlayer &&
            currentIndex === allCategoryPlayers.length - 1
          ) {
            // Category finished, move to next category
            toast.success(
              `${currentCategory?.label} category complete! Moving to next category.`
            );
            selectPlayer(nextCategoryPlayer);
          } else {
            // Still players in current category
            selectPlayer(currentCategoryPlayers[0]);
          }
        } else {
          // No more in current category, move to next
          const nextCategoryPlayer = eligiblePlayers[0];
          if (nextCategoryPlayer) {
            toast.success(
              `${currentCategory?.label} category complete! Moving to next category.`
            );
            selectPlayer(nextCategoryPlayer);
          }
        }
      }
    } else {
      // Category finished, move to next category with available players
      const nextCategoryPlayer = eligiblePlayers[0];
      if (nextCategoryPlayer) {
        toast.success(
          `${currentCategory?.label} category complete! Moving to next category.`
        );
        selectPlayer(nextCategoryPlayer);
      }
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case "batsman":
        return "text-primary bg-primary/10 border-primary/20";
      case "bowler":
        return "text-green-400 bg-green-500/10 border-green-500/20";
      case "all-rounder":
        return "text-orange-400 bg-orange-500/10 border-orange-500/20";
      case "wicket-keeper":
        return "text-purple-400 bg-purple-500/10 border-purple-500/20";
      default:
        return "text-gray-400 bg-gray-500/10 border-gray-500/20";
    }
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case "batsman":
        return "Batsman";
      case "bowler":
        return "Bowler";
      case "all-rounder":
        return "All-Rounder";
      case "wicket-keeper":
        return "Wicket Keeper";
      default:
        return role;
    }
  };

  const getRoleIcon = (role) => {
    return roleMeta[role]?.icon || "person";
  };

  // First bid is base price, subsequent bids add increment
  const isFirstBid = highestBidder === null;
  const nextBidAmount = isFirstBid
    ? currentPlayer?.base_price || 0
    : highestBid + bidIncrement;
  const displayPlayer = celebrationPlayer?.player || currentPlayer;
  // Show base price when no bids yet, otherwise show highest bid
  const displayHighestBid =
    celebrationPlayer?.amount !== undefined
      ? celebrationPlayer.amount
      : isFirstBid
      ? currentPlayer?.base_price || 0
      : highestBid;
  const displayHighestBidder = celebrationPlayer?.bidder || highestBidder;

  if (loading && !tournament) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background-dark">
        <div className="flex flex-col items-center gap-4">
          <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-text-secondary">Loading auction...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background-dark text-white min-h-screen flex flex-col overflow-x-hidden">
      {/* Sold Celebration - Fireworks + Card */}
      {celebration?.type === "sold" && (
        <>
          <div className="celebration-overlay">
            <div className="fireworks-layer" ref={fireworksRef}></div>
          </div>
          <div className="sold-card-overlay">
            <div className="sold-card sold-type">
              <div className="sold-card-badge sold">
                <span className="material-symbols-outlined text-lg">
                  celebration
                </span>
                SOLD
              </div>
              <div className="sold-card-avatar">
                {celebrationPlayer?.player?.photo_url ? (
                  <img
                    src={celebrationPlayer.player.photo_url}
                    alt={celebrationPlayer.player.name}
                  />
                ) : (
                  <span className="material-symbols-outlined">person</span>
                )}
              </div>
              <div className="sold-card-player-name">
                {celebrationPlayer?.player?.name}
              </div>
              <span
                className={`sold-card-role ${
                  celebrationPlayer?.player?.role === "batsman"
                    ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                    : celebrationPlayer?.player?.role === "bowler"
                    ? "bg-green-500/20 text-green-400 border border-green-500/30"
                    : celebrationPlayer?.player?.role === "all-rounder"
                    ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                    : "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                }`}
              >
                {celebrationPlayer?.player?.role?.replace("-", " ")}
              </span>
              <div className="sold-card-divider"></div>
              <div className="sold-card-team-section">
                <div
                  className="sold-card-team-logo"
                  style={{
                    backgroundColor: `${
                      celebrationPlayer?.bidder?.color || "#8b5cf6"
                    }20`,
                    color: celebrationPlayer?.bidder?.color || "#8b5cf6",
                  }}
                >
                  {celebrationPlayer?.bidder?.logo_url ? (
                    <img
                      src={celebrationPlayer.bidder.logo_url}
                      alt={celebrationPlayer.bidder.name}
                    />
                  ) : (
                    celebrationPlayer?.bidder?.short_name?.slice(0, 3) || "TM"
                  )}
                </div>
                <div className="sold-card-team-name">
                  {celebrationPlayer?.bidder?.name}
                </div>
              </div>
              <div className="sold-card-price">
                {formatShortCurrency(celebrationPlayer?.amount || 0)}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Unsold Celebration - Duck + Card */}
      {celebration?.type === "unsold" && (
        <>
          <div className="duck-overlay">
            <div
              className="duck-scene"
              key={
                celebration?.player || celebrationPlayer?.player?.id || "duck"
              }
            >
              <div className="cloud cloud--1"></div>
              <div className="cloud cloud--2"></div>
              <div className="cloud cloud--3"></div>
              <div className="cloud cloud--4"></div>

              <div className="duck__wrapper">
                <div className="duck">
                  <div className="duck duck__inner">
                    <div className="duck__mouth"></div>
                    <div className="duck__head">
                      <div className="duck__eye"></div>
                      <div className="duck__eye--shadow"></div>
                      <div className="duck__white"></div>
                    </div>
                    <div className="duck__body"></div>
                    <div className="duck__wing"></div>
                  </div>
                  <div className="duck__foot duck__foot--1"></div>
                  <div className="duck__foot duck__foot--2"></div>
                  <div className="surface"></div>
                </div>
              </div>
            </div>
          </div>
          <div className="sold-card-overlay">
            <div className="sold-card unsold-type">
              <div className="sold-card-badge unsold">
                <span className="material-symbols-outlined text-lg">
                  sentiment_dissatisfied
                </span>
                UNSOLD
              </div>
              <div className="sold-card-avatar">
                {celebrationPlayer?.player?.photo_url ? (
                  <img
                    src={celebrationPlayer.player.photo_url}
                    alt={celebrationPlayer.player.name}
                  />
                ) : (
                  <span className="material-symbols-outlined">person</span>
                )}
              </div>
              <div className="sold-card-player-name">
                {celebrationPlayer?.player?.name}
              </div>
              <span
                className={`sold-card-role ${
                  celebrationPlayer?.player?.role === "batsman"
                    ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                    : celebrationPlayer?.player?.role === "bowler"
                    ? "bg-green-500/20 text-green-400 border border-green-500/30"
                    : celebrationPlayer?.player?.role === "all-rounder"
                    ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                    : "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                }`}
              >
                {celebrationPlayer?.player?.role?.replace("-", " ")}
              </span>
              <div className="sold-card-divider"></div>
              <div className="sold-card-price unsold">
                Base:{" "}
                {formatShortCurrency(
                  celebrationPlayer?.player?.base_price || 0
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Header */}
      <header className="shrink-0 flex items-center justify-between whitespace-nowrap border-b border-[#283539] bg-surface-darker px-6 py-3 z-20">
        <div className="flex items-center gap-4 text-white">
          <Link
            to={`/tournament/${tournamentId}`}
            className="size-8 flex items-center justify-center rounded bg-primary/20 text-primary hover:bg-primary/30 transition"
          >
            <span className="material-symbols-outlined text-2xl">
              arrow_back
            </span>
          </Link>
          <h2 className="text-white text-lg font-bold leading-tight tracking-tight">
            {tournament?.name}{" "}
            <span className="text-primary font-normal">Live</span>
          </h2>
        </div>
        <div className="hidden md:flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10">
            <span
              className={`w-2 h-2 rounded-full ${
                displayPlayer ? "bg-red-500 animate-pulse" : "bg-yellow-500"
              }`}
            ></span>
            <span className="text-xs font-semibold text-white tracking-wide uppercase">
              {displayPlayer ? "Live Auction" : "Waiting"}
            </span>
            {displayPlayer && (
              <>
                <span className="text-white/20">|</span>
                <span className="text-xs text-white/80">
                  {displayPlayer.name}
                </span>
              </>
            )}
          </div>
          {/* Current Category Indicator */}
          {displayPlayer && currentCategory && (
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${currentCategory.color}/20 border border-white/10`}
            >
              <span
                className={`material-symbols-outlined text-sm ${currentCategory.color
                  .replace("bg-", "text-")
                  .replace("-500", "-400")}`}
              >
                {currentCategory.icon}
              </span>
              <span
                className={`text-xs font-bold ${currentCategory.color
                  .replace("bg-", "text-")
                  .replace("-500", "-400")}`}
              >
                {currentCategory.label}
              </span>
              <span className="text-white/50 text-xs">
                ({playersByCategory[currentCategory.id]?.length || 0} left)
              </span>
            </div>
          )}

          {/* Auction Control Buttons */}
          <div className="flex items-center gap-2">
            {auctionStatus === "live" ? (
              <button
                onClick={pauseAuction}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 transition-colors text-sm font-semibold"
              >
                <span className="material-symbols-outlined text-sm">pause</span>
                Pause
              </button>
            ) : auctionStatus === "paused" ? (
              <button
                onClick={resumeAuction}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 transition-colors text-sm font-semibold"
              >
                <span className="material-symbols-outlined text-sm">
                  play_arrow
                </span>
                Resume
              </button>
            ) : null}

            {auctionStatus !== "ended" && (
              <button
                onClick={endAuction}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors text-sm font-semibold"
              >
                <span className="material-symbols-outlined text-sm">stop</span>
                End
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link
            className="text-text-secondary text-sm font-medium hover:text-primary transition-colors"
            to={`/tournament/${tournamentId}`}
          >
            Dashboard
          </Link>
          <Link
            className="text-text-secondary text-sm font-medium hover:text-primary transition-colors"
            to={`/tournament/${tournamentId}/teams`}
          >
            Teams
          </Link>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        <main className="flex-1 flex flex-col p-4 lg:p-6 gap-4 lg:gap-6 overflow-y-auto pb-24 lg:pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 flex-1 min-h-0">
            {/* Left Side - Current Player */}
            <div className="lg:col-span-8 flex flex-col gap-4 lg:gap-6">
              {/* Current Player Card */}
              <div className="relative bg-surface-dark border border-white/5 rounded-2xl overflow-hidden shadow-xl flex-1 flex flex-col group min-h-[450px] lg:min-h-[500px]">
                <div className="absolute top-0 right-0 w-2/3 h-full bg-gradient-to-l from-primary/5 to-transparent pointer-events-none"></div>
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 blur-[100px] rounded-full pointer-events-none"></div>

                {displayPlayer ? (
                  <div className="flex flex-col md:flex-row h-full">
                    {/* Player Image */}
                    <div className="w-full md:w-5/12 relative min-h-[280px] md:min-h-full bg-gradient-to-b from-[#222] to-surface-dark flex items-center justify-center">
                      {displayPlayer.photo_url ? (
                        <img
                          src={displayPlayer.photo_url}
                          alt={displayPlayer.name}
                          className="w-full h-full object-contain max-h-[400px] md:max-h-full"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-text-secondary">
                          <span className="material-symbols-outlined text-[120px]">
                            person
                          </span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-surface-dark via-transparent to-transparent opacity-70 pointer-events-none"></div>
                      <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end z-10">
                        <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-lg p-3">
                          <p className="text-[10px] text-white/60 uppercase tracking-wider mb-1 font-bold">
                            Base Price
                          </p>
                          <p className="text-xl font-bold text-white">
                            {formatShortCurrency(displayPlayer.base_price)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Player Info */}
                    <div className="w-full md:w-7/12 p-6 lg:p-8 flex flex-col justify-between relative z-10">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${getRoleColor(
                              displayPlayer.role
                            )}`}
                          >
                            <span className="material-symbols-outlined text-sm">
                              {getRoleIcon(displayPlayer.role)}
                            </span>
                            {getRoleLabel(displayPlayer.role)}
                          </span>
                        </div>
                        <h1 className="text-4xl lg:text-5xl font-black text-white leading-tight tracking-tight">
                          {displayPlayer.name}
                        </h1>
                      </div>

                      <div className="space-y-4 mt-6">
                        {/* Current Highest Bid or Base Price */}
                        <div className="p-6 lg:p-8 rounded-2xl bg-[#111618] border border-primary/30 shadow-[0_0_40px_-10px_rgba(13,185,242,0.25)] relative overflow-hidden">
                          <div className="absolute top-0 left-0 w-1 h-full bg-primary animate-pulse shadow-[0_0_15px_2px_rgba(13,185,242,0.6)]"></div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-primary text-xs font-bold uppercase tracking-[0.2em] flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-primary animate-ping"></span>
                              {isFirstBid
                                ? "Base Price"
                                : "Current Highest Bid"}
                            </p>
                          </div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-5xl lg:text-7xl font-black text-white tracking-tighter tabular-nums drop-shadow-2xl">
                              {formatShortCurrency(displayHighestBid)}
                            </span>
                          </div>
                        </div>

                        {/* Highest Bidder */}
                        {displayHighestBidder && (
                          <div className="flex items-center justify-between p-4 rounded-xl bg-surface-darker border border-white/10">
                            <div className="flex items-center gap-3">
                              <div className="text-right pr-3 border-r border-white/10">
                                <p className="text-[10px] text-white/40 uppercase font-bold tracking-wider">
                                  Held by
                                </p>
                                <p className="text-xs text-primary font-bold">
                                  {displayHighestBidder.short_name}
                                </p>
                              </div>
                              <div className="flex items-center gap-3 pl-1">
                                <div
                                  className="size-10 rounded-full ring-2 ring-white/10 flex items-center justify-center text-xs font-black text-white shadow-lg overflow-hidden"
                                  style={{
                                    backgroundColor: displayHighestBidder.color,
                                  }}
                                >
                                  {displayHighestBidder.logo_url ? (
                                    <img
                                      src={displayHighestBidder.logo_url}
                                      alt={displayHighestBidder.name}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    displayHighestBidder.short_name
                                  )}
                                </div>
                                <span className="font-bold text-white text-lg leading-none">
                                  {displayHighestBidder.name}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* No Player Selected State */
                  <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                    {auctionStarted && !showCategoryOrder ? (
                      /* Auction Already Started - Show Next Player UI */
                      <>
                        <div className="size-20 rounded-full bg-[#1c2e35] flex items-center justify-center text-text-secondary mb-4">
                          <span className="material-symbols-outlined text-4xl">
                            {availablePlayers.length > 0
                              ? currentCategory?.icon || "sports_cricket"
                              : unsoldPlayers.length > 0 && !unsoldRoundStarted
                              ? "replay"
                              : "emoji_events"}
                          </span>
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-2">
                          {availablePlayers.length > 0
                            ? "Select Next Player"
                            : unsoldPlayers.length > 0 && !unsoldRoundStarted
                            ? "First Round Complete!"
                            : "🎉 Auction Complete!"}
                        </h3>
                        <p className="text-text-secondary mb-4 max-w-md text-sm">
                          {availablePlayers.length > 0
                            ? randomMode
                              ? `${
                                  availablePlayers.length
                                } players remaining. Random selection within ${
                                  currentCategory?.label || "category"
                                }.`
                              : `${
                                  availablePlayers.length
                                } players remaining. Current category: ${
                                  currentCategory?.label || "All done"
                                }`
                            : unsoldPlayers.length > 0 && !unsoldRoundStarted
                            ? `${unsoldPlayers.length} players went unsold. Give them a second chance!`
                            : "All players have been auctioned. Great work!"}
                        </p>

                        {/* Random Mode Indicator */}
                        {availablePlayers.length > 0 && randomMode && (
                          <div className="flex items-center gap-2 mb-4 px-4 py-2 rounded-lg bg-orange-500/20 border border-orange-500/30">
                            <span className="material-symbols-outlined text-orange-400 text-[18px]">
                              shuffle
                            </span>
                            <span className="text-orange-400 text-sm font-bold">
                              Random within{" "}
                              {currentCategory?.label || "Category"}
                            </span>
                          </div>
                        )}

                        {/* Current Category Progress */}
                        {availablePlayers.length > 0 && !randomMode && (
                          <div className="flex items-center gap-2 mb-6">
                            {categoryOrder.map((cat) => {
                              const count =
                                playersByCategory[cat.id]?.length || 0;
                              return (
                                <div
                                  key={cat.id}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold text-white ${
                                    count > 0
                                      ? cat.color
                                      : "bg-white/10 opacity-50"
                                  }`}
                                >
                                  <span className="material-symbols-outlined text-sm align-middle mr-1">
                                    {cat.icon}
                                  </span>
                                  {cat.label.split(" ")[0]}: {count}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Unsold Players Preview */}
                        {availablePlayers.length === 0 &&
                          unsoldPlayers.length > 0 &&
                          !unsoldRoundStarted && (
                            <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
                              {categoryOrder.map((cat) => {
                                const count = unsoldPlayers.filter(
                                  (p) => getPlayerCategoryId(p) === cat.id
                                ).length;
                                if (count === 0) return null;
                                return (
                                  <div
                                    key={cat.id}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold text-white ${cat.color}`}
                                  >
                                    <span className="material-symbols-outlined text-sm align-middle mr-1">
                                      {cat.icon}
                                    </span>
                                    {cat.label.split(" ")[0]}: {count}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                        {availablePlayers.length > 0 ? (
                          <button
                            onClick={nextPlayer}
                            disabled={loading}
                            className="px-6 py-3 bg-primary hover:bg-primary-dark text-background-dark font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                          >
                            <span className="material-symbols-outlined text-[20px]">
                              {randomMode ? "shuffle" : "skip_next"}
                            </span>
                            Next Player
                          </button>
                        ) : unsoldPlayers.length > 0 && !unsoldRoundStarted ? (
                          <button
                            onClick={startUnsoldRound}
                            disabled={loading}
                            className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                          >
                            <span className="material-symbols-outlined text-[20px]">
                              replay
                            </span>
                            Start Unsold Round ({unsoldPlayers.length} Players)
                          </button>
                        ) : null}
                      </>
                    ) : !showCategoryOrder ? (
                      /* First Time - Show Category Order Setup */
                      <>
                        <div className="size-20 rounded-full bg-[#1c2e35] flex items-center justify-center text-text-secondary mb-4">
                          <span className="material-symbols-outlined text-4xl">
                            {randomMode ? "shuffle" : "person_search"}
                          </span>
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-2">
                          Ready to Start Auction
                        </h3>
                        <p className="text-text-secondary mb-4 max-w-md text-sm">
                          {randomMode
                            ? "Random mode: Players within each category will come in random order."
                            : "Sequential mode: Players come in order within each category."}
                        </p>

                        {/* Mode Toggle */}
                        <div className="flex items-center gap-3 mb-6 p-3 rounded-xl bg-surface-darker border border-white/10">
                          <button
                            onClick={() => toggleRandomMode(false)}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 ${
                              !randomMode
                                ? "bg-primary text-background-dark"
                                : "bg-white/5 text-white/60 hover:bg-white/10"
                            }`}
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              sort
                            </span>
                            Sequential
                          </button>
                          <button
                            onClick={() => toggleRandomMode(true)}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 ${
                              randomMode
                                ? "bg-orange-500 text-white"
                                : "bg-white/5 text-white/60 hover:bg-white/10"
                            }`}
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              shuffle
                            </span>
                            Random
                          </button>
                        </div>

                        {/* Current Category Order Preview - Show always */}
                        <div className="flex items-center gap-2 mb-6">
                          {categoryOrder.map((cat, index) => (
                            <div key={cat.id} className="flex items-center">
                              <span
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold text-white ${cat.color}`}
                              >
                                <span className="material-symbols-outlined text-sm align-middle mr-1">
                                  {cat.icon}
                                </span>
                                {index + 1}. {cat.label.split(" ")[0]}
                              </span>
                              {index < categoryOrder.length - 1 && (
                                <span className="material-symbols-outlined text-white/30 text-sm mx-1">
                                  arrow_forward
                                </span>
                              )}
                            </div>
                          ))}
                        </div>

                        {availablePlayers.length > 0 && (
                          <div className="flex flex-col sm:flex-row gap-3">
                            <button
                              onClick={() => setShowCategoryOrder(true)}
                              className="px-5 py-2.5 bg-[#283539] hover:bg-[#3b4e54] text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                              <span className="material-symbols-outlined text-[20px]">
                                tune
                              </span>
                              Set Category Order
                            </button>
                            <button
                              onClick={nextPlayer}
                              disabled={loading}
                              className="px-5 py-2.5 bg-primary hover:bg-primary-dark text-background-dark font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                              <span className="material-symbols-outlined text-[20px]">
                                play_arrow
                              </span>
                              Start Auction
                            </button>
                          </div>
                        )}

                        {/* Category Summary */}
                        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-lg">
                          {categoryOrder.map((cat) => (
                            <div
                              key={cat.id}
                              className={`p-3 rounded-xl ${cat.color}/10 border border-white/10`}
                            >
                              <p
                                className={`text-xs font-bold ${cat.color
                                  .replace("bg-", "text-")
                                  .replace("-500", "-400")}`}
                              >
                                <span className="material-symbols-outlined text-sm align-middle mr-1">
                                  {cat.icon}
                                </span>
                                {cat.label}
                              </p>
                              <p className="text-white text-xl font-bold mt-1">
                                {playersByCategory[cat.id]?.length || 0}
                              </p>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      /* Category Order Configuration */
                      <div className="w-full max-w-md">
                        <h3 className="text-xl font-bold text-white mb-2">
                          Set Category Order
                        </h3>
                        <p className="text-text-secondary text-sm mb-6">
                          Drag or use arrows to arrange the order. First
                          category will be auctioned first.
                        </p>

                        <div className="space-y-2 mb-6">
                          {categoryOrder.map((cat, index) => (
                            <div
                              key={cat.id}
                              className={`flex items-center gap-3 p-3 rounded-xl bg-surface-darker border border-white/10 ${cat.color}/10`}
                            >
                              <span
                                className={`w-8 h-8 rounded-lg ${cat.color} flex items-center justify-center text-white font-bold text-sm`}
                              >
                                {index + 1}
                              </span>
                              <div className="flex-1">
                                <p className="text-white font-bold flex items-center gap-1.5">
                                  <span className="material-symbols-outlined text-sm">
                                    {cat.icon}
                                  </span>
                                  {cat.label}
                                </p>
                                <p className="text-text-secondary text-xs">
                                  {playersByCategory[cat.id]?.length || 0}{" "}
                                  players available
                                </p>
                              </div>
                              <div className="flex flex-col gap-1">
                                <button
                                  onClick={() => moveCategoryUp(index)}
                                  disabled={index === 0}
                                  className="p-1 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                  <span className="material-symbols-outlined text-white text-[18px]">
                                    keyboard_arrow_up
                                  </span>
                                </button>
                                <button
                                  onClick={() => moveCategoryDown(index)}
                                  disabled={index === categoryOrder.length - 1}
                                  className="p-1 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                  <span className="material-symbols-outlined text-white text-[18px]">
                                    keyboard_arrow_down
                                  </span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="flex gap-3">
                          <button
                            onClick={() => setShowCategoryOrder(false)}
                            className="flex-1 px-4 py-2.5 bg-[#283539] hover:bg-[#3b4e54] text-white font-bold rounded-lg transition-colors"
                          >
                            Done
                          </button>
                          <button
                            onClick={() => {
                              setShowCategoryOrder(false);
                              nextPlayer();
                            }}
                            disabled={loading || availablePlayers.length === 0}
                            className="flex-1 px-4 py-2.5 bg-primary hover:bg-primary-dark text-background-dark font-bold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined text-[20px]">
                              play_arrow
                            </span>
                            Start
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Bid History */}
              {bidHistory.length > 0 && (
                <div className="bg-surface-dark border border-white/5 rounded-2xl p-6 hidden lg:block">
                  <h3 className="text-white text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2 text-white/50">
                    <span className="material-symbols-outlined text-base">
                      history
                    </span>{" "}
                    Recent Bids
                  </h3>
                  <div className="space-y-2 max-h-[150px] overflow-y-auto">
                    {bidHistory.map((bid, index) => (
                      <div
                        key={index}
                        className={`flex justify-between items-center p-3 rounded-lg ${
                          index === 0
                            ? "bg-primary/10 border border-primary/20"
                            : "bg-white/5"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="size-8 rounded-full flex items-center justify-center text-white text-xs font-bold overflow-hidden"
                            style={{ backgroundColor: bid.team.color }}
                          >
                            {bid.team.logo_url ? (
                              <img
                                src={bid.team.logo_url}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              bid.team.short_name
                            )}
                          </div>
                          <span className="text-white font-medium">
                            {bid.team.name}
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="text-white font-bold">
                            {formatShortCurrency(bid.amount)}
                          </p>
                          <p className="text-xs text-text-secondary">
                            {bid.time}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Side - Bidding Panel */}
            <div className="lg:col-span-4 flex flex-col min-h-[400px] max-h-[calc(100vh-180px)]">
              <div className="bg-surface-dark border border-white/5 rounded-2xl flex flex-col flex-1 overflow-hidden shadow-2xl relative">
                {/* Panel Header */}
                <div className="p-4 border-b border-white/5 bg-[#161d20] flex items-center justify-between sticky top-0 z-20 backdrop-blur-md bg-opacity-90">
                  <div>
                    <h3 className="text-white font-bold text-lg flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary">
                        touch_app
                      </span>{" "}
                      Bidding Panel
                    </h3>
                    <p className="text-[11px] text-white/40 uppercase font-bold tracking-wider mt-0.5">
                      {currentPlayer
                        ? "Select team to bid"
                        : "Select a player first"}
                    </p>
                  </div>
                  {currentPlayer && (
                    <div className="text-right">
                      <span className="text-[10px] uppercase text-white/40 font-bold block">
                        Next Bid
                      </span>
                      <span className="text-primary font-mono font-bold text-lg">
                        {formatShortCurrency(nextBidAmount)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Teams List */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {teams.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <span className="material-symbols-outlined text-4xl text-text-secondary mb-3">
                        group_off
                      </span>
                      <p className="text-text-secondary text-sm">
                        No teams added yet
                      </p>
                      <Link
                        to={`/tournament/${tournamentId}`}
                        className="text-primary text-sm mt-2 hover:underline"
                      >
                        Add teams first →
                      </Link>
                    </div>
                  ) : (
                    teams.map((team) => {
                      const isHighestBidder = highestBidder?.id === team.id;
                      const canAfford = team.remaining_purse >= nextBidAmount;
                      const pursePercent =
                        ((team.total_purse - team.remaining_purse) /
                          team.total_purse) *
                        100;

                      return (
                        <button
                          key={team.id}
                          onClick={() =>
                            currentPlayer &&
                            canAfford &&
                            !isHighestBidder &&
                            placeBid(team)
                          }
                          disabled={
                            !currentPlayer ||
                            !canAfford ||
                            isHighestBidder ||
                            loading
                          }
                          className={`w-full relative group overflow-hidden rounded-xl p-0 transition-all ${
                            isHighestBidder
                              ? "bg-surface-darker border border-primary/50 shadow-[0_0_20px_-5px_rgba(13,185,242,0.15)] cursor-default"
                              : canAfford && currentPlayer
                              ? "bg-surface-darker hover:bg-surface-dark border border-white/10 hover:border-white/30 active:scale-[0.98]"
                              : "bg-surface-darker border border-white/5 opacity-50 cursor-not-allowed"
                          }`}
                        >
                          {isHighestBidder && (
                            <>
                              <div className="absolute inset-0 bg-primary/5"></div>
                              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary"></div>
                            </>
                          )}

                          <div className="p-3 flex items-center gap-3 relative z-10">
                            <div
                              className="shrink-0 size-12 rounded-full flex items-center justify-center text-white font-black text-sm shadow-lg ring-2 ring-white/10 overflow-hidden"
                              style={{ backgroundColor: team.color }}
                            >
                              {team.logo_url ? (
                                <img
                                  src={team.logo_url}
                                  alt={team.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                team.short_name
                              )}
                            </div>
                            <div className="flex-1 text-left min-w-0">
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-white font-bold text-base truncate">
                                  {team.name}
                                </span>
                                {isHighestBidder && (
                                  <span className="text-primary text-[10px] font-bold uppercase tracking-wider bg-primary/10 px-1.5 py-0.5 rounded">
                                    Highest
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center justify-between">
                                <span
                                  className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                                    canAfford
                                      ? "text-white/60 bg-white/5"
                                      : "text-red-400 bg-red-400/10 border border-red-400/20"
                                  }`}
                                >
                                  {formatShortCurrency(team.remaining_purse)}
                                  {!canAfford && " (Low)"}
                                </span>
                                <div className="h-1.5 w-16 bg-white/10 rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${pursePercent}%`,
                                      backgroundColor: team.color,
                                    }}
                                  ></div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Hover Overlay for Bidding */}
                          {canAfford && currentPlayer && !isHighestBidder && (
                            <div
                              className="absolute inset-0 backdrop-blur-sm opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-200 rounded-xl"
                              style={{ backgroundColor: `${team.color}ee` }}
                            >
                              <span className="text-white font-bold text-lg flex items-center gap-2">
                                <span className="material-symbols-outlined">
                                  gavel
                                </span>
                                BID {formatShortCurrency(nextBidAmount)}
                              </span>
                            </div>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>

                {/* Player Selection (if no current player) */}
                {!currentPlayer && availablePlayers.length > 0 && (
                  <div className="p-3 border-t border-white/5 bg-[#161d20]">
                    {/* Role Filter Tabs */}
                    <div className="flex items-center gap-1 mb-3 overflow-x-auto no-scrollbar">
                      <button
                        onClick={() => setSelectedRole("all")}
                        className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          selectedRole === "all"
                            ? "bg-primary text-white"
                            : "bg-white/5 text-white/50 hover:text-white hover:bg-white/10"
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm align-middle mr-1">
                          stadium
                        </span>
                        All ({availablePlayers.length})
                      </button>
                      <button
                        onClick={() => setSelectedRole("batsman")}
                        className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          selectedRole === "batsman"
                            ? "bg-blue-500 text-white"
                            : "bg-white/5 text-white/50 hover:text-white hover:bg-white/10"
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm align-middle mr-1">
                          {getRoleIcon("batsman")}
                        </span>
                        BAT ({playersByCategory.batsman?.length || 0})
                      </button>
                      <button
                        onClick={() => setSelectedRole("bowler")}
                        className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          selectedRole === "bowler"
                            ? "bg-green-500 text-white"
                            : "bg-white/5 text-white/50 hover:text-white hover:bg-white/10"
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm align-middle mr-1">
                          {getRoleIcon("bowler")}
                        </span>
                        BOWL ({playersByCategory.bowler?.length || 0})
                      </button>
                      <button
                        onClick={() => setSelectedRole("all-rounder")}
                        className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          selectedRole === "all-rounder"
                            ? "bg-orange-500 text-white"
                            : "bg-white/5 text-white/50 hover:text-white hover:bg-white/10"
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm align-middle mr-1">
                          {getRoleIcon("all-rounder")}
                        </span>
                        AR ({playersByCategory["all-rounder"]?.length || 0})
                      </button>
                      <button
                        onClick={() => setSelectedRole("wicket-keeper")}
                        className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          selectedRole === "wicket-keeper"
                            ? "bg-purple-500 text-white"
                            : "bg-white/5 text-white/50 hover:text-white hover:bg-white/10"
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm align-middle mr-1">
                          {getRoleIcon("wicket-keeper")}
                        </span>
                        WK ({playersByCategory["wicket-keeper"]?.length || 0})
                      </button>
                    </div>

                    {/* Players List */}
                    <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                      {filteredPlayers.slice(0, 8).map((player) => (
                        <button
                          key={player.id}
                          onClick={() => selectPlayer(player)}
                          disabled={loading}
                          className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-primary/20 border border-white/10 hover:border-primary/50 transition-all"
                        >
                          <div className="size-8 rounded-full bg-[#283539] flex items-center justify-center overflow-hidden">
                            {player.photo_url ? (
                              <img
                                src={player.photo_url}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="material-symbols-outlined text-sm text-text-secondary">
                                person
                              </span>
                            )}
                          </div>
                          <div className="text-left">
                            <p className="text-white text-xs font-bold truncate max-w-[80px]">
                              {player.name}
                            </p>
                            <div className="flex items-center gap-1">
                              <span
                                className={`text-[9px] px-1 rounded ${
                                  player.role === "batsman"
                                    ? "bg-blue-500/20 text-blue-400"
                                    : player.role === "bowler"
                                    ? "bg-green-500/20 text-green-400"
                                    : player.role === "all-rounder"
                                    ? "bg-orange-500/20 text-orange-400"
                                    : "bg-purple-500/20 text-purple-400"
                                }`}
                              >
                                <span className="material-symbols-outlined text-[11px] align-middle mr-0.5">
                                  {getRoleIcon(player.role)}
                                </span>
                                {player.role === "batsman"
                                  ? "BAT"
                                  : player.role === "bowler"
                                  ? "BOWL"
                                  : player.role === "all-rounder"
                                  ? "AR"
                                  : "WK"}
                              </span>
                              <p className="text-text-secondary text-[10px]">
                                {formatShortCurrency(player.base_price)}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>

                    {filteredPlayers.length > 8 && (
                      <p className="text-center text-text-secondary text-[10px] mt-2">
                        +{filteredPlayers.length - 8} more players
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Footer Controls */}
      <footer className="fixed bottom-0 left-0 right-0 bg-surface-darker/95 backdrop-blur-xl border-t border-white/10 px-4 py-2 z-50 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.5)]">
        <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row items-center justify-between gap-2">
          {/* Bid Increment Controls */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            <span className="text-[10px] text-white/40 uppercase font-bold tracking-wider hidden md:block">
              Increment
            </span>
            <div className="flex items-center gap-1.5">
              <div className="flex items-center bg-surface-dark rounded-lg p-0.5 border border-white/5">
                {[
                  { label: "+500", value: 500 },
                  { label: "+1K", value: 1000 },
                  { label: "+5K", value: 5000 },
                  { label: "+10K", value: 10000 },
                ].map((inc) => (
                  <button
                    key={inc.value}
                    onClick={() => {
                      setBidIncrement(inc.value);
                      setShowCustomIncrement(false);
                      setCustomIncrementValue("");
                    }}
                    className={`relative h-8 px-2.5 rounded-md text-xs font-semibold transition-all ${
                      bidIncrement === inc.value && !showCustomIncrement
                        ? "bg-primary text-white shadow-lg shadow-primary/20"
                        : "hover:bg-white/5 hover:text-white text-white/50"
                    }`}
                  >
                    {inc.label}
                  </button>
                ))}
              </div>

              {/* Custom Increment Button */}
              <button
                onClick={() => setShowCustomIncrement(!showCustomIncrement)}
                className={`h-8 px-2.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                  showCustomIncrement
                    ? "bg-primary text-white"
                    : "bg-surface-dark hover:bg-white/5 text-white/50 hover:text-white border border-white/10"
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">
                  edit
                </span>
                <span className="hidden sm:inline">Custom</span>
              </button>

              {/* Custom Increment Input */}
              {showCustomIncrement && (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={customIncrementValue}
                    onChange={(e) =>
                      setCustomIncrementValue(
                        e.target.value.replace(/[^0-9]/g, "")
                      )
                    }
                    placeholder="Amount"
                    className="w-20 h-8 px-2 rounded-lg bg-[#1c2e35] border border-[#283539] text-white text-xs placeholder:text-text-secondary/50 focus:outline-none focus:border-primary transition-colors"
                  />
                  <button
                    onClick={() => {
                      if (customIncrementValue) {
                        setBidIncrement(parseInt(customIncrementValue, 10));
                      }
                    }}
                    className="h-8 px-2.5 bg-primary hover:bg-primary-dark text-background-dark text-xs font-bold rounded-lg transition-colors"
                  >
                    Set
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <button
              onClick={markSold}
              disabled={!currentPlayer || !highestBidder || loading}
              className="flex-1 md:flex-none flex items-center justify-center gap-1.5 bg-accent-green hover:bg-green-500 text-white font-bold h-10 px-5 rounded-lg transition-all shadow-lg shadow-green-900/20 active:scale-95 text-sm border border-green-400/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[18px]">
                gavel
              </span>
              SOLD
            </button>
            <button
              onClick={markUnsold}
              disabled={!currentPlayer || loading}
              className="flex-1 md:flex-none flex items-center justify-center gap-1.5 bg-surface-dark hover:bg-red-500/20 text-red-500 hover:text-red-400 border border-red-500/30 hover:border-red-500 font-bold h-10 px-5 rounded-lg transition-all active:scale-95 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[18px]">
                block
              </span>
              UNSOLD
            </button>
            <button
              onClick={nextPlayer}
              disabled={availablePlayers.length === 0 || loading}
              className="h-10 px-3 rounded-lg bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              title="Next Player"
            >
              <span className="material-symbols-outlined text-[18px] group-hover:translate-x-0.5 transition-transform">
                skip_next
              </span>
            </button>
          </div>
          {/* Trademark */}
          <div className="text-text-secondary/50 text-xs hidden md:block">
            © {new Date().getFullYear()} Made by{" "}
            <span className="text-primary">Nikhil</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default TournamentLive;
