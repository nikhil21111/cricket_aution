import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase, formatShortCurrency, uploadImage } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import Modal from "../components/Modal";
import AddPlayerForm from "../components/AddPlayerForm";
import BulkImportPlayers from "../components/BulkImportPlayers";
import toast from "react-hot-toast";

const TournamentPlayers = () => {
  const { id: tournamentId } = useParams();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [tournament, setTournament] = useState(null);
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [isQuickEdit, setIsQuickEdit] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [editedPlayers, setEditedPlayers] = useState({});
  const [savingInlineIds, setSavingInlineIds] = useState(new Set());

  const handleInlineChange = (playerId, fieldName, value) => {
    setEditedPlayers(prev => {
      const original = players.find(p => p.id === playerId);
      const playerDraft = prev[playerId] || { ...original };
      const nextDraft = { ...playerDraft, [fieldName]: value };
      
      if (fieldName === 'status') {
        if (value === 'sold') {
          nextDraft.team_id = nextDraft.team_id || (teams[0]?.id || "");
          nextDraft.sold_price = nextDraft.sold_price || nextDraft.base_price || 500;
        } else {
          nextDraft.team_id = null;
          nextDraft.sold_price = null;
        }
      }
      
      return { ...prev, [playerId]: nextDraft };
    });
  };

  const isPlayerModified = (player) => {
    const draft = editedPlayers[player.id];
    if (!draft) return false;
    return (
      draft.name !== player.name ||
      draft.role !== player.role ||
      draft.icon_role !== player.icon_role ||
      draft.base_price !== player.base_price ||
      draft.status !== player.status ||
      draft.team_id !== player.team_id ||
      draft.sold_price !== player.sold_price
    );
  };

  const handleResetInline = (playerId) => {
    setEditedPlayers(prev => {
      const next = { ...prev };
      delete next[playerId];
      return next;
    });
  };

  const handleSaveInline = async (playerId) => {
    const draft = editedPlayers[playerId];
    if (!draft) return;
    const original = players.find(p => p.id === playerId);
    if (!original) return;

    if (!draft.name.trim()) {
      toast.error("Name cannot be empty");
      return;
    }

    if (draft.status === 'sold') {
      if (!draft.team_id) {
        toast.error("Please select a team for sold players");
        return;
      }
      if (!draft.sold_price || draft.sold_price <= 0) {
        toast.error("Sold price must be greater than 0");
        return;
      }
      if (draft.sold_price < draft.base_price) {
        toast.error("Sold price cannot be less than base price");
        return;
      }

      const selectedTeam = teams.find(t => t.id === draft.team_id);
      if (selectedTeam) {
        let refundedPurse = selectedTeam.remaining_purse;
        if (original.status === 'sold' && original.team_id === draft.team_id) {
          refundedPurse += (original.sold_price || 0);
        }
        if (refundedPurse < draft.sold_price) {
          toast.error(`Team ${selectedTeam.short_name} does not have enough budget (${refundedPurse} pts available)`);
          return;
        }
      }
    }

    setSavingInlineIds(prev => new Set(prev).add(playerId));
    try {
      const { error: playerError } = await supabase
        .from("players")
        .update({
          name: draft.name,
          role: draft.role,
          base_price: draft.base_price,
          status: draft.status,
          team_id: draft.team_id,
          sold_price: draft.sold_price,
          icon_role: draft.icon_role,
        })
        .eq("id", playerId);

      if (playerError) throw playerError;

      const purseUpdates = new Map();
      const iconUpdates = new Map();

      if (original.status === "sold" && original.team_id) {
        const prevTeam = teams.find((t) => t.id === original.team_id);
        if (prevTeam) {
          purseUpdates.set(
            original.team_id,
            (prevTeam.remaining_purse || 0) + (original.sold_price || 0)
          );
          if (original.icon_role !== "none") {
            iconUpdates.set(
              original.team_id,
              Math.max(0, (prevTeam.icon_player_count || 0) - 1)
            );
          }
        }
      }

      if (draft.status === "sold" && draft.team_id) {
        const currentTeam = teams.find((t) => t.id === draft.team_id);
        if (currentTeam) {
          const baseRemaining = purseUpdates.has(draft.team_id)
            ? purseUpdates.get(draft.team_id)
            : currentTeam.remaining_purse;
          purseUpdates.set(draft.team_id, baseRemaining - draft.sold_price);

          if (draft.icon_role !== "none") {
            const baseIcon = iconUpdates.has(draft.team_id)
              ? iconUpdates.get(draft.team_id)
              : currentTeam.icon_player_count || 0;
            iconUpdates.set(draft.team_id, baseIcon + 1);
          }
        }
      }

      if (purseUpdates.size > 0) {
        const updates = Array.from(purseUpdates.entries()).map(
          async ([teamId, remaining_purse]) => {
            return supabase
              .from("teams")
              .update({ remaining_purse })
              .eq("id", teamId);
          }
        );
        await Promise.all(updates);
      }

      if (iconUpdates.size > 0) {
        const updates = Array.from(iconUpdates.entries()).map(
          async ([teamId, icon_player_count]) => {
            return supabase
              .from("teams")
              .update({ icon_player_count })
              .eq("id", teamId);
          }
        );
        await Promise.all(updates);
      }

      setEditedPlayers(prev => {
        const next = { ...prev };
        delete next[playerId];
        return next;
      });

      setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, ...draft } : p));
      await fetchTeams();
      toast.success(`${draft.name} updated successfully!`);
    } catch (error) {
      console.error("Save inline player failed:", error);
      toast.error(error.message || "Failed to update player");
    } finally {
      setSavingInlineIds(prev => {
        const next = new Set(prev);
        next.delete(playerId);
        return next;
      });
    }
  };

  useEffect(() => {
    if (tournamentId) {
      fetchData();
      const cleanup = setupSubscriptions();
      return cleanup;
    }
  }, [tournamentId]);

  const setupSubscriptions = () => {
    const playersSubscription = supabase
      .channel(`players-list-${tournamentId}`)
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

    return () => {
      playersSubscription.unsubscribe();
    };
  };

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchTournament(), fetchPlayers(), fetchTeams()]);
    setLoading(false);
  };

  const fetchTournament = async () => {
    const { data, error } = await supabase
      .from("tournaments")
      .select("*")
      .eq("id", tournamentId)
      .single();
    if (error) {
      toast.error("Failed to load tournament");
      return;
    }
    if (data) setTournament(data);
  };

  const fetchPlayers = async () => {
    const { data, error } = await supabase
      .from("players")
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("created_at", { ascending: true });
    if (error) {
      toast.error("Failed to load players");
      return;
    }
    if (data) setPlayers(data);
  };

  const fetchTeams = async () => {
    const { data, error } = await supabase
      .from("teams")
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("name", { ascending: true });
    if (error) {
      toast.error("Failed to load teams");
      return;
    }
    if (data) setTeams(data);
  };

  const handleDeletePlayer = async (playerId) => {
    try {
      const playerToDelete = players.find((p) => p.id === playerId);

      // If deleting a sold icon player, decrement the team's icon count
      if (
        playerToDelete &&
        playerToDelete.status === "sold" &&
        playerToDelete.icon_role &&
        playerToDelete.icon_role !== "none" &&
        playerToDelete.team_id
      ) {
        const team = teams.find((t) => t.id === playerToDelete.team_id);
        if (team) {
          const nextCount = Math.max(0, (team.icon_player_count || 0) - 1);
          await supabase
            .from("teams")
            .update({ icon_player_count: nextCount })
            .eq("id", team.id);
        }
      }

      const { error } = await supabase
        .from("players")
        .delete()
        .eq("id", playerId);

      if (error) throw error;
      toast.success("Player deleted successfully");
      setDeleteConfirm(null);
      setPlayers((prev) => prev.filter((p) => p.id !== playerId));
    } catch (error) {
      toast.error(error.message || "Failed to delete player");
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

  const getRoleColor = (role) => {
    switch (role) {
      case "batsman":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "bowler":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "all-rounder":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      case "wicket-keeper":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "sold":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "unsold":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      default:
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    }
  };

  const getIconRoleLabel = (iconRole) => {
    switch (iconRole) {
      case "icon-player":
      case "icon-player-sequence":
      case "icon-player-random":
        return "Icon Player";
      case "icon-batsman":
        return "Icon Batsman";
      case "icon-bowler":
        return "Icon Bowler";
      case "icon-allrounder":
        return "Icon All-Rounder";
      case "icon-keeper":
        return "Icon Wicket-Keeper";
      default:
        return null;
    }
  };

  const getIconRoleColor = (iconRole) => {
    switch (iconRole) {
      case "icon-player":
      case "icon-player-sequence":
      case "icon-player-random":
        return "bg-primary/15 text-primary border-primary/30";
      case "icon-batsman":
        return "bg-blue-500/15 text-blue-200 border-blue-500/30";
      case "icon-bowler":
        return "bg-red-500/15 text-red-200 border-red-500/30";
      case "icon-allrounder":
        return "bg-purple-500/15 text-purple-200 border-purple-500/30";
      case "icon-keeper":
        return "bg-yellow-500/15 text-yellow-200 border-yellow-500/30";
      default:
        return "";
    }
  };

  // Filter players
  const filteredPlayers = players.filter((player) => {
    const matchesSearch = player.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesRole = filterRole === "all" || player.role === filterRole;
    const matchesStatus =
      filterStatus === "all" || player.status === filterStatus;
    return matchesSearch && matchesRole && matchesStatus;
  });

  // Stats
  const totalPlayers = players.length;
  const soldPlayers = players.filter((p) => p.status === "sold").length;
  const unsoldPlayers = players.filter((p) => p.status === "unsold").length;
  const availablePlayers = players.filter(
    (p) => p.status === "available"
  ).length;

  const getTeamName = (teamId) => {
    const team = teams.find((t) => t.id === teamId);
    return team ? team.short_name : "-";
  };

  const getTeamColor = (teamId) => {
    const team = teams.find((t) => t.id === teamId);
    return team ? team.color : "#666";
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background-light dark:bg-background-dark">
        <div className="flex flex-col items-center gap-4">
          <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-text-secondary">Loading players...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background-light dark:bg-background-dark text-text-primary dark:text-slate-100 min-h-screen flex flex-col overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-50 h-20 flex-shrink-0 flex items-center justify-between px-6 border-b-3 border-text-primary dark:border-text-secondary-dark bg-background-light dark:bg-background-dark">
        <div className="flex items-center gap-4">
          <Link
            to={`/tournament/${tournamentId}`}
            className="flex items-center justify-center size-10 border-2 border-text-primary dark:border-text-secondary-dark bg-background-light dark:bg-card-dark text-text-primary dark:text-slate-100 hover:bg-background-tertiary transition-colors shadow-[2px_2px_0px_var(--border-color)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_var(--border-color)]"
          >
            <span className="material-symbols-outlined text-[24px]">
              arrow_back
            </span>
          </Link>
          <div>
            <h1 className="text-2xl font-display font-black tracking-tight uppercase leading-none text-text-primary dark:text-slate-100">
              Player Pool
            </h1>
            <p className="text-xs text-text-secondary dark:text-text-secondary-dark font-mono font-bold uppercase mt-1">
              {tournament?.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center size-10 border-2 border-text-primary dark:border-text-secondary-dark bg-background-light dark:bg-card-dark text-text-primary dark:text-slate-100 hover:bg-background-tertiary transition-colors shadow-[2px_2px_0px_var(--border-color)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_var(--border-color)] animate-fadeIn"
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            aria-label="Toggle theme"
          >
            <span className="material-symbols-outlined text-[20px]">
              {theme === "dark" ? "light_mode" : "dark_mode"}
            </span>
          </button>
          
          <button
            onClick={() => setShowAddPlayer(true)}
            className="flex items-center justify-center gap-2 h-10 px-3 md:px-4 border-2 border-text-primary dark:border-text-secondary-dark bg-primary hover:bg-primary-dark text-white text-sm font-display font-bold uppercase tracking-wider shadow-[3px_3px_0px_var(--border-color)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_var(--border-color)] transition-all"
          >
            <span className="material-symbols-outlined">person_add</span>
            <span className="hidden md:inline">Add Player</span>
          </button>
          <button
            onClick={() => setShowBulkImport(true)}
            className="flex items-center justify-center gap-2 h-10 px-3 md:px-4 border-2 border-text-primary dark:border-text-secondary-dark bg-background-light dark:bg-card-dark hover:bg-background-tertiary text-text-primary dark:text-slate-100 text-sm font-display font-bold uppercase tracking-wider shadow-[3px_3px_0px_var(--border-color)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_var(--border-color)] transition-all"
          >
            <span className="material-symbols-outlined">cloud_upload</span>
            <span className="hidden md:inline">Bulk Import</span>
          </button>
          <Link
            to={`/tournament/${tournamentId}/teams`}
            className="flex items-center justify-center gap-2 h-10 px-3 md:px-4 border-2 border-text-primary dark:border-text-secondary-dark bg-background-light dark:bg-card-dark hover:bg-background-tertiary text-text-primary dark:text-slate-100 text-sm font-display font-bold uppercase tracking-wider shadow-[3px_3px_0px_var(--border-color)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_var(--border-color)] transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">groups</span>
            <span className="hidden md:inline">Teams</span>
          </Link>
          <Link
            to={`/tournament/${tournamentId}/live`}
            className="flex items-center justify-center gap-2 h-10 px-3 md:px-4 border-2 border-text-primary dark:border-text-secondary-dark bg-background-light dark:bg-card-dark hover:bg-background-tertiary text-text-primary dark:text-slate-100 text-sm font-display font-bold uppercase tracking-wider shadow-[3px_3px_0px_var(--border-color)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_var(--border-color)] transition-all"
          >
            <span className="material-symbols-outlined">live_tv</span>
            <span className="hidden md:inline">Go Live</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 w-full max-w-[1600px] mx-auto p-4 lg:p-8 flex flex-col gap-6">
        {/* Stats Section */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="relative overflow-hidden bg-background-light dark:bg-card-dark border-2 border-text-primary dark:border-text-secondary-dark p-6 shadow-[4px_4px_0px_var(--border-color)] group">
            <div className="relative z-10">
              <p className="text-text-secondary dark:text-text-secondary-dark text-xs font-mono font-bold uppercase tracking-wider">
                Total Players
              </p>
              <p className="text-3xl font-display font-black tracking-tight mt-2">{totalPlayers}</p>
            </div>
          </div>
          <div className="relative overflow-hidden bg-background-light dark:bg-card-dark border-2 border-text-primary dark:border-text-secondary-dark p-6 shadow-[4px_4px_0px_var(--border-color)] group">
            <div className="relative z-10">
              <p className="text-text-secondary dark:text-text-secondary-dark text-xs font-mono font-bold uppercase tracking-wider">
                Available
              </p>
              <p className="text-3xl font-display font-black tracking-tight text-yellow-400 mt-2">
                {availablePlayers}
              </p>
            </div>
          </div>
          <div className="relative overflow-hidden bg-background-light dark:bg-card-dark border-2 border-text-primary dark:border-text-secondary-dark p-6 shadow-[4px_4px_0px_var(--border-color)] group">
            <div className="relative z-10">
              <p className="text-text-secondary dark:text-text-secondary-dark text-xs font-mono font-bold uppercase tracking-wider">
                Sold
              </p>
              <p className="text-3xl font-display font-black tracking-tight text-green-400 mt-2">
                {soldPlayers}
              </p>
            </div>
          </div>
          <div className="relative overflow-hidden bg-background-light dark:bg-card-dark border-2 border-text-primary dark:border-text-secondary-dark p-6 shadow-[4px_4px_0px_var(--border-color)] group">
            <div className="relative z-10">
              <p className="text-text-secondary dark:text-text-secondary-dark text-xs font-mono font-bold uppercase tracking-wider">
                Unsold
              </p>
              <p className="text-3xl font-display font-black tracking-tight text-red-400 mt-2">
                {unsoldPlayers}
              </p>
            </div>
          </div>
        </section>

        {/* Filters Section */}
        <section className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center">
          {/* Search */}
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search players..."
              className="w-full h-12 pl-10 pr-4 border-2 border-text-primary dark:border-text-secondary-dark bg-background-light dark:bg-card-dark text-text-primary dark:text-slate-100 placeholder:text-text-secondary/50 font-mono text-sm tracking-tight focus:outline-none focus:border-primary transition-colors shadow-[3px_3px_0px_var(--border-color)]"
            />
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            {/* Role Filter */}
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="h-12 px-4 border-2 border-text-primary dark:border-text-secondary-dark bg-background-light dark:bg-card-dark text-text-primary dark:text-slate-100 font-mono text-sm tracking-tight focus:outline-none focus:border-primary transition-colors shadow-[3px_3px_0px_var(--border-color)]"
            >
              <option value="all">All Roles</option>
              <option value="batsman">Batsman</option>
              <option value="bowler">Bowler</option>
              <option value="all-rounder">All-Rounder</option>
              <option value="wicket-keeper">Wicket Keeper</option>
            </select>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="h-12 px-4 border-2 border-text-primary dark:border-text-secondary-dark bg-background-light dark:bg-card-dark text-text-primary dark:text-slate-100 font-mono text-sm tracking-tight focus:outline-none focus:border-primary transition-colors shadow-[3px_3px_0px_var(--border-color)]"
            >
              <option value="all">All Status</option>
              <option value="available">Available</option>
              <option value="sold">Sold</option>
              <option value="unsold">Unsold</option>
            </select>

            {/* Layout Toggle */}
            <div className="flex border-2 border-text-primary dark:border-text-secondary-dark shadow-[3px_3px_0px_var(--border-color)] overflow-hidden">
              <button
                onClick={() => setIsQuickEdit(false)}
                className={`h-11 px-3 flex items-center gap-1 font-mono text-xs font-bold uppercase transition-colors ${
                  !isQuickEdit
                    ? "bg-primary text-white"
                    : "bg-background-light dark:bg-card-dark text-text-secondary hover:bg-background-tertiary text-text-primary dark:text-slate-100"
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">grid_view</span>
                Grid
              </button>
              <button
                onClick={() => setIsQuickEdit(true)}
                className={`h-11 px-3 flex items-center gap-1 font-mono text-xs font-bold uppercase transition-colors border-l-2 border-text-primary dark:border-text-secondary-dark ${
                  isQuickEdit
                    ? "bg-primary text-white"
                    : "bg-background-light dark:bg-card-dark text-text-secondary hover:bg-background-tertiary text-text-primary dark:text-slate-100"
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">table_chart</span>
                Spreadsheet
              </button>
            </div>
          </div>
        </section>

        {/* Players Grid OR Table View */}
        {filteredPlayers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-background-light dark:bg-card-dark border-2 border-text-primary dark:border-text-secondary-dark shadow-[3px_3px_0px_var(--border-color)]">
            <div className="size-16 border-2 border-text-primary dark:border-text-secondary-dark bg-background-secondary dark:bg-background-dark flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-3xl text-text-secondary">
                person_off
              </span>
            </div>
            <p className="text-text-secondary text-lg">No players found</p>
            <p className="text-text-secondary/60 text-sm mt-1">
              {searchQuery || filterRole !== "all" || filterStatus !== "all"
                ? "Try adjusting your filters"
                : "Add players to get started"}
            </p>
            {!searchQuery &&
              filterRole === "all" &&
              filterStatus === "all" && (
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => setShowAddPlayer(true)}
                    className="px-4 py-2 bg-primary text-white font-display font-bold uppercase tracking-wider border-2 border-text-primary dark:border-text-secondary-dark shadow-[3px_3px_0px_var(--border-color)] hover:bg-primary-dark transition-all"
                  >
                    Add Player
                  </button>
                  <button
                    onClick={() => setShowBulkImport(true)}
                    className="px-4 py-2 bg-background-light dark:bg-card-dark text-text-primary border-2 border-text-primary dark:border-text-secondary-dark shadow-[3px_3px_0px_var(--border-color)] hover:bg-background-tertiary transition-all"
                  >
                    Bulk Import
                  </button>
                </div>
              )}
          </div>
        ) : isQuickEdit ? (
          /* Quick Edit / Spreadsheet View */
          <div className="overflow-x-auto border-2 border-text-primary dark:border-text-secondary-dark bg-background-light dark:bg-card-dark shadow-[3px_3px_0px_var(--border-color)]">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="border-b-2 border-text-primary dark:border-text-secondary-dark bg-background-secondary dark:bg-background-dark font-mono text-xs uppercase text-text-secondary">
                  <th className="p-3 w-16">Photo</th>
                  <th className="p-3 min-w-[200px]">Player Name</th>
                  <th className="p-3 w-44">Role</th>
                  <th className="p-3 w-36">Base Price</th>
                  <th className="p-3 w-36">Status</th>
                  <th className="p-3 w-48">Team Selection</th>
                  <th className="p-3 w-36">Sold Price</th>
                  <th className="p-3 w-28 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-text-primary/10">
                {filteredPlayers.map((player) => {
                  const draft = editedPlayers[player.id] || player;
                  const isModified = isPlayerModified(player);
                  const isSaving = savingInlineIds.has(player.id);
                  
                  return (
                    <tr key={player.id} className="hover:bg-background-secondary/40 font-mono text-xs">
                      {/* Photo Column */}
                      <td className="p-3">
                        <div className="size-10 border border-text-primary/20 bg-background-secondary dark:bg-background-dark flex items-center justify-center overflow-hidden">
                          {player.photo_url ? (
                            <img src={player.photo_url} alt="" className="size-full object-cover" />
                          ) : (
                            <span className="material-symbols-outlined text-lg text-text-secondary">person</span>
                          )}
                        </div>
                      </td>
                      
                      {/* Name Column */}
                      <td className="p-3">
                        <input
                          type="text"
                          value={draft.name}
                          onChange={(e) => handleInlineChange(player.id, 'name', e.target.value)}
                          className="w-full h-9 px-2 bg-background-light dark:bg-background-dark border border-text-primary/20 focus:border-primary text-text-primary dark:text-slate-100 font-sans font-semibold text-sm outline-none"
                        />
                      </td>
                      
                      {/* Role Column */}
                      <td className="p-3">
                        <select
                          value={draft.role}
                          onChange={(e) => handleInlineChange(player.id, 'role', e.target.value)}
                          className="w-full h-9 px-2 bg-background-light dark:bg-background-dark border border-text-primary/20 focus:border-primary text-text-primary dark:text-slate-100 font-sans outline-none"
                        >
                          <option value="batsman">Batsman</option>
                          <option value="bowler">Bowler</option>
                          <option value="all-rounder">All-Rounder</option>
                          <option value="wicket-keeper">Wicket Keeper</option>
                        </select>
                      </td>
                      
                      {/* Base Price Column */}
                      <td className="p-3">
                        <input
                          type="number"
                          value={draft.base_price}
                          onChange={(e) => handleInlineChange(player.id, 'base_price', parseInt(e.target.value, 10) || 0)}
                          className="w-full h-9 px-2 bg-background-light dark:bg-background-dark border border-text-primary/20 focus:border-primary text-text-primary dark:text-slate-100 font-mono text-sm outline-none"
                        />
                      </td>
                      
                      {/* Status Column */}
                      <td className="p-3">
                        <select
                          value={draft.status}
                          onChange={(e) => handleInlineChange(player.id, 'status', e.target.value)}
                          className="w-full h-9 px-2 bg-background-light dark:bg-background-dark border border-text-primary/20 focus:border-primary text-text-primary dark:text-slate-100 font-sans outline-none"
                        >
                          <option value="available">Available</option>
                          <option value="sold">Sold</option>
                          <option value="unsold">Unsold</option>
                        </select>
                      </td>
                      
                      {/* Team Selection Column */}
                      <td className="p-3">
                        <select
                          value={draft.team_id || ""}
                          disabled={draft.status !== 'sold'}
                          onChange={(e) => handleInlineChange(player.id, 'team_id', e.target.value || null)}
                          className="w-full h-9 px-2 bg-background-light dark:bg-background-dark border border-text-primary/20 focus:border-primary text-text-primary dark:text-slate-100 font-sans outline-none disabled:opacity-40"
                        >
                          <option value="">Select Team</option>
                          {teams.map(t => (
                            <option key={t.id} value={t.id}>{t.name} ({t.short_name})</option>
                          ))}
                        </select>
                      </td>
                      
                      {/* Sold Price Column */}
                      <td className="p-3">
                        <input
                          type="number"
                          disabled={draft.status !== 'sold'}
                          value={draft.sold_price || ""}
                          onChange={(e) => handleInlineChange(player.id, 'sold_price', parseInt(e.target.value, 10) || 0)}
                          className="w-full h-9 px-2 bg-background-light dark:bg-background-dark border border-text-primary/20 focus:border-primary text-text-primary dark:text-slate-100 font-mono text-sm outline-none disabled:opacity-40"
                        />
                      </td>
                      
                      {/* Actions Column */}
                      <td className="p-3 text-center">
                        <div className="flex justify-center items-center gap-1.5">
                          {isModified ? (
                            <>
                              <button
                                onClick={() => handleSaveInline(player.id)}
                                disabled={isSaving}
                                className="flex items-center justify-center size-8 bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 transition-colors rounded"
                                title="Save Changes"
                              >
                                {isSaving ? (
                                  <div className="size-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                  <span className="material-symbols-outlined text-[18px]">check</span>
                                )}
                              </button>
                              <button
                                onClick={() => handleResetInline(player.id)}
                                disabled={isSaving}
                                className="flex items-center justify-center size-8 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/30 transition-colors rounded"
                                title="Discard Changes"
                              >
                                <span className="material-symbols-outlined text-[18px]">close</span>
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirm(player)}
                              className="flex items-center justify-center size-8 bg-red-500/10 text-red-400 border border-red-400/30 hover:bg-red-500/20 transition-colors rounded"
                              title="Delete Player"
                            >
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* Normal Grid View */
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredPlayers.map((player) => (
              <div
                key={player.id}
                className="bg-background-light dark:bg-card-dark border-2 border-text-primary dark:border-text-secondary-dark overflow-hidden shadow-[3px_3px_0px_var(--border-color)] hover:shadow-[4px_4px_0px_var(--border-color)] transition-all group"
              >
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Player Photo */}
                    <div className="size-14 border border-text-primary dark:border-text-secondary-dark bg-background-secondary dark:bg-background-dark flex items-center justify-center overflow-hidden flex-shrink-0">
                      {player.photo_url ? (
                        <img
                          src={player.photo_url}
                          alt={player.name}
                          className="size-full object-cover"
                        />
                      ) : (
                        <span className="material-symbols-outlined text-2xl text-text-secondary">
                          person
                        </span>
                      )}
                    </div>

                    {/* Player Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-text-primary dark:text-slate-100 font-bold truncate">
                        {player.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={`text-[10px] px-2 py-0.5 border-2 ${getRoleColor(
                            player.role
                          )}`}
                        >
                          {getRoleLabel(player.role)}
                        </span>
                        {getIconRoleLabel(player.icon_role) && (
                          <span
                            className={`text-[10px] px-2 py-0.5 border-2 ${getIconRoleColor(
                              player.icon_role
                            )}`}
                          >
                            {getIconRoleLabel(player.icon_role)}
                          </span>
                        )}
                        <span
                          className={`text-[10px] px-2 py-0.5 border-2 ${getStatusColor(
                            player.status
                          )}`}
                        >
                          {player.status.charAt(0).toUpperCase() +
                            player.status.slice(1)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Price Info */}
                  <div className="mt-4 flex items-center justify-between">
                    <div>
                      <p className="text-text-secondary text-xs">Base Price</p>
                      <p className="text-text-primary dark:text-slate-100 font-bold">
                        {formatShortCurrency(player.base_price)}
                      </p>
                    </div>
                    {player.status === "sold" && (
                      <div className="text-right">
                        <p className="text-text-secondary text-xs">Sold For</p>
                        <p className="text-green-400 font-bold">
                          {formatShortCurrency(player.sold_price)}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Team Info (if sold) */}
                  {player.status === "sold" && player.team_id && (
                    <div
                      className="mt-3 px-3 py-2 flex items-center gap-2"
                      style={{
                        backgroundColor: getTeamColor(player.team_id) + "20",
                      }}
                    >
                      <span
                        className="text-xs font-bold px-2 py-0.5"
                        style={{
                          backgroundColor: getTeamColor(player.team_id),
                          color: "#fff",
                        }}
                      >
                        {getTeamName(player.team_id)}
                      </span>
                      <span className="text-text-secondary text-xs">Team</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="px-4 py-3 bg-background-secondary dark:bg-background-dark border-t-2 border-text-primary dark:border-text-secondary-dark flex gap-2">
                  <button
                    onClick={() => setEditingPlayer(player)}
                    className="flex-1 flex items-center justify-center gap-1 h-9 bg-background-tertiary dark:bg-card-dark text-text-primary dark:text-slate-100 text-sm font-display font-bold uppercase tracking-wider border border-text-primary dark:border-text-secondary-dark hover:bg-background-light transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      edit
                    </span>
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(player)}
                    className="flex items-center justify-center size-9 bg-red-500/10 text-red-400 border border-red-400 hover:bg-red-500/20 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      delete
                    </span>
                  </button>
                </div>
              </div>
            ))}
          </section>
        )}
      </main>

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
            onSuccess={(newPlayer) => {
              if (newPlayer) {
                setPlayers((prev) => [...prev, newPlayer]);
              } else {
                fetchPlayers();
              }
              setShowAddPlayer(false);
            }}
          />
        </Modal>
      )}

      {/* Bulk Import Modal */}
      {showBulkImport && (
        <Modal
          isOpen={true}
          onClose={() => setShowBulkImport(false)}
          title="Bulk Import Players"
        >
          <BulkImportPlayers
            tournamentId={tournamentId}
            defaultBasePrice={tournament?.default_base_price}
            onClose={() => setShowBulkImport(false)}
            onSuccess={(importedList) => {
              if (Array.isArray(importedList)) {
                setPlayers((prev) => [...prev, ...importedList]);
              } else {
                fetchPlayers();
              }
            }}
          />
        </Modal>
      )}

      {/* Edit Player Modal */}
      {editingPlayer && (
        <Modal
          isOpen={true}
          onClose={() => setEditingPlayer(null)}
          title="Edit Player"
        >
          <EditPlayerForm
            player={editingPlayer}
            teams={teams}
            onClose={() => setEditingPlayer(null)}
            onSuccess={(updatedPlayer) => {
              if (updatedPlayer) {
                setPlayers((prev) =>
                  prev.map((p) => (p.id === updatedPlayer.id ? updatedPlayer : p))
                );
              } else {
                fetchPlayers();
              }
              setEditingPlayer(null);
            }}
          />
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <Modal
          isOpen={true}
          onClose={() => setDeleteConfirm(null)}
          title="Delete Player"
        >
          <div className="text-center">
            <div className="size-16 border-2 border-red-400 bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-3xl text-red-400">
                warning
              </span>
            </div>
            <p className="text-text-primary dark:text-slate-100 text-lg font-medium mb-2">
              Are you sure you want to delete{" "}
              <span className="text-primary">{deleteConfirm.name}</span>?
            </p>
            <p className="text-text-secondary text-sm mb-6">
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 h-11 bg-background-tertiary dark:bg-card-dark text-text-primary dark:text-slate-100 font-display font-bold uppercase tracking-wider border-2 border-text-primary dark:border-text-secondary-dark hover:bg-background-light transition-colors shadow-[2px_2px_0px_var(--border-color)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_var(--border-color)]"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeletePlayer(deleteConfirm.id)}
                className="flex-1 h-11 bg-red-500 text-white font-display font-bold uppercase tracking-wider border-2 border-text-primary dark:border-text-secondary-dark hover:bg-red-600 transition-colors shadow-[2px_2px_0px_var(--border-color)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_var(--border-color)]"
              >
                Delete
              </button>
            </div>
          </div>
        </Modal>
      )}


    </div>
  );
};

// Edit Player Form Component
const EditPlayerForm = ({ player, teams, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: player.name || "",
    role: player.role || "batsman",
    icon_role: player.icon_role || "none",
    base_price: player.base_price || 500,
    status: player.status || "available",
    team_id: player.team_id || "",
    sold_price: player.sold_price || 0,
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(player.photo_url || null);
  const [showCustomPrice, setShowCustomPrice] = useState(false);
  const [customPriceValue, setCustomPriceValue] = useState("");

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (photoPreview && !photoPreview.startsWith("http"))
        URL.revokeObjectURL(photoPreview);
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) {
      toast.error("Please enter player name");
      return;
    }

    const prevStatus = player.status;
    const prevTeamId = player.team_id;
    const prevSoldPrice = player.sold_price || 0;
    const prevIconRole = player.icon_role || "none";
    const newIconRole = formData.icon_role || "none";
    const selectedTeam = teams.find((t) => t.id === formData.team_id);
    const soldPrice = Number(formData.sold_price || 0);

    // Validation for sold state
    if (formData.status === "sold") {
      if (!formData.team_id || !selectedTeam) {
        toast.error("Select a team for sold players");
        return;
      }
      if (!soldPrice || soldPrice <= 0) {
        toast.error("Enter a sold price greater than 0");
        return;
      }
      if (soldPrice < formData.base_price) {
        toast.error("Sold price cannot be below base price");
        return;
      }

      // Check affordability (accounts for refund if same team editing)
      const balances = new Map(teams.map((t) => [t.id, t.remaining_purse]));
      if (prevStatus === "sold" && prevTeamId) {
        balances.set(
          prevTeamId,
          (balances.get(prevTeamId) || 0) + prevSoldPrice
        );
      }
      const candidate = (balances.get(formData.team_id) || 0) - soldPrice;
      if (candidate < 0) {
        toast.error("Team does not have enough purse for this price");
        return;
      }
    }

    setLoading(true);
    try {
      let photo_url = player.photo_url;

      // Upload new photo if provided
      if (photoFile) {
        photo_url = await uploadImage("players", photoFile);
      }

      const updateData = {
        name: formData.name,
        role: formData.role,
        icon_role: formData.icon_role,
        base_price: formData.base_price,
        status: formData.status,
        photo_url,
      };

      // Handle sold status
      if (formData.status === "sold" && formData.team_id) {
        updateData.team_id = formData.team_id;
        updateData.sold_price = soldPrice || formData.base_price;
      } else if (formData.status !== "sold") {
        updateData.team_id = null;
        updateData.sold_price = null;
      }

      const { error } = await supabase
        .from("players")
        .update(updateData)
        .eq("id", player.id);

      if (error) throw error;

      // Sync team purse changes (refund old, charge new)
      const purseUpdates = new Map();
      const iconUpdates = new Map();

      if (prevStatus === "sold" && prevTeamId) {
        const prevTeam = teams.find((t) => t.id === prevTeamId);
        if (prevTeam) {
          purseUpdates.set(
            prevTeamId,
            (prevTeam.remaining_purse || 0) + prevSoldPrice
          );
          if (prevIconRole !== "none") {
            iconUpdates.set(
              prevTeamId,
              Math.max(0, (prevTeam.icon_player_count || 0) - 1)
            );
          }
        }
      }

      if (formData.status === "sold" && formData.team_id) {
        const currentTeam = teams.find((t) => t.id === formData.team_id);
        if (currentTeam) {
          const baseRemaining = purseUpdates.has(formData.team_id)
            ? purseUpdates.get(formData.team_id)
            : currentTeam.remaining_purse;
          purseUpdates.set(formData.team_id, baseRemaining - soldPrice);

          if (newIconRole !== "none") {
            const baseIcon = iconUpdates.has(formData.team_id)
              ? iconUpdates.get(formData.team_id)
              : currentTeam.icon_player_count || 0;
            iconUpdates.set(formData.team_id, baseIcon + 1);
          }
        }
      }

      if (purseUpdates.size > 0) {
        const updates = Array.from(purseUpdates.entries()).map(
          async ([teamId, remaining_purse]) => {
            return supabase
              .from("teams")
              .update({ remaining_purse })
              .eq("id", teamId);
          }
        );
        const purseResults = await Promise.all(updates);
        const purseError = purseResults.find((r) => r.error)?.error;
        if (purseError) throw purseError;
      }

      if (iconUpdates.size > 0) {
        const updates = Array.from(iconUpdates.entries()).map(
          async ([teamId, icon_player_count]) => {
            return supabase
              .from("teams")
              .update({ icon_player_count })
              .eq("id", teamId);
          }
        );
        const iconResults = await Promise.all(updates);
        const iconError = iconResults.find((r) => r.error)?.error;
        if (iconError) throw iconError;
      }

      toast.success("Player updated successfully!");
      onSuccess?.();
    } catch (error) {
      toast.error(error.message || "Failed to update player");
    } finally {
      setLoading(false);
    }
  };

  const roles = [
    {
      value: "batsman",
      label: "Batsman",
      icon: "sports_cricket",
      color: "text-primary bg-primary/10 border-primary/20",
    },
    {
      value: "bowler",
      label: "Bowler",
      icon: "sports_baseball",
      color: "text-green-400 bg-green-500/10 border-green-500/20",
    },
    {
      value: "all-rounder",
      label: "All-Rounder",
      icon: "military_tech",
      color: "text-orange-400 bg-orange-500/10 border-orange-500/20",
    },
    {
      value: "wicket-keeper",
      label: "Wicket Keeper",
      icon: "sports_handball",
      color: "text-purple-400 bg-purple-500/10 border-purple-500/20",
    },
  ];

  const iconRoles = [
    {
      value: "none",
      label: "No Icon",
      description: "Regular player",
      color: "bg-background-secondary dark:bg-background-dark text-text-secondary border-text-primary dark:border-text-secondary-dark",
      icon: "radio_button_unchecked",
    },
    {
      value: "icon-player",
      label: "Icon Player",
      description: "Marquee player",
      color: "bg-primary/10 text-primary border-primary/30",
      icon: "star",
    },
  ];

  const basePriceOptions = [
    { label: "500", value: 500 },
    { label: "1K", value: 1000 },
    { label: "5K", value: 5000 },
    { label: "10K", value: 10000 },
  ];

  const handleCustomPriceChange = (e) => {
    const value = e.target.value.replace(/[^0-9]/g, "");
    setCustomPriceValue(value);
    if (value) {
      setFormData({ ...formData, base_price: parseInt(value, 10) });
    }
  };

  const applyCustomPrice = () => {
    if (customPriceValue) {
      setFormData({ ...formData, base_price: parseInt(customPriceValue, 10) });
      setShowCustomPrice(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Photo Upload */}
      <div className="flex justify-center">
        <label className="cursor-pointer group">
          <div className="size-24 rounded-full bg-background-tertiary dark:bg-background-dark border-2 border-dashed border-text-secondary dark:border-text-secondary-dark group-hover:border-primary flex items-center justify-center overflow-hidden transition-colors">
            {photoPreview ? (
              <img
                src={photoPreview}
                alt="Photo preview"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center text-text-secondary group-hover:text-primary transition-colors">
                <span className="material-symbols-outlined text-2xl">
                  person_add
                </span>
                <span className="text-[10px] mt-1">Add Photo</span>
              </div>
            )}
          </div>
          <input
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            className="hidden"
          />
        </label>
      </div>

      {/* Player Name */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">
          Player Name *
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Virat Kohli"
          className="w-full h-11 px-4 bg-background-secondary dark:bg-background-dark border-2 border-text-primary dark:border-text-secondary-dark text-text-primary dark:text-slate-100 placeholder:text-text-secondary/50 focus:outline-none focus:border-primary transition-colors"
        />
      </div>

      {/* Role */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">
          Role
        </label>
        <div className="grid grid-cols-2 gap-2">
          {roles.map((role) => (
            <button
              key={role.value}
              type="button"
              onClick={() => setFormData({ ...formData, role: role.value })}
              className={`h-10 text-xs font-bold border-2 transition-all flex items-center justify-center gap-2 ${
                formData.role === role.value
                  ? role.color
                  : "bg-background-secondary dark:bg-background-dark text-text-secondary border-text-primary dark:border-text-secondary-dark hover:bg-background-tertiary"
              }`}
            >
              <span className="material-symbols-outlined text-sm">
                {role.icon}
              </span>
              {role.label}
            </button>
          ))}
        </div>
      </div>

      {/* Icon Player Group */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-text-secondary">
            Icon Player Group
          </label>
          <span className="text-[11px] text-text-secondary/70">
            Optional tag for marquee players
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {iconRoles.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() =>
                setFormData({
                  ...formData,
                  icon_role:
                    item.value === "icon-player"
                      ? "icon-player-sequence"
                      : item.value,
                })
              }
              className={`w-full h-12 border-2 text-left px-3 flex items-center gap-3 transition-all ${
                formData.icon_role === item.value ||
                (item.value === "icon-player" &&
                  (formData.icon_role || "").startsWith("icon-player"))
                  ? `${item.color} shadow-[0_0_0_1px_rgba(13,185,242,0.3)]`
                  : "bg-background-secondary dark:bg-background-dark text-text-secondary border-text-primary dark:border-text-secondary-dark hover:bg-background-tertiary"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {item.icon}
              </span>
              <div className="leading-tight">
                <p className="text-sm font-semibold text-text-primary dark:text-slate-100">{item.label}</p>
                <p className="text-[11px] text-text-secondary/80">
                  {item.description}
                </p>
              </div>
            </button>
          ))}
        </div>

        {/* Icon Order Option - Only shown when Icon Player is selected */}
        {(formData.icon_role || "").startsWith("icon-player") && (
          <div className="mt-3 p-3 bg-background-secondary dark:bg-background-dark border-2 border-text-primary dark:border-text-secondary-dark">
            <label className="block text-xs font-medium text-text-secondary mb-2">
              Auction Order
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  setFormData({
                    ...formData,
                    icon_role: "icon-player-sequence",
                  })
                }
                className={`h-10 text-xs font-bold border-2 transition-all flex items-center justify-center gap-2 ${
                  formData.icon_role === "icon-player-sequence" ||
                  formData.icon_role === "icon-player"
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "bg-background-tertiary dark:bg-background-dark text-text-secondary border-text-secondary dark:border-text-secondary-dark hover:bg-background-light"
                }`}
              >
                <span className="material-symbols-outlined text-sm">
                  format_list_numbered
                </span>
                Sequence
              </button>
              <button
                type="button"
                onClick={() =>
                  setFormData({ ...formData, icon_role: "icon-player-random" })
                }
                className={`h-10 text-xs font-bold border-2 transition-all flex items-center justify-center gap-2 ${
                  formData.icon_role === "icon-player-random"
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "bg-background-tertiary dark:bg-background-dark text-text-secondary border-text-secondary dark:border-text-secondary-dark hover:bg-background-light"
                }`}
              >
                <span className="material-symbols-outlined text-sm">
                  shuffle
                </span>
                Random
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Base Price */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">
          Base Price (Points)
        </label>
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-2">
            {basePriceOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setFormData({ ...formData, base_price: option.value });
                  setShowCustomPrice(false);
                  setCustomPriceValue("");
                }}
                className={`h-10 text-sm font-bold transition-all ${
                  formData.base_price === option.value && !showCustomPrice
                    ? "bg-primary text-white border-2 border-[var(--border-color)]"
                    : "bg-[var(--bg-primary)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] border-2 border-[var(--border-color)]"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowCustomPrice(!showCustomPrice)}
            className={`w-full h-10 text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              showCustomPrice
                ? "bg-primary text-white border-2 border-[var(--border-color)]"
                : "bg-[var(--bg-primary)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] border-2 border-dashed border-[var(--border-color)]"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">edit</span>
            Custom Amount
          </button>

          {showCustomPrice && (
            <div className="flex gap-2">
              <input
                type="text"
                value={customPriceValue}
                onChange={handleCustomPriceChange}
                placeholder="Enter custom points"
                className="flex-1 h-11 px-4 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-text-secondary/60 focus:outline-none focus:border-primary transition-colors"
              />
              <button
                type="button"
                onClick={applyCustomPrice}
                className="px-4 h-11 bg-primary hover:bg-primary-dark text-white font-bold border-2 border-[var(--border-color)] transition-colors"
              >
                Set
              </button>
            </div>
          )}

          <div className="flex items-center justify-between p-3 bg-background-secondary dark:bg-background-dark border-2 border-text-primary dark:border-text-secondary-dark">
            <span className="text-text-secondary text-sm">
              Selected Base Price:
            </span>
            <span className="text-primary font-bold text-lg">
              {formData.base_price.toLocaleString()} pts
            </span>
          </div>
        </div>
      </div>

      {/* Status */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">
          Status
        </label>
        <div className="grid grid-cols-3 gap-2">
          {["available", "sold", "unsold"].map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setFormData({ ...formData, status })}
              className={`h-10 text-xs font-bold border-2 transition-all capitalize ${
                formData.status === status
                  ? status === "sold"
                    ? "bg-green-500/20 text-green-400 border-green-500/30"
                    : status === "unsold"
                    ? "bg-red-500/20 text-red-400 border-red-500/30"
                    : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                  : "bg-background-secondary dark:bg-background-dark text-text-secondary border-text-primary dark:border-text-secondary-dark hover:bg-background-tertiary"
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Team Selection (if sold) */}
      {formData.status === "sold" && (
        <>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Assign to Team
            </label>
            <select
              value={formData.team_id}
              onChange={(e) =>
                setFormData({ ...formData, team_id: e.target.value })
              }
              className="w-full h-11 px-4 bg-background-secondary dark:bg-background-dark border-2 border-text-primary dark:border-text-secondary-dark text-text-primary dark:text-slate-100 focus:outline-none focus:border-primary transition-colors"
            >
              <option value="">Select Team</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name} ({team.short_name})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Sold Price (Points)
            </label>
            <input
              type="number"
              value={formData.sold_price}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  sold_price: parseInt(e.target.value, 10) || 0,
                })
              }
              className="w-full h-11 px-4 bg-background-secondary dark:bg-background-dark border-2 border-text-primary dark:border-text-secondary-dark text-text-primary dark:text-slate-100 focus:outline-none focus:border-primary transition-colors"
            />
          </div>
        </>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading}
        className="w-full h-11 bg-primary hover:bg-primary-dark text-white font-display font-bold uppercase tracking-wider border-2 border-text-primary dark:border-text-secondary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[2px_2px_0px_var(--border-color)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_var(--border-color)]"
      >
        {loading ? (
          <>
            <div className="size-4 border-2 border-background-dark border-t-transparent rounded-full animate-spin"></div>
            Updating...
          </>
        ) : (
          <>
            <span className="material-symbols-outlined text-[20px]">save</span>
            Update Player
          </>
        )}
      </button>
    </form>
  );
};

export default TournamentPlayers;
