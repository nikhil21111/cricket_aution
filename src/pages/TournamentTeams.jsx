import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase, formatShortCurrency, uploadImage } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import Modal from "../components/Modal";
import AddTeamForm from "../components/AddTeamForm";
import toast from "react-hot-toast";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const TournamentTeams = () => {
  const { id: tournamentId } = useParams();
  const { user } = useAuth();

  const [tournament, setTournament] = useState(null);
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [expandedTeam, setExpandedTeam] = useState(null);
  const [selectedSquad, setSelectedSquad] = useState(null);
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    if (tournamentId) {
      fetchData();
    }
  }, [tournamentId]);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchTournament(), fetchTeams(), fetchPlayers()]);
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

  const fetchTeams = async () => {
    const { data, error } = await supabase
      .from("teams")
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("created_at", { ascending: true });
    if (error) {
      toast.error("Failed to load teams");
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
      toast.error("Failed to load players");
      return;
    }
    if (data) setPlayers(data);
  };

  const handleDeleteTeam = async (teamId) => {
    try {
      // First, remove team assignment from all players of this team
      await supabase
        .from("players")
        .update({ team_id: null, status: "available", sold_price: null })
        .eq("team_id", teamId);

      // Then delete the team
      const { error } = await supabase.from("teams").delete().eq("id", teamId);

      if (error) throw error;
      toast.success("Team deleted successfully");
      setDeleteConfirm(null);
      fetchTeams();
      fetchPlayers();
    } catch (error) {
      toast.error(error.message || "Failed to delete team");
    }
  };

  // Calculate stats
  const totalSpent = teams.reduce(
    (sum, t) => sum + (t.total_purse - t.remaining_purse),
    0
  );
  const soldPlayers = players.filter((p) => p.status === "sold").length;
  const unsoldPlayers = players.filter((p) => p.status === "unsold").length;

  // Filter & rank teams (search first, then budget filters pick top few)
  const searchedTeams = teams.filter((team) => {
    const matchesSearch =
      team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      team.short_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const topCount = Math.max(1, Math.min(5, searchedTeams.length));

  const highBudgetRanked = [...searchedTeams].sort(
    (a, b) => (b.remaining_purse || 0) - (a.remaining_purse || 0)
  );
  const lowBudgetRanked = [...searchedTeams].sort(
    (a, b) => (a.remaining_purse || 0) - (b.remaining_purse || 0)
  );

  const highBudgetTeams = highBudgetRanked.slice(0, topCount);
  const lowBudgetTeams = lowBudgetRanked.slice(0, topCount);

  const filteredTeams = (() => {
    switch (filter) {
      case "high-budget":
        return highBudgetTeams;
      case "low-budget":
        return lowBudgetTeams;
      case "full-squad":
        return searchedTeams; // full squad view uses layout below
      default:
        return searchedTeams;
    }
  })();

  const getRoleLabel = (role) => {
    switch (role) {
      case "batsman":
        return "BAT";
      case "bowler":
        return "BOWL";
      case "all-rounder":
        return "AR";
      case "wicket-keeper":
        return "WK";
      default:
        return role?.toUpperCase()?.slice(0, 3) || "N/A";
    }
  };

  const getIconLabel = (iconRole) => {
    switch (iconRole) {
      case "icon-player":
      case "icon-player-sequence":
      case "icon-player-random":
        return "Icon";
      case "icon-batsman":
        return "Icon Bat";
      case "icon-bowler":
        return "Icon Bowl";
      case "icon-allrounder":
        return "Icon AR";
      case "icon-keeper":
        return "Icon WK";
      default:
        return "-";
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

  // Group players by role for squad view
  const groupPlayersByRole = (teamPlayers) => {
    const roles = ["batsman", "bowler", "all-rounder", "wicket-keeper"];
    const grouped = {};
    roles.forEach((role) => {
      grouped[role] = teamPlayers.filter((p) => p.role === role);
    });
    // Add any players with other roles
    const otherPlayers = teamPlayers.filter((p) => !roles.includes(p.role));
    if (otherPlayers.length > 0) {
      grouped["other"] = otherPlayers;
    }
    return grouped;
  };

  // Download team squad as PDF
  const downloadSquadPDF = (team) => {
    const teamPlayers = players.filter((p) => p.team_id === team.id);
    const grouped = groupPlayersByRole(teamPlayers);
    const iconCount = teamPlayers.filter(
      (p) => p.icon_role && p.icon_role !== "none"
    ).length;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header background
    doc.setFillColor(28, 46, 53);
    doc.rect(0, 0, pageWidth, 50, "F");

    // Team Name
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text(team.name, pageWidth / 2, 20, { align: "center" });

    // Tournament Name
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(200, 200, 200);
    doc.text(tournament?.name || "Tournament", pageWidth / 2, 30, {
      align: "center",
    });

    // Team Stats
    doc.setFontSize(10);
    doc.setTextColor(13, 185, 242);
    const statsText = `${
      teamPlayers.length
    } Players • Icon Players: ${iconCount} • Total Spent: ${formatShortCurrency(
      team.total_purse - team.remaining_purse
    )} • Remaining: ${formatShortCurrency(team.remaining_purse)}`;
    doc.text(statsText, pageWidth / 2, 42, { align: "center" });

    let yPosition = 60;

    const roleLabels = {
      batsman: "Batters",
      bowler: "Bowlers",
      "all-rounder": "All-Rounders",
      "wicket-keeper": "Wicket-Keepers",
      other: "Others",
    };

    const roleColors = {
      batsman: [59, 130, 246],
      bowler: [239, 68, 68],
      "all-rounder": [168, 85, 247],
      "wicket-keeper": [234, 179, 8],
      other: [107, 114, 128],
    };

    // Add each role section
    Object.entries(grouped).forEach(([role, rolePlayers]) => {
      if (rolePlayers.length === 0) return;

      // Check if we need a new page
      if (yPosition > 250) {
        doc.addPage();
        yPosition = 20;
      }

      // Role header
      const [r, g, b] = roleColors[role] || [107, 114, 128];
      doc.setFillColor(r, g, b);
      doc.roundedRect(14, yPosition - 5, pageWidth - 28, 10, 2, 2, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(
        `${roleLabels[role] || role} (${rolePlayers.length})`,
        20,
        yPosition + 2
      );

      yPosition += 15;

      // Players table
      const tableData = rolePlayers.map((player, index) => [
        index + 1,
        player.name,
        getRoleLabel(player.role),
        getIconLabel(player.icon_role),
        formatShortCurrency(player.sold_price || 0),
      ]);

      autoTable(doc, {
        startY: yPosition,
        head: [["#", "Player Name", "Role", "Icon", "Price"]],
        body: tableData,
        theme: "striped",
        headStyles: {
          fillColor: [40, 53, 57],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 9,
        },
        bodyStyles: {
          textColor: [50, 50, 50],
          fontSize: 9,
        },
        alternateRowStyles: {
          fillColor: [240, 245, 250],
        },
        columnStyles: {
          0: { cellWidth: 15, halign: "center" },
          1: { cellWidth: "auto" },
          2: { cellWidth: 28, halign: "center" },
          3: { cellWidth: 28, halign: "center" },
          4: { cellWidth: 35, halign: "right" },
        },
        margin: { left: 14, right: 14 },
      });

      yPosition = doc.lastAutoTable.finalY + 15;
    });

    // Footer
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Generated on ${new Date().toLocaleDateString()} • Page ${i} of ${totalPages}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: "center" }
      );
    }

    // Download
    doc.save(`${team.short_name}_Squad.pdf`);
    toast.success(`${team.name} squad downloaded!`);
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background-dark">
        <div className="flex flex-col items-center gap-4">
          <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-text-secondary">Loading teams...</p>
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
              Team Summary
            </h1>
            <p className="text-xs text-text-secondary font-medium">
              {tournament?.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddTeam(true)}
            className="flex items-center justify-center px-4 h-10 rounded-lg bg-[#283539] text-white font-bold text-sm hover:bg-[#3b4e54] transition-colors"
          >
            <span className="material-symbols-outlined mr-2">group_add</span>
            Add Team
          </button>
          <Link
            to={`/tournament/${tournamentId}/players`}
            className="flex items-center justify-center px-4 h-10 rounded-lg bg-[#283539] text-white font-bold text-sm hover:bg-[#3b4e54] transition-colors"
          >
            <span className="material-symbols-outlined mr-2">people</span>
            Players
          </Link>
          <Link
            to={`/tournament/${tournamentId}/live`}
            className="flex items-center justify-center px-4 h-10 rounded-lg bg-primary text-background-dark font-bold text-sm hover:bg-primary-dark transition-colors"
          >
            <span className="material-symbols-outlined mr-2">live_tv</span>
            Go Live
          </Link>
        </div>
      </header>

      <main className="flex-1 w-full max-w-[1600px] mx-auto p-4 lg:p-8 flex flex-col gap-8">
        {/* Stats Section */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1 rounded-xl p-6 bg-card-dark border border-[#283539] relative overflow-hidden group">
            <div className="absolute right-0 top-0 h-full w-1 bg-primary/50"></div>
            <div className="flex justify-between items-start z-10">
              <div>
                <p className="text-text-secondary text-sm font-semibold uppercase tracking-wider">
                  Total Purse Spent
                </p>
                <p className="text-3xl font-bold mt-2 tracking-tight">
                  {formatShortCurrency(totalSpent)}
                </p>
              </div>
              <span className="material-symbols-outlined text-primary text-4xl opacity-20 group-hover:opacity-40 transition-opacity">
                payments
              </span>
            </div>
            {teams.length > 0 && (
              <>
                <div className="w-full bg-[#283539] h-1.5 mt-4 rounded-full overflow-hidden">
                  <div
                    className="bg-primary h-full rounded-full"
                    style={{
                      width: `${
                        teams.reduce((s, t) => s + t.total_purse, 0) > 0
                          ? (totalSpent /
                              teams.reduce((s, t) => s + t.total_purse, 0)) *
                            100
                          : 0
                      }%`,
                    }}
                  ></div>
                </div>
                <p className="text-xs text-text-secondary mt-2 text-right">
                  {teams.reduce((s, t) => s + t.total_purse, 0) > 0
                    ? (
                        (totalSpent /
                          teams.reduce((s, t) => s + t.total_purse, 0)) *
                        100
                      ).toFixed(0)
                    : 0}
                  % of total budget
                </p>
              </>
            )}
          </div>

          <div className="flex flex-col gap-1 rounded-xl p-6 bg-card-dark border border-[#283539] relative overflow-hidden group">
            <div className="absolute right-0 top-0 h-full w-1 bg-green-500/50"></div>
            <div className="flex justify-between items-start z-10">
              <div>
                <p className="text-text-secondary text-sm font-semibold uppercase tracking-wider">
                  Players Sold
                </p>
                <p className="text-3xl font-bold mt-2 tracking-tight">
                  {soldPlayers}
                </p>
              </div>
              <span className="material-symbols-outlined text-green-500 text-4xl opacity-20 group-hover:opacity-40 transition-opacity">
                groups
              </span>
            </div>
            <div className="flex gap-2 mt-4 text-xs font-medium text-text-secondary">
              <span className="text-green-500 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">
                  check_circle
                </span>{" "}
                {soldPlayers}
              </span>
              out of {players.length} players
            </div>
          </div>

          <div className="flex flex-col gap-1 rounded-xl p-6 bg-card-dark border border-[#283539] relative overflow-hidden group">
            <div className="absolute right-0 top-0 h-full w-1 bg-orange-500/50"></div>
            <div className="flex justify-between items-start z-10">
              <div>
                <p className="text-text-secondary text-sm font-semibold uppercase tracking-wider">
                  Unsold Players
                </p>
                <p className="text-3xl font-bold mt-2 tracking-tight">
                  {unsoldPlayers}
                </p>
              </div>
              <span className="material-symbols-outlined text-orange-500 text-4xl opacity-20 group-hover:opacity-40 transition-opacity">
                person_off
              </span>
            </div>
            <div className="flex gap-2 mt-4 text-xs font-medium text-text-secondary">
              <span>
                Available:{" "}
                {players.filter((p) => p.status === "available").length}
              </span>
            </div>
          </div>
        </section>

        {/* Filters & Actions */}
        <section className="flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="w-full md:w-auto flex-1 max-w-2xl relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary material-symbols-outlined">
              search
            </span>
            <input
              className="w-full h-12 pl-12 pr-4 rounded-xl bg-card-dark border border-[#283539] focus:border-primary text-white placeholder-text-secondary transition-colors outline-none"
              placeholder="Search teams by name..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 no-scrollbar">
            {[
              { key: "all", label: "All Teams" },
              { key: "high-budget", label: "High Budget" },
              { key: "low-budget", label: "Low Budget" },
              { key: "full-squad", label: "Full Squad" },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => {
                  setFilter(f.key);
                  setSelectedSquad(null);
                  setExpandedTeam(null);
                }}
                className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === f.key
                    ? "bg-primary/10 text-primary border border-primary/20 font-bold"
                    : "bg-card-dark text-text-secondary border border-[#283539] hover:border-[#3b4e54]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </section>

        {/* Team Cards Grid OR Full Squad View */}
        {filter === "full-squad" ? (
          /* Full Squad View - All Teams Grid */
          <section className="space-y-6">
            {selectedSquad ? (
              /* Selected Team Detail View */
              <div className="bg-card-dark rounded-xl border border-primary/50 shadow-[0_0_20px_rgba(13,185,242,0.15)]">
                {/* Team Header */}
                <div className="p-4 border-b border-[#283539] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs border border-white/10 overflow-hidden"
                      style={{ backgroundColor: selectedSquad.color }}
                    >
                      {selectedSquad.logo_url ? (
                        <img
                          src={selectedSquad.logo_url}
                          alt={selectedSquad.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        selectedSquad.short_name
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">
                        {selectedSquad.name}
                      </h3>
                      <p className="text-xs text-text-secondary">
                        {(() => {
                          const squadPlayers = players.filter(
                            (p) => p.team_id === selectedSquad.id
                          );
                          const iconCount = squadPlayers.filter(
                            (p) => p.icon_role && p.icon_role !== "none"
                          ).length;
                          return `${
                            squadPlayers.length
                          } Players • ${iconCount} Icon • ${formatShortCurrency(
                            selectedSquad.remaining_purse
                          )} Remaining`;
                        })()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => downloadSquadPDF(selectedSquad)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-background-dark font-bold hover:bg-primary-dark transition-colors"
                    >
                      <span className="material-symbols-outlined text-lg">
                        download
                      </span>
                      <span className="text-sm font-medium">Download PDF</span>
                    </button>
                    <button
                      onClick={() => setSelectedSquad(null)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#283539] text-text-secondary hover:text-white transition-colors"
                    >
                      <span className="material-symbols-outlined text-lg">
                        arrow_back
                      </span>
                      <span className="text-sm font-medium">All Teams</span>
                    </button>
                  </div>
                </div>

                {/* Players by Role */}
                <div className="p-4">
                  {(() => {
                    const teamPlayers = players.filter(
                      (p) => p.team_id === selectedSquad.id
                    );
                    const grouped = groupPlayersByRole(teamPlayers);

                    if (teamPlayers.length === 0) {
                      return (
                        <div className="text-center py-8 text-text-secondary">
                          <span className="material-symbols-outlined text-3xl mb-2 block">
                            person_off
                          </span>
                          <p className="text-sm">No players acquired yet</p>
                        </div>
                      );
                    }

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {Object.entries(grouped).map(([role, rolePlayers]) => {
                          if (rolePlayers.length === 0) return null;
                          const roleLabels = {
                            batsman: "Batters",
                            bowler: "Bowlers",
                            "all-rounder": "All-Rounders",
                            "wicket-keeper": "Wicket-Keepers",
                            other: "Others",
                          };
                          return (
                            <div
                              key={role}
                              className="bg-[#1c2e35] rounded-lg border border-[#283539] overflow-hidden"
                            >
                              <div className="px-3 py-2 border-b border-[#283539] bg-[#283539]/50">
                                <h5 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                                  {roleLabels[role] || role} (
                                  {rolePlayers.length})
                                </h5>
                              </div>
                              <div className="divide-y divide-[#283539]">
                                {rolePlayers.map((player) => (
                                  <div
                                    key={player.id}
                                    className="px-3 py-2 flex items-center justify-between gap-2"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <div className="size-7 rounded-full bg-[#283539] flex-shrink-0 flex items-center justify-center overflow-hidden">
                                        {player.photo_url ? (
                                          <img
                                            src={player.photo_url}
                                            alt={player.name}
                                            className="w-full h-full object-cover"
                                          />
                                        ) : (
                                          <span className="material-symbols-outlined text-text-secondary text-sm">
                                            person
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2 truncate">
                                        <span className="text-sm text-white truncate">
                                          {player.name}
                                        </span>
                                        {player.icon_role &&
                                          player.icon_role !== "none" && (
                                            <span className="text-[10px] px-2 py-0.5 rounded border border-primary/40 text-primary whitespace-nowrap">
                                              Icon
                                            </span>
                                          )}
                                      </div>
                                    </div>
                                    <span className="text-xs font-bold text-primary whitespace-nowrap">
                                      {formatShortCurrency(player.sold_price)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>
            ) : (
              /* All Teams Grid */
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {teams.length === 0 ? (
                  <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
                    <div className="size-20 rounded-full bg-card-dark flex items-center justify-center text-text-secondary mb-4">
                      <span className="material-symbols-outlined text-4xl">
                        search_off
                      </span>
                    </div>
                    <p className="text-text-secondary text-lg mb-2">
                      No teams found
                    </p>
                    <p className="text-text-secondary text-sm">
                      Add teams to get started
                    </p>
                  </div>
                ) : (
                  teams
                    .filter((team) => {
                      if (!searchQuery) return true;
                      return (
                        team.name
                          .toLowerCase()
                          .includes(searchQuery.toLowerCase()) ||
                        team.short_name
                          .toLowerCase()
                          .includes(searchQuery.toLowerCase())
                      );
                    })
                    .map((team) => {
                      const teamPlayers = players.filter(
                        (p) => p.team_id === team.id
                      );
                      return (
                        <div
                          key={team.id}
                          className="bg-card-dark rounded-xl border border-[#283539] p-4 hover:border-primary/50 hover:shadow-[0_0_15px_rgba(13,185,242,0.1)] transition-all group"
                        >
                          <div
                            className="flex flex-col items-center text-center cursor-pointer"
                            onClick={() => setSelectedSquad(team)}
                          >
                            <div
                              className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-sm border-2 border-white/10 overflow-hidden mb-3 group-hover:scale-110 transition-transform"
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
                            <h3 className="text-sm font-bold text-white leading-tight truncate w-full">
                              {team.name}
                            </h3>
                            <p className="text-xs text-text-secondary mt-1">
                              {teamPlayers.length} Players
                            </p>
                            <div className="mt-2 px-2 py-1 rounded bg-[#1c2e35] border border-[#283539]">
                              <span className="text-xs font-medium text-primary">
                                {formatShortCurrency(team.remaining_purse)}
                              </span>
                            </div>
                          </div>
                          {/* Edit/Delete Buttons */}
                          <div className="flex gap-1 mt-3 pt-3 border-t border-[#283539]">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingTeam(team);
                              }}
                              className="flex-1 flex items-center justify-center h-7 rounded bg-[#283539] text-white text-[10px] font-medium hover:bg-[#3b4e54] transition-colors"
                            >
                              <span className="material-symbols-outlined text-[14px] mr-1">
                                edit
                              </span>
                              Edit
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirm(team);
                              }}
                              className="flex items-center justify-center size-7 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                            >
                              <span className="material-symbols-outlined text-[14px]">
                                delete
                              </span>
                            </button>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            )}
          </section>
        ) : (
          /* Normal Team Cards Grid */
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 auto-rows-min">
            {filteredTeams.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
                <div className="size-20 rounded-full bg-card-dark flex items-center justify-center text-text-secondary mb-4">
                  <span className="material-symbols-outlined text-4xl">
                    search_off
                  </span>
                </div>
                <p className="text-text-secondary text-lg mb-2">
                  No teams found
                </p>
                <p className="text-text-secondary text-sm">
                  Try adjusting your search or filters
                </p>
              </div>
            ) : (
              filteredTeams.map((team) => {
                const teamPlayers = players.filter(
                  (p) => p.team_id === team.id
                );
                const spent = team.total_purse - team.remaining_purse;
                const spentPercent = (spent / team.total_purse) * 100;
                const isExpanded = expandedTeam === team.id;

                return (
                  <div
                    key={team.id}
                    className={`bg-card-dark rounded-xl border transition-all cursor-pointer ${
                      isExpanded
                        ? "col-span-1 md:col-span-2 row-span-2 border-primary/50 shadow-[0_0_20px_rgba(13,185,242,0.15)]"
                        : "border-[#283539] hover:border-primary/50 hover:shadow-[0_0_15px_rgba(13,185,242,0.1)]"
                    }`}
                    onClick={() => setExpandedTeam(isExpanded ? null : team.id)}
                  >
                    {/* Team Header */}
                    <div
                      className={`p-5 ${
                        isExpanded ? "border-b border-[#283539]" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm border border-white/10 overflow-hidden"
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
                          <div>
                            <h3 className="text-lg font-bold text-white leading-tight">
                              {team.name}
                            </h3>
                            <p className="text-xs text-text-secondary">
                              {team.short_name}
                            </p>
                          </div>
                        </div>
                        <span className="material-symbols-outlined text-text-secondary">
                          {isExpanded ? "close_fullscreen" : "open_in_full"}
                        </span>
                      </div>

                      <div className="space-y-3 mt-4">
                        <div className="flex justify-between items-end">
                          <span className="text-sm text-text-secondary">
                            Purse Remaining
                          </span>
                          <span className="text-xl font-bold text-white">
                            {formatShortCurrency(team.remaining_purse)}
                          </span>
                        </div>
                        <div className="w-full bg-[#283539] h-1.5 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${spentPercent}%`,
                              backgroundColor:
                                spentPercent > 80 ? "#ef4444" : team.color,
                            }}
                          ></div>
                        </div>
                        <div className="flex justify-between items-center pt-1">
                          <div className="px-2 py-1 rounded bg-[#1c2e35] text-xs font-medium text-text-secondary border border-[#283539]">
                            Squad: {teamPlayers.length}/25
                          </div>
                          <div className="px-2 py-1 rounded bg-[#1c2e35] text-xs font-medium text-text-secondary border border-[#283539]">
                            Spent: {formatShortCurrency(spent)}
                          </div>
                        </div>
                        {/* Edit/Delete Buttons */}
                        <div className="flex gap-2 mt-3 pt-3 border-t border-[#283539]">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingTeam(team);
                            }}
                            className="flex-1 flex items-center justify-center gap-1 h-8 rounded-lg bg-[#283539] text-white text-xs font-medium hover:bg-[#3b4e54] transition-colors"
                          >
                            <span className="material-symbols-outlined text-[16px]">
                              edit
                            </span>
                            Edit
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirm(team);
                            }}
                            className="flex items-center justify-center size-8 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[16px]">
                              delete
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Content - Roster */}
                    {isExpanded && (
                      <div className="p-4">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-3 flex items-center gap-2">
                          <span className="material-symbols-outlined text-sm">
                            people
                          </span>
                          Squad ({teamPlayers.length})
                        </h4>

                        {teamPlayers.length === 0 ? (
                          <div className="text-center py-6 text-text-secondary">
                            <span className="material-symbols-outlined text-2xl mb-2 block">
                              person_off
                            </span>
                            <p className="text-xs">No players acquired</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[280px] overflow-y-auto">
                            {Object.entries(
                              groupPlayersByRole(teamPlayers)
                            ).map(([role, rolePlayers]) => {
                              if (rolePlayers.length === 0) return null;
                              return rolePlayers.map((player) => (
                                <div
                                  key={player.id}
                                  className="flex items-center justify-between p-2 rounded-lg bg-[#1c2e35] border border-[#283539]"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="size-8 rounded-full bg-[#283539] flex-shrink-0 flex items-center justify-center overflow-hidden">
                                      {player.photo_url ? (
                                        <img
                                          src={player.photo_url}
                                          alt={player.name}
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        <span className="material-symbols-outlined text-text-secondary text-sm">
                                          person
                                        </span>
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-white font-medium text-xs truncate">
                                        {player.name}
                                      </p>
                                      <span
                                        className={`text-[10px] px-1.5 py-0.5 rounded border ${getRoleColor(
                                          player.role
                                        )}`}
                                      >
                                        {getRoleLabel(player.role)}
                                      </span>
                                    </div>
                                  </div>
                                  <p className="text-primary font-bold text-xs whitespace-nowrap">
                                    {formatShortCurrency(player.sold_price)}
                                  </p>
                                </div>
                              ));
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </section>
        )}
      </main>

      {/* Trademark Footer */}
      <div className="text-center py-4 text-text-secondary/50 text-xs border-t border-[#283539]">
        © {new Date().getFullYear()} Made by{" "}
        <span className="text-primary">Nikhil</span>
      </div>

      {/* Live Ticker */}
      {players.filter((p) => p.status === "sold").length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-surface-darker border-t border-[#283539] py-2 px-4 z-40">
          <div className="flex items-center gap-4 text-sm">
            <span className="px-2 py-0.5 rounded bg-primary text-background-dark text-xs font-bold uppercase">
              Latest
            </span>
            <div className="overflow-hidden flex-1 relative">
              <p className="animate-marquee whitespace-nowrap text-text-secondary">
                {players
                  .filter((p) => p.status === "sold")
                  .slice(-5)
                  .map((p) => {
                    const team = teams.find((t) => t.id === p.team_id);
                    return `${p.name} sold to ${
                      team?.short_name || "Unknown"
                    } for ${formatShortCurrency(p.sold_price)}`;
                  })
                  .join(" • ")}
              </p>
            </div>
          </div>
        </div>
      )}

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

      {/* Edit Team Modal */}
      {editingTeam && (
        <Modal
          isOpen={true}
          onClose={() => setEditingTeam(null)}
          title="Edit Team"
        >
          <EditTeamForm
            team={editingTeam}
            onClose={() => setEditingTeam(null)}
            onSuccess={() => {
              fetchTeams();
              setEditingTeam(null);
            }}
          />
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <Modal
          isOpen={true}
          onClose={() => setDeleteConfirm(null)}
          title="Delete Team"
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
              All players assigned to this team will become available again.
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
                onClick={() => handleDeleteTeam(deleteConfirm.id)}
                className="flex-1 h-11 rounded-lg bg-red-500 text-white font-bold hover:bg-red-600 transition-colors"
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

// Edit Team Form Component
const EditTeamForm = ({ team, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: team.name || "",
    short_name: team.short_name || "",
    color: team.color || "#8b5cf6",
    total_purse: team.total_purse || 10000,
  });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(team.logo_url || null);
  const [showCustomPurse, setShowCustomPurse] = useState(false);
  const [customPurseValue, setCustomPurseValue] = useState("");

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (logoPreview && !logoPreview.startsWith("http"))
        URL.revokeObjectURL(logoPreview);
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.short_name) {
      toast.error("Please fill all required fields");
      return;
    }

    setLoading(true);
    try {
      let logo_url = team.logo_url;

      // Upload new logo if provided
      if (logoFile) {
        logo_url = await uploadImage("logos", logoFile);
      }

      // Calculate the difference in purse
      const purseDiff = formData.total_purse - team.total_purse;
      const newRemainingPurse = team.remaining_purse + purseDiff;

      const { error } = await supabase
        .from("teams")
        .update({
          name: formData.name,
          short_name: formData.short_name.toUpperCase(),
          color: formData.color,
          logo_url,
          total_purse: formData.total_purse,
          remaining_purse: Math.max(0, newRemainingPurse),
        })
        .eq("id", team.id);

      if (error) throw error;

      toast.success("Team updated successfully!");
      onSuccess?.();
    } catch (error) {
      toast.error(error.message || "Failed to update team");
    } finally {
      setLoading(false);
    }
  };

  const purseOptions = [
    { label: "5K", value: 5000 },
    { label: "10K", value: 10000 },
    { label: "15K", value: 15000 },
    { label: "20K", value: 20000 },
  ];

  const handleCustomPurseChange = (e) => {
    const value = e.target.value.replace(/[^0-9]/g, "");
    setCustomPurseValue(value);
    if (value) {
      setFormData({ ...formData, total_purse: parseInt(value, 10) });
    }
  };

  const applyCustomPurse = () => {
    if (customPurseValue) {
      setFormData({ ...formData, total_purse: parseInt(customPurseValue, 10) });
      setShowCustomPurse(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Logo Upload */}
      <div className="flex justify-center">
        <label className="cursor-pointer group">
          <div className="size-24 rounded-full bg-[#283539] border-2 border-dashed border-[#3b4e54] group-hover:border-primary flex items-center justify-center overflow-hidden transition-colors">
            {logoPreview ? (
              <img
                src={logoPreview}
                alt="Logo preview"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center text-text-secondary group-hover:text-primary transition-colors">
                <span className="material-symbols-outlined text-2xl">
                  add_photo_alternate
                </span>
                <span className="text-[10px] mt-1">Add Logo</span>
              </div>
            )}
          </div>
          <input
            type="file"
            accept="image/*"
            onChange={handleLogoChange}
            className="hidden"
          />
        </label>
      </div>

      {/* Team Name */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">
          Team Name *
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Mumbai Indians"
          className="w-full h-11 px-4 rounded-lg bg-[#1c2e35] border border-[#283539] text-white placeholder:text-text-secondary/50 focus:outline-none focus:border-primary transition-colors"
        />
      </div>

      {/* Short Name */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">
          Short Name *
        </label>
        <input
          type="text"
          value={formData.short_name}
          onChange={(e) =>
            setFormData({ ...formData, short_name: e.target.value.slice(0, 4) })
          }
          placeholder="e.g., MI"
          maxLength={4}
          className="w-full h-11 px-4 rounded-lg bg-[#1c2e35] border border-[#283539] text-white placeholder:text-text-secondary/50 focus:outline-none focus:border-primary transition-colors uppercase"
        />
      </div>

      {/* Team Color */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">
          Team Color
        </label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={formData.color}
            onChange={(e) =>
              setFormData({ ...formData, color: e.target.value })
            }
            className="w-11 h-11 rounded-lg cursor-pointer bg-transparent border-0"
          />
          <input
            type="text"
            value={formData.color}
            onChange={(e) =>
              setFormData({ ...formData, color: e.target.value })
            }
            className="flex-1 h-11 px-4 rounded-lg bg-[#1c2e35] border border-[#283539] text-white font-mono focus:outline-none focus:border-primary transition-colors"
          />
        </div>
      </div>

      {/* Team Budget */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">
          Team Budget (Points)
        </label>
        <div className="space-y-3">
          {/* Quick Select Buttons */}
          <div className="grid grid-cols-4 gap-2">
            {purseOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setFormData({ ...formData, total_purse: option.value });
                  setShowCustomPurse(false);
                  setCustomPurseValue("");
                }}
                className={`h-10 rounded-lg text-sm font-bold transition-all ${
                  formData.total_purse === option.value && !showCustomPurse
                    ? "bg-primary text-background-dark"
                    : "bg-[#1c2e35] text-white hover:bg-[#283539]"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* Custom Button */}
          <button
            type="button"
            onClick={() => setShowCustomPurse(!showCustomPurse)}
            className={`w-full h-10 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              showCustomPurse
                ? "bg-primary text-background-dark"
                : "bg-[#1c2e35] text-white hover:bg-[#283539] border border-dashed border-[#3b4e54]"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">edit</span>
            Custom Amount
          </button>

          {/* Custom Input Field */}
          {showCustomPurse && (
            <div className="flex gap-2">
              <input
                type="text"
                value={customPurseValue}
                onChange={handleCustomPurseChange}
                placeholder="Enter custom points"
                className="flex-1 h-11 px-4 rounded-lg bg-[#1c2e35] border border-[#283539] text-white placeholder:text-text-secondary/50 focus:outline-none focus:border-primary transition-colors"
              />
              <button
                type="button"
                onClick={applyCustomPurse}
                className="px-4 h-11 bg-primary hover:bg-primary-dark text-background-dark font-bold rounded-lg transition-colors"
              >
                Set
              </button>
            </div>
          )}

          {/* Current Value Display */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-[#1c2e35] border border-[#283539]">
            <span className="text-text-secondary text-sm">
              Selected Budget:
            </span>
            <span className="text-primary font-bold text-lg">
              {formData.total_purse.toLocaleString()} pts
            </span>
          </div>

          {/* Info about budget change */}
          {formData.total_purse !== team.total_purse && (
            <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <p className="text-yellow-400 text-xs">
                <span className="material-symbols-outlined text-[14px] align-middle mr-1">
                  info
                </span>
                Remaining purse will be adjusted by{" "}
                {formData.total_purse > team.total_purse ? "+" : ""}
                {(formData.total_purse - team.total_purse).toLocaleString()} pts
              </p>
            </div>
          )}
        </div>
      </div>

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
            Update Team
          </>
        )}
      </button>
    </form>
  );
};

export default TournamentTeams;
