import { useEffect, useMemo, useState, useRef } from "react";
import { Fireworks } from "fireworks-js";
import { Link, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { supabase, formatShortCurrency, formatCurrency } from "../lib/supabase";

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
  const [theme, setTheme] = useState("dark");

  // Celebration states
  const [celebration, setCelebration] = useState(null);
  const [celebrationPlayer, setCelebrationPlayer] = useState(null);
  const celebrationTimeoutRef = useRef(null);
  const fireworksRef = useRef(null);
  const fireworksInstanceRef = useRef(null);
  const previousPlayersRef = useRef({});

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
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

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

  const totalPurse = teams.reduce((sum, t) => sum + (t.total_purse || 0), 0);
  const remainingPurse = teams.reduce(
    (sum, t) => sum + (t.remaining_purse || 0),
    0
  );

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
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-900 dark:bg-background-dark dark:text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="size-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-slate-600 dark:text-text-secondary">
            Loading live auction...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-900 dark:bg-background-dark dark:text-white px-6 text-center">
        <div className="size-16 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mb-4 dark:bg-red-500/10 dark:text-red-300">
          <span className="material-symbols-outlined text-3xl">error</span>
        </div>
        <p className="text-lg font-bold mb-2">Live view unavailable</p>
        <p className="text-sm text-slate-600 dark:text-text-secondary max-w-md mb-4">
          {error}
        </p>
        <button
          onClick={fetchAll}
          className="h-11 px-5 rounded-xl bg-sky-500 text-white font-bold shadow hover:bg-sky-600"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div
      className={
        light
          ? "min-h-screen bg-slate-50 text-slate-900"
          : "min-h-screen bg-background-dark text-white"
      }
    >
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

      <header className="sticky top-0 z-20 backdrop-blur bg-white/80 dark:bg-background-dark/80 border-b border-slate-200 dark:border-[#283539] px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/"
            className="size-10 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center hover:bg-slate-300 dark:bg-[#1c2e35] dark:text-white"
            aria-label="Back"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.18em] font-semibold text-slate-500 dark:text-text-secondary">
              Live Auction
            </p>
            <h1 className="text-lg font-black truncate">{tournament?.name}</h1>
            <p className="text-xs text-slate-500 dark:text-text-secondary truncate">
              {tournament?.description || "View-only live stream"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Auction Status Badge */}
          <span
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border ${statusConfig[auctionStatus].bgClass}`}
          >
            <span className={`w-2 h-2 rounded-full ${statusConfig[auctionStatus].dotClass}`}></span>
            {statusConfig[auctionStatus].label}
          </span>
          <button
            onClick={() => setTheme(light ? "dark" : "light")}
            className="size-10 rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-100 dark:bg-[#1c2e35] dark:border-[#283539] dark:text-white"
            aria-label="Toggle theme"
          >
            <span className="material-symbols-outlined text-[20px]">
              {light ? "dark_mode" : "light_mode"}
            </span>
          </button>
          <button
            onClick={copyPublicLink}
            className="h-10 px-4 rounded-xl bg-sky-500 text-white font-semibold shadow hover:bg-sky-600 flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">link</span>
            Share
          </button>
        </div>
      </header>

      <main className="p-4 sm:p-6 space-y-4 max-w-5xl mx-auto">
        {/* Status summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div
            className={`${
              light
                ? "bg-white border-slate-200"
                : "bg-card-dark border-[#283539]"
            } rounded-2xl border p-4 shadow-sm`}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-slate-600 dark:text-text-secondary">
                Auction status
              </p>
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700 dark:bg-[#1c2e35] dark:text-white border border-slate-200 dark:border-[#283539]">
                {auctionState?.current_player_id ? "In Progress" : "Waiting"}
              </span>
            </div>
            <p className="text-2xl font-black mb-2">
              {isLive ? "Live now" : "Not started"}
            </p>
            <p className="text-sm text-slate-500 dark:text-text-secondary">
              Watch bids update in real time. Managers control the auction.
            </p>
          </div>

          <div
            className={`${
              light
                ? "bg-white border-slate-200"
                : "bg-card-dark border-[#283539]"
            } rounded-2xl border p-4 shadow-sm flex flex-col gap-2`}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-600 dark:text-text-secondary">
                Purse overview
              </p>
              <span className="text-xs text-slate-500 dark:text-text-secondary">
                {teams.length} teams
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600 dark:text-text-secondary">
                Total purse
              </span>
              <span className="font-bold">{formatCurrency(totalPurse)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600 dark:text-text-secondary">
                Remaining purse
              </span>
              <span className="font-bold">
                {formatCurrency(remainingPurse)}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-[#1c2e35] overflow-hidden">
              <div
                className="h-full bg-sky-500"
                style={{
                  width: `${
                    totalPurse
                      ? Math.max(
                          0,
                          Math.min(100, (remainingPurse / totalPurse) * 100)
                        )
                      : 0
                  }%`,
                }}
              ></div>
            </div>
          </div>
        </div>

        {/* Current lot */}
        <div
          className={`${
            light
              ? "bg-white border-slate-200"
              : "bg-card-dark border-[#283539]"
          } rounded-2xl border p-4 shadow-sm`}
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500 dark:text-text-secondary font-semibold">
                Current player
              </p>
              <h2 className="text-xl font-black">
                {currentPlayer?.name || "Waiting for next player"}
              </h2>
            </div>
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full border ${
                currentPlayer
                  ? "bg-green-100 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-300 dark:border-green-500/30"
                  : "bg-slate-100 text-slate-700 border-slate-200 dark:bg-[#1c2e35] dark:text-text-secondary dark:border-[#283539]"
              }`}
            >
              {currentPlayer ? "On the block" : "Idle"}
            </span>
          </div>

          {currentPlayer ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
              <div className="flex items-center gap-3">
                <div className="size-16 rounded-2xl bg-slate-100 flex items-center justify-center overflow-hidden dark:bg-[#1c2e35]">
                  {currentPlayer.photo_url ? (
                    <img
                      src={currentPlayer.photo_url}
                      alt={currentPlayer.name}
                      className="size-full object-cover"
                    />
                  ) : (
                    <span className="material-symbols-outlined text-3xl text-slate-500 dark:text-text-secondary">
                      person
                    </span>
                  )}
                </div>
                <div>
                  <p className="font-bold text-lg leading-tight">
                    {currentPlayer.name}
                  </p>
                  <div className="flex items-center gap-2 text-sm">
                    <span
                      className={`px-2 py-1 rounded-full border text-xs font-semibold ${
                        roleStyles[currentPlayer.role] ||
                        "bg-slate-100 text-slate-700 border-slate-200"
                      }`}
                    >
                      {currentPlayer.role?.replace("-", " ")}
                    </span>
                    <span className="text-slate-500 dark:text-text-secondary">
                      Base {formatShortCurrency(currentPlayer.base_price)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 dark:bg-[#16262c] dark:border-[#283539]">
                <p className="text-xs text-slate-500 dark:text-text-secondary mb-1 font-semibold">
                  Highest bid
                </p>
                <p className="text-2xl font-black">
                  {formatCurrency(
                    auctionState?.highest_bid || currentPlayer.base_price || 0
                  )}
                </p>
                <p className="text-xs text-slate-500 dark:text-text-secondary">
                  by {highestBidder?.name || "—"}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 dark:bg-[#16262c] dark:border-[#283539]">
                <p className="text-xs text-slate-500 dark:text-text-secondary mb-1 font-semibold">
                  Team purse remaining
                </p>
                <p className="text-lg font-bold">
                  {highestBidder
                    ? formatCurrency(highestBidder.remaining_purse || 0)
                    : "—"}
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-600 dark:bg-[#16262c] dark:border-[#283539] dark:text-text-secondary">
              The auction manager will start the next player soon. Keep this
              page open to watch live bids.
            </div>
          )}
        </div>

        {/* Player list */}
        <div
          className={`${
            light
              ? "bg-white border-slate-200"
              : "bg-card-dark border-[#283539]"
          } rounded-2xl border p-4 shadow-sm space-y-3`}
        >
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500 dark:text-text-secondary font-semibold">
                Players
              </p>
              <h3 className="text-lg font-black">Sold / available / unsold</h3>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-full bg-green-100 text-green-700 border border-green-200 dark:bg-green-500/10 dark:text-green-300 dark:border-green-500/30">
                Sold {players.filter((p) => p.status === "sold").length}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 border border-blue-200 dark:bg-sky-500/10 dark:text-sky-200 dark:border-sky-500/30">
                Available{" "}
                {players.filter((p) => p.status === "available").length}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200 dark:bg-yellow-500/10 dark:text-yellow-200 dark:border-yellow-500/30">
                Unsold {players.filter((p) => p.status === "unsold").length}
              </span>
            </div>
          </div>

          {players.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-text-secondary">
              Players will appear here once added.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {sortedPlayers.map((player) => {
                const sold = player.status === "sold";
                const unsold = player.status === "unsold";
                const team = sold ? teamById[player.team_id] : null;
                return (
                  <div
                    key={player.id}
                    className={`${
                      light
                        ? "bg-slate-50 border-slate-200"
                        : "bg-[#16262c] border-[#283539]"
                    } border rounded-xl p-3 flex items-start gap-3`}
                  >
                    <div className="size-10 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden dark:bg-[#1c2e35]">
                      {player.photo_url ? (
                        <img
                          src={player.photo_url}
                          alt={player.name}
                          className="size-full object-cover"
                        />
                      ) : (
                        <span className="material-symbols-outlined text-slate-500 dark:text-text-secondary">
                          person
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold truncate">{player.name}</p>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                            sold
                              ? "bg-green-100 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-300 dark:border-green-500/30"
                              : unsold
                              ? "bg-amber-100 text-amber-700 border-amber-200 dark:bg-yellow-500/10 dark:text-yellow-200 dark:border-yellow-500/30"
                              : "bg-blue-100 text-blue-700 border-blue-200 dark:bg-sky-500/10 dark:text-sky-200 dark:border-sky-500/30"
                          }`}
                        >
                          {sold ? "Sold" : unsold ? "Unsold" : "Available"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span
                          className={`px-2 py-0.5 rounded-full border ${
                            roleStyles[player.role] ||
                            "bg-slate-100 text-slate-700 border-slate-200"
                          }`}
                        >
                          {player.role?.replace("-", " ")}
                        </span>
                        <span className="text-slate-500 dark:text-text-secondary">
                          {sold
                            ? `Sold for ${formatShortCurrency(
                                player.sold_price || player.base_price || 0
                              )}`
                            : `Base ${formatShortCurrency(
                                player.base_price || 0
                              )}`}
                        </span>
                      </div>
                      {sold && (
                        <p className="text-xs text-slate-500 dark:text-text-secondary">
                          Bought by {team?.name || "Team"}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Teams & purse */}
        <div
          className={`${
            light
              ? "bg-white border-slate-200"
              : "bg-card-dark border-[#283539]"
          } rounded-2xl border p-4 shadow-sm space-y-3`}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black">Teams & purse</h3>
            <p className="text-xs text-slate-500 dark:text-text-secondary">
              Tap a team to see its squad
            </p>
          </div>
          <div className="space-y-3">
            {teams.length === 0 && (
              <p className="text-sm text-slate-500 dark:text-text-secondary">
                No teams yet.
              </p>
            )}
            {teams.map((team) => {
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
                  className={`${
                    light
                      ? "bg-slate-50 border-slate-200"
                      : "bg-[#16262c] border-[#283539]"
                  } border rounded-xl p-3`}
                >
                  <summary className="flex items-center justify-between gap-3 cursor-pointer">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="size-12 rounded-xl flex items-center justify-center font-bold text-sm overflow-hidden"
                        style={{
                          backgroundColor: `${team.color || "#0db9f2"}1a`,
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
                          team.short_name?.slice(0, 3) || team.name?.slice(0, 2)
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold truncate">{team.name}</p>
                        <p className="text-xs text-slate-500 dark:text-text-secondary">
                          Remaining{" "}
                          {formatShortCurrency(team.remaining_purse || 0)} /{" "}
                          {formatShortCurrency(team.total_purse || 0)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500 dark:text-text-secondary">
                        Spent
                      </p>
                      <p className="font-bold">
                        {formatShortCurrency(
                          (team.total_purse || 0) - (team.remaining_purse || 0)
                        )}
                      </p>
                    </div>
                  </summary>
                  <div className="mt-3 space-y-2">
                    <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-[#1c2e35] overflow-hidden">
                      <div
                        className="h-full bg-sky-500"
                        style={{ width: `${filled}%` }}
                      ></div>
                    </div>
                    <SquadList players={players} teamId={team.id} />
                  </div>
                </details>
              );
            })}
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
      <p className="text-sm text-slate-500 dark:text-text-secondary">
        No players bought yet.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {squad.map((player) => (
        <div
          key={player.id}
          className="rounded-lg border border-slate-200 bg-white p-3 flex items-center gap-3 dark:bg-[#1c2e35] dark:border-[#283539]"
        >
          <div className="size-10 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden dark:bg-[#283539]">
            {player.photo_url ? (
              <img
                src={player.photo_url}
                alt={player.name}
                className="size-full object-cover"
              />
            ) : (
              <span className="material-symbols-outlined text-slate-500 dark:text-text-secondary">
                person
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{player.name}</p>
            <div className="flex items-center gap-2 text-xs">
              <span
                className={`px-2 py-0.5 rounded-full border ${
                  roleStyles[player.role] ||
                  "bg-slate-100 text-slate-700 border-slate-200"
                }`}
              >
                {player.role?.replace("-", " ")}
              </span>
              <span className="text-slate-500 dark:text-text-secondary">
                {formatShortCurrency(
                  player.sold_price || player.base_price || 0
                )}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default LiveAuction;
