import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase, formatShortCurrency, uploadImage } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import Modal from "../components/Modal";
import AddPlayerForm from "../components/AddPlayerForm";
import toast from "react-hot-toast";

const TournamentPlayers = () => {
  const { id: tournamentId } = useParams();
  const { user } = useAuth();

  const [tournament, setTournament] = useState(null);
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

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
      fetchPlayers();
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
      <div className="h-screen w-full flex items-center justify-center bg-background-dark">
        <div className="flex flex-col items-center gap-4">
          <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-text-secondary">Loading players...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background-dark text-white font-display min-h-screen flex flex-col overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-[#283539] bg-background-dark/90 backdrop-blur-md px-6 py-4 lg:px-10">
        <div className="flex items-center gap-4">
          <Link
            to={`/tournament/${tournamentId}`}
            className="flex items-center justify-center size-10 rounded-xl bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary-dark transition-colors"
          >
            <span className="material-symbols-outlined text-[24px]">
              arrow_back
            </span>
          </Link>
          <div>
            <h1 className="text-xl font-bold leading-tight tracking-tight text-white">
              Player Pool
            </h1>
            <p className="text-xs text-text-secondary font-medium">
              {tournament?.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddPlayer(true)}
            className="flex items-center justify-center px-4 h-10 rounded-lg bg-primary text-background-dark font-bold text-sm hover:bg-primary-dark transition-colors"
          >
            <span className="material-symbols-outlined mr-2">person_add</span>
            Add Player
          </button>
          <Link
            to={`/tournament/${tournamentId}/live`}
            className="flex items-center justify-center px-4 h-10 rounded-lg bg-[#283539] text-white font-bold text-sm hover:bg-[#3b4e54] transition-colors"
          >
            <span className="material-symbols-outlined mr-2">live_tv</span>
            Go Live
          </Link>
        </div>
      </header>

      <main className="flex-1 w-full max-w-[1600px] mx-auto p-4 lg:p-8 flex flex-col gap-6">
        {/* Stats Section */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex flex-col gap-1 rounded-xl p-5 bg-card-dark border border-[#283539]">
            <p className="text-text-secondary text-xs font-semibold uppercase tracking-wider">
              Total Players
            </p>
            <p className="text-2xl font-bold tracking-tight">{totalPlayers}</p>
          </div>
          <div className="flex flex-col gap-1 rounded-xl p-5 bg-card-dark border border-[#283539]">
            <p className="text-text-secondary text-xs font-semibold uppercase tracking-wider">
              Available
            </p>
            <p className="text-2xl font-bold tracking-tight text-yellow-400">
              {availablePlayers}
            </p>
          </div>
          <div className="flex flex-col gap-1 rounded-xl p-5 bg-card-dark border border-[#283539]">
            <p className="text-text-secondary text-xs font-semibold uppercase tracking-wider">
              Sold
            </p>
            <p className="text-2xl font-bold tracking-tight text-green-400">
              {soldPlayers}
            </p>
          </div>
          <div className="flex flex-col gap-1 rounded-xl p-5 bg-card-dark border border-[#283539]">
            <p className="text-text-secondary text-xs font-semibold uppercase tracking-wider">
              Unsold
            </p>
            <p className="text-2xl font-bold tracking-tight text-red-400">
              {unsoldPlayers}
            </p>
          </div>
        </section>

        {/* Filters Section */}
        <section className="flex flex-col sm:flex-row gap-4">
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
              className="w-full h-11 pl-10 pr-4 rounded-lg bg-card-dark border border-[#283539] text-white placeholder:text-text-secondary/50 focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          {/* Role Filter */}
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="h-11 px-4 rounded-lg bg-card-dark border border-[#283539] text-white focus:outline-none focus:border-primary transition-colors"
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
            className="h-11 px-4 rounded-lg bg-card-dark border border-[#283539] text-white focus:outline-none focus:border-primary transition-colors"
          >
            <option value="all">All Status</option>
            <option value="available">Available</option>
            <option value="sold">Sold</option>
            <option value="unsold">Unsold</option>
          </select>
        </section>

        {/* Players Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredPlayers.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
              <div className="size-16 rounded-xl bg-[#1c2e35] flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-3xl text-text-secondary">
                  person_off
                </span>
              </div>
              <p className="text-text-secondary text-lg">No players found</p>
              <p className="text-text-secondary/60 text-sm mt-1">
                {searchQuery || filterRole !== "all" || filterStatus !== "all"
                  ? "Try adjusting your filters"
                  : "Add your first player to get started"}
              </p>
              {!searchQuery &&
                filterRole === "all" &&
                filterStatus === "all" && (
                  <button
                    onClick={() => setShowAddPlayer(true)}
                    className="mt-4 px-4 py-2 bg-primary text-background-dark font-bold rounded-lg hover:bg-primary-dark transition-colors"
                  >
                    Add Player
                  </button>
                )}
            </div>
          ) : (
            filteredPlayers.map((player) => (
              <div
                key={player.id}
                className="bg-card-dark rounded-xl border border-[#283539] overflow-hidden hover:border-primary/50 transition-all group"
              >
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Player Photo */}
                    <div className="size-14 rounded-lg bg-[#1c2e35] flex items-center justify-center overflow-hidden flex-shrink-0">
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
                      <h3 className="text-white font-bold truncate">
                        {player.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded border ${getRoleColor(
                            player.role
                          )}`}
                        >
                          {getRoleLabel(player.role)}
                        </span>
                        {getIconRoleLabel(player.icon_role) && (
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded border ${getIconRoleColor(
                              player.icon_role
                            )}`}
                          >
                            {getIconRoleLabel(player.icon_role)}
                          </span>
                        )}
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded border ${getStatusColor(
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
                      <p className="text-white font-bold">
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
                      className="mt-3 px-3 py-2 rounded-lg flex items-center gap-2"
                      style={{
                        backgroundColor: getTeamColor(player.team_id) + "20",
                      }}
                    >
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded"
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
                <div className="px-4 py-3 bg-card-hover border-t border-surface-dark flex gap-2">
                  <button
                    onClick={() => setEditingPlayer(player)}
                    className="flex-1 flex items-center justify-center gap-1 h-9 rounded-lg bg-[#283539] text-white text-sm font-medium hover:bg-[#3b4e54] transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      edit
                    </span>
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(player)}
                    className="flex items-center justify-center size-9 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      delete
                    </span>
                  </button>
                </div>
              </div>
            ))
          )}
        </section>
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
            onSuccess={() => {
              fetchPlayers();
              setShowAddPlayer(false);
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
            onSuccess={() => {
              fetchPlayers();
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
            <div className="size-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-3xl text-red-400">
                warning
              </span>
            </div>
            <p className="text-white text-lg font-medium mb-2">
              Are you sure you want to delete{" "}
              <span className="text-primary">{deleteConfirm.name}</span>?
            </p>
            <p className="text-text-secondary text-sm mb-6">
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 h-11 rounded-lg bg-[#283539] text-white font-bold hover:bg-[#3b4e54] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeletePlayer(deleteConfirm.id)}
                className="flex-1 h-11 rounded-lg bg-red-500 text-white font-bold hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Trademark Footer */}
      <div className="text-center py-4 text-text-secondary/50 text-xs border-t border-[#283539]">
        © {new Date().getFullYear()} Made by{" "}
        <span className="text-primary">Nikhil</span>
      </div>
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
      color: "bg-[#1c2e35] text-text-secondary border-[#283539]",
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
          <div className="size-24 rounded-full bg-[#283539] border-2 border-dashed border-[#3b4e54] group-hover:border-primary flex items-center justify-center overflow-hidden transition-colors">
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
          className="w-full h-11 px-4 rounded-lg bg-[#1c2e35] border border-[#283539] text-white placeholder:text-text-secondary/50 focus:outline-none focus:border-primary transition-colors"
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
              className={`h-10 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                formData.role === role.value
                  ? role.color
                  : "bg-[#1c2e35] text-text-secondary border-[#283539] hover:bg-[#283539]"
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
              className={`w-full h-12 rounded-lg border text-left px-3 flex items-center gap-3 transition-all ${
                formData.icon_role === item.value ||
                (item.value === "icon-player" &&
                  (formData.icon_role || "").startsWith("icon-player"))
                  ? `${item.color} shadow-[0_0_0_1px_rgba(13,185,242,0.3)]`
                  : "bg-[#1c2e35] text-text-secondary border-[#283539] hover:bg-[#283539]"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {item.icon}
              </span>
              <div className="leading-tight">
                <p className="text-sm font-semibold text-white">{item.label}</p>
                <p className="text-[11px] text-text-secondary/80">
                  {item.description}
                </p>
              </div>
            </button>
          ))}
        </div>

        {/* Icon Order Option - Only shown when Icon Player is selected */}
        {(formData.icon_role || "").startsWith("icon-player") && (
          <div className="mt-3 p-3 rounded-lg bg-[#1c2e35] border border-[#283539]">
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
                className={`h-10 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                  formData.icon_role === "icon-player-sequence" ||
                  formData.icon_role === "icon-player"
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "bg-[#283539] text-text-secondary border-[#3b4e54] hover:bg-[#3b4e54]"
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
                className={`h-10 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                  formData.icon_role === "icon-player-random"
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "bg-[#283539] text-text-secondary border-[#3b4e54] hover:bg-[#3b4e54]"
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
                className={`h-10 rounded-lg text-sm font-bold transition-all ${
                  formData.base_price === option.value && !showCustomPrice
                    ? "bg-primary text-background-dark"
                    : "bg-[#1c2e35] text-white hover:bg-[#283539]"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowCustomPrice(!showCustomPrice)}
            className={`w-full h-10 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              showCustomPrice
                ? "bg-primary text-background-dark"
                : "bg-[#1c2e35] text-white hover:bg-[#283539] border border-dashed border-[#3b4e54]"
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
                className="flex-1 h-11 px-4 rounded-lg bg-[#1c2e35] border border-[#283539] text-white placeholder:text-text-secondary/50 focus:outline-none focus:border-primary transition-colors"
              />
              <button
                type="button"
                onClick={applyCustomPrice}
                className="px-4 h-11 bg-primary hover:bg-primary-dark text-background-dark font-bold rounded-lg transition-colors"
              >
                Set
              </button>
            </div>
          )}

          <div className="flex items-center justify-between p-3 rounded-lg bg-[#1c2e35] border border-[#283539]">
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
              className={`h-10 rounded-lg text-xs font-bold border transition-all capitalize ${
                formData.status === status
                  ? status === "sold"
                    ? "bg-green-500/20 text-green-400 border-green-500/30"
                    : status === "unsold"
                    ? "bg-red-500/20 text-red-400 border-red-500/30"
                    : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                  : "bg-[#1c2e35] text-text-secondary border-[#283539] hover:bg-[#283539]"
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
              className="w-full h-11 px-4 rounded-lg bg-[#1c2e35] border border-[#283539] text-white focus:outline-none focus:border-primary transition-colors"
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
              className="w-full h-11 px-4 rounded-lg bg-[#1c2e35] border border-[#283539] text-white focus:outline-none focus:border-primary transition-colors"
            />
          </div>
        </>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading}
        className="w-full h-11 bg-primary hover:bg-primary-dark text-background-dark font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
