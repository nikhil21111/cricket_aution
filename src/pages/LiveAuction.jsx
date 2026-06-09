import { useEffect, useMemo, useState, useRef } from "react";
import { Fireworks } from "fireworks-js";
import { Link, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { supabase, formatShortCurrency, formatCurrency } from "../lib/supabase";
import { useTheme } from "../context/ThemeContext";

const roleStyles = {
  batsman: "bg-blue-100 text-blue-700 border-blue-200",
  bowler: "bg-green-100 text-green-700 border-green-200",
  "all-rounder": "bg-orange-100 text-orange-700 border-orange-200",
  "wicket-keeper": "bg-purple-100 text-purple-700 border-purple-200",
};

const LiveAuction = () => {
  const { id: tournamentId } = useParams();
  const [tournament, setTournament] = useState(null);
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [auctionState, setAuctionState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { theme, setTheme } = useTheme();

  // Tab and filter states for the interactive UI
  const [activeTab, setActiveTab] = useState("teams"); // 'teams', 'players', 'stats'
  const [searchTerm, setSearchTerm] = useState("");
  const [playerFilter, setPlayerFilter] = useState("all"); // 'all', 'available', 'sold', 'unsold'
  const [roleFilter, setRoleFilter] = useState("all"); // 'all', 'batsman', 'bowler', 'all-rounder', 'wicket-keeper'


  // Celebration states
  const [celebration, setCelebration] = useState(null);
  const [celebrationPlayer, setCelebrationPlayer] = useState(null);
  const celebrationTimeoutRef = useRef(null);
  const fireworksRef = useRef(null);
  const fireworksInstanceRef = useRef(null);
  const previousPlayersRef = useRef({});

  const getInitials = (name) => {
    if (!name) return "";
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 3).toUpperCase();
  };

  // Trigger celebration effect
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

  // Cleanup celebration effects on unmount
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

  // Fireworks effect for sold celebration
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

  useEffect(() => {
    if (!tournamentId) return;

    fetchAll();
    const cleanup = setupSubscriptions();
    return cleanup;
  }, [tournamentId]);

  // Fallback polling in case realtime is blocked (e.g., if Realtime not enabled for anon)
  useEffect(() => {
    if (!tournamentId) return;
    const interval = setInterval(() => {
      fetchAuctionState();
      fetchTeams();
      fetchPlayers();
    }, 5000);
    return () => clearInterval(interval);
  }, [tournamentId]);

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([
        fetchTournament(),
        fetchTeams(),
        fetchPlayers(),
        fetchAuctionState(),
      ]);
    } catch (err) {
      console.error(err);
      setError(
        "Live view is not available right now. Please try again or contact the organizer."
      );
    } finally {
      setLoading(false);
    }
  };

  const setupSubscriptions = () => {
    const teamsSub = supabase
      .channel(`public-view-teams-${tournamentId}`)
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

    const playersSub = supabase
      .channel(`public-view-players-${tournamentId}`)
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

    const auctionSub = supabase
      .channel(`public-view-auction-${tournamentId}`)
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
      teamsSub.unsubscribe();
      playersSub.unsubscribe();
      auctionSub.unsubscribe();
    };
  };

  const fetchTournament = async () => {
    // Use public view to avoid RLS recursion for anon viewers
    const { data, error: fetchError } = await supabase
      .from("public_live_tournaments")
      .select("id, name, description, status")
      .eq("id", tournamentId)
      .single();

    if (fetchError) throw fetchError;
    setTournament(data);
  };

  const fetchTeams = async () => {
    const { data, error: fetchError } = await supabase
      .from("teams")
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("created_at", { ascending: true });

    if (fetchError) throw fetchError;
    setTeams(data || []);
  };

  const fetchPlayers = async () => {
    const { data, error: fetchError } = await supabase
      .from("players")
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("created_at", { ascending: true });

    if (fetchError) throw fetchError;

    // Check for status changes to trigger celebrations
    if (data && data.length > 0) {
      const prevPlayers = previousPlayersRef.current;

      for (const player of data) {
        const prevPlayer = prevPlayers[player.id];
        if (prevPlayer && prevPlayer.status !== player.status) {
          // Status changed!
          if (player.status === "sold" && prevPlayer.status === "available") {
            // Player was sold - fetch fresh team data to get correct buyer
            let team = null;
            if (player.team_id) {
              const { data: teamData } = await supabase
                .from("teams")
                .select("*")
                .eq("id", player.team_id)
                .single();
              team = teamData;
            }

            setCelebrationPlayer({
              player: player,
              bidder: team,
              amount: player.sold_price || player.base_price,
            });
            triggerCelebration("sold", {
              player: player.name,
              team: team?.short_name || team?.name,
              amount: player.sold_price,
            });
          } else if (
            player.status === "unsold" &&
            prevPlayer.status === "available"
          ) {
            // Player went unsold - trigger duck
            setCelebrationPlayer({
              player: player,
              bidder: null,
              amount: player.base_price,
            });
            triggerCelebration("unsold", { player: player.name });
          }
        }
      }

      // Update previous players reference
      previousPlayersRef.current = data.reduce((acc, p) => {
        acc[p.id] = { ...p };
        return acc;
      }, {});
    }

    setPlayers(data || []);
  };

  const fetchAuctionState = async () => {
    const { data, error: fetchError } = await supabase
      .from("auction_state")
      .select("*")
      .eq("tournament_id", tournamentId)
      .single();

    if (fetchError) throw fetchError;
    setAuctionState(data);
  };

  const currentPlayer = useMemo(() => {
    if (!auctionState?.current_player_id) return null;
    return players.find((p) => p.id === auctionState.current_player_id) || null;
  }, [auctionState, players]);

  const highestBidder = useMemo(() => {
    if (!auctionState?.highest_bidder_id) return null;
    return teams.find((t) => t.id === auctionState.highest_bidder_id) || null;
  }, [auctionState, teams]);

  const teamById = useMemo(() => {
    return teams.reduce((acc, team) => {
      acc[team.id] = team;
      return acc;
    }, {});
  }, [teams]);

  const sortedPlayers = useMemo(() => {
    const order = { sold: 0, available: 1, unsold: 2 };
    return [...players].sort((a, b) => {
      const aRank = order[a.status] ?? 99;
      const bRank = order[b.status] ?? 99;
      if (aRank === bRank) return 0;
      return aRank - bRank;
    });
  }, [players]);

  const filteredPlayers = useMemo(() => {
    return sortedPlayers.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = playerFilter === "all" || p.status === playerFilter;
      const matchesRole = roleFilter === "all" || p.role === roleFilter;
      return matchesSearch && matchesFilter && matchesRole;
    });
  }, [sortedPlayers, searchTerm, playerFilter, roleFilter]);

  const recentSolds = useMemo(() => {
    return [...players]
      .filter((p) => p.status === "sold")
      .sort((a, b) => {
        const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
        const dateB = new Date(b.updated_at || b.created_at || 0).getTime();
        return dateB - dateA;
      })
      .slice(0, 4);
  }, [players]);

  const topBuys = useMemo(() => {
    return [...players]
      .filter((p) => p.status === "sold")
      .sort((a, b) => (b.sold_price || 0) - (a.sold_price || 0))
      .slice(0, 5);
  }, [players]);

  const completedLots = useMemo(() => {
    return [...players]
      .filter((p) => p.status === "sold" || p.status === "unsold")
      .sort((a, b) => {
        const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
        const dateB = new Date(b.updated_at || b.created_at || 0).getTime();
        return dateB - dateA;
      });
  }, [players]);

  const getTeamTopBuy = (teamId) => {
    const teamSoldPlayers = players
      .filter((p) => p.team_id === teamId && p.status === "sold")
      .sort((a, b) => (b.sold_price || 0) - (a.sold_price || 0));
    return teamSoldPlayers[0] || null;
  };

  const totalPurse = teams.reduce((sum, t) => sum + (t.total_purse || 0), 0);
  const remainingPurse = teams.reduce(
    (sum, t) => sum + (t.remaining_purse || 0),
    0
  );

  const soldPlayers = useMemo(() => {
    return players.filter((p) => p.status === "sold");
  }, [players]);

  const totalSoldValue = useMemo(() => {
    return soldPlayers.reduce((sum, p) => sum + (p.sold_price || 0), 0);
  }, [soldPlayers]);

  const avgSalePrice = useMemo(() => {
    return soldPlayers.length > 0 ? totalSoldValue / soldPlayers.length : 0;
  }, [soldPlayers, totalSoldValue]);

  const copyPublicLink = async () => {
    const url = `${window.location.origin}/live/${tournamentId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Public live link copied");
    } catch (e) {
      toast.error("Couldn't copy link");
    }
  };

  const isLive = !!auctionState?.is_live;
  const light = theme === "light";
  const isMarquee = currentPlayer?.icon_role && currentPlayer.icon_role !== 'none';

  // Derive auction status for display
  const auctionStatus = useMemo(() => {
    if (tournament?.status === "completed") return "ended";
    if (auctionState?.is_live) return "live";
    return "paused";
  }, [tournament, auctionState]);

  const statusConfig = {
    live: {
      label: "Live",
      icon: "play_circle",
      bgClass: "bg-green-100 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-300 dark:border-green-500/30",
      dotClass: "bg-green-500 animate-pulse"
    },
    paused: {
      label: "Paused",
      icon: "pause_circle",
      bgClass: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30",
      dotClass: "bg-amber-500"
    },
    ended: {
      label: "Ended",
      icon: "stop_circle",
      bgClass: "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/30",
      dotClass: "bg-red-500"
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark text-text-primary dark:text-slate-100">
        <div className="border-3 border-text-primary dark:border-text-secondary-dark bg-background-secondary dark:bg-background-dark p-8 shadow-[4px_4px_0px_var(--border-color)] flex flex-col items-center gap-4">
          <div className="size-10 border-4 border-primary border-t-transparent animate-spin"></div>
          <p className="font-mono text-sm font-bold uppercase tracking-wider">
            Loading live auction stream...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background-light dark:bg-background-dark text-text-primary dark:text-slate-100 px-6 text-center">
        <div className="border-3 border-text-primary dark:border-text-secondary-dark bg-background-secondary dark:bg-background-dark p-8 max-w-md shadow-[6px_6px_0px_var(--border-color)] flex flex-col items-center">
          <div className="size-16 border-2 border-text-primary dark:border-text-secondary-dark bg-accent-crimson/10 text-accent-crimson flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-3xl">error</span>
          </div>
          <h2 className="font-display font-black text-xl uppercase tracking-wider mb-2">LIVE VIEW UNAVAILABLE</h2>
          <p className="font-mono text-xs text-text-secondary dark:text-text-secondary-dark mb-6 leading-relaxed">
            {error}
          </p>
          <button
            onClick={fetchAll}
            className="h-11 px-6 border-2 border-text-primary dark:border-text-secondary-dark bg-primary hover:bg-primary-dark text-white font-display font-bold uppercase tracking-wider shadow-[3px_3px_0px_var(--border-color)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_var(--border-color)] transition-all"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background-light dark:bg-background-dark text-text-primary dark:text-slate-100 min-h-screen flex flex-col overflow-x-hidden transition-colors duration-200">
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
                      celebrationPlayer?.bidder?.color || "#0db9f2"
                    }20`,
                    color: celebrationPlayer?.bidder?.color || "#0db9f2",
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

      <header className="sticky top-0 z-20 h-20 flex-shrink-0 flex items-center justify-between px-4 sm:px-6 border-b-3 border-text-primary dark:border-text-secondary-dark bg-background-light dark:bg-background-dark">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/"
            className="size-10 border-2 border-text-primary dark:border-text-secondary-dark bg-background-light dark:bg-card-dark text-text-primary dark:text-slate-100 flex items-center justify-center hover:bg-background-tertiary transition-all shadow-[2px_2px_0px_var(--border-color)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_var(--border-color)]"
            aria-label="Back"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[9px] font-black uppercase text-accent-crimson tracking-wider">Public View</span>
              <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse"></span>
            </div>
            <h1 className="font-display font-black text-lg sm:text-xl uppercase tracking-tight truncate max-w-[200px] sm:max-w-xs md:max-w-md">
              {tournament?.name}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status Badge */}
          <span
            className={`hidden sm:flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider px-3 py-1.5 border-2 border-text-primary dark:border-text-secondary-dark bg-background-secondary dark:bg-background-dark ${statusConfig[auctionStatus].bgClass}`}
          >
            <span className={`w-2 h-2 rounded-full ${statusConfig[auctionStatus].dotClass}`}></span>
            {statusConfig[auctionStatus].label}
          </span>

          <button
            onClick={() => setTheme(light ? "dark" : "light")}
            className="size-10 border-2 border-text-primary dark:border-text-secondary-dark bg-background-light dark:bg-card-dark text-text-primary dark:text-slate-100 flex items-center justify-center hover:bg-background-tertiary transition-all shadow-[2px_2px_0px_var(--border-color)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_var(--border-color)]"
            aria-label="Toggle theme"
          >
            <span className="material-symbols-outlined text-[20px]">
              {light ? "dark_mode" : "light_mode"}
            </span>
          </button>

          <button
            onClick={copyPublicLink}
            className="h-10 px-4 border-2 border-text-primary dark:border-text-secondary-dark bg-primary hover:bg-primary-dark text-white text-xs font-display font-bold uppercase tracking-wider flex items-center gap-2 shadow-[2px_2px_0px_var(--border-color)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_var(--border-color)] transition-all"
          >
            <span className="material-symbols-outlined text-[16px]">link</span>
            <span className="hidden xs:inline">Share</span>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Mobile Status Bar (visible only on mobile) */}
        <div className="flex sm:hidden items-center justify-between p-3 border-2 border-text-primary dark:border-text-secondary-dark bg-background-secondary dark:bg-background-dark">
          <span className="font-mono text-xs font-bold uppercase text-text-secondary dark:text-text-secondary-dark">Status:</span>
          <span
            className={`flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-1 border border-text-primary dark:border-text-secondary-dark ${statusConfig[auctionStatus].bgClass}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${statusConfig[auctionStatus].dotClass}`}></span>
            {statusConfig[auctionStatus].label}
          </span>
        </div>

        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT COLUMN: Active Lot Board & Recent Sales */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-6">
            
            {/* Active Lot Display */}
            {auctionStatus === "paused" ? (
              <div className="border-3 border-dashed border-text-primary dark:border-text-secondary-dark bg-background-light dark:bg-card-dark p-8 text-center shadow-[4px_4px_0px_var(--border-color)] flex flex-col items-center justify-center min-h-[300px]">
                <div className="size-16 border-2 border-text-primary dark:border-text-secondary-dark bg-accent-amber/10 flex items-center justify-center text-accent-amber mb-4">
                  <span className="material-symbols-outlined text-3xl">pause_circle</span>
                </div>
                <h3 className="font-display font-black text-xl uppercase tracking-wider mb-2 text-text-primary dark:text-slate-100">
                  AUCTION STREAM PAUSED
                </h3>
                <p className="text-sm text-text-secondary dark:text-text-secondary-dark max-w-sm">
                  The host has paused the auction stream. Please stand by, updates will appear in real time once resumed.
                </p>
              </div>
            ) : currentPlayer ? (
              <div className={`border-3 bg-background-light dark:bg-card-dark overflow-hidden transition-all ${
                isMarquee 
                  ? "marquee-glow border-amber-500 dark:border-amber-400" 
                  : "border-text-primary dark:border-text-secondary-dark shadow-[6px_6px_0px_var(--border-color)]"
              }`}>
                {/* Header Tag */}
                <div className={`px-4 py-3 text-white border-b-3 border-text-primary dark:border-text-secondary-dark flex items-center justify-between transition-colors ${
                  isMarquee 
                    ? "bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600" 
                    : "bg-accent-crimson"
                }`}>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping"></span>
                    <span className="font-display font-black text-xs uppercase tracking-widest flex items-center gap-1">
                      {isMarquee ? "★ MARQUEE LOT ON BLOCK" : "ACTIVE LOT ON BLOCK"}
                    </span>
                  </div>
                  <span className="font-mono text-xs font-bold uppercase bg-white/20 px-2 py-0.5">
                    {currentPlayer.role?.replace("-", " ")}
                  </span>
                </div>

                <div className="flex flex-col md:flex-row border-b-3 border-text-primary dark:border-text-secondary-dark">
                  {/* Photo Section */}
                  <div className={`relative w-full md:w-56 h-56 md:h-auto min-h-[224px] border-b-3 md:border-b-0 md:border-r-3 border-text-primary dark:border-text-secondary-dark flex items-center justify-center overflow-hidden transition-all ${
                    isMarquee
                      ? "bg-gradient-to-br from-amber-500/20 via-yellow-500/10 to-transparent"
                      : "bg-gradient-to-br from-primary/10 to-transparent"
                  }`}>
                    {currentPlayer.photo_url ? (
                      <img
                        src={currentPlayer.photo_url}
                        alt={currentPlayer.name}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-5xl font-display font-black text-text-secondary/20 uppercase">
                        {getInitials(currentPlayer.name)}
                      </span>
                    )}
                    <div className="absolute top-2 left-2 px-2 py-1 border-2 border-text-primary dark:border-text-secondary-dark bg-background-light dark:bg-card-dark font-mono text-[10px] font-black uppercase">
                      LOT #{currentPlayer.id.slice(0, 5)}
                    </div>
                    {isMarquee && (
                      <div className="absolute top-2 right-2 px-2 py-0.5 bg-amber-500 text-white font-mono text-[8px] font-black uppercase tracking-wider border border-white/30 shadow-[1px_1px_0px_rgba(0,0,0,1)]">
                        MARQUEE
                      </div>
                    )}
                  </div>

                  {/* Info / Bidding Section */}
                  <div className="flex-1 p-6 flex flex-col justify-between gap-6">
                    <div>
                      <h2 className="font-display font-black text-3xl uppercase tracking-tight leading-none mb-2 text-text-primary dark:text-slate-100">
                        {currentPlayer.name}
                      </h2>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 border border-text-primary dark:border-text-secondary-dark text-xs font-mono font-bold uppercase ${
                          currentPlayer.role === "batsman" ? "bg-blue-500/10 text-blue-500 font-bold" :
                          currentPlayer.role === "bowler" ? "bg-green-500/10 text-green-500 font-bold" :
                          currentPlayer.role === "all-rounder" ? "bg-orange-500/10 text-orange-500 font-bold" :
                          "bg-purple-500/10 text-purple-500 font-bold"
                        }`}>
                          {currentPlayer.role?.replace("-", " ")}
                        </span>
                        <span className="font-mono text-xs text-text-secondary dark:text-text-secondary-dark font-semibold">
                          BASE PRICE: {formatCurrency(currentPlayer.base_price)}
                        </span>
                      </div>
                    </div>

                    {/* Broadcast Bid Board */}
                    <div className="border-2 border-text-primary dark:border-text-secondary-dark bg-background-secondary dark:bg-background-dark p-4 shadow-[4px_4px_0px_var(--border-color)]">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                          <p className="text-[10px] font-mono font-bold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wider">
                            {highestBidder ? "CURRENT HIGHEST BID" : "OPENING BID"}
                          </p>
                          <p className="font-mono text-3xl sm:text-4xl font-black text-accent-green leading-none mt-1">
                            {formatCurrency(auctionState?.highest_bid || currentPlayer.base_price || 0)}
                          </p>
                        </div>
                        {highestBidder && (
                          <div className="flex items-center gap-2 md:border-l-2 md:border-text-primary md:dark:border-text-secondary-dark md:pl-4">
                            <div
                              className="size-10 border-2 border-text-primary dark:border-text-secondary-dark flex items-center justify-center font-black text-sm uppercase"
                              style={{
                                backgroundColor: `${highestBidder.color || "#2563eb"}20`,
                                color: highestBidder.color || "#2563eb",
                              }}
                            >
                              {highestBidder.logo_url ? (
                                <img src={highestBidder.logo_url} alt={highestBidder.name} className="size-full object-cover" />
                              ) : (
                                highestBidder.short_name?.slice(0, 3) || "TM"
                              )}
                            </div>
                            <div>
                              <p className="text-[9px] font-mono font-bold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wider">
                                LEADING BIDDER
                              </p>
                              <p className="font-display font-extrabold text-sm uppercase tracking-wide truncate max-w-[150px]">
                                {highestBidder.name}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="border-3 border-dashed border-text-primary dark:border-text-secondary-dark bg-background-light dark:bg-card-dark p-8 text-center shadow-[4px_4px_0px_var(--border-color)] flex flex-col items-center justify-center min-h-[300px]">
                <div className="size-16 border-2 border-text-primary dark:border-text-secondary-dark bg-accent-amber/10 flex items-center justify-center text-accent-amber mb-4">
                  <span className="material-symbols-outlined text-3xl animate-bounce">hourglass_empty</span>
                </div>
                <h3 className="font-display font-black text-xl uppercase tracking-wider mb-2 text-text-primary dark:text-slate-100">
                  WAITING FOR NEXT LOT
                </h3>
                <p className="text-sm text-text-secondary dark:text-text-secondary-dark max-w-sm">
                  The auction organizer will select and present the next player shortly. Keep this page open to watch live bids.
                </p>
              </div>
            )}

            {/* Live Auction Timeline */}
            <div className="border-2 border-text-primary dark:border-text-secondary-dark bg-background-light dark:bg-card-dark p-5 shadow-[4px_4px_0px_var(--border-color)]">
              <h3 className="font-display font-black text-sm uppercase tracking-widest mb-4 flex items-center gap-2 text-text-primary dark:text-slate-100">
                <span className="material-symbols-outlined text-[18px] text-accent-green">rss_feed</span>
                LIVE AUCTION TIMELINE
              </h3>
              
              {completedLots.length === 0 ? (
                <div className="p-4 border border-dashed border-text-primary dark:border-text-secondary-dark text-center font-mono text-xs text-text-secondary dark:text-text-secondary-dark bg-background-secondary dark:bg-background-dark">
                  NO AUCTION ACTIVITY RECORDED YET.
                </div>
              ) : (
                <div className="relative pl-6 border-l-2 border-text-primary/30 dark:border-text-secondary-dark/30 space-y-4 max-h-[300px] overflow-y-auto pr-2">
                  {completedLots.map((p) => {
                    const team = teamById[p.team_id];
                    const isSold = p.status === "sold";
                    return (
                      <div key={p.id} className="relative">
                        {/* Timeline Node Icon */}
                        <span className={`absolute -left-[31px] top-1 size-4 border-2 border-text-primary dark:border-text-secondary-dark flex items-center justify-center text-[8px] font-bold ${
                          isSold ? "bg-accent-green text-white" : "bg-accent-amber text-white"
                        }`}>
                        </span>
                        
                        <div className="border border-text-primary dark:border-text-secondary-dark bg-background-secondary dark:bg-background-dark p-3 shadow-[1px_1px_0px_var(--border-color)]">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className={`text-[8px] font-mono font-bold uppercase px-1 border ${
                              isSold ? "bg-green-500/10 text-green-500 border-green-500/30" : "bg-amber-500/10 text-amber-500 border-amber-500/30"
                            }`}>
                              {p.status}
                            </span>
                            <span className="text-[9px] font-mono text-text-secondary dark:text-text-secondary-dark font-medium">
                              LOT #{p.id.slice(0, 5)}
                            </span>
                          </div>
                          
                          <p className="font-display font-extrabold text-xs uppercase text-text-primary dark:text-slate-100 mt-1 leading-snug">
                            {isSold ? (
                              <span>
                                {p.name} SOLD TO <span className="text-primary">{team?.name || "TEAM"}</span> FOR <span className="text-accent-green">{formatCurrency(p.sold_price || 0)}</span>
                              </span>
                            ) : (
                              <span>
                                {p.name} WENT UNSOLD AT BASE PRICE <span className="text-accent-amber">{formatCurrency(p.base_price || 0)}</span>
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Interactive Dashboard Tabs */}
          <div className="lg:col-span-5 xl:col-span-4 flex flex-col">
            <div className="border-2 border-text-primary dark:border-text-secondary-dark bg-background-light dark:bg-card-dark shadow-[4px_4px_0px_var(--border-color)] overflow-hidden flex flex-col h-full">
              {/* Tab Bar */}
              <div className="flex border-b-2 border-text-primary dark:border-text-secondary-dark">
                <button
                  onClick={() => setActiveTab("teams")}
                  className={`flex-1 py-3 font-display font-black text-[10px] sm:text-xs uppercase tracking-wider border-r border-text-primary dark:border-text-secondary-dark transition-all ${
                    activeTab === "teams"
                      ? "bg-primary text-white"
                      : "bg-background-light dark:bg-card-dark hover:bg-background-tertiary text-text-primary dark:text-slate-100"
                  }`}
                >
                  Teams
                </button>
                <button
                  onClick={() => setActiveTab("players")}
                  className={`flex-1 py-3 font-display font-black text-[10px] sm:text-xs uppercase tracking-wider border-r border-text-primary dark:border-text-secondary-dark transition-all ${
                    activeTab === "players"
                      ? "bg-primary text-white"
                      : "bg-background-light dark:bg-card-dark hover:bg-background-tertiary text-text-primary dark:text-slate-100"
                  }`}
                >
                  Player Pool
                </button>
                <button
                  onClick={() => setActiveTab("leaderboard")}
                  className={`flex-1 py-3 font-display font-black text-[10px] sm:text-xs uppercase tracking-wider transition-all ${
                    activeTab === "leaderboard"
                      ? "bg-primary text-white"
                      : "bg-background-light dark:bg-card-dark hover:bg-background-tertiary text-text-primary dark:text-slate-100"
                  }`}
                >
                  Leaderboard
                </button>
              </div>

              {/* Tab Content Panel */}
              <div className="p-4 overflow-y-auto max-h-[500px] lg:max-h-[600px] flex-1">
                
                {/* TEAMS TAB */}
                {activeTab === "teams" && (
                  <div className="space-y-3">
                    {teams.length === 0 ? (
                      <p className="text-sm font-mono text-text-secondary dark:text-text-secondary-dark py-4 text-center">
                        NO TEAMS REGISTERED YET.
                      </p>
                    ) : (
                      teams.map((team) => {
                        const filled = team.total_purse
                          ? Math.max(
                              0,
                              Math.min(
                                100,
                                ((team.total_purse - (team.remaining_purse || 0)) /
                                  team.total_purse) *
                                  100
                              )
                            )
                          : 0;
                        return (
                          <details
                            key={team.id}
                            className="border-2 border-text-primary dark:border-text-secondary-dark bg-background-light dark:bg-card-dark shadow-[2px_2px_0px_var(--border-color)] group open:shadow-[1px_1px_0px_var(--border-color)] open:translate-x-[1px] open:translate-y-[1px] transition-all"
                          >
                            <summary className="flex items-center justify-between p-3 cursor-pointer select-none">
                              <div className="flex items-center gap-3 min-w-0">
                                <div
                                  className="size-10 border-2 border-text-primary dark:border-text-secondary-dark flex items-center justify-center font-black text-xs uppercase"
                                  style={{
                                    backgroundColor: `${team.color || "#0db9f2"}15`,
                                    color: team.color || "#0db9f2",
                                  }}
                                >
                                  {team.logo_url ? (
                                    <img
                                      src={team.logo_url}
                                      alt={team.name}
                                      className="size-full object-cover"
                                    />
                                  ) : (
                                    team.short_name?.slice(0, 3) || "TM"
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-display font-extrabold text-sm uppercase tracking-wide truncate text-text-primary dark:text-slate-100">
                                    {team.name}
                                  </p>
                                  <p className="text-[10px] font-mono text-text-secondary dark:text-text-secondary-dark">
                                    PURSE: {formatShortCurrency(team.remaining_purse || 0)} LEFT
                                  </p>
                                </div>
                              </div>
                              <span className="material-symbols-outlined transition-transform duration-200 group-open:rotate-180 text-text-secondary dark:text-text-secondary-dark">
                                expand_more
                              </span>
                            </summary>
                            <div className="p-3 border-t border-text-primary dark:border-text-secondary-dark bg-background-secondary dark:bg-background-dark space-y-3">
                              {/* Budget Progress Bar */}
                              <div className="space-y-1">
                                <div className="flex justify-between text-[9px] font-mono text-text-secondary dark:text-text-secondary-dark uppercase font-bold">
                                  <span>Spent Purse</span>
                                  <span>{Math.round(filled)}%</span>
                                </div>
                                <div className="w-full h-2.5 border border-text-primary dark:border-text-secondary-dark bg-background-light dark:bg-card-dark overflow-hidden">
                                  <div
                                    className="h-full bg-primary transition-all duration-300"
                                    style={{ width: `${filled}%` }}
                                  ></div>
                                </div>
                              </div>

                              {/* Squad Balance Badges */}
                              {(() => {
                                const teamSquad = players.filter(
                                  (p) => p.team_id === team.id && p.status === "sold"
                                );
                                const bat = teamSquad.filter((p) => p.role === "batsman").length;
                                const bowl = teamSquad.filter((p) => p.role === "bowler").length;
                                const ar = teamSquad.filter((p) => p.role === "all-rounder").length;
                                const wk = teamSquad.filter((p) => p.role === "wicket-keeper").length;
                                return (
                                  <div className="flex flex-wrap gap-1.5">
                                    <span className="px-1.5 py-0.5 border border-text-primary dark:border-text-secondary-dark bg-blue-500/15 text-blue-600 dark:text-blue-400 font-mono text-[9px] font-bold">
                                      BAT: {bat}
                                    </span>
                                    <span className="px-1.5 py-0.5 border border-text-primary dark:border-text-secondary-dark bg-green-500/15 text-green-600 dark:text-green-400 font-mono text-[9px] font-bold">
                                      BOWL: {bowl}
                                    </span>
                                    <span className="px-1.5 py-0.5 border border-text-primary dark:border-text-secondary-dark bg-orange-500/15 text-orange-600 dark:text-orange-400 font-mono text-[9px] font-bold">
                                      AR: {ar}
                                    </span>
                                    <span className="px-1.5 py-0.5 border border-text-primary dark:border-text-secondary-dark bg-purple-500/15 text-purple-600 dark:text-purple-400 font-mono text-[9px] font-bold">
                                      WK: {wk}
                                    </span>
                                  </div>
                                );
                              })()}

                              <SquadList players={players} teamId={team.id} />
                            </div>
                          </details>
                        );
                      })
                    )}
                  </div>
                )}

                {/* PLAYER POOL TAB */}
                {activeTab === "players" && (
                  <div className="space-y-4">
                    {/* Search and Filters */}
                    <div className="space-y-2">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary dark:text-text-secondary-dark material-symbols-outlined text-[18px]">
                          search
                        </span>
                        <input
                          type="text"
                          placeholder="Search players..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full h-9 pl-9 pr-4 border-2 border-text-primary dark:border-text-secondary-dark bg-background-light dark:bg-card-dark text-text-primary dark:text-slate-100 placeholder:text-text-secondary/50 font-mono text-xs tracking-tight focus:outline-none focus:border-primary transition-colors shadow-[2px_2px_0px_var(--border-color)]"
                        />
                      </div>
                      <div className="grid grid-cols-4 gap-1">
                        {["all", "available", "sold", "unsold"].map((f) => (
                          <button
                            key={f}
                            onClick={() => setPlayerFilter(f)}
                            className={`py-1 text-[9px] font-mono font-bold uppercase border border-text-primary dark:border-text-secondary-dark transition-all ${
                              playerFilter === f
                                ? "bg-primary text-white"
                                : "bg-background-light dark:bg-card-dark hover:bg-background-tertiary text-text-secondary dark:text-text-secondary-dark"
                            }`}
                          >
                            {f}
                          </button>
                        ))}
                      </div>

                      {/* Role Filters */}
                      <div className="grid grid-cols-5 gap-1">
                        {[
                          { id: "all", label: "All" },
                          { id: "batsman", label: "Bat" },
                          { id: "bowler", label: "Bowl" },
                          { id: "all-rounder", label: "AR" },
                          { id: "wicket-keeper", label: "WK" }
                        ].map((r) => (
                          <button
                            key={r.id}
                            onClick={() => setRoleFilter(r.id)}
                            className={`py-1 text-[9px] font-mono font-bold uppercase border border-text-primary dark:border-text-secondary-dark transition-all ${
                              roleFilter === r.id
                                ? "bg-primary text-white"
                                : "bg-background-light dark:bg-card-dark hover:bg-background-tertiary text-text-secondary dark:text-text-secondary-dark"
                            }`}
                          >
                            {r.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Players List */}
                    <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                      {filteredPlayers.length === 0 ? (
                        <p className="text-xs font-mono text-text-secondary dark:text-text-secondary-dark py-4 text-center">
                          NO MATCHING PLAYERS.
                        </p>
                      ) : (
                        filteredPlayers.map((player) => {
                          const sold = player.status === "sold";
                          const unsold = player.status === "unsold";
                          const team = sold ? teamById[player.team_id] : null;
                          return (
                            <div
                              key={player.id}
                              className="border border-text-primary dark:border-text-secondary-dark bg-background-secondary dark:bg-background-dark p-2 flex items-center justify-between gap-3"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="size-8 border border-text-primary dark:border-text-secondary-dark bg-background-light dark:bg-card-dark flex items-center justify-center overflow-hidden flex-shrink-0">
                                  {player.photo_url ? (
                                    <img
                                      src={player.photo_url}
                                      alt={player.name}
                                      className="size-full object-cover"
                                    />
                                  ) : (
                                    <span className="material-symbols-outlined text-slate-500 dark:text-text-secondary text-[16px]">
                                      person
                                    </span>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-display font-bold text-xs uppercase truncate text-text-primary dark:text-slate-100">
                                    {player.name}
                                  </p>
                                  <p className="text-[9px] font-mono text-text-secondary dark:text-text-secondary-dark uppercase">
                                    {player.role?.replace("-", " ")}
                                  </p>
                                </div>
                              </div>

                              <div className="text-right flex-shrink-0">
                                <span
                                  className={`inline-block px-1.5 py-0.5 border text-[8px] font-mono font-bold uppercase tracking-wider mb-1 ${
                                    sold
                                      ? "bg-green-500/10 text-green-500 border-green-500/30"
                                      : unsold
                                      ? "bg-amber-500/10 text-amber-500 border-amber-500/30"
                                      : "bg-blue-500/10 text-blue-500 border-blue-500/30"
                                  }`}
                                >
                                  {player.status}
                                </span>
                                <p className="font-mono text-[10px] font-bold text-text-primary dark:text-slate-100">
                                  {sold
                                    ? formatShortCurrency(player.sold_price || 0)
                                    : formatShortCurrency(player.base_price || 0)}
                                </p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* LEADERBOARD TAB */}
                {activeTab === "leaderboard" && (
                  <div className="space-y-4">
                    {/* Standings Table */}
                    <div className="border-2 border-text-primary dark:border-text-secondary-dark bg-background-secondary dark:bg-background-dark overflow-hidden shadow-[2px_2px_0px_var(--border-color)]">
                      <table className="w-full text-left border-collapse font-mono text-xs">
                        <thead>
                          <tr className="border-b-2 border-text-primary dark:border-text-secondary-dark bg-background-light dark:bg-card-dark font-display font-black uppercase tracking-wider text-[9px] sm:text-[10px]">
                            <th className="p-3">Team</th>
                            <th className="p-3 text-center">Squad</th>
                            <th className="p-3 text-right">Spent</th>
                            <th className="p-3 text-right">Purse</th>
                          </tr>
                        </thead>
                        <tbody>
                          {teams.map((team) => {
                            const teamSquad = players.filter((p) => p.team_id === team.id && p.status === "sold");
                            const spent = (team.total_purse || 0) - (team.remaining_purse || 0);
                            return (
                              <tr key={team.id} className="border-b border-text-primary/20 dark:border-text-secondary-dark/20 hover:bg-background-light dark:hover:bg-card-dark transition-colors">
                                <td className="p-3 font-display font-black uppercase tracking-wider flex items-center gap-1.5 truncate max-w-[80px] sm:max-w-none">
                                  <span className="w-2 h-2 border border-text-primary dark:border-text-secondary-dark inline-block flex-shrink-0" style={{ backgroundColor: team.color || "#0db9f2" }}></span>
                                  {team.short_name || team.name.slice(0, 3)}
                                </td>
                                <td className="p-3 text-center font-bold">{teamSquad.length}</td>
                                <td className="p-3 text-right font-bold text-accent-green">{formatShortCurrency(spent)}</td>
                                <td className="p-3 text-right font-bold text-text-primary dark:text-slate-100">{formatShortCurrency(team.remaining_purse || 0)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Team Standings Summary details */}
                    <div className="border border-text-primary dark:border-text-secondary-dark bg-background-secondary dark:bg-background-dark p-3 space-y-2">
                      <p className="text-[10px] font-mono font-bold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wider">
                        Purse statistics
                      </p>
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-text-secondary dark:text-text-secondary-dark">Total purse:</span>
                        <span className="font-bold text-text-primary dark:text-slate-100">{formatShortCurrency(totalPurse)}</span>
                      </div>
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-text-secondary dark:text-text-secondary-dark">Spent purse:</span>
                        <span className="font-bold text-accent-green">{formatShortCurrency(totalPurse - remainingPurse)}</span>
                      </div>
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-text-secondary dark:text-text-secondary-dark">Average price:</span>
                        <span className="font-bold text-accent-cobalt">{formatShortCurrency(avgSalePrice)}</span>
                      </div>
                    </div>

                    {/* Top buys */}
                    {topBuys.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-mono font-bold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wider">
                          ★ Top Signings
                        </p>
                        <div className="space-y-1.5">
                          {topBuys.map((p, idx) => {
                            const team = teamById[p.team_id];
                            return (
                              <div key={p.id} className="border border-text-primary dark:border-text-secondary-dark bg-background-secondary dark:bg-background-dark p-2 flex items-center justify-between text-xs shadow-[1px_1px_0px_var(--border-color)]">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="font-mono font-black text-accent-crimson">#{idx + 1}</span>
                                  <div className="min-w-0">
                                    <p className="font-display font-bold uppercase truncate text-text-primary dark:text-slate-100">{p.name}</p>
                                    <p className="text-[9px] font-mono text-text-secondary dark:text-text-secondary-dark uppercase">{team?.short_name || "TEAM"}</p>
                                  </div>
                                </div>
                                <span className="font-mono font-black text-accent-green">{formatShortCurrency(p.sold_price || 0)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
};

const SquadList = ({ players, teamId }) => {
  const squad = players.filter(
    (p) => p.team_id === teamId && p.status === "sold"
  );
  if (squad.length === 0) {
    return (
      <p className="text-[10px] font-mono text-text-secondary dark:text-text-secondary-dark py-1">
        NO PLAYERS BOUGHT YET.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {squad.map((player) => (
        <div
          key={player.id}
          className="border border-text-primary dark:border-text-secondary-dark bg-background-light dark:bg-card-dark p-2 flex items-center gap-2.5"
        >
          <div className="size-8 border border-text-primary dark:border-text-secondary-dark bg-background-secondary dark:bg-background-dark flex items-center justify-center overflow-hidden flex-shrink-0">
            {player.photo_url ? (
              <img
                src={player.photo_url}
                alt={player.name}
                className="size-full object-cover"
              />
            ) : (
              <span className="material-symbols-outlined text-slate-500 dark:text-text-secondary text-[16px]">
                person
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display font-bold text-xs uppercase truncate text-text-primary dark:text-slate-100">{player.name}</p>
            <div className="flex items-center justify-between text-[9px] font-mono text-text-secondary dark:text-text-secondary-dark">
              <span>{player.role?.replace("-", " ")}</span>
              <span className="font-bold text-accent-green">
                {formatShortCurrency(player.sold_price || player.base_price || 0)}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default LiveAuction;
