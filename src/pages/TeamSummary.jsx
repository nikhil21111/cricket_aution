import { useState } from "react";
import { Link } from "react-router-dom";
import { formatCurrency, formatShortCurrency } from "../lib/supabase";
import jsPDF from "jspdf";
import "jspdf-autotable";

const TeamSummary = ({ teams, players, refreshData }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [expandedTeam, setExpandedTeam] = useState(null);
  const [selectedSquad, setSelectedSquad] = useState(null);

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
        return searchedTeams; // handled separately in layout, but keep for consistency
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
  const downloadTeamPDF = (team, teamPlayers) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFillColor(28, 46, 53);
    doc.rect(0, 0, pageWidth, 45, "F");

    // Team name
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text(team.name, 14, 20);

    // Team info
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(180, 180, 180);
    doc.text(`Short Name: ${team.short_name}`, 14, 30);
    doc.text(`Total Players: ${teamPlayers.length}`, 14, 38);

    // Budget info on right side
    doc.setTextColor(13, 185, 242);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    const spent = team.total_purse - team.remaining_purse;
    doc.text(
      `Remaining: ${formatShortCurrency(team.remaining_purse)}`,
      pageWidth - 14,
      20,
      { align: "right" }
    );
    doc.text(`Spent: ${formatShortCurrency(spent)}`, pageWidth - 14, 30, {
      align: "right",
    });
    doc.text(
      `Total Purse: ${formatShortCurrency(team.total_purse)}`,
      pageWidth - 14,
      38,
      { align: "right" }
    );

    // Player table
    const tableData = teamPlayers.map((player, index) => [
      index + 1,
      player.name,
      getRoleLabel(player.role),
      formatShortCurrency(player.base_price || 0),
      formatShortCurrency(player.sold_price || 0),
    ]);

    doc.autoTable({
      startY: 55,
      head: [["#", "Player Name", "Role", "Base Price", "Sold Price"]],
      body: tableData,
      theme: "grid",
      headStyles: {
        fillColor: [13, 185, 242],
        textColor: [0, 0, 0],
        fontStyle: "bold",
        halign: "center",
      },
      styles: {
        fontSize: 10,
        cellPadding: 4,
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 15 },
        1: { halign: "left" },
        2: { halign: "center", cellWidth: 25 },
        3: { halign: "right", cellWidth: 35 },
        4: { halign: "right", cellWidth: 35 },
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
    });

    // Footer with total
    const finalY = doc.lastAutoTable.finalY + 10;
    const totalSpentByTeam = teamPlayers.reduce(
      (sum, p) => sum + (p.sold_price || 0),
      0
    );
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text(
      `Total Amount Spent: ${formatShortCurrency(totalSpentByTeam)}`,
      pageWidth - 14,
      finalY,
      { align: "right" }
    );

    // Download date
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`,
      14,
      finalY
    );

    doc.save(`${team.name.replace(/\s+/g, "_")}_Squad.pdf`);
  };

  // Download all teams summary as PDF
  const downloadAllTeamsPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFillColor(28, 46, 53);
    doc.rect(0, 0, pageWidth, 35, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("All Teams - Squad Summary", 14, 22);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(180, 180, 180);
    doc.text(
      `Total Teams: ${teams.length} | Total Players Sold: ${soldPlayers}`,
      14,
      30
    );

    let yPosition = 45;

    teams.forEach((team, teamIndex) => {
      const teamPlayers = players.filter((p) => p.team_id === team.id);

      // Check if we need a new page
      if (yPosition > 250) {
        doc.addPage();
        yPosition = 20;
      }

      // Team header
      doc.setFillColor(40, 53, 57);
      doc.rect(14, yPosition - 6, pageWidth - 28, 10, "F");
      doc.setTextColor(13, 185, 242);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`${team.name} (${team.short_name})`, 16, yPosition);
      doc.setTextColor(180, 180, 180);
      doc.setFontSize(10);
      doc.text(
        `${teamPlayers.length} Players | ${formatShortCurrency(
          team.remaining_purse
        )} Remaining`,
        pageWidth - 16,
        yPosition,
        { align: "right" }
      );

      yPosition += 8;

      if (teamPlayers.length > 0) {
        const tableData = teamPlayers.map((player, index) => [
          index + 1,
          player.name,
          getRoleLabel(player.role),
          formatShortCurrency(player.sold_price || 0),
        ]);

        doc.autoTable({
          startY: yPosition,
          head: [["#", "Player Name", "Role", "Price"]],
          body: tableData,
          theme: "grid",
          headStyles: {
            fillColor: [13, 185, 242],
            textColor: [0, 0, 0],
            fontStyle: "bold",
            halign: "center",
            fontSize: 9,
          },
          styles: {
            fontSize: 9,
            cellPadding: 2,
          },
          columnStyles: {
            0: { halign: "center", cellWidth: 12 },
            1: { halign: "left" },
            2: { halign: "center", cellWidth: 20 },
            3: { halign: "right", cellWidth: 30 },
          },
          alternateRowStyles: {
            fillColor: [245, 245, 245],
          },
          margin: { left: 14, right: 14 },
        });

        yPosition = doc.lastAutoTable.finalY + 15;
      } else {
        doc.setTextColor(128, 128, 128);
        doc.setFontSize(9);
        doc.text("No players acquired", 16, yPosition + 5);
        yPosition += 20;
      }
    });

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setTextColor(128, 128, 128);
      doc.text(
        `Page ${i} of ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: "center" }
      );
      doc.text(
        `Generated on: ${new Date().toLocaleDateString()}`,
        14,
        doc.internal.pageSize.getHeight() - 10
      );
    }

    doc.save("All_Teams_Squad_Summary.pdf");
  };

  return (
    <div className="bg-background-dark text-white font-display min-h-screen flex flex-col overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-[#283539] bg-background-dark/90 backdrop-blur-md px-6 py-4 lg:px-10">
        <div className="flex items-center gap-4">
          <Link
            to="/"
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
              Auction Dashboard
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-2 text-sm font-medium text-text-secondary">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            System Online
          </div>
          <div className="flex gap-3">
            <Link
              to="/live"
              className="flex items-center justify-center px-4 h-10 rounded-lg bg-primary text-background-dark font-bold text-sm hover:bg-primary-dark transition-colors"
            >
              <span className="material-symbols-outlined mr-2">live_tv</span>
              Go Live
            </Link>
          </div>
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
                        (totalSpent /
                          teams.reduce((s, t) => s + t.total_purse, 0)) *
                        100
                      }%`,
                    }}
                  ></div>
                </div>
                <p className="text-xs text-text-secondary mt-2 text-right">
                  {(
                    (totalSpent /
                      teams.reduce((s, t) => s + t.total_purse, 0)) *
                    100
                  ).toFixed(0)}
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
                        {
                          players.filter((p) => p.team_id === selectedSquad.id)
                            .length
                        }{" "}
                        Players •{" "}
                        {formatShortCurrency(selectedSquad.remaining_purse)}{" "}
                        Remaining
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const teamPlayers = players.filter(
                          (p) => p.team_id === selectedSquad.id
                        );
                        downloadTeamPDF(selectedSquad, teamPlayers);
                      }}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-colors"
                      title="Download Squad as PDF"
                    >
                      <span className="material-symbols-outlined text-lg">
                        download
                      </span>
                      <span className="text-sm font-medium hidden sm:inline">
                        Download PDF
                      </span>
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
                                      <span className="text-sm text-white truncate">
                                        {player.name}
                                      </span>
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
              <>
                {/* Download All Button */}
                {teams.length > 0 && (
                  <div className="flex justify-end mb-4">
                    <button
                      onClick={downloadAllTeamsPDF}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-colors"
                    >
                      <span className="material-symbols-outlined text-lg">
                        download
                      </span>
                      <span className="text-sm font-medium">
                        Download All Teams PDF
                      </span>
                    </button>
                  </div>
                )}
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
                            onClick={() => setSelectedSquad(team)}
                            className="bg-card-dark rounded-xl border border-[#283539] p-4 cursor-pointer hover:border-primary/50 hover:shadow-[0_0_15px_rgba(13,185,242,0.1)] transition-all group"
                          >
                            <div className="flex flex-col items-center text-center">
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
                          </div>
                        );
                      })
                  )}
                </div>
              </>
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
                      </div>
                    </div>

                    {/* Expanded Content - Roster */}
                    {isExpanded && (
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm">
                              people
                            </span>
                            Squad ({teamPlayers.length})
                          </h4>
                          {teamPlayers.length > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                downloadTeamPDF(team, teamPlayers);
                              }}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-colors text-xs font-medium"
                              title="Download Squad as PDF"
                            >
                              <span className="material-symbols-outlined text-sm">
                                download
                              </span>
                              Download PDF
                            </button>
                          )}
                        </div>

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
    </div>
  );
};

export default TeamSummary;
