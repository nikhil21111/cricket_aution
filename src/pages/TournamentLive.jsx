import { useState, useEffect, useRef } from "react";
import { Fireworks } from "fireworks-js";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase, formatCurrency, formatShortCurrency } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import toast from "react-hot-toast";

const TournamentLive = () => {
  const { id: tournamentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();

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
  const [imgError, setImgError] = useState(false);
  const [selectedRole, setSelectedRole] = useState("all");
  const [showCategoryOrder, setShowCategoryOrder] = useState(false);
  const [celebration, setCelebration] = useState(null);
  const [celebrationPlayer, setCelebrationPlayer] = useState(null);

  useEffect(() => {
    setImgError(false);
  }, [currentPlayer?.id, celebrationPlayer?.player?.id]);
  const celebrationTimeoutRef = useRef(null);
  const fireworksRef = useRef(null);
  const fireworksInstanceRef = useRef(null);

  const [consoleHeight, setConsoleHeight] = useState(78);
  const consoleRef = useRef(null);

  useEffect(() => {
    const measure = () => {
      if (consoleRef.current) {
        setConsoleHeight(consoleRef.current.offsetHeight);
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [teams, currentPlayer]);

  const [liveClockTime, setLiveClockTime] = useState("");
  useEffect(() => {
    setLiveClockTime(new Date().toLocaleTimeString());
    const clockInterval = setInterval(() => {
      setLiveClockTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  const getInitials = (name) => {
    if (!name) return "";
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 3).toUpperCase();
  };

  const formatIPLMoneyStats = (value) => {
    if (value === undefined || value === null || isNaN(value)) return "0";
    return value.toLocaleString();
  };

  const formatIPLMoneyBid = (value) => {
    return formatCurrency(value);
  };

  const formatIPLMoneyTeam = (value) => {
    return formatShortCurrency(value);
  };

  const splitFormattedVal = (formattedStr) => {
    if (!formattedStr) return { val: "0", unit: "pts" };
    const parts = formattedStr.split(" ");
    return {
      val: parts[0] || "0",
      unit: parts[1] || "pts"
    };
  };

  const getRoleDetails = (role) => {
    switch (role) {
      case "batsman":
        return { cls: "role-bat", e: "🏏", t: "Batsman" };
      case "bowler":
        return { cls: "role-bowl", e: "🎯", t: "Bowler" };
      case "all-rounder":
        return { cls: "role-ar", e: "⚡", t: "All-Rounder" };
      case "wicket-keeper":
        return { cls: "role-wk", e: "🧤", t: "Wicket-Keeper" };
      default:
        return { cls: "role-bat", e: "🏏", t: "Batsman" };
    }
  };


  const [bidClockVal, setBidClockVal] = useState(15);
  useEffect(() => {
    if (currentPlayer && auctionStatus === "live") {
      setBidClockVal(15);
      const countdown = setInterval(() => {
        setBidClockVal((prev) => {
          if (prev <= 1) {
            clearInterval(countdown);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(countdown);
    } else {
      setBidClockVal(15);
    }
  }, [currentPlayer, highestBid, auctionStatus]);


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
      
      const newBid = auctionState.highest_bid || 0;
      const newBidderId = auctionState.highest_bidder_id;
      const team = teams.find((t) => t.id === newBidderId);
      
      setHighestBid(newBid);
      setHighestBidder(team || null);

      if (newBid > 0 && team) {
        // Only add if it's not already the latest bid in history to avoid duplication
        setBidHistory((prev) => {
          if (prev.length > 0 && prev[0].amount === newBid && prev[0].team?.id === team.id) {
            return prev;
          }
          return [
            {
              team,
              amount: newBid,
              time: new Date().toLocaleTimeString(),
            },
            ...prev.slice(0, 9),
          ];
        });
      }
    } else {
      setCurrentPlayer(null);
      setHighestBid(0);
      setHighestBidder(null);
      setBidHistory([]);
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
  const isMarquee = displayPlayer?.icon_role && displayPlayer.icon_role !== "none";
  // Show base price when no bids yet, otherwise show highest bid
  const displayHighestBid =
    celebrationPlayer?.amount !== undefined
      ? celebrationPlayer.amount
      : isFirstBid
      ? currentPlayer?.base_price || 0
      : highestBid;
  const displayHighestBidder = celebrationPlayer?.bidder || highestBidder;

  // Bento stats calculations
  const soldPlayers = players.filter((p) => p.status === "sold");
  const unsoldPlayersList = players.filter((p) => p.status === "unsold");
  const totalSoldValue = soldPlayers.reduce((sum, p) => sum + (p.sold_price || 0), 0);
  const soldPlayersCount = soldPlayers.length;
  
  // Find highest bid today (highest sold player, or current highest bid)
  const highestSold = [...soldPlayers].sort((a, b) => (b.sold_price || 0) - (a.sold_price || 0))[0];
  const highestBidValue = highestSold ? highestSold.sold_price : (highestBid || 0);
  const highestBidPlayer = highestSold ? highestSold : (highestBidder ? currentPlayer : null);
  const highestBidPlayerTeamShort = highestSold 
    ? (teams.find(t => t.id === highestSold.team_id)?.short_name || '—') 
    : (highestBidder ? highestBidder.short_name : '—');

  const auctionedPlayersCount = soldPlayers.length + unsoldPlayersList.length;
  const remainingPlayersCount = players.filter((p) => p.status === "available").length;
  const avgSalePrice = soldPlayersCount > 0 ? totalSoldValue / soldPlayersCount : 0;

  if (loading && !tournament) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background-light dark:bg-background-dark">
        <div className="flex flex-col items-center gap-4">
          <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-text-secondary">Loading auction...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background-light dark:bg-background-dark text-text-primary dark:text-slate-100 min-h-screen flex flex-col overflow-x-hidden">
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
                {formatIPLMoneyBid(celebrationPlayer?.amount || 0)}
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
                {formatIPLMoneyBid(
                  celebrationPlayer?.player?.base_price || 0
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Comprehensive Brutalist Editorial CSS Styles */}
      <style>{`
        :root {
          --bg-primary: #ffffff;
          --bg-secondary: #f8fafc;
          --bg-tertiary: #f1f5f9;
          --text-primary: #0f172a;
          --text-secondary: #475569;
          --accent-crimson: #e11d48;
          --accent-cobalt: #2563eb;
          --accent-green: #10b981;
          --accent-amber: #f59e0b;
          --border-color: #0f172a;
          --shadow-sm: 4px 4px 0px #0f172a;
          --shadow-md: 8px 8px 0px #0f172a;
          --font-display: 'Outfit', sans-serif;
          --font-body: 'Source Sans 3', sans-serif;
          --font-mono: 'Geist Mono', monospace;
        }
        html.dark {
          --bg-primary: #0f172a;
          --bg-secondary: #1e293b;
          --bg-tertiary: #162032;
          --text-primary: #f8fafc;
          --text-secondary: #94a3b8;
          --accent-crimson: #fb7185;
          --accent-cobalt: #60a5fa;
          --accent-green: #34d399;
          --accent-amber: #fbbf24;
          --border-color: #f8fafc;
          --shadow-sm: 4px 4px 0px #f8fafc;
          --shadow-md: 8px 8px 0px #f8fafc;
        }

        *, *::before, *::after {
          box-sizing: border-box;
          transition: background-color 0.15s, border-color 0.15s, color 0.15s;
        }

        /* HEADER & TICKER */
        #root header.app-header,
        .bg-background-light header.app-header,
        .bg-background-dark header.app-header {
          background: var(--text-primary) !important;
          color: var(--bg-primary) !important;
          flex-shrink: 0;
          border-bottom: 3px solid var(--border-color) !important;
        }
        .ticker-wrap {
          display: flex;
          align-items: center;
          background: var(--bg-tertiary);
          border-bottom: 2px solid var(--border-color);
          height: 34px;
          overflow: hidden;
          font-family: var(--font-mono);
          font-size: 0.72rem;
          font-weight: 700;
        }
        .ticker-title {
          background: var(--accent-crimson);
          color: #fff;
          padding: 0 0.75rem;
          height: 100%;
          display: flex;
          align-items: center;
          text-transform: uppercase;
          font-family: var(--font-display);
          font-weight: 800;
          letter-spacing: 0.05em;
          border-right: 2px solid var(--border-color);
          white-space: nowrap;
          z-index: 10;
        }
        .ticker-content {
          flex: 1;
          overflow: hidden;
          display: flex;
          align-items: center;
          position: relative;
          height: 100%;
        }
        .ticker-items {
          display: inline-flex;
          white-space: nowrap;
          padding-left: 100%;
          animation: ticker-slide 20s linear infinite;
        }
        @keyframes ticker-slide {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-100%, 0, 0); }
        }
        .ticker-item {
          display: inline-flex;
          align-items: center;
          margin-right: 2rem;
          text-transform: uppercase;
        }
        .ticker-item-team {
          color: var(--text-primary);
          font-weight: 800;
          margin-right: 0.4rem;
        }
        .ticker-item-amount {
          color: var(--accent-crimson);
          font-weight: 700;
          margin-right: 0.4rem;
        }
        .ticker-item-time {
          color: var(--text-secondary);
          font-size: 0.62rem;
        }
        .ticker-clock-box {
          background: var(--bg-secondary);
          color: var(--text-primary);
          border-left: 2px solid var(--border-color);
          padding: 0 0.75rem;
          height: 100%;
          display: flex;
          align-items: center;
          gap: 0.4rem;
          z-index: 10;
          white-space: nowrap;
        }
        .live-dot {
          display: inline-block;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--accent-green);
          animation: blink 1.2s infinite;
        }
        .main-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.35rem 1.25rem;
          gap: 0.75rem;
          flex-wrap: wrap;
        }
        .header-left {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .back-btn {
          width: 28px;
          height: 28px;
          border: 2px solid var(--bg-primary);
          background: transparent;
          color: var(--bg-primary);
          cursor: pointer;
          font-size: 0.85rem;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 2px 2px 0 var(--bg-primary);
          font-family: var(--font-display);
          font-weight: 800;
          text-decoration: none;
          flex-shrink: 0;
        }
        .back-btn:hover {
          background: var(--bg-primary);
          color: var(--text-primary);
        }
        .header-title {
          font-size: 1.15rem;
          color: var(--bg-primary);
          font-family: var(--font-display);
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: -0.02em;
        }
        .badge {
          background: var(--accent-crimson);
          color: #fff;
          font-family: var(--font-mono);
          font-size: 0.65rem;
          font-weight: 700;
          padding: 0.1rem 0.45rem;
          border: 1px solid var(--bg-primary);
          text-transform: uppercase;
        }
        .header-right {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          flex-wrap: wrap;
        }
        .status-pill {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          border: 2px solid var(--bg-primary);
          padding: 0.28rem 0.7rem;
          font-family: var(--font-mono);
          font-size: 0.65rem;
          font-weight: 700;
          text-transform: uppercase;
          color: var(--bg-primary);
          flex-shrink: 0;
        }
        .category-pill {
          border: 2px solid var(--bg-primary);
          padding: 0.28rem 0.7rem;
          font-family: var(--font-mono);
          font-size: 0.62rem;
          font-weight: 700;
          color: var(--bg-primary);
          text-transform: uppercase;
          opacity: 0.85;
          flex-shrink: 0;
        }
        .ctrl-btn {
          border: 2px solid;
          padding: 0.28rem 0.7rem;
          font-family: var(--font-mono);
          font-size: 0.62rem;
          font-weight: 700;
          cursor: pointer;
          text-transform: uppercase;
          background: transparent;
          flex-shrink: 0;
        }
        .ctrl-btn.pause {
          border-color: var(--accent-amber);
          color: var(--accent-amber);
        }
        .ctrl-btn.end {
          border-color: var(--accent-crimson);
          color: var(--accent-crimson);
        }
        .ctrl-btn:active {
          transform: translate(1px,1px);
        }
        .bid-clock {
          display: flex;
          align-items: center;
          border: 2px solid var(--bg-primary);
          box-shadow: 3px 3px 0 var(--bg-primary);
          flex-shrink: 0;
        }
        .clock-lbl {
          font-family: var(--font-display);
          font-size: 0.62rem;
          font-weight: 800;
          text-transform: uppercase;
          padding: 0.35rem 0.5rem;
          border-right: 2px solid var(--bg-primary);
          background: var(--accent-amber);
          color: #000;
        }
        .clock-val {
          font-family: var(--font-mono);
          font-size: 1rem;
          font-weight: 700;
          padding: 0.25rem 0.65rem;
          color: var(--bg-primary);
        }
        .theme-btn {
          background: transparent;
          border: 2px solid var(--bg-primary);
          color: var(--bg-primary);
          padding: 0.28rem 0.7rem;
          font-family: var(--font-mono);
          font-size: 0.62rem;
          font-weight: 700;
          cursor: pointer;
          text-transform: uppercase;
          box-shadow: 2px 2px 0 var(--bg-primary);
          flex-shrink: 0;
        }
        .theme-btn:active {
          transform: translate(1px,1px);
          box-shadow: 1px 1px 0 var(--bg-primary);
        }

        /* LAYOUT & BENTO */
        .page-body {
          display: flex;
          flex: 1;
          min-height: 0;
          overflow: hidden;
          width: 100%;
        }
        .main {
          flex: 1;
          overflow: hidden;
          padding: 0.85rem 1.25rem 0.75rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          width: 100%;
        }
        .stats-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0.75rem;
          width: 100%;
          flex-shrink: 0;
        }
        .stat-bento {
          border: 2px solid var(--border-color);
          padding: 0.65rem 1rem;
          background: var(--bg-secondary);
          box-shadow: var(--shadow-sm);
        }
        .stat-lbl {
          font-family: var(--font-mono);
          font-size: 0.6rem;
          text-transform: uppercase;
          color: var(--text-secondary);
          margin-bottom: 0.15rem;
          font-weight: 700;
        }
        .stat-val {
          font-family: var(--font-mono);
          font-size: 1.45rem;
          font-weight: 700;
          color: var(--text-primary);
          line-height: 1.1;
        }
        .stat-sub {
          font-family: var(--font-mono);
          font-size: 0.58rem;
          color: var(--text-secondary);
          margin-top: 0.15rem;
        }
        .grid2 {
          display: grid;
          grid-template-columns: 3fr 1fr;
          gap: 0.75rem;
          flex: 1;
          min-height: 0;
          overflow: hidden;
          width: 100%;
        }
        .left-col {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          min-height: 0;
          overflow: hidden;
          flex: 1;
        }
        .right-col {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          min-height: 0;
          overflow: hidden;
          flex: 1;
        }

        /* PLAYER CARD */
        .player-card {
          border: 3px solid var(--border-color);
          background: var(--bg-secondary);
          box-shadow: var(--shadow-md);
          position: relative;
          flex: 1;
          min-height: 340px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: pulseBorder 1.8s infinite ease-in-out;
        }
        .player-card.marquee-card-active {
          animation: pulseMarqueeBorder 2s infinite ease-in-out;
        }
        @keyframes pulseBorder {
          0%  { border-color: var(--border-color); box-shadow: var(--shadow-md); }
          50% { border-color: var(--accent-crimson); box-shadow: 8px 8px 0 var(--accent-crimson); }
          100%{ border-color: var(--border-color); box-shadow: var(--shadow-md); }
        }
        @keyframes pulseMarqueeBorder {
          0%, 100% {
            border-color: #f59e0b;
            box-shadow: 8px 8px 0px #d97706, 0 0 15px rgba(245, 158, 11, 0.4);
          }
          50% {
            border-color: #d97706;
            box-shadow: 8px 8px 0px #b45309, 0 0 25px rgba(245, 158, 11, 0.8);
          }
        }
        .player-inner {
          display: flex;
          flex: 1;
          overflow: hidden;
          align-items: stretch;
        }
        .player-img-col {
          width: 40%;
          min-width: 240px;
          max-width: 360px;
          flex-shrink: 0;
          border-right: 3px solid var(--border-color);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          background: linear-gradient(160deg, var(--accent-cobalt) 0%, #0f172a 100%);
          align-self: stretch;
        }
        .player-img-col img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: top center;
          position: absolute;
          inset: 0;
        }
        .avatar-initials {
          font-family: var(--font-display);
          font-weight: 800;
          font-size: 5.5rem;
          color: rgba(255,255,255,0.9);
          letter-spacing: -0.04em;
          line-height: 1;
          text-shadow: 0 4px 20px rgba(0,0,0,0.4);
          position: relative;
          z-index: 1;
        }
        .cat-stripe {
          position: absolute;
          top: 0; left: 0; right: 0;
          background: var(--text-primary);
          color: var(--bg-primary);
          font-family: var(--font-mono);
          font-size: 0.65rem;
          font-weight: 700;
          text-transform: uppercase;
          padding: 0.22rem 0.5rem;
          text-align: center;
          letter-spacing: 0.12em;
          z-index: 2;
          border-bottom: 2px solid var(--border-color);
        }
        .player-img-col::after {
          content: '';
          position: absolute;
          bottom: 0; left: 0; right: 0;
          height: 50%;
          background: linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 100%);
          pointer-events: none;
          z-index: 0;
        }
        .player-info-col {
          flex: 1;
          padding: 1rem 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
          justify-content: space-between;
          overflow: hidden;
        }
        .role-tag {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          border: 2px solid var(--border-color);
          font-family: var(--font-mono);
          font-size: 0.68rem;
          font-weight: 700;
          text-transform: uppercase;
          padding: 0.15rem 0.55rem;
          width: fit-content;
        }
        .role-bat { border-color: var(--accent-cobalt); color: var(--accent-cobalt); }
        .role-bowl { border-color: var(--accent-green); color: var(--accent-green); }
        .role-ar { border-color: var(--accent-amber); color: var(--accent-amber); }
        .role-wk { border-color: #a855f7; color: #a855f7; }
        .player-name {
          font-size: 2.8rem;
          font-family: var(--font-display);
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: -0.03em;
          line-height: 0.95;
          color: var(--text-primary);
        }
        .status-badge {
          position: absolute;
          top: 0.85rem;
          right: 0.85rem;
          background: var(--accent-amber);
          color: #000;
          font-family: var(--font-display);
          font-weight: 800;
          font-size: 0.75rem;
          padding: 0.3rem 0.75rem;
          border: 2px solid var(--border-color);
          box-shadow: 2px 2px 0 var(--border-color);
          text-transform: uppercase;
          z-index: 10;
        }

        /* BID BOARD */
        .bid-board {
          display: flex;
          border: 3px solid var(--border-color);
          box-shadow: var(--shadow-sm);
          background: var(--bg-primary);
          height: 120px;
          max-height: 120px;
          overflow: hidden;
          margin-top: 0.5rem;
        }
        .bid-board-main {
          flex: 1.4;
          background: var(--accent-crimson);
          color: #fff;
          padding: 0.7rem 1.1rem;
          display: flex;
          flex-direction: column;
          justify-content: center;
          border-right: 3px solid var(--border-color);
        }
        html.dark .bid-board-main {
          background: #e11d48;
          color: #fff;
        }
        .bb-lbl {
          font-family: var(--font-mono);
          font-size: 0.68rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          opacity: 0.95;
          font-weight: 700;
          margin-bottom: 0.15rem;
        }
        .bb-val {
          font-family: var(--font-mono);
          font-size: 2.6rem;
          font-weight: 800;
          line-height: 1;
          white-space: nowrap;
        }
        .bb-unit {
          font-size: 1.3rem;
          font-weight: 400;
          opacity: 0.9;
        }
        .bid-board-sidebar {
          flex: 1;
          display: flex;
          flex-direction: column;
          background: var(--bg-secondary);
        }
        .bb-sub-box {
          flex: 1;
          padding: 0.4rem 0.85rem;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .bb-sub-box:first-child {
          border-bottom: 2px solid var(--border-color);
        }
        .bb-sub-lbl {
          font-family: var(--font-mono);
          font-size: 0.6rem;
          text-transform: uppercase;
          color: var(--text-secondary);
          margin-bottom: 0.08rem;
          font-weight: 700;
        }
        .bb-sub-val {
          font-family: var(--font-mono);
          font-size: 1.3rem;
          font-weight: 700;
          color: var(--text-primary);
          line-height: 1.1;
        }
        .bb-sub-unit {
          font-size: 0.85rem;
          font-weight: 400;
          color: var(--text-secondary);
        }

        /* TEAM PANEL */
        .team-panel {
          border: 2px solid var(--border-color);
          background: var(--bg-primary);
          box-shadow: var(--shadow-sm);
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 0;
          overflow: hidden;
        }
        .panel-hdr {
          font-family: var(--font-display);
          font-weight: 800;
          font-size: 0.85rem;
          text-transform: uppercase;
          border-bottom: 2px solid var(--border-color);
          padding: 0.55rem 0.9rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: var(--bg-secondary);
          flex-shrink: 0;
        }
        .panel-sub {
          font-family: var(--font-mono);
          font-size: 0.58rem;
          color: var(--text-secondary);
          text-transform: uppercase;
        }
        .team-scroll {
          flex: 1;
          overflow-y: auto;
        }
        .t-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.45rem 0.75rem;
          border-bottom: 1px solid var(--border-color);
          transition: background 0.1s;
        }
        .t-row:last-child { border-bottom: none; }
        .t-row:hover { background: var(--bg-secondary); }
        .t-row.active {
          background: var(--bg-tertiary);
          border-left: 4px solid var(--accent-crimson);
        }
        .t-row-left {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .t-swatch {
          width: 11px;
          height: 11px;
          border: 2px solid var(--border-color);
          flex-shrink: 0;
        }
        .t-name {
          font-family: var(--font-display);
          font-size: 0.78rem;
          font-weight: 800;
          text-transform: uppercase;
        }
        .t-fullname {
          font-family: var(--font-mono);
          font-size: 0.58rem;
          color: var(--text-secondary);
        }
        .t-row-right {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
        }
        .t-purse-val {
          font-family: var(--font-mono);
          font-weight: 700;
          font-size: 0.82rem;
        }
        .t-bar {
          width: 55px;
          height: 4px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          margin-top: 2px;
        }
        .t-bar-fill { height: 100%; }

        /* FIXED BOTTOM CONSOLE */
        .console {
          position: fixed;
          bottom: 0; left: 0; right: 0;
          z-index: 100;
          border-top: 3px solid var(--border-color);
          border-bottom: 3px solid var(--border-color);
          background: var(--bg-primary);
          box-shadow: 0 -6px 0 var(--border-color);
          display: grid;
          grid-template-columns: 3fr 1fr;
          gap: 0.75rem;
          padding: 0 1.25rem;
          height: 92px;
        }
        .console-left-section {
          display: flex;
          border-left: 2px solid var(--border-color);
          border-right: 2px solid var(--border-color);
          overflow: hidden;
          min-height: 0;
        }
        .console-right-section {
          display: flex;
          border-left: 2px solid var(--border-color);
          border-right: 2px solid var(--border-color);
          overflow: hidden;
          min-height: 0;
          background: var(--bg-secondary);
        }
        .console-left {
          display: flex;
          flex-direction: column;
          border-right: 2px solid var(--border-color);
          flex-shrink: 0;
        }
        .console-hdr {
          font-family: var(--font-display);
          font-weight: 800;
          font-size: 0.7rem;
          text-transform: uppercase;
          border-bottom: 1px solid var(--border-color);
          padding: 0.25rem 0.65rem;
          background: var(--text-primary);
          color: var(--bg-primary);
          display: flex;
          flex-direction: column;
          gap: 0.05rem;
        }
        .console-sub {
          font-family: var(--font-mono);
          font-size: 0.55rem;
          color: var(--accent-amber);
          font-weight: 700;
        }
        .inc-row {
          display: flex;
          align-items: center;
          padding: 0.2rem 0.5rem;
          gap: 3px;
          flex: 1;
          background: var(--bg-secondary);
        }
        .inc-label {
          font-family: var(--font-mono);
          font-size: 0.52rem;
          text-transform: uppercase;
          color: var(--text-secondary);
          margin-right: 0.35rem;
          white-space: nowrap;
        }
        .inc-btn {
          border: 2px solid var(--border-color);
          padding: 0.1rem 0.35rem;
          font-family: var(--font-mono);
          font-size: 0.6rem;
          font-weight: 700;
          cursor: pointer;
          background: var(--bg-primary);
          color: var(--text-primary);
        }
        .inc-btn.active {
          background: var(--text-primary);
          color: var(--bg-primary);
        }
        .inc-btn:hover:not(.active) {
          background: var(--bg-tertiary);
        }
        .inc-custom {
          margin-left: auto;
          border: 2px solid var(--accent-crimson);
          padding: 0.1rem 0.35rem;
          font-family: var(--font-mono);
          font-size: 0.6rem;
          font-weight: 700;
          cursor: pointer;
          background: transparent;
          color: var(--accent-crimson);
          white-space: nowrap;
        }
        .inc-custom.active {
          background: var(--accent-crimson);
          color: #fff;
        }
        .console-teams {
          display: flex;
          flex-direction: column;
          flex: 1;
          overflow: hidden;
        }
        .console-teams-label {
          font-family: var(--font-mono);
          font-size: 0.52rem;
          font-weight: 700;
          text-transform: uppercase;
          color: var(--text-secondary);
          padding: 0.12rem 0.5rem;
          border-bottom: 1px solid var(--border-color);
          background: var(--bg-secondary);
          letter-spacing: 0.08em;
        }
        .team-grid {
          display: grid;
          flex: 1;
          width: 100%;
        }
        .team-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 0.3rem 0.15rem;
          border-right: 1px solid var(--border-color);
          background: var(--bg-primary);
          cursor: pointer;
          position: relative;
          gap: 0.05rem;
        }
        .team-btn:last-child { border-right: none; }
        .team-btn:hover { background: var(--bg-tertiary); }
        .team-btn:active { transform: translate(1px,1px); }
        .team-btn.highest {
          background: rgba(225,29,72,0.08);
          outline: 2px solid var(--accent-crimson);
          outline-offset: -2px;
        }
        html.dark .team-btn.highest {
          background: rgba(251,113,133,0.12);
        }
        .team-btn.broke {
          opacity: 0.35;
          cursor: not-allowed;
        }
        .t-stripe {
          width: 100%;
          height: 4px;
          border-bottom: 1px solid var(--border-color);
          position: absolute;
          top: 0; left: 0; right: 0;
        }
        .t-short {
          font-family: var(--font-display);
          font-size: 0.8rem;
          font-weight: 800;
          text-transform: uppercase;
          line-height: 1;
        }
        .t-purse {
          font-family: var(--font-mono);
          font-size: 0.58rem;
          color: var(--text-secondary);
        }
        .t-top {
          position: absolute;
          top: 2px;
          right: 2px;
          font-family: var(--font-mono);
          font-size: 0.4rem;
          color: var(--accent-crimson);
          font-weight: 700;
          text-transform: uppercase;
        }
        .actions {
          display: grid;
          grid-template-rows: 1fr 1fr;
          grid-template-columns: 1.2fr 1fr;
          flex: 1;
        }
        .act-btn {
          font-family: var(--font-display);
          font-weight: 800;
          font-size: 0.65rem;
          text-transform: uppercase;
          cursor: pointer;
          border: none !important;
          border-left: 2px solid var(--border-color) !important;
          border-bottom: 2px solid var(--border-color) !important;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.15rem;
          padding: 0 0.3rem;
          background: var(--bg-primary);
          color: var(--text-primary);
        }
        .act-btn:active { transform: translate(1px,1px); }
        .act-btn.sold {
          background: var(--accent-green) !important;
          color: #fff !important;
          grid-row: 1 / 3;
          grid-column: 1;
          border-bottom: none !important;
          border-left: none !important;
          font-size: 0.75rem;
        }
        .act-btn.sold:hover { filter: brightness(1.1); }
        .act-btn.unsold {
          background: var(--bg-secondary) !important;
          color: var(--accent-crimson) !important;
          grid-row: 1;
          grid-column: 2;
          font-size: 0.6rem;
          border-bottom: 2px solid var(--border-color) !important;
        }
        .act-btn.next {
          background: var(--bg-secondary) !important;
          color: var(--text-primary) !important;
          font-size: 1.1rem;
          grid-row: 2;
          grid-column: 2;
          border-bottom: none !important;
        }
        @media(max-width:860px) {
          .grid2 { grid-template-columns: 1fr; }
          .stats-row { grid-template-columns: repeat(2, 1fr); }
          .team-grid { grid-template-columns: repeat(5, 1fr) !important; }
          .player-inner { flex-direction: column; }
          .player-img-col {
            width: 100% !important;
            min-width: 100% !important;
            max-width: 100% !important;
            height: 180px !important;
            border-right: none !important;
            border-bottom: 3px solid var(--border-color);
          }
          .console {
            grid-template-columns: 1fr;
            height: auto;
            padding: 0.5rem 1.25rem;
          }
          .console-left-section {
            border-bottom: 2px solid var(--border-color);
          }
        }
      `}</style>

      {/* Header */}
      <header className="app-header">
        <div className="ticker-wrap">
          <div className="ticker-title">BID HISTORY</div>
          <div className="ticker-content">
            <div className="ticker-items">
              {bidHistory.length === 0 ? (
                <span className="ticker-item text-slate-400 dark:text-slate-500">Waiting for first bid...</span>
              ) : (
                bidHistory.map((bid, index) => (
                  <span key={index} className="ticker-item">
                    <span className="ticker-item-team">{bid.team.short_name}</span>
                    <span className="ticker-item-amount">{formatIPLMoneyBid(bid.amount)}</span>
                    <span className="ticker-item-time">({bid.time})</span>
                    {index < bidHistory.length - 1 && <span style={{ color: 'var(--text-secondary)', marginLeft: '2rem', marginRight: '2rem' }}>•</span>}
                  </span>
                ))
              )}
            </div>
          </div>
          <div className="ticker-clock-box">
            <span className="live-dot"></span>
            <span>{liveClockTime}</span>
          </div>
        </div>

        <div className="main-row">
          <div className="header-left">
            <Link to={`/tournament/${tournamentId}`} className="back-btn">←</Link>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', color: 'var(--bg-primary)', opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '2px' }}>
                TOURNAMENT
              </div>
              <div className="header-title">
                CRICKET AUCTION PRO <span className="badge">IPL-2026</span>
              </div>
            </div>
          </div>

          <div className="header-right">
            <div className="status-pill">
              <span className="live-dot"></span>
              <span>LIVE AUCTION</span>
            </div>

            {displayPlayer && currentCategory && (
              <div className="category-pill">
                <span>★ {currentCategory.label}</span>
                <span style={{ margin: '0 0.4rem', opacity: 0.4 }}>|</span>
                <span style={{ color: 'var(--accent-amber)' }}>{playersByCategory[currentCategory.id]?.length || 0} LEFT</span>
              </div>
            )}

            {auctionStatus === "live" ? (
              <button onClick={pauseAuction} className="ctrl-btn pause">⏸ PAUSE</button>
            ) : auctionStatus === "paused" ? (
              <button onClick={resumeAuction} className="ctrl-btn pause">▶ RESUME</button>
            ) : null}

            {auctionStatus !== "ended" && (
              <button onClick={endAuction} className="ctrl-btn end">⏹ END</button>
            )}

            <div className="bid-clock">
              <div className="clock-lbl">BID CLOCK</div>
              <div className="clock-val">{bidClockVal === 0 ? "TIME!" : `${bidClockVal}s`}</div>
            </div>

            <button onClick={toggleTheme} className="theme-btn">
              {theme === "dark" ? "☀️ LIGHT MODE" : "🌙 DARK MODE"}
            </button>
          </div>
        </div>
      </header>

      <div className="page-body" style={{ paddingBottom: `${consoleHeight}px` }}>
        <main className="main">
          {/* STATS BENTO ROW */}
          <div className="stats-row shrink-0">
            <div className="stat-bento">
              <div className="stat-lbl font-mono text-[10px]">Total Sold Value</div>
              <div className="stat-val font-mono text-2xl font-bold">
                {formatShortCurrency(totalSoldValue)}
              </div>
              <div className="stat-sub font-mono text-[9px] text-slate-500">
                {soldPlayers.length > 0
                  ? `↑ ${formatShortCurrency(soldPlayers[soldPlayers.length - 1].sold_price || 0)} since last player`
                  : "No players sold yet"}
              </div>
            </div>

            <div className="stat-bento">
              <div className="stat-lbl font-mono text-[10px]">Highest Bid Today</div>
              <div className="stat-val font-mono text-2xl font-bold" style={{ color: "var(--accent-crimson)" }}>
                {formatShortCurrency(highestBidValue)}
              </div>
              <div className="stat-sub font-mono text-[9px] text-slate-500">
                {highestBidPlayer ? `${highestBidPlayer.name} → ${highestBidPlayerTeamShort}` : "No bids today"}
              </div>
            </div>

            <div className="stat-bento">
              <div className="stat-lbl font-mono text-[10px]">Players Auctioned</div>
              <div className="stat-val font-mono text-2xl font-bold">
                {soldPlayersCount + unsoldPlayersList.length}{" "}
                <span className="text-xs font-normal text-slate-500">/ {players.length}</span>
              </div>
              <div className="stat-sub font-mono text-[9px] text-slate-500">
                {remainingPlayersCount} players remaining
              </div>
            </div>

            <div className="stat-bento">
              <div className="stat-lbl font-mono text-[10px]">Avg Sale Price</div>
              <div className="stat-val font-mono text-2xl font-bold">
                {formatShortCurrency(avgSalePrice)}
              </div>
              <div className="stat-sub font-mono text-[9px] text-slate-500">
                Across {soldPlayersCount} sold players
              </div>
            </div>
          </div>

          {/* TWO-COLUMN GRID */}
          <div className="grid2" style={{ marginBottom: 0 }}>
            {/* LEFT COLUMN: ACTIVE PLAYER CARD OR MANUAL SELECTOR */}
            <div className="left-col">
              {displayPlayer ? (
                <div className={`player-card ${isMarquee ? "marquee-card-active" : ""}`}>
                  <div className="status-badge">ACTIVE BIDDING</div>
                  <div className="player-inner">
                    {/* BIG PHOTO / AVATAR COLUMN */}
                    <div
                      className="player-img-col"
                      style={{
                        background: displayPlayer.color
                          ? `linear-gradient(160deg, ${displayPlayer.color} 0%, #0f172a 100%)`
                          : `linear-gradient(160deg, var(--accent-cobalt) 0%, #0f172a 100%)`,
                      }}
                    >
                      <div className="cat-stripe">
                        {currentCategory?.label || "★ PLAYER"}
                      </div>
                      {displayPlayer.photo_url && 
                       displayPlayer.photo_url !== "null" && 
                       displayPlayer.photo_url !== "undefined" && 
                       displayPlayer.photo_url.trim() !== "" && 
                       !imgError ? (
                        <img
                          src={displayPlayer.photo_url}
                          alt={displayPlayer.name}
                          className="w-full h-full object-cover object-top absolute inset-0"
                          onError={() => setImgError(true)}
                        />
                      ) : (
                        <span className="avatar-initials">
                          {getInitials(displayPlayer.name)}
                        </span>
                      )}
                    </div>

                    {/* INFO COLUMN */}
                    <div className="player-info-col">
                      <div>
                        <div
                          className={`role-tag ${getRoleDetails(displayPlayer.role).cls}`}
                          style={{ marginBottom: "0.5rem" }}
                        >
                          {getRoleDetails(displayPlayer.role).e} {getRoleDetails(displayPlayer.role).t}
                        </div>
                        <div className="player-name">
                          {displayPlayer.name}
                        </div>
                      </div>

                      {/* BROADCAST STYLE BID BOARD */}
                      <div className="bid-board">
                        <div className="bid-board-main">
                          <span className="bb-lbl">{isFirstBid ? "Base Price" : "Current Bid"}</span>
                          <span className="bb-val">
                            {splitFormattedVal(formatCurrency(displayHighestBid)).val}{" "}
                            <span className="bb-unit">
                              {splitFormattedVal(formatCurrency(displayHighestBid)).unit}
                            </span>
                          </span>
                        </div>
                        <div className="bid-board-sidebar">
                          <div className="bb-sub-box">
                            <span className="bb-sub-lbl">High Bidder</span>
                            <span className="bb-sub-val">
                              {displayHighestBidder ? displayHighestBidder.short_name : "—"}
                            </span>
                          </div>
                          <div className="bb-sub-box">
                            <span className="bb-sub-lbl">Base Price</span>
                            <span className="bb-sub-val">
                              {splitFormattedVal(formatCurrency(displayPlayer.base_price)).val}{" "}
                              <span className="bb-sub-unit">
                                {splitFormattedVal(formatCurrency(displayPlayer.base_price)).unit}
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* NO ACTIVE PLAYER - SETUP & MANUAL SELECTION PANEL */
                <div className="player-card flex flex-col p-6 overflow-y-auto">
                  <div className="flex-1 flex flex-col justify-center items-center text-center py-4">
                    {auctionStarted && !showCategoryOrder ? (
                      <>
                        <div className="size-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4 border-2 border-black">
                          <span className="material-symbols-outlined text-3xl">
                            {availablePlayers.length > 0
                              ? currentCategory?.icon || "sports_cricket"
                              : unsoldPlayers.length > 0 && !unsoldRoundStarted
                              ? "replay"
                              : "emoji_events"}
                          </span>
                        </div>
                        <h3 className="text-xl font-bold text-text-primary dark:text-slate-100 mb-2">
                          {availablePlayers.length > 0
                            ? "Select Next Player"
                            : unsoldPlayers.length > 0 && !unsoldRoundStarted
                            ? "First Round Complete!"
                            : "🎉 Auction Complete!"}
                        </h3>
                        <p className="text-text-secondary dark:text-slate-400 mb-4 max-w-md text-xs font-mono">
                          {availablePlayers.length > 0
                            ? randomMode
                              ? `${availablePlayers.length} players remaining. Random selection within ${currentCategory?.label || "category"}.`
                              : `${availablePlayers.length} players remaining. Current category: ${currentCategory?.label || "All done"}`
                            : unsoldPlayers.length > 0 && !unsoldRoundStarted
                            ? `${unsoldPlayers.length} players went unsold. Give them a second chance!`
                            : "All players have been auctioned. Great work!"}
                        </p>

                        {availablePlayers.length > 0 && randomMode && (
                          <div className="flex items-center gap-2 mb-4 px-4 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/30">
                            <span className="material-symbols-outlined text-orange-500 text-[18px]">
                              shuffle
                            </span>
                            <span className="text-orange-500 text-xs font-bold font-mono">
                              Random within {currentCategory?.label || "Category"}
                            </span>
                          </div>
                        )}

                        {availablePlayers.length > 0 ? (
                          <button
                            onClick={nextPlayer}
                            disabled={loading}
                            className="px-5 py-2.5 bg-[#e11d48] hover:bg-[#be123c] text-white font-bold font-mono border-2 border-black uppercase shadow-[4px_4px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_#000] flex items-center justify-center gap-2"
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              {randomMode ? "shuffle" : "skip_next"}
                            </span>
                            Next Player
                          </button>
                        ) : unsoldPlayers.length > 0 && !unsoldRoundStarted ? (
                          <button
                            onClick={startUnsoldRound}
                            disabled={loading}
                            className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold font-mono border-2 border-black uppercase shadow-[4px_4px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_#000] flex items-center justify-center gap-2"
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              replay
                            </span>
                            Start Unsold Round ({unsoldPlayers.length} Players)
                          </button>
                        ) : null}
                      </>
                    ) : !showCategoryOrder ? (
                      <>
                        <div className="size-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4 border-2 border-black">
                          <span className="material-symbols-outlined text-3xl">
                            {randomMode ? "shuffle" : "person_search"}
                          </span>
                        </div>
                        <h3 className="text-xl font-bold text-text-primary dark:text-slate-100 mb-2">
                          Ready to Start Auction
                        </h3>
                        <p className="text-text-secondary dark:text-slate-400 mb-4 max-w-md text-xs font-mono">
                          {randomMode
                            ? "Random mode: Players within each category will come in random order."
                            : "Sequential mode: Players come in order within each category."}
                        </p>

                        <div className="flex items-center gap-3 mb-6 p-1 bg-slate-100 dark:bg-slate-800 border-2 border-black">
                          <button
                            onClick={() => toggleRandomMode(false)}
                            className={`px-3 py-1.5 font-bold font-mono text-[10px] uppercase transition-colors ${
                              !randomMode
                                ? "bg-[#0f172a] text-white"
                                : "text-black dark:text-white hover:bg-black/10"
                            }`}
                          >
                            Sequential
                          </button>
                          <button
                            onClick={() => toggleRandomMode(true)}
                            className={`px-3 py-1.5 font-bold font-mono text-[10px] uppercase transition-colors ${
                              randomMode
                                ? "bg-[#e11d48] text-white"
                                : "text-black dark:text-white hover:bg-black/10"
                            }`}
                          >
                            Random
                          </button>
                        </div>

                        {availablePlayers.length > 0 && (
                          <div className="flex flex-col sm:flex-row gap-3">
                            <button
                              onClick={() => setShowCategoryOrder(true)}
                              className="px-4 py-2 bg-[#1e293b] hover:bg-[#334155] text-white font-bold font-mono border-2 border-black uppercase shadow-[3px_3px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_#000] flex items-center justify-center gap-1.5 text-xs"
                            >
                              <span className="material-symbols-outlined text-sm">
                                tune
                              </span>
                              Category Order
                            </button>
                            <button
                              onClick={nextPlayer}
                              disabled={loading}
                              className="px-4 py-2 bg-[#10b981] hover:bg-[#059669] text-white font-bold font-mono border-2 border-black uppercase shadow-[3px_3px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_#000] flex items-center justify-center gap-1.5 text-xs"
                            >
                              <span className="material-symbols-outlined text-sm">
                                play_arrow
                              </span>
                              Start Auction
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="w-full max-w-md text-left">
                        <h3 className="text-lg font-black text-text-primary dark:text-slate-100 mb-2">
                          Set Category Order
                        </h3>
                        <p className="text-text-secondary dark:text-slate-400 text-xs font-mono mb-4">
                          Arrange the order. First category will be auctioned first.
                        </p>

                        <div className="space-y-2 mb-6 max-h-[200px] overflow-y-auto pr-1">
                          {categoryOrder.map((cat, index) => (
                            <div
                              key={cat.id}
                              className="flex items-center gap-2 p-2 bg-white dark:bg-slate-800 border-2 border-black text-xs"
                            >
                              <span className="w-5 h-5 rounded bg-slate-900 text-white flex items-center justify-center font-bold">
                                {index + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-text-primary dark:text-slate-100 font-bold truncate">
                                  {cat.label}
                                </p>
                              </div>
                              <div className="flex gap-0.5">
                                <button
                                  onClick={() => moveCategoryUp(index)}
                                  disabled={index === 0}
                                  className="p-0.5 border border-black hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30"
                                >
                                  <span className="material-symbols-outlined text-xs block">
                                    keyboard_arrow_up
                                  </span>
                                </button>
                                <button
                                  onClick={() => moveCategoryDown(index)}
                                  disabled={index === categoryOrder.length - 1}
                                  className="p-0.5 border border-black hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30"
                                >
                                  <span className="material-symbols-outlined text-xs block">
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
                            className="flex-1 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-black dark:text-white font-bold font-mono border-2 border-black text-xs uppercase"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => {
                              setShowCategoryOrder(false);
                              nextPlayer();
                            }}
                            disabled={loading || availablePlayers.length === 0}
                            className="flex-1 py-1.5 bg-[#10b981] hover:bg-[#059669] text-white font-bold font-mono border-2 border-black text-xs uppercase disabled:opacity-50"
                          >
                            Save & Start
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* MANUAL SELECTION LIST */}
                  {!currentPlayer && availablePlayers.length > 0 && (
                    <div className="border-t-2 border-black pt-4 mt-auto">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-xs font-bold uppercase text-slate-500">
                          Or Select Player Manually
                        </span>
                        <div className="flex gap-1 overflow-x-auto max-w-[70%] no-scrollbar">
                          {[
                            { id: "all", label: "All" },
                            { id: "batsman", label: "BAT" },
                            { id: "bowler", label: "BOWL" },
                            { id: "all-rounder", label: "AR" },
                            { id: "wicket-keeper", label: "WK" },
                          ].map((role) => (
                            <button
                              key={role.id}
                              onClick={() => setSelectedRole(role.id)}
                              className={`px-2 py-0.5 border border-black text-[9px] font-bold font-mono uppercase transition-colors shrink-0 ${
                                selectedRole === role.id
                                  ? "bg-slate-900 text-white"
                                  : "bg-white dark:bg-slate-800 text-black dark:text-white hover:bg-slate-100"
                              }`}
                            >
                              {role.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {filteredPlayers.slice(0, 8).map((player) => (
                          <button
                            key={player.id}
                            onClick={() => selectPlayer(player)}
                            disabled={loading}
                            className="flex items-center gap-1.5 p-1.5 bg-white dark:bg-slate-800 border border-black hover:bg-slate-100 dark:hover:bg-slate-700 transition-all text-left min-w-0"
                          >
                            <div className="size-6 rounded-full bg-slate-900 border border-black flex items-center justify-center overflow-hidden shrink-0">
                              {player.photo_url ? (
                                <img
                                  src={player.photo_url}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="material-symbols-outlined text-[10px] text-white">
                                  person
                                </span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-text-primary dark:text-slate-100 text-[10px] font-bold truncate leading-tight">
                                {player.name}
                              </p>
                              <p className="text-text-secondary dark:text-slate-400 text-[9px] font-mono leading-none">
                                {formatIPLMoneyTeam(player.base_price)}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>

                      {filteredPlayers.length > 8 && (
                        <p className="text-right text-text-secondary text-[8px] font-mono mt-1">
                          +{filteredPlayers.length - 8} more available
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: TEAM PURSES SIDEBAR */}
            <div className="right-col">
              <div className="team-panel">
                <div className="panel-hdr">
                  <span>Team Purses</span>
                  <span className="panel-sub">Scroll ↓</span>
                </div>
                <div className="team-scroll">
                  {[...teams]
                    .sort((a, b) => b.remaining_purse - a.remaining_purse)
                    .map((team) => {
                      const isCurrentHighBidder = highestBidder?.id === team.id;
                      const totalPurse = team.total_purse || 10000;
                      const spentPercent = ((totalPurse - team.remaining_purse) / totalPurse) * 100;

                      return (
                        <div
                          key={team.id}
                          className={`t-row ${isCurrentHighBidder ? "active" : ""}`}
                        >
                          <div className="t-row-left">
                            <div
                              className="t-swatch"
                              style={{ backgroundColor: team.color || "#0db9f2" }}
                            ></div>
                            <div className="min-w-0">
                              <div className="t-name truncate">{team.short_name}</div>
                              <div className="t-fullname truncate max-w-[120px]">{team.name}</div>
                            </div>
                          </div>
                          <div className="t-row-right shrink-0">
                            <div
                              className="t-purse-val"
                              style={{
                                color: isCurrentHighBidder
                                  ? "var(--accent-crimson)"
                                  : "var(--text-primary)",
                              }}
                            >
                              {formatIPLMoneyTeam(team.remaining_purse)}
                            </div>
                            <div className="t-bar">
                              <div
                                className="t-bar-fill"
                                style={{
                                  width: `${spentPercent}%`,
                                  backgroundColor: team.color || "#0db9f2",
                                }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* FIXED BOTTOM: ADMIN BID CONSOLE */}
      <div className="console" id="console" ref={consoleRef}>
        {/* LEFT SECTION (Aligns with player card) */}
        <div className="console-left-section">
          <div className="console-left">
            <div className="console-hdr">
              <span>Admin Bid Control</span>
              <span className="console-sub">
                Next: <strong>{formatCurrency(nextBidAmount)}</strong>
              </span>
            </div>
            <div className="inc-row">
              <span className="inc-label">INC:</span>
              {[
                { label: "+500", value: 500 },
                { label: "+1K", value: 1000 },
                { label: "+5K", value: 5000 },
                { label: "+10K", value: 10000 },
              ].map((inc) => (
                <button
                  key={inc.value}
                  className={`inc-btn ${bidIncrement === inc.value && !showCustomIncrement ? "active" : ""}`}
                  onClick={() => {
                    setBidIncrement(inc.value);
                    setShowCustomIncrement(false);
                    setCustomIncrementValue("");
                  }}
                >
                  {inc.label}
                </button>
              ))}
              <button
                className={`inc-custom ${showCustomIncrement ? "active" : ""}`}
                onClick={() => setShowCustomIncrement(!showCustomIncrement)}
              >
                ✎
              </button>
              {showCustomIncrement && (
                <div id="custom-row" className="flex items-center gap-1 ml-1">
                  <input
                    type="text"
                    value={customIncrementValue}
                    onChange={(e) =>
                      setCustomIncrementValue(
                        e.target.value.replace(/[^0-9]/g, "")
                      )
                    }
                    placeholder="Amt"
                    className="w-14 h-6 px-1 border-2 border-black font-mono text-[10px] bg-white text-black"
                  />
                  <button
                    onClick={() => {
                      if (customIncrementValue) {
                        setBidIncrement(parseInt(customIncrementValue, 10));
                      }
                    }}
                    className="h-6 px-1.5 border-2 border-black font-mono text-[9px] font-bold bg-[#0f172a] text-white hover:bg-slate-800"
                  >
                    OK
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="console-teams">
            <div className="console-teams-label">▼ CLICK A TEAM TO PLACE BID</div>
            <div className="team-grid" style={{ gridTemplateColumns: `repeat(${Math.max(10, teams.length)}, 1fr)` }}>
              {Array.from({ length: Math.max(10, teams.length) }).map((_, idx) => {
                const team = teams[idx];
                if (team) {
                  const isHighestBidder = highestBidder?.id === team.id;
                  const canAfford = team.remaining_purse >= nextBidAmount;
                  return (
                    <button
                      key={team.id}
                      disabled={!currentPlayer || isHighestBidder || !canAfford || loading}
                      className={`team-btn ${isHighestBidder ? "highest" : ""} ${!canAfford && !isHighestBidder ? "broke" : ""}`}
                      title={`${team.name} — ${formatIPLMoneyTeam(team.remaining_purse)}`}
                      onClick={() =>
                        currentPlayer &&
                        canAfford &&
                        !isHighestBidder &&
                        placeBid(team)
                      }
                    >
                      {isHighestBidder && <span className="t-top">HIGHEST</span>}
                      <div
                        className="t-stripe"
                        style={{ backgroundColor: team.color || "#0db9f2" }}
                      ></div>
                      <div className="t-short">{team.short_name}</div>
                      <div className="t-purse">{formatIPLMoneyTeam(team.remaining_purse)}</div>
                    </button>
                  );
                } else {
                  return (
                    <div
                      key={`empty-${idx}`}
                      className="team-btn opacity-25 cursor-not-allowed select-none"
                    >
                      <div className="t-stripe bg-slate-300 dark:bg-slate-700"></div>
                      <div className="t-short text-slate-400">—</div>
                      <div className="t-purse text-slate-400">0 pts</div>
                    </div>
                  );
                }
              })}
            </div>
          </div>
        </div>

        {/* RIGHT SECTION (Aligns with sidebar) */}
        <div className="console-right-section">
          <div className="actions">
            <button
              className="act-btn sold"
              onClick={markSold}
              disabled={!currentPlayer || !highestBidder || loading}
              style={{ opacity: !currentPlayer || !highestBidder ? 0.5 : 1 }}
            >
              🔨 SOLD
            </button>
            <button
              className="act-btn unsold"
              onClick={markUnsold}
              disabled={!currentPlayer || loading}
              style={{ opacity: !currentPlayer ? 0.5 : 1 }}
            >
              ✗ UNSOLD
            </button>
            <button
              className="act-btn next"
              onClick={nextPlayer}
              disabled={availablePlayers.length === 0 || loading}
              style={{ opacity: availablePlayers.length === 0 ? 0.5 : 1 }}
              title="Next Player"
            >
              ⏭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TournamentLive;
