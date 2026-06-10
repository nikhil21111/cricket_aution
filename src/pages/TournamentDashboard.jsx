import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import Sidebar from "../components/Sidebar";
import Modal from "../components/Modal";
import AddTeamForm from "../components/AddTeamForm";
import AddPlayerForm from "../components/AddPlayerForm";
import { formatShortCurrency } from "../lib/supabase";
import toast from "react-hot-toast";

const TournamentDashboard = () => {
  const { id: tournamentId } = useParams();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [tournament, setTournament] = useState(null);
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [auctionState, setAuctionState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [showAddPlayer, setShowAddPlayer] = useState(false);

  useEffect(() => {
    if (!tournamentId) return;
    fetchData();
    const cleanup = setupSubscriptions();
    return () => cleanup?.();
  }, [tournamentId]);

  const setupSubscriptions = () => {
    const teamsSubscription = supabase
      .channel(`teams-${tournamentId}`)
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
      .channel(`players-${tournamentId}`)
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
      .channel(`auction-${tournamentId}`)
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

    if (error || !data) {
      toast.error("Tournament not found");
      navigate("/");
      return;
    }

    // Check if user owns this tournament
    if (data.user_id !== user?.id) {
      toast.error("You do not have access to this tournament");
      navigate("/");
      return;
    }

    setTournament(data);
  };

  const fetchTeams = async () => {
    const { data } = await supabase
      .from("teams")
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("created_at", { ascending: true });
    if (data) setTeams(data);
  };

  const fetchPlayers = async () => {
    const { data } = await supabase
      .from("players")
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("created_at", { ascending: true });
    if (data) setPlayers(data);
  };

  const fetchAuctionState = async () => {
    const { data } = await supabase
      .from("auction_state")
      .select("*")
      .eq("tournament_id", tournamentId)
      .single();
    if (data) setAuctionState(data);
  };

  const updateTournamentCounts = async () => {
    await supabase
      .from("tournaments")
      .update({
        teams_count: teams.length,
        players_count: players.length,
      })
      .eq("id", tournamentId);
  };

  useEffect(() => {
    if (tournament && (teams.length > 0 || players.length > 0)) {
      updateTournamentCounts();
    }
  }, [teams.length, players.length]);

  const copyPublicLink = async () => {
    const url = `${window.location.origin}/live/${tournamentId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Public live link copied");
    } catch (e) {
      toast.error("Couldn't copy link");
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
        return "WK";
      default:
        return role;
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background-light dark:bg-background-dark text-text-primary dark:text-slate-100">
        <div className="flex flex-col items-center gap-4">
          <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-text-secondary dark:text-text-secondary-dark font-mono font-bold uppercase">Loading tournament...</p>
        </div>
      </div>
    );
  }

  const totalPurse = teams.reduce((sum, t) => sum + (t.total_purse || 0), 0);
  const remainingPurse = teams.reduce(
    (sum, t) => sum + (t.remaining_purse || 0),
    0
  );
  const soldPlayers = players.filter((p) => p.status === "sold").length;
  const availablePlayers = players.filter(
    (p) => p.status === "available"
  ).length;

  return (
    <div className="flex h-screen w-full">
      <Sidebar
        auctionState={auctionState}
        tournament={tournament}
        tournamentId={tournamentId}
      />

      <main className="flex-1 flex flex-col h-full overflow-hidden bg-background-light dark:bg-background-dark text-text-primary dark:text-slate-100 relative">
        {/* Header */}
        <header className="h-20 flex-shrink-0 flex items-center justify-between px-6 border-b-3 border-text-primary dark:border-text-secondary-dark bg-background-light dark:bg-background-dark sticky top-0 z-20">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <Link
                to="/"
                className="text-text-secondary hover:text-text-primary dark:hover:text-slate-100 transition-colors"
              >
                <span className="material-symbols-outlined text-xl">
                  arrow_back
                </span>
              </Link>
              <h2 className="text-text-primary dark:text-slate-100 text-2xl font-display font-black tracking-tight uppercase leading-none">
                {tournament?.name}
              </h2>
            </div>
            <p className="text-text-secondary dark:text-text-secondary-dark text-xs font-mono font-bold uppercase mt-1 ml-7">
              Manage teams, players, and auction
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="flex items-center justify-center size-10 border-2 border-text-primary dark:border-text-secondary-dark bg-background-light dark:bg-card-dark text-text-primary dark:text-slate-100 hover:bg-background-tertiary transition-colors shadow-[2px_2px_0px_var(--border-color)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_var(--border-color)]"
              title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
              aria-label="Toggle theme"
            >
              <span className="material-symbols-outlined text-[20px]">
                {theme === "dark" ? "light_mode" : "dark_mode"}
              </span>
            </button>
            <span
              className={`text-xs font-mono font-bold px-3 py-1.5 border-2 ${
                auctionState?.is_live
                  ? "bg-green-500/10 text-green-500 border-green-500"
                  : "bg-yellow-500/10 text-yellow-500 border-yellow-500"
              }`}
            >
              {auctionState?.is_live
                ? "LIVE"
                : tournament?.status?.toUpperCase()}
            </span>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-20">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 max-w-7xl mx-auto">
            {/* Hero Card */}
            <div className="col-span-1 md:col-span-2 relative group overflow-hidden bg-background-light dark:bg-card-dark border-2 border-text-primary dark:border-text-secondary-dark shadow-[4px_4px_0px_var(--border-color)] transition-all hover:shadow-[6px_6px_0px_var(--border-color)] hover:-translate-x-0.5 hover:-translate-y-0.5">
              <div className="relative z-10 p-6 h-full flex flex-col justify-end min-h-[200px]">
                <div className="flex items-start justify-between mb-4">
                  <div className="border-2 border-primary bg-primary/10 p-2 text-primary">
                    <span className="material-symbols-outlined">trophy</span>
                  </div>
                </div>
                <h3 className="text-3xl font-display font-black text-text-primary dark:text-slate-100 mb-2 uppercase leading-tight">
                  {tournament?.name}
                </h3>
                <p className="text-text-secondary dark:text-text-secondary-dark text-sm mb-6 max-w-md">
                  {tournament?.description ||
                    "Add teams, players, and start your live auction."}
                </p>
                <div className="flex flex-wrap gap-2 sm:gap-3">
                  <Link
                    to={`/tournament/${tournamentId}/live`}
                    className="flex items-center justify-center gap-2 h-10 px-4 sm:px-6 border-2 border-text-primary dark:border-text-secondary-dark bg-primary hover:bg-primary-dark text-white text-sm font-display font-bold uppercase tracking-wider shadow-[3px_3px_0px_var(--border-color)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_var(--border-color)] transition-all"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      play_arrow
                    </span>
                    <span className="hidden sm:inline">
                      {auctionState?.is_live ? "View Live" : "Start Auction"}
                    </span>
                    <span className="sm:hidden">
                      {auctionState?.is_live ? "Live" : "Start"}
                    </span>
                  </Link>
                  <button
                    type="button"
                    onClick={copyPublicLink}
                    className="flex items-center justify-center gap-2 h-10 px-3 sm:px-4 border-2 border-text-primary dark:border-text-secondary-dark bg-background-light dark:bg-card-dark hover:bg-background-tertiary text-text-primary dark:text-slate-100 text-sm font-display font-bold uppercase tracking-wider shadow-[3px_3px_0px_var(--border-color)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_var(--border-color)] transition-all"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      link
                    </span>
                    <span className="hidden sm:inline">Copy Live Link</span>
                    <span className="sm:hidden">Copy Link</span>
                  </button>
                  <Link
                    to={`/tournament/${tournamentId}/teams`}
                    className="flex items-center justify-center gap-2 h-10 px-3 sm:px-4 border-2 border-text-primary dark:border-text-secondary-dark bg-background-light dark:bg-card-dark hover:bg-background-tertiary text-text-primary dark:text-slate-100 text-sm font-display font-bold uppercase tracking-wider shadow-[3px_3px_0px_var(--border-color)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_var(--border-color)] transition-all"
                  >
                    <span className="hidden sm:inline">View Teams</span>
                    <span className="sm:hidden">Teams</span>
                  </Link>
                </div>
              </div>
            </div>

            {/* Stats Card: Total Teams */}
            <div className="relative overflow-hidden bg-background-light dark:bg-card-dark border-2 border-text-primary dark:border-text-secondary-dark p-6 flex flex-col justify-between shadow-[4px_4px_0px_var(--border-color)] group">
              <div className="relative z-10 flex justify-between items-start">
                <div className="border border-text-primary dark:border-text-secondary-dark bg-background-secondary dark:bg-background-dark p-2 text-text-primary dark:text-slate-100">
                  <span className="material-symbols-outlined">groups</span>
                </div>
                {teams.length > 0 && (
                  <span className="text-xs font-mono font-bold text-accent-green flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">
                      check_circle
                    </span>
                    ACTIVE
                  </span>
                )}
              </div>
              <div className="relative z-10 mt-4">
                <p className="text-text-secondary dark:text-text-secondary-dark text-xs font-mono font-bold uppercase mb-1">
                  Total Teams
                </p>
                <p className="text-text-primary dark:text-slate-100 text-3xl font-display font-black tracking-tight">
                  {teams.length}
                </p>
              </div>
            </div>

            {/* Stats Card: Total Players */}
            <div className="relative overflow-hidden bg-background-light dark:bg-card-dark border-2 border-text-primary dark:border-text-secondary-dark p-6 flex flex-col justify-between shadow-[4px_4px_0px_var(--border-color)] group">
              <div className="relative z-10 flex justify-between items-start">
                <div className="border border-text-primary dark:border-text-secondary-dark bg-background-secondary dark:bg-background-dark p-2 text-text-primary dark:text-slate-100">
                  <span className="material-symbols-outlined">person</span>
                </div>
                <span className="text-xs font-mono font-bold text-text-secondary dark:text-text-secondary-dark">
                  AVAILABLE: {availablePlayers}
                </span>
              </div>
              <div className="relative z-10 mt-4">
                <p className="text-text-secondary dark:text-text-secondary-dark text-xs font-mono font-bold uppercase mb-1">
                  Total Players
                </p>
                <p className="text-text-primary dark:text-slate-100 text-3xl font-display font-black tracking-tight">
                  {players.length}
                </p>
              </div>
            </div>

            {/* Team Management Card */}
            <div className="relative col-span-1 md:col-span-2 row-span-2 bg-background-light dark:bg-card-dark border-2 border-text-primary dark:border-text-secondary-dark flex flex-col overflow-hidden shadow-[4px_4px_0px_var(--border-color)]">
              <div className="relative z-10 p-5 border-b-2 border-text-primary dark:border-text-secondary-dark flex items-center justify-between bg-background-secondary dark:bg-background-dark">
                <div>
                  <h3 className="text-text-primary dark:text-slate-100 text-lg font-display font-black uppercase">Teams</h3>
                  <p className="text-text-secondary dark:text-text-secondary-dark text-xs font-mono font-medium">
                    Franchises & budgets
                  </p>
                </div>
                <button
                  onClick={() => setShowAddTeam(true)}
                  className="flex items-center justify-center size-9 border-2 border-text-primary dark:border-text-secondary-dark bg-primary hover:bg-primary-dark text-white shadow-[2px_2px_0px_var(--border-color)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[0px_0px_0px_var(--border-color)] transition-all"
                >
                  <span className="material-symbols-outlined">add</span>
                </button>
              </div>
              <div className="relative z-10 flex-1 overflow-y-auto p-3">
                {teams.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-10">
                    <div className="size-14 rounded-xl bg-[#1c2e35] flex items-center justify-center mb-3">
                      <span className="material-symbols-outlined text-2xl text-text-secondary">
                        groups
                      </span>
                    </div>
                    <p className="text-text-secondary text-sm">
                      No teams added yet
                    </p>
                    <button
                      onClick={() => setShowAddTeam(true)}
                      className="mt-3 text-primary text-sm font-medium hover:underline"
                    >
                      Add your first team
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {teams.slice(0, 4).map((team) => (
                      <div
                        key={team.id}
                        className="flex items-center gap-3 p-3 rounded-xl bg-[#1c2e35] hover:bg-[#243d46] transition-colors group"
                      >
                        <div
                          className="size-10 rounded-lg flex items-center justify-center text-text-primary dark:text-slate-100 font-bold text-sm"
                          style={{
                            backgroundColor: team.color + "30",
                            color: team.color,
                          }}
                        >
                          {team.logo_url ? (
                            <img
                              src={team.logo_url}
                              alt={team.name}
                              className="size-full object-cover rounded-lg"
                            />
                          ) : (
                            team.short_name?.slice(0, 2)
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-text-primary dark:text-slate-100 font-display font-bold truncate">
                            {team.name}
                          </p>
                          <p className="text-text-secondary text-xs">
                            {formatShortCurrency(team.remaining_purse)} /{" "}
                            {formatShortCurrency(team.total_purse)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-text-secondary">Players</p>
                          <p className="text-text-primary dark:text-slate-100 font-bold font-mono">
                            {
                              players.filter((p) => p.team_id === team.id)
                                .length
                            }
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {teams.length > 4 && (
                  <Link
                    to={`/tournament/${tournamentId}/teams`}
                    className="block text-center text-primary text-sm font-medium mt-3 hover:underline"
                  >
                    View all {teams.length} teams →
                  </Link>
                )}
                {teams.length > 0 && teams.length <= 4 && (
                  <Link
                    to={`/tournament/${tournamentId}/teams`}
                    className="block text-center text-primary text-sm font-medium mt-3 hover:underline"
                  >
                    Manage all teams →
                  </Link>
                )}
              </div>
            </div>

            {/* Player Pool Card */}
            <div className="relative col-span-1 md:col-span-2 row-span-2 bg-background-light dark:bg-card-dark border-2 border-text-primary dark:border-text-secondary-dark flex flex-col overflow-hidden shadow-[4px_4px_0px_var(--border-color)]">
              <div className="relative z-10 p-5 border-b-2 border-text-primary dark:border-text-secondary-dark flex items-center justify-between bg-background-secondary dark:bg-background-dark">
                <div>
                  <h3 className="text-text-primary dark:text-slate-100 text-lg font-display font-black uppercase">Player Pool</h3>
                  <p className="text-text-secondary dark:text-text-secondary-dark text-xs font-mono font-medium">
                    Available players for auction
                  </p>
                </div>
                <button
                  onClick={() => setShowAddPlayer(true)}
                  className="flex items-center justify-center size-9 border-2 border-text-primary dark:border-text-secondary-dark bg-primary hover:bg-primary-dark text-white shadow-[2px_2px_0px_var(--border-color)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[0px_0px_0px_var(--border-color)] transition-all"
                >
                  <span className="material-symbols-outlined">add</span>
                </button>
              </div>
              <div className="relative z-10 flex-1 overflow-y-auto p-3">
                {players.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-10">
                    <div className="size-14 rounded-xl bg-[#1c2e35] flex items-center justify-center mb-3">
                      <span className="material-symbols-outlined text-2xl text-text-secondary">
                        person
                      </span>
                    </div>
                    <p className="text-text-secondary text-sm">
                      No players added yet
                    </p>
                    <button
                      onClick={() => setShowAddPlayer(true)}
                      className="mt-3 text-primary text-sm font-medium hover:underline"
                    >
                      Add your first player
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {players.slice(0, 8).map((player) => (
                      <div
                        key={player.id}
                        className="flex items-center gap-3 p-3 rounded-xl bg-[#1c2e35] hover:bg-[#243d46] transition-colors"
                      >
                        <div className="size-10 rounded-full bg-[#283539] flex items-center justify-center overflow-hidden">
                          {player.photo_url ? (
                            <img
                              src={player.photo_url}
                              alt={player.name}
                              className="size-full object-cover"
                            />
                          ) : (
                            <span className="material-symbols-outlined text-text-secondary">
                              person
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-text-primary dark:text-slate-100 font-display font-bold truncate text-sm">
                            {player.name}
                          </p>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded border ${getRoleColor(
                                player.role
                              )}`}
                            >
                              {getRoleLabel(player.role)}
                            </span>
                            <span className="text-text-secondary text-xs">
                              {formatShortCurrency(player.base_price)}
                            </span>
                          </div>
                        </div>
                        <span
                          className={`size-2 rounded-full ${
                            player.status === "sold"
                              ? "bg-green-400"
                              : player.status === "unsold"
                              ? "bg-red-400"
                              : "bg-yellow-400"
                          }`}
                        ></span>
                      </div>
                    ))}
                  </div>
                )}
                {players.length > 8 && (
                  <Link
                    to={`/tournament/${tournamentId}/players`}
                    className="block text-center text-primary text-sm font-medium mt-3 hover:underline"
                  >
                    View all {players.length} players →
                  </Link>
                )}
                {players.length > 0 && players.length <= 8 && (
                  <Link
                    to={`/tournament/${tournamentId}/players`}
                    className="block text-center text-primary text-sm font-medium mt-3 hover:underline"
                  >
                    Manage all players →
                  </Link>
                )}
              </div>
            </div>
          </div>


        </div>
      </main>

      {/* Add Team Modal */}
      {showAddTeam && (
        <Modal
          isOpen={true}
          onClose={() => setShowAddTeam(false)}
          title="Add Team"
        >
          <AddTeamForm
            tournamentId={tournamentId}
            defaultPurse={tournament?.default_purse}
            onClose={() => setShowAddTeam(false)}
            onSuccess={() => {
              fetchTeams();
              setShowAddTeam(false);
            }}
          />
        </Modal>
      )}

      {/* Add Player Modal */}
      {showAddPlayer && (
        <Modal
          isOpen={true}
          onClose={() => setShowAddPlayer(false)}
          title="Add Player"
        >
          <AddPlayerForm
            tournamentId={tournamentId}
            defaultBasePrice={tournament?.default_base_price}
            onClose={() => setShowAddPlayer(false)}
            onSuccess={() => {
              fetchPlayers();
              setShowAddPlayer(false);
            }}
          />
        </Modal>
      )}
    </div>
  );
};

export default TournamentDashboard;
