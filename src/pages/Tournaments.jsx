import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import toast from "react-hot-toast";

const Tournaments = () => {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // tournament to delete
  const [deleting, setDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  useEffect(() => {
    fetchTournaments();
  }, [user]);

  const fetchTournaments = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("tournaments")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTournaments(data || []);
    } catch (error) {
      console.error("Error fetching tournaments:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const handleDeleteTournament = async (tournament) => {
    setDeleting(true);
    try {
      // Delete all related data first (players, teams, auction_state)
      await supabase
        .from("players")
        .delete()
        .eq("tournament_id", tournament.id);

      await supabase.from("teams").delete().eq("tournament_id", tournament.id);

      await supabase
        .from("auction_state")
        .delete()
        .eq("tournament_id", tournament.id);

      // Delete the tournament
      const { error } = await supabase
        .from("tournaments")
        .delete()
        .eq("id", tournament.id);

      if (error) throw error;

      toast.success(`"${tournament.name}" deleted successfully`);
      setDeleteConfirm(null);
      fetchTournaments();
    } catch (error) {
      console.error("Error deleting tournament:", error);
      toast.error("Failed to delete tournament");
    } finally {
      setDeleting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "draft":
        return "bg-gray-500/20 text-gray-400 border-gray-500/20";
      case "setup":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/20";
      case "live":
        return "bg-green-500/20 text-green-400 border-green-500/20";
      case "completed":
        return "bg-primary/20 text-primary border-primary/20";
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/20";
    }
  };

  const filteredTournaments = tournaments.filter((tournament) =>
    tournament.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tournament.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark text-text-primary dark:text-slate-100">
      {/* Header */}
      <header className="h-20 flex items-center justify-between px-6 border-b-3 border-text-primary dark:border-text-secondary-dark bg-background-light dark:bg-background-dark sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="size-10 border-2 border-primary bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined">gavel</span>
            </div>
            <div>
              <h1 className="text-text-primary dark:text-slate-100 text-xl font-display font-black uppercase leading-none">Auction Pro</h1>
              <p className="text-text-secondary dark:text-text-secondary-dark text-xs font-mono font-bold uppercase mt-1">Tournament Manager</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 px-4 py-2 border-2 border-text-primary dark:border-text-secondary-dark bg-background-light dark:bg-card-dark shadow-[2px_2px_0px_var(--border-color)]">
            <div className="size-8 rounded-full border border-primary bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
              {user?.user_metadata?.full_name?.charAt(0)?.toUpperCase() ||
                user?.email?.charAt(0)?.toUpperCase()}
            </div>
            <div className="hidden sm:block">
              <p className="text-text-primary dark:text-slate-100 text-sm font-bold leading-none">
                {user?.user_metadata?.full_name || "User"}
              </p>
              <p className="text-text-secondary dark:text-text-secondary-dark text-xs leading-none mt-1">
                {user?.email}
              </p>
            </div>
          </div>
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
          <button
            onClick={handleSignOut}
            className="flex items-center justify-center size-10 border-2 border-red-500/50 bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors shadow-[2px_2px_0px_rgba(239,68,68,0.4)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_rgba(239,68,68,0.4)]"
          >
            <span className="material-symbols-outlined">logout</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6 max-w-6xl mx-auto">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-display font-black text-text-primary dark:text-slate-100 uppercase">My Tournaments</h2>
            <p className="text-text-secondary dark:text-text-secondary-dark mt-1">
              Create and manage your auction tournaments
            </p>
          </div>
          <div className="flex flex-col sm:flex-row w-full md:w-auto items-stretch sm:items-center gap-4">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-64">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-text-secondary dark:text-text-secondary-dark">
                <span className="material-symbols-outlined text-lg">search</span>
              </span>
              <input
                type="text"
                placeholder="Search tournaments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-11 pl-10 pr-4 border-2 border-text-primary dark:border-text-secondary-dark bg-background-light dark:bg-card-dark text-text-primary dark:text-slate-100 font-body text-sm placeholder-text-secondary dark:placeholder-text-secondary-dark shadow-[3px_3px_0px_var(--border-color)] focus:outline-none focus:shadow-[4px_4px_0px_var(--accent-crimson)] focus:border-primary transition-all"
              />
            </div>
            
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center justify-center gap-2 h-11 px-5 border-2 border-text-primary dark:border-text-secondary-dark bg-primary hover:bg-primary-dark text-white font-display font-bold uppercase tracking-wider shadow-[3px_3px_0px_var(--border-color)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_var(--border-color)] transition-all whitespace-nowrap"
            >
              <span className="material-symbols-outlined">add</span>
              New Tournament
            </button>
          </div>
        </div>

        {/* Tournament List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4">
              <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="text-text-secondary">Loading tournaments...</p>
            </div>
          </div>
        ) : tournaments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="size-20 rounded-2xl bg-[#1c2e35] flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-4xl text-text-secondary">
                trophy
              </span>
            </div>
            <h3 className="text-xl font-bold text-text-primary dark:text-slate-100 mb-2">
              No tournaments yet
            </h3>
            <p className="text-text-secondary max-w-sm mb-6">
              Create your first tournament to start managing teams, players, and
              live auctions.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 h-11 px-5 border-2 border-text-primary dark:border-text-secondary-dark bg-primary hover:bg-primary-dark text-white font-display font-bold uppercase tracking-wider shadow-[3px_3px_0px_var(--border-color)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_var(--border-color)] transition-all"
            >
              <span className="material-symbols-outlined">add</span>
              Create Tournament
            </button>
          </div>
        ) : filteredTournaments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-text-primary dark:border-text-secondary-dark p-6">
            <div className="size-16 border-2 border-dashed border-text-primary dark:border-text-secondary-dark bg-background-light dark:bg-card-dark flex items-center justify-center mb-4 text-text-secondary dark:text-text-secondary-dark shadow-[3px_3px_0px_var(--border-color)]">
              <span className="material-symbols-outlined text-3xl">search_off</span>
            </div>
            <h3 className="text-lg font-display font-black text-text-primary dark:text-slate-100 mb-2 uppercase">
              No matching tournaments
            </h3>
            <p className="text-text-secondary dark:text-text-secondary-dark max-w-sm mb-6">
              No tournaments matched your search query. Try searching for a different keyword or name.
            </p>
            <button
              onClick={() => setSearchQuery("")}
              className="h-10 px-4 border-2 border-text-primary dark:border-text-secondary-dark bg-background-light dark:bg-card-dark hover:bg-background-tertiary text-text-primary dark:text-slate-100 font-display font-bold uppercase tracking-wider shadow-[3px_3px_0px_var(--border-color)] active:translate-x-[1px] active:translate-y-[1px]"
            >
              Clear Search
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTournaments.map((tournament) => (
              <div
                key={tournament.id}
                className="group bg-background-light dark:bg-card-dark border-2 border-text-primary dark:border-text-secondary-dark p-6 transition-all relative shadow-[4px_4px_0px_var(--border-color)] hover:shadow-[6px_6px_0px_var(--border-color)] hover:-translate-x-0.5 hover:-translate-y-0.5"
              >
                <Link to={`/tournament/${tournament.id}`} className="block">
                  <div className="flex items-start justify-between mb-4">
                    <div className="size-12 border-2 border-primary bg-primary/10 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                      <span className="material-symbols-outlined">trophy</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-mono font-bold px-2 py-1 border-2 ${getStatusBadge(
                          tournament.status
                        )}`}
                      >
                        {tournament.status?.toUpperCase()}
                      </span>
                      {/* Delete Button */}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDeleteConfirm(tournament);
                        }}
                        className="size-8 border-2 border-red-500/50 bg-red-500/10 text-red-500 hover:bg-red-500/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete Tournament"
                      >
                        <span className="material-symbols-outlined text-lg">
                          delete
                        </span>
                      </button>
                    </div>
                  </div>
                  <h3 className="text-lg font-display font-black text-text-primary dark:text-slate-100 mb-2 group-hover:text-primary transition-colors uppercase leading-tight">
                    {tournament.name}
                  </h3>
                  {tournament.description && (
                    <p className="text-text-secondary dark:text-text-secondary-dark text-sm line-clamp-2 mb-4 leading-relaxed">
                      {tournament.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-text-secondary dark:text-text-secondary-dark pt-4 border-t border-text-primary dark:border-text-secondary-dark font-mono font-bold uppercase">
                    <div className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-base">
                        groups
                      </span>
                      <span>{tournament.teams_count || 0} Teams</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-base">
                        person
                      </span>
                      <span>{tournament.players_count || 0} Players</span>
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Tournament Modal */}
      {showCreateModal && (
        <CreateTournamentModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchTournaments();
          }}
          userId={user?.id}
        />
      )}

      {/* Trademark Footer */}
      <footer className="text-center py-6 text-text-secondary dark:text-text-secondary-dark font-mono font-bold uppercase text-xs border-t-3 border-text-primary dark:border-text-secondary-dark mt-16 bg-background-light dark:bg-background-dark">
        © {new Date().getFullYear()} Made by{" "}
        <span className="text-primary font-black">Nikhil</span>
      </footer>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-background-light dark:bg-card-dark border-3 border-text-primary dark:border-text-secondary-dark p-6 w-full max-w-md shadow-[8px_8px_0px_var(--border-color)]">
            <div className="flex items-center gap-4 mb-4">
              <div className="size-12 border-2 border-red-500 bg-red-500/10 flex items-center justify-center text-red-500">
                <span className="material-symbols-outlined text-2xl">
                  warning
                </span>
              </div>
              <div>
                <h3 className="text-xl font-display font-black text-text-primary dark:text-slate-100 uppercase">
                  Delete Tournament
                </h3>
                <p className="text-text-secondary dark:text-text-secondary-dark text-xs font-mono font-bold uppercase mt-0.5">
                  This action cannot be undone
                </p>
              </div>
            </div>

            <p className="text-text-secondary dark:text-text-secondary-dark text-sm mb-6 leading-relaxed">
              Are you sure you want to delete{" "}
              <span className="text-primary font-bold">
                "{deleteConfirm.name}"
              </span>
              ? This will permanently remove the tournament along with all its
              teams, players, and auction data.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                className="flex-1 h-11 px-4 border-2 border-text-primary dark:border-text-secondary-dark bg-background-light dark:bg-card-dark hover:bg-background-tertiary text-text-primary dark:text-slate-100 font-display font-bold uppercase tracking-wider shadow-[3px_3px_0px_var(--border-color)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_var(--border-color)] transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteTournament(deleteConfirm)}
                disabled={deleting}
                className="flex-1 h-11 px-4 border-2 border-red-500 bg-red-500 hover:bg-red-600 text-white font-display font-bold uppercase tracking-wider shadow-[3px_3px_0px_rgba(239,68,68,0.5)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_rgba(239,68,68,0.5)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Deleting...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-lg">
                      delete
                    </span>
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Create Tournament Modal Component
const CreateTournamentModal = ({ onClose, onSuccess, userId }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    default_purse: 10000,
    default_base_price: 500,
  });
  const [showCustomPurse, setShowCustomPurse] = useState(false);
  const [customPurseValue, setCustomPurseValue] = useState("");
  const [showCustomBasePrice, setShowCustomBasePrice] = useState(false);
  const [customBasePriceValue, setCustomBasePriceValue] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Please enter tournament name");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("tournaments")
        .insert({
          name: formData.name.trim(),
          description: formData.description.trim(),
          default_purse: formData.default_purse,
          default_base_price: formData.default_base_price,
          user_id: userId,
          status: "draft",
          teams_count: 0,
          players_count: 0,
        })
        .select()
        .single();

      if (error) throw error;

      // Create auction_state for this tournament
      await supabase.from("auction_state").insert({
        tournament_id: data.id,
        is_live: false,
        current_player_id: null,
        highest_bid: 0,
        highest_bidder_id: null,
      });

      toast.success("Tournament created!");
      navigate(`/tournament/${data.id}`);
      onSuccess?.();
    } catch (error) {
      toast.error(error.message || "Failed to create tournament");
    } finally {
      setLoading(false);
    }
  };

  const purseOptions = [
    { label: "5K", value: 5000 },
    { label: "10K", value: 10000 },
    { label: "20K", value: 20000 },
    { label: "50K", value: 50000 },
    { label: "1L", value: 100000 },
  ];

  const basePriceOptions = [
    { label: "100", value: 100 },
    { label: "500", value: 500 },
    { label: "1K", value: 1000 },
    { label: "5K", value: 5000 },
  ];

  const handleCustomPurseChange = (e) => {
    const value = e.target.value.replace(/[^0-9]/g, "");
    setCustomPurseValue(value);
    if (value) {
      setFormData({ ...formData, default_purse: parseInt(value, 10) });
    }
  };

  const handleCustomBasePriceChange = (e) => {
    const value = e.target.value.replace(/[^0-9]/g, "");
    setCustomBasePriceValue(value);
    if (value) {
      setFormData({ ...formData, default_base_price: parseInt(value, 10) });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      ></div>
      <div className="relative bg-[var(--bg-primary)] border-2 border-[var(--border-color)] w-full max-w-md max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200 shadow-[var(--shadow-md)]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b-2 border-[var(--border-color)]">
          <div>
            <h3 className="text-xl font-display font-black uppercase text-[var(--text-primary)]">Create Tournament</h3>
            <p className="text-text-secondary text-sm">
              Set up a new auction tournament
            </p>
          </div>
          <button
            onClick={onClose}
            className="size-9 border-2 border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-primary hover:text-white transition-colors flex items-center justify-center"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Tournament Name */}
          <div>
            <label className="block text-sm font-bold uppercase text-text-secondary mb-2">
              Tournament Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="e.g., IPL 2026 Auction"
              className="w-full h-12 px-4 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-text-secondary/60 focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-bold uppercase text-text-secondary mb-2">
              Description (Optional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Brief description of your tournament..."
              rows={3}
              className="w-full px-4 py-3 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-text-secondary/60 focus:outline-none focus:border-primary transition-colors resize-none"
            />
          </div>

          {/* Default Purse */}
          <div>
            <label className="block text-sm font-bold uppercase text-text-secondary mb-2">
              Default Team Budget (Points)
            </label>
            <div className="space-y-3">
              <div className="grid grid-cols-5 gap-2">
                {purseOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, default_purse: option.value });
                      setShowCustomPurse(false);
                      setCustomPurseValue("");
                    }}
                    className={`h-10 text-sm font-bold transition-all ${
                      formData.default_purse === option.value &&
                      !showCustomPurse
                        ? "bg-primary text-white border-2 border-[var(--border-color)]"
                        : "bg-[var(--bg-primary)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] border-2 border-[var(--border-color)]"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {/* Custom Purse Button */}
              <button
                type="button"
                onClick={() => setShowCustomPurse(!showCustomPurse)}
                className={`w-full h-10 text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                  showCustomPurse
                    ? "bg-primary text-white border-2 border-[var(--border-color)]"
                    : "bg-[var(--bg-primary)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] border-2 border-dashed border-[var(--border-color)]"
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">
                  edit
                </span>
                Custom Amount
              </button>

              {/* Custom Purse Input */}
              {showCustomPurse && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customPurseValue}
                    onChange={handleCustomPurseChange}
                    placeholder="Enter custom points"
                    className="flex-1 h-11 px-4 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-text-secondary/60 focus:outline-none focus:border-primary transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCustomPurse(false)}
                    className="px-4 h-11 bg-primary hover:bg-primary-dark text-white font-bold border-2 border-[var(--border-color)] transition-colors"
                  >
                    Set
                  </button>
                </div>
              )}

              {/* Current Value Display */}
              <div className="flex items-center justify-between p-3 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)]">
                <span className="text-text-secondary text-sm font-bold uppercase">
                  Selected Budget:
                </span>
                <span className="text-primary font-bold text-lg">
                  {formData.default_purse.toLocaleString()} pts
                </span>
              </div>
            </div>
          </div>

          {/* Default Base Price */}
          <div>
            <label className="block text-sm font-bold uppercase text-text-secondary mb-2">
              Default Player Base Price (Points)
            </label>
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-2">
                {basePriceOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        default_base_price: option.value,
                      });
                      setShowCustomBasePrice(false);
                      setCustomBasePriceValue("");
                    }}
                    className={`h-10 text-sm font-bold transition-all ${
                      formData.default_base_price === option.value &&
                      !showCustomBasePrice
                        ? "bg-primary text-white border-2 border-[var(--border-color)]"
                        : "bg-[var(--bg-primary)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] border-2 border-[var(--border-color)]"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {/* Custom Base Price Button */}
              <button
                type="button"
                onClick={() => setShowCustomBasePrice(!showCustomBasePrice)}
                className={`w-full h-10 text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                  showCustomBasePrice
                    ? "bg-primary text-white border-2 border-[var(--border-color)]"
                    : "bg-[var(--bg-primary)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] border-2 border-dashed border-[var(--border-color)]"
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">
                  edit
                </span>
                Custom Amount
              </button>

              {/* Custom Base Price Input */}
              {showCustomBasePrice && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customBasePriceValue}
                    onChange={handleCustomBasePriceChange}
                    placeholder="Enter custom points"
                    className="flex-1 h-11 px-4 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-text-secondary/60 focus:outline-none focus:border-primary transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCustomBasePrice(false)}
                    className="px-4 h-11 bg-primary hover:bg-primary-dark text-white font-bold border-2 border-[var(--border-color)] transition-colors"
                  >
                    Set
                  </button>
                </div>
              )}

              {/* Current Value Display */}
              <div className="flex items-center justify-between p-3 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)]">
                <span className="text-text-secondary text-sm font-bold uppercase">
                  Selected Base Price:
                </span>
                <span className="text-primary font-bold text-lg">
                  {formData.default_base_price.toLocaleString()} pts
                </span>
              </div>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 border-2 border-[var(--border-color)] bg-primary hover:bg-primary-dark text-white text-sm font-display font-bold uppercase tracking-wider shadow-[3px_3px_0px_var(--border-color)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_var(--border-color)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="size-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Creating...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined">add</span>
                Create Tournament
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Tournaments;
