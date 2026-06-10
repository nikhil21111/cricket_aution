import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase, formatShortCurrency, uploadImage } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import Modal from "../components/Modal";
import AddTeamForm from "../components/AddTeamForm";
import BulkImportTeams from "../components/BulkImportTeams";
import toast from "react-hot-toast";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const TournamentTeams = () => {
  const { id: tournamentId } = useParams();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [tournament, setTournament] = useState(null);
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [expandedTeam, setExpandedTeam] = useState(null);
  const [selectedSquad, setSelectedSquad] = useState(null);
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [isQuickEdit, setIsQuickEdit] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [editedTeams, setEditedTeams] = useState({});
  const [savingInlineIds, setSavingInlineIds] = useState(new Set());

  const handleInlineChange = (teamId, fieldName, value) => {
    setEditedTeams(prev => {
      const original = teams.find(t => t.id === teamId);
      const teamDraft = prev[teamId] || { ...original };
      return { ...prev, [teamId]: { ...teamDraft, [fieldName]: value } };
    });
  };

  const isTeamModified = (team) => {
    const draft = editedTeams[team.id];
    if (!draft) return false;
    return (
      draft.name !== team.name ||
      draft.short_name !== team.short_name ||
      draft.color !== team.color ||
      draft.total_purse !== team.total_purse
    );
  };

  const handleResetInline = (teamId) => {
    setEditedTeams(prev => {
      const next = { ...prev };
      delete next[teamId];
      return next;
    });
  };

  const handleSaveInline = async (teamId) => {
    const draft = editedTeams[teamId];
    if (!draft) return;
    const original = teams.find(t => t.id === teamId);
    if (!original) return;

    if (!draft.name.trim() || !draft.short_name.trim()) {
      toast.error("Name and Short Name are required");
      return;
    }

    if (draft.total_purse <= 0) {
      toast.error("Budget must be greater than 0");
      return;
    }

    const spent = original.total_purse - original.remaining_purse;
    const nextRemaining = draft.total_purse - spent;
    if (nextRemaining < 0) {
      toast.error(`New budget is too low. Team has already spent ${spent} pts.`);
      return;
    }

    setSavingInlineIds(prev => new Set(prev).add(teamId));
    try {
      const { error } = await supabase
        .from("teams")
        .update({
          name: draft.name,
          short_name: draft.short_name.toUpperCase(),
          color: draft.color,
          total_purse: draft.total_purse,
          remaining_purse: nextRemaining,
        })
        .eq("id", teamId);

      if (error) throw error;

      setEditedTeams(prev => {
        const next = { ...prev };
        delete next[teamId];
        return next;
      });

      setTeams(prev => prev.map(t => t.id === teamId ? { ...t, ...draft, remaining_purse: nextRemaining, short_name: draft.short_name.toUpperCase() } : t));
      toast.success(`${draft.name} updated successfully!`);
    } catch (error) {
      console.error("Save inline team failed:", error);
      toast.error(error.message || "Failed to update team");
    } finally {
      setSavingInlineIds(prev => {
        const next = new Set(prev);
        next.delete(teamId);
        return next;
      });
    }
  };

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
      setTeams((prev) => prev.filter((t) => t.id !== teamId));
      setPlayers((prev) =>
        prev.map((p) =>
          p.team_id === teamId
            ? { ...p, team_id: null, status: "available", sold_price: null }
            : p
        )
      );
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
    const iconCount = teamPlayers.filter(
      (p) => p.icon_role && p.icon_role !== "none"
    ).length;

    const hexToRgb = (hex) => {
      if (!hex) return [15, 23, 42]; // Slate default
      let c = hex.replace("#", "");
      if (c.length === 3) {
        c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
      }
      const r = parseInt(c.substring(0, 2), 16);
      const g = parseInt(c.substring(2, 4), 16);
      const b = parseInt(c.substring(4, 6), 16);
      return [r, g, b];
    };

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Helper: Draw standard page outline (Double Border)
    const drawPageBorders = (pdf) => {
      pdf.setDrawColor(15, 23, 42);
      // Outer border (thick line)
      pdf.setLineWidth(0.8);
      pdf.rect(10, 10, pageWidth - 20, pageHeight - 20);
      
      // Inner border (thin line)
      pdf.setLineWidth(0.25);
      pdf.rect(11.5, 11.5, pageWidth - 23, pageHeight - 23);
    };

    // Helper: Draw page header masthead
    const drawPageHeader = (pdf) => {
      // Top Strip line (thin)
      pdf.setLineWidth(0.25);
      pdf.setDrawColor(15, 23, 42);
      pdf.line(11.5, 19.5, pageWidth - 11.5, 19.5);
      
      // Top Strip texts
      pdf.setFont("courier", "bold");
      pdf.setFontSize(7.5);
      pdf.setTextColor(15, 23, 42);
      pdf.text("OFFICIAL AUCTION DRAFT RECORD", 15, 16.5);
      
      const tourName = (tournament?.name || "TOURNAMENT").toUpperCase();
      pdf.text(tourName, pageWidth / 2, 16.5, { align: "center" });
      
      const today = new Date().toISOString().split('T')[0];
      pdf.text(`GEN: ${today}`, pageWidth - 15, 16.5, { align: "right" });
      
      // Top Strip line (thick)
      pdf.setLineWidth(0.8);
      pdf.line(11.5, 20.5, pageWidth - 11.5, 20.5);

      // Logo initials block (using team color)
      const [r, g, b] = hexToRgb(team.color);
      pdf.setFillColor(r, g, b);
      pdf.setDrawColor(15, 23, 42);
      pdf.setLineWidth(0.8);
      pdf.rect(15, 24, 18, 18, "FD");

      // Initials text inside logo box
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      const shortName = (team.short_name || "TM").toUpperCase();
      if (shortName.length > 3) {
        pdf.setFontSize(14);
      } else if (shortName.length === 3) {
        pdf.setFontSize(18);
      } else {
        pdf.setFontSize(22);
      }
      pdf.text(shortName, 24, 34.5, { align: "center" });

      // Team Title and subtitle beside logo
      pdf.setTextColor(15, 23, 42);
      pdf.setFont("times", "bold");
      pdf.setFontSize(18);
      pdf.text(`${team.name.toUpperCase()} SQUAD ROSTER`, 37, 31.5);
      
      pdf.setFont("times", "italic");
      pdf.setFontSize(9.5);
      pdf.setTextColor(100, 116, 139);
      pdf.text("Official tournament roster draft manifest & squad stats", 37, 36.5);

      // Stats strip borders
      pdf.setDrawColor(15, 23, 42);
      pdf.setLineWidth(0.4);
      pdf.line(11.5, 45, pageWidth - 11.5, 45);
      
      // Stats strip background
      pdf.setFillColor(248, 250, 252);
      pdf.rect(11.75, 45.2, pageWidth - 23.5, 7.6, "F");
      
      pdf.line(11.5, 53, pageWidth - 11.5, 53);

      // Stats labels & values
      pdf.setTextColor(15, 23, 42);
      pdf.setFont("courier", "bold");
      pdf.setFontSize(8);

      const spent = team.total_purse - team.remaining_purse;
      const stats = [
        { label: "PLAYERS", val: `${teamPlayers.length} / 15` },
        { label: "ICON PLAYERS", val: `${iconCount}` },
        { label: "TOTAL SPENT", val: formatShortCurrency(spent) },
        { label: "REMAINING", val: formatShortCurrency(team.remaining_purse) }
      ];

      const segmentWidth = (pageWidth - 23) / 4;
      stats.forEach((stat, i) => {
        const xPos = 11.5 + i * segmentWidth + segmentWidth / 2;
        pdf.text(`${stat.label}: ${stat.val}`, xPos, 50.2, { align: "center" });
        if (i < 3) {
          pdf.setLineWidth(0.15);
          pdf.line(11.5 + (i + 1) * segmentWidth, 45.5, 11.5 + (i + 1) * segmentWidth, 52.5);
        }
      });
    };

    // Draw page 1 setup
    drawPageBorders(doc);
    drawPageHeader(doc);

    // Group players by role
    const grouped = groupPlayersByRole(teamPlayers);

    // Grid coordinates
    let yLeft = 58;
    let yRight = 58;

    const drawSection = (colIndex, title, rolePlayers) => {
      if (!rolePlayers || rolePlayers.length === 0) return;

      const xStart = colIndex === 0 ? 16 : 111;
      const colWidth = 83;
      let y = colIndex === 0 ? yLeft : yRight;

      // Calculate approximate height of this section: Header (8.5mm) + Rows (length * 7.2mm)
      const sectionHeight = 8.5 + (rolePlayers.length * 7.2);
      if (y + sectionHeight > 230) {
        doc.addPage();
        drawPageBorders(doc);
        yLeft = 20;
        yRight = 20;
        y = 20;
      }

      // Draw Section Title bar (Double lines)
      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.4);
      doc.line(xStart, y, xStart + colWidth, y);
      doc.line(xStart, y + 0.6, xStart + colWidth, y + 0.6);

      // Section Title Text
      doc.setFont("times", "bold");
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(title.toUpperCase(), xStart, y + 4.5);

      // Section Player Count
      doc.setFont("courier", "bold");
      doc.setFontSize(8);
      doc.setTextColor(225, 29, 72); // Crimson Red
      const countText = `${rolePlayers.length} ${rolePlayers.length === 1 ? 'PLAYER' : 'PLAYERS'}`;
      doc.text(countText, xStart + colWidth, y + 4.5, { align: "right" });

      // Line under header
      doc.setLineWidth(0.25);
      doc.line(xStart, y + 6, xStart + colWidth, y + 6);

      y += 8.5;

      // Render players
      rolePlayers.forEach((player, idx) => {
        if (idx > 0) {
          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.2);
          doc.line(xStart, y - 1.5, xStart + colWidth, y - 1.5);
        }

        // Index number
        doc.setFont("courier", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(148, 163, 184);
        const numStr = String(idx + 1).padStart(2, "0");
        doc.text(numStr, xStart, y + 2.5);

        // Player Name
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(15, 23, 42);
        
        let pName = player.name.toUpperCase();
        if (pName.length > 14) {
          pName = pName.slice(0, 14) + "...";
        }
        doc.text(pName, xStart + 7, y + 2.5);

        // Icon Badge (if any)
        const nameWidth = doc.getTextWidth(pName);
        if (player.icon_role && player.icon_role !== "none") {
          const badgeX = xStart + 7 + nameWidth + 2;
          doc.setFillColor(245, 158, 11); // Amber
          doc.setDrawColor(15, 23, 42);
          doc.setLineWidth(0.15);
          doc.rect(badgeX, y - 0.8, 8, 3.5, "FD");

          doc.setTextColor(15, 23, 42);
          doc.setFont("courier", "bold");
          doc.setFontSize(5.5);
          doc.text("ICON", badgeX + 4, y + 1.6, { align: "center" });
        }

        // Price Tag Box
        const priceText = formatShortCurrency(player.sold_price || 0);
        const priceWidth = 16;
        const priceX = xStart + colWidth - priceWidth;

        if (player.icon_role && player.icon_role !== "none") {
          doc.setFillColor(236, 253, 245); // Emerald-50
          doc.setDrawColor(16, 185, 129); // Emerald-500
        } else {
          doc.setFillColor(241, 245, 249); // Slate-100
          doc.setDrawColor(15, 23, 42);
        }

        doc.setLineWidth(0.2);
        doc.rect(priceX, y - 1, priceWidth, 4.2, "FD");

        doc.setFont("courier", "bold");
        doc.setFontSize(7.5);
        if (player.icon_role && player.icon_role !== "none") {
          doc.setTextColor(16, 185, 129);
        } else {
          doc.setTextColor(15, 23, 42);
        }
        doc.text(priceText, priceX + (priceWidth / 2), y + 2.1, { align: "center" });

        y += 7.2;
      });

      if (colIndex === 0) {
        yLeft = y + 6;
      } else {
        yRight = y + 6;
      }
    };

    // Draw Column 1: Batters, All-Rounders
    drawSection(0, "Batters", grouped.batsman);
    drawSection(0, "All-Rounders", grouped["all-rounder"]);

    // Draw Column 2: Bowlers, Wicket-Keepers, Others
    drawSection(1, "Bowlers", grouped.bowler);
    drawSection(1, "Wicket-Keepers", grouped["wicket-keeper"]);
    drawSection(1, "Others", grouped.other);

    // Draw Squad Value Profile Box
    let profileY = Math.max(yLeft, yRight) + 6;
    if (profileY < 235) {
      profileY = 235; // Pin to bottom region if space allows
    }

    if (profileY + 22 > 275) {
      doc.addPage();
      drawPageBorders(doc);
      profileY = 20;
    }

    // Profile Box frame
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.4);
    // Draw dashed box
    doc.setLineDashPattern([1.5, 1.5], 0);
    doc.setFillColor(248, 250, 252);
    doc.rect(16, profileY, 178, 18, "FD");
    doc.setLineDashPattern([], 0); // Reset

    // Title for profile
    doc.setFont("times", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text("SQUAD VALUE PROFILE", 20, profileY + 5);

    doc.setLineWidth(0.15);
    doc.line(20, profileY + 6.5, 188, profileY + 6.5);

    // Stats calculations
    const spent = team.total_purse - team.remaining_purse;
    const avgPrice = teamPlayers.length ? spent / teamPlayers.length : 0;
    const spentPct = team.total_purse > 0 ? (spent / team.total_purse) * 100 : 0;

    doc.setFont("courier", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    
    // Column 1
    doc.text(`AVG SOLD PRICE: ${formatShortCurrency(avgPrice)}`, 22, profileY + 12.5);
    // Column 2
    doc.text(`BUDGET UTILIZED: ${spentPct.toFixed(1)}%`, 82, profileY + 12.5);
    // Column 3
    doc.text(`ICON PLAYERS: ${iconCount} USED`, 142, profileY + 12.5);

    // Apply double outlines and footers to all pages dynamically
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      
      // Page frame (in case new page was added inside section)
      drawPageBorders(doc);

      // Page footer strip
      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.35);
      doc.line(11.5, pageHeight - 20, pageWidth - 11.5, pageHeight - 20);
      
      doc.setFont("courier", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      
      doc.text("CRICKET AUCTION PRO • MATCHDAY RECORD SHEET", 15, pageHeight - 15);
      doc.text(`PAGE ${i} OF ${totalPages}`, pageWidth - 15, pageHeight - 15, { align: "right" });
    }

    // Download
    doc.save(`${team.short_name}_Squad.pdf`);
    toast.success(`${team.name} squad downloaded!`);
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background-light dark:bg-background-dark">
        <div className="flex flex-col items-center gap-4">
          <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-text-secondary">Loading teams...</p>
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
              Team Summary
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
            className="flex items-center justify-center size-10 border-2 border-text-primary dark:border-text-secondary-dark bg-background-light dark:bg-card-dark text-text-primary dark:text-slate-100 hover:bg-background-tertiary transition-colors shadow-[2px_2px_0px_var(--border-color)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_var(--border-color)]"
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            aria-label="Toggle theme"
          >
            <span className="material-symbols-outlined text-[20px]">
              {theme === "dark" ? "light_mode" : "dark_mode"}
            </span>
          </button>
          <button
            onClick={() => setShowAddTeam(true)}
            className="flex items-center justify-center gap-2 h-10 px-3 md:px-4 border-2 border-text-primary dark:border-text-secondary-dark bg-background-light dark:bg-card-dark hover:bg-background-tertiary text-text-primary dark:text-slate-100 text-sm font-display font-bold uppercase tracking-wider shadow-[3px_3px_0px_var(--border-color)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_var(--border-color)] transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">group_add</span>
            <span className="hidden md:inline">Add Team</span>
          </button>
          <button
            onClick={() => setShowBulkImport(true)}
            className="flex items-center justify-center gap-2 h-10 px-3 md:px-4 border-2 border-text-primary dark:border-text-secondary-dark bg-background-light dark:bg-card-dark hover:bg-background-tertiary text-text-primary dark:text-slate-100 text-sm font-display font-bold uppercase tracking-wider shadow-[3px_3px_0px_var(--border-color)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_var(--border-color)] transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
            <span className="hidden md:inline">Bulk Import</span>
          </button>
          <Link
            to={`/tournament/${tournamentId}/players`}
            className="flex items-center justify-center gap-2 h-10 px-3 md:px-4 border-2 border-text-primary dark:border-text-secondary-dark bg-background-light dark:bg-card-dark hover:bg-background-tertiary text-text-primary dark:text-slate-100 text-sm font-display font-bold uppercase tracking-wider shadow-[3px_3px_0px_var(--border-color)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_var(--border-color)] transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">people</span>
            <span className="hidden md:inline">Players</span>
          </Link>
          <Link
            to={`/tournament/${tournamentId}/live`}
            className="flex items-center justify-center gap-2 h-10 px-3 md:px-4 border-2 border-text-primary dark:border-text-secondary-dark bg-primary hover:bg-primary-dark text-white text-sm font-display font-bold uppercase tracking-wider shadow-[3px_3px_0px_var(--border-color)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_var(--border-color)] transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">live_tv</span>
            <span className="hidden md:inline">Go Live</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 w-full max-w-[1600px] mx-auto p-4 lg:p-8 flex flex-col gap-8">
        {/* Stats Section */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Total Purse Spent Card */}
          <div className="relative overflow-hidden bg-background-light dark:bg-card-dark border-2 border-text-primary dark:border-text-secondary-dark p-6 flex flex-col justify-between shadow-[4px_4px_0px_var(--border-color)] group">
            <div className="relative z-10">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-text-secondary dark:text-text-secondary-dark text-xs font-mono font-bold uppercase tracking-wider">
                    Total Purse Spent
                  </p>
                  <p className="text-3xl font-display font-black mt-2 tracking-tight">
                    {formatShortCurrency(totalSpent)}
                  </p>
                </div>
                <span className="material-symbols-outlined text-primary text-4xl opacity-20 group-hover:opacity-40 transition-opacity">
                  payments
                </span>
              </div>
              {teams.length > 0 && (
                <>
                  <div className="w-full bg-background-tertiary dark:bg-background-dark border-2 border-text-primary dark:border-text-secondary-dark h-3 mt-4 overflow-hidden">
                    <div
                      className="bg-primary h-full"
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
                  <p className="text-xs font-mono font-bold text-text-secondary mt-2 text-right">
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
          </div>

          {/* Players Sold Card */}
          <div className="relative overflow-hidden bg-background-light dark:bg-card-dark border-2 border-text-primary dark:border-text-secondary-dark p-6 flex flex-col justify-between shadow-[4px_4px_0px_var(--border-color)] group">
            <div className="relative z-10 flex flex-col justify-between h-full">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-text-secondary dark:text-text-secondary-dark text-xs font-mono font-bold uppercase tracking-wider">
                    Players Sold
                  </p>
                  <p className="text-3xl font-display font-black mt-2 tracking-tight">
                    {soldPlayers}
                  </p>
                </div>
                <span className="material-symbols-outlined text-green-500 text-4xl opacity-20 group-hover:opacity-40 transition-opacity">
                  groups
                </span>
              </div>
              <div className="flex gap-2 mt-4 text-xs font-mono font-bold text-text-secondary">
                <span className="text-green-500 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">
                    check_circle
                  </span>{" "}
                  {soldPlayers}
                </span>
                out of {players.length} players
              </div>
            </div>
          </div>

          {/* Unsold Players Card */}
          <div className="relative overflow-hidden bg-background-light dark:bg-card-dark border-2 border-text-primary dark:border-text-secondary-dark p-6 flex flex-col justify-between shadow-[4px_4px_0px_var(--border-color)] group">
            <div className="relative z-10 flex flex-col justify-between h-full">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-text-secondary dark:text-text-secondary-dark text-xs font-mono font-bold uppercase tracking-wider">
                    Unsold Players
                  </p>
                  <p className="text-3xl font-display font-black mt-2 tracking-tight">
                    {unsoldPlayers}
                  </p>
                </div>
                <span className="material-symbols-outlined text-orange-500 text-4xl opacity-20 group-hover:opacity-40 transition-opacity">
                  person_off
                </span>
              </div>
              <div className="flex gap-2 mt-4 text-xs font-mono font-bold text-text-secondary">
                <span>
                  Available:{" "}
                  {players.filter((p) => p.status === "available").length}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Filters & Actions */}
        <section className="flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="w-full md:w-auto flex-1 max-w-2xl relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary dark:text-text-secondary-dark material-symbols-outlined">
              search
            </span>
            <input
              className="w-full h-12 pl-12 pr-4 border-2 border-text-primary dark:border-text-secondary-dark bg-background-light dark:bg-card-dark focus:border-primary text-text-primary dark:text-slate-100 placeholder-[#475569]/50 dark:placeholder-[#94a3b8]/50 font-mono text-sm tracking-tight outline-none shadow-[3px_3px_0px_var(--border-color)]"
              placeholder="Search teams by name..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap md:flex-nowrap gap-3 items-center w-full md:w-auto pb-2 md:pb-0">
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {[
                { key: "all", label: "All Teams" },
                { key: "high-budget", label: "High Budget" },
                { key: "low-budget", label: "Low Budget" },
                { key: "full-squad", label: "Full Squad" },
              ].map((f) => (
                <button
                  key={f.key}
                  disabled={isQuickEdit}
                  onClick={() => {
                    setFilter(f.key);
                    setSelectedSquad(null);
                    setExpandedTeam(null);
                  }}
                  className={`whitespace-nowrap px-3 py-1.5 border-2 text-xs font-display font-bold uppercase tracking-wider shadow-[2px_2px_0px_var(--border-color)] transition-all active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_var(--border-color)] disabled:opacity-40 disabled:cursor-not-allowed ${
                    filter === f.key && !isQuickEdit
                      ? "bg-primary text-white border-text-primary dark:border-text-secondary-dark"
                      : "bg-background-light dark:bg-card-dark text-text-secondary dark:text-text-secondary-dark border-text-primary dark:border-text-secondary-dark hover:bg-background-tertiary"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Layout Toggle */}
            <div className="flex border-2 border-text-primary dark:border-text-secondary-dark shadow-[3px_3px_0px_var(--border-color)] overflow-hidden">
              <button
                onClick={() => setIsQuickEdit(false)}
                className={`h-9 px-3 flex items-center gap-1 font-mono text-xs font-bold uppercase transition-colors ${
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
                className={`h-9 px-3 flex items-center gap-1 font-mono text-xs font-bold uppercase transition-colors border-l-2 border-text-primary dark:border-text-secondary-dark ${
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

        {/* Team Cards Grid OR Spreadsheet View OR Full Squad View */}
        {isQuickEdit ? (
          /* Spreadsheet View */
          <div className="overflow-x-auto border-2 border-text-primary dark:border-text-secondary-dark bg-background-light dark:bg-card-dark shadow-[3px_3px_0px_var(--border-color)]">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b-2 border-text-primary dark:border-text-secondary-dark bg-background-secondary dark:bg-background-dark font-mono text-xs uppercase text-text-secondary">
                  <th className="p-3 w-16">Logo</th>
                  <th className="p-3 min-w-[200px]">Team Name</th>
                  <th className="p-3 w-40">Short Name</th>
                  <th className="p-3 w-44">Color</th>
                  <th className="p-3 w-40">Budget (Total Purse)</th>
                  <th className="p-3 w-32 text-right">Spent</th>
                  <th className="p-3 w-36 text-right">Remaining</th>
                  <th className="p-3 w-28 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-text-primary/10">
                {filteredTeams.map((team) => {
                  const draft = editedTeams[team.id] || team;
                  const isModified = isTeamModified(team);
                  const isSaving = savingInlineIds.has(team.id);
                  const spent = team.total_purse - team.remaining_purse;
                  
                  return (
                    <tr key={team.id} className="hover:bg-background-secondary/40 font-mono text-xs">
                      {/* Logo Column */}
                      <td className="p-3">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-text-primary dark:text-slate-100 font-bold text-xs border border-white/10 overflow-hidden"
                          style={{ backgroundColor: draft.color }}
                        >
                          {team.logo_url ? (
                            <img src={team.logo_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            draft.short_name
                          )}
                        </div>
                      </td>
                      
                      {/* Name Column */}
                      <td className="p-3">
                        <input
                          type="text"
                          value={draft.name}
                          onChange={(e) => handleInlineChange(team.id, 'name', e.target.value)}
                          className="w-full h-9 px-2 bg-background-light dark:bg-background-dark border border-text-primary/20 focus:border-primary text-text-primary dark:text-slate-100 font-sans font-semibold text-sm outline-none"
                        />
                      </td>
                      
                      {/* Short Name Column */}
                      <td className="p-3">
                        <input
                          type="text"
                          maxLength={4}
                          value={draft.short_name}
                          onChange={(e) => handleInlineChange(team.id, 'short_name', e.target.value)}
                          className="w-full h-9 px-2 bg-background-light dark:bg-background-dark border border-text-primary/20 focus:border-primary text-text-primary dark:text-slate-100 font-bold outline-none uppercase"
                        />
                      </td>
                      
                      {/* Color Column */}
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={draft.color}
                            onChange={(e) => handleInlineChange(team.id, 'color', e.target.value)}
                            className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
                          />
                          <input
                            type="text"
                            value={draft.color}
                            onChange={(e) => handleInlineChange(team.id, 'color', e.target.value)}
                            className="w-20 h-9 px-1.5 bg-background-light dark:bg-background-dark border border-text-primary/20 text-[10px] text-text-primary dark:text-slate-100 font-mono outline-none"
                          />
                        </div>
                      </td>
                      
                      {/* Total Purse Column */}
                      <td className="p-3">
                        <input
                          type="number"
                          value={draft.total_purse}
                          onChange={(e) => handleInlineChange(team.id, 'total_purse', parseInt(e.target.value, 10) || 0)}
                          className="w-full h-9 px-2 bg-background-light dark:bg-background-dark border border-text-primary/20 focus:border-primary text-text-primary dark:text-slate-100 font-mono text-sm outline-none"
                        />
                      </td>
                      
                      {/* Spent Column */}
                      <td className="p-3 text-right font-mono font-semibold text-text-secondary">
                        {spent.toLocaleString()} pts
                      </td>
                      
                      {/* Remaining Column */}
                      <td className="p-3 text-right font-mono font-bold text-primary">
                        {(draft.total_purse - spent).toLocaleString()} pts
                      </td>
                      
                      {/* Actions Column */}
                      <td className="p-3 text-center">
                        <div className="flex justify-center items-center gap-1.5">
                          {isModified ? (
                            <>
                              <button
                                onClick={() => handleSaveInline(team.id)}
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
                                onClick={() => handleResetInline(team.id)}
                                disabled={isSaving}
                                className="flex items-center justify-center size-8 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/30 transition-colors rounded"
                                title="Discard Changes"
                              >
                                <span className="material-symbols-outlined text-[18px]">close</span>
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirm(team)}
                              className="flex items-center justify-center size-8 bg-red-500/10 text-red-400 border border-red-400/30 hover:bg-red-500/20 transition-colors rounded"
                              title="Delete Team"
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
        ) : filter === "full-squad" ? (
          /* Full Squad View - All Teams Grid */
          <section className="space-y-6">
            {selectedSquad ? (
              /* Selected Team Detail View */
              <div className="relative overflow-hidden bg-background-light dark:bg-card-dark border-2 border-text-primary dark:border-text-secondary-dark shadow-[4px_4px_0px_var(--border-color)]">
                {/* Team Header */}
                <div className="relative z-10 p-4 border-b-2 border-text-primary dark:border-text-secondary-dark flex items-center justify-between bg-background-secondary dark:bg-background-dark">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-text-primary dark:text-slate-100 font-bold text-xs border border-white/10 overflow-hidden"
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
                      <h3 className="text-lg font-display font-black uppercase text-text-primary dark:text-slate-100">
                        {selectedSquad.name}
                      </h3>
                      <p className="text-xs text-text-secondary dark:text-text-secondary-dark font-mono font-bold uppercase mt-0.5">
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
                      className="flex items-center gap-2 h-10 px-4 border-2 border-text-primary dark:border-text-secondary-dark bg-primary hover:bg-primary-dark text-white text-sm font-display font-bold uppercase tracking-wider shadow-[3px_3px_0px_var(--border-color)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_var(--border-color)] transition-all"
                    >
                      <span className="material-symbols-outlined text-lg">
                        download
                      </span>
                      <span className="text-sm font-medium">Download PDF</span>
                    </button>
                    <button
                      onClick={() => setSelectedSquad(null)}
                      className="flex items-center gap-2 h-10 px-4 border-2 border-text-primary dark:border-text-secondary-dark bg-background-light dark:bg-card-dark hover:bg-background-tertiary text-text-primary dark:text-slate-100 text-sm font-display font-bold uppercase tracking-wider shadow-[3px_3px_0px_var(--border-color)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_var(--border-color)] transition-all"
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
                              className="relative overflow-hidden bg-background-light dark:bg-card-dark border-2 border-text-primary dark:border-text-secondary-dark shadow-[3px_3px_0px_var(--border-color)]"
                            >
                              <div className="px-3 py-2 border-b-2 border-text-primary dark:border-text-secondary-dark bg-background-secondary dark:bg-background-dark">
                                <h5 className="text-xs font-mono font-bold uppercase tracking-wider text-text-primary dark:text-slate-100">
                                  {roleLabels[role] || role} (
                                  {rolePlayers.length})
                                </h5>
                              </div>
                              <div className="divide-y-2 divide-text-primary dark:divide-text-secondary-dark">
                                {rolePlayers.map((player) => (
                                  <div
                                    key={player.id}
                                    className="px-3 py-2 flex items-center justify-between gap-2 bg-background-light dark:bg-card-dark"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <div className="size-7 rounded-none border border-text-primary dark:border-text-secondary-dark bg-background-secondary dark:bg-background-dark flex-shrink-0 flex items-center justify-center overflow-hidden">
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
                                        <span className="text-sm font-display font-bold text-text-primary dark:text-slate-100 truncate">
                                          {player.name}
                                        </span>
                                        {player.icon_role &&
                                          player.icon_role !== "none" && (
                                            <span className="text-[9px] px-1.5 py-0.5 border-2 border-primary/40 text-primary font-mono font-bold uppercase whitespace-nowrap">
                                              Icon
                                            </span>
                                          )}
                                      </div>
                                    </div>
                                    <span className="text-xs font-mono font-bold text-primary whitespace-nowrap">
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
                    <div className="size-20 border-2 border-text-primary dark:border-text-secondary-dark bg-background-secondary dark:bg-background-dark flex items-center justify-center text-text-secondary mb-4">
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
                          className="bg-background-light dark:bg-card-dark border-2 border-text-primary dark:border-text-secondary-dark p-4 shadow-[3px_3px_0px_var(--border-color)] hover:shadow-[4px_4px_0px_var(--border-color)] transition-all group"
                        >
                          <div
                            className="flex flex-col items-center text-center cursor-pointer"
                            onClick={() => setSelectedSquad(team)}
                          >
                            <div
                              className="w-14 h-14 rounded-full flex items-center justify-center text-text-primary dark:text-slate-100 font-bold text-sm border-2 border-white/10 overflow-hidden mb-3 group-hover:scale-110 transition-transform"
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
                            <h3 className="text-sm font-bold text-text-primary dark:text-slate-100 leading-tight truncate w-full">
                              {team.name}
                            </h3>
                            <p className="text-xs text-text-secondary mt-1">
                              {teamPlayers.length} Players
                            </p>
                            <div className="mt-2 px-2 py-1 border border-text-primary dark:border-text-secondary-dark bg-background-secondary dark:bg-background-dark">
                              <span className="text-xs font-medium text-primary">
                                {formatShortCurrency(team.remaining_purse)}
                              </span>
                            </div>
                          </div>
                          {/* Edit/Delete Buttons */}
                          <div className="flex gap-1 mt-3 pt-3 border-t-2 border-text-primary dark:border-text-secondary-dark">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingTeam(team);
                              }}
                              className="flex-1 flex items-center justify-center h-7 bg-background-tertiary dark:bg-background-dark text-text-primary dark:text-slate-100 text-[10px] font-display font-bold uppercase border border-text-primary dark:border-text-secondary-dark hover:bg-background-light transition-colors"
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
                              className="flex items-center justify-center size-7 bg-red-500/10 text-red-400 border border-red-400 hover:bg-red-500/20 transition-colors"
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
                   <div className="size-20 border-2 border-text-primary dark:border-text-secondary-dark bg-background-secondary dark:bg-background-dark flex items-center justify-center text-text-secondary mb-4">
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
                    className={`bg-background-light dark:bg-card-dark border-2 transition-all cursor-pointer ${
                      isExpanded
                        ? "col-span-1 md:col-span-2 row-span-2 border-primary shadow-[4px_4px_0px_var(--border-color)]"
                        : "border-text-primary dark:border-text-secondary-dark shadow-[3px_3px_0px_var(--border-color)] hover:shadow-[4px_4px_0px_var(--border-color)]"
                    }`}
                    onClick={() => setExpandedTeam(isExpanded ? null : team.id)}
                  >
                    {/* Team Header */}
                    <div
                      className={`p-5 ${
                        isExpanded ? "border-b-2 border-text-primary dark:border-text-secondary-dark" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-12 h-12 rounded-full flex items-center justify-center text-text-primary dark:text-slate-100 font-bold text-sm border border-white/10 overflow-hidden"
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
                            <h3 className="text-lg font-bold text-text-primary dark:text-slate-100 leading-tight">
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
                          <span className="text-xl font-bold text-text-primary dark:text-slate-100">
                            {formatShortCurrency(team.remaining_purse)}
                          </span>
                        </div>
                        <div className="w-full bg-background-tertiary dark:bg-background-dark h-2 overflow-hidden border border-text-primary dark:border-text-secondary-dark">
                          <div
                            className="h-full transition-all"
                            style={{
                              width: `${spentPercent}%`,
                              backgroundColor:
                                spentPercent > 80 ? "#ef4444" : team.color,
                            }}
                          ></div>
                        </div>
                        <div className="flex justify-between items-center pt-1">
                          <div className="px-2 py-1 bg-background-secondary dark:bg-background-dark text-xs font-mono font-bold text-text-secondary border border-text-primary dark:border-text-secondary-dark">
                            Squad: {teamPlayers.length}/25
                          </div>
                          <div className="px-2 py-1 bg-background-secondary dark:bg-background-dark text-xs font-mono font-bold text-text-secondary border border-text-primary dark:border-text-secondary-dark">
                            Spent: {formatShortCurrency(spent)}
                          </div>
                        </div>
                        {/* Edit/Delete Buttons */}
                        <div className="flex gap-2 mt-3 pt-3 border-t-2 border-text-primary dark:border-text-secondary-dark">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingTeam(team);
                            }}
                            className="flex-1 flex items-center justify-center gap-1 h-8 bg-background-tertiary dark:bg-background-dark text-text-primary dark:text-slate-100 text-xs font-display font-bold uppercase border border-text-primary dark:border-text-secondary-dark hover:bg-background-light transition-colors"
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
                            className="flex items-center justify-center size-8 bg-red-500/10 text-red-400 border border-red-400 hover:bg-red-500/20 transition-colors"
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
                                  className="flex items-center justify-between p-2 bg-background-secondary dark:bg-background-dark border border-text-primary dark:border-text-secondary-dark"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="size-8 rounded-full bg-background-tertiary dark:bg-background-dark flex-shrink-0 flex items-center justify-center overflow-hidden">
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
                                      <p className="text-text-primary dark:text-slate-100 font-medium text-xs truncate">
                                        {player.name}
                                      </p>
                                      <span
                                        className={`text-[10px] px-1.5 py-0.5 border-2 ${getRoleColor(
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



      {/* Live Ticker */}
      {players.filter((p) => p.status === "sold").length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-background-secondary dark:bg-background-dark border-t-2 border-text-primary dark:border-text-secondary-dark py-2 px-4 z-40">
          <div className="flex items-center gap-4 text-sm">
            <span className="px-2 py-0.5 bg-primary text-white text-xs font-display font-bold uppercase">
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
            onSuccess={(newTeam) => {
              if (newTeam) {
                setTeams((prev) => [...prev, newTeam]);
              } else {
                fetchTeams();
              }
              setShowAddTeam(false);
            }}
          />
        </Modal>
      )}

      {/* Bulk Import Modal */}
      {showBulkImport && (
        <Modal
          isOpen={true}
          onClose={() => setShowBulkImport(false)}
          title="Bulk Import Teams"
        >
          <BulkImportTeams
            tournamentId={tournamentId}
            defaultPurse={tournament?.default_purse}
            onClose={() => setShowBulkImport(false)}
            onSuccess={(importedList) => {
              if (Array.isArray(importedList)) {
                setTeams((prev) => [...prev, ...importedList]);
              } else {
                fetchTeams();
              }
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
            onSuccess={(updatedTeam) => {
              if (updatedTeam) {
                setTeams((prev) =>
                  prev.map((t) => (t.id === updatedTeam.id ? updatedTeam : t))
                );
              } else {
                fetchTeams();
              }
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
              All players assigned to this team will become available again.
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
                onClick={() => handleDeleteTeam(deleteConfirm.id)}
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

      const { data, error } = await supabase
        .from("teams")
        .update({
          name: formData.name,
          short_name: formData.short_name.toUpperCase(),
          color: formData.color,
          logo_url,
          total_purse: formData.total_purse,
          remaining_purse: Math.max(0, newRemainingPurse),
        })
        .eq("id", team.id)
        .select();

      if (error) throw error;

      toast.success("Team updated successfully!");
      onSuccess?.(data && data[0]);
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
          <div className="size-24 rounded-full bg-background-tertiary dark:bg-background-dark border-2 border-dashed border-text-secondary dark:border-text-secondary-dark group-hover:border-primary flex items-center justify-center overflow-hidden transition-colors">
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
          className="w-full h-11 px-4 bg-background-secondary dark:bg-background-dark border-2 border-text-primary dark:border-text-secondary-dark text-text-primary dark:text-slate-100 placeholder:text-text-secondary/50 focus:outline-none focus:border-primary transition-colors"
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
          className="w-full h-11 px-4 bg-background-secondary dark:bg-background-dark border-2 border-text-primary dark:border-text-secondary-dark text-text-primary dark:text-slate-100 placeholder:text-text-secondary/50 focus:outline-none focus:border-primary transition-colors uppercase"
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
            className="w-11 h-11 cursor-pointer bg-transparent border-0"
          />
          <input
            type="text"
            value={formData.color}
            onChange={(e) =>
              setFormData({ ...formData, color: e.target.value })
            }
            className="flex-1 h-11 px-4 bg-background-secondary dark:bg-background-dark border-2 border-text-primary dark:border-text-secondary-dark text-text-primary dark:text-slate-100 font-mono focus:outline-none focus:border-primary transition-colors"
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
                className={`h-10 text-sm font-bold transition-all ${
                  formData.total_purse === option.value && !showCustomPurse
                    ? "bg-primary text-white border-2 border-[var(--border-color)]"
                    : "bg-[var(--bg-primary)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] border-2 border-[var(--border-color)]"
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
            className={`w-full h-10 text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              showCustomPurse
                ? "bg-primary text-white border-2 border-[var(--border-color)]"
                : "bg-[var(--bg-primary)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] border-2 border-dashed border-[var(--border-color)]"
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
                className="flex-1 h-11 px-4 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-text-secondary/60 focus:outline-none focus:border-primary transition-colors"
              />
              <button
                type="button"
                onClick={applyCustomPurse}
                className="px-4 h-11 bg-primary hover:bg-primary-dark text-white font-bold border-2 border-[var(--border-color)] transition-colors"
              >
                Set
              </button>
            </div>
          )}

          {/* Current Value Display */}
          <div className="flex items-center justify-between p-3 bg-background-secondary dark:bg-background-dark border-2 border-text-primary dark:border-text-secondary-dark">
            <span className="text-text-secondary text-sm">
              Selected Budget:
            </span>
            <span className="text-primary font-bold text-lg">
              {formData.total_purse.toLocaleString()} pts
            </span>
          </div>

          {/* Info about budget change */}
          {formData.total_purse !== team.total_purse && (
            <div className="p-3 bg-yellow-500/10 border-2 border-yellow-500/30">
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
            Update Team
          </>
        )}
      </button>
    </form>
  );
};

export default TournamentTeams;
