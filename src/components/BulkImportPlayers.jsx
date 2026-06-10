import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import toast from "react-hot-toast";

const BulkImportPlayers = ({
  onClose,
  onSuccess,
  tournamentId,
  defaultBasePrice = 500,
}) => {
  const [inputText, setInputText] = useState("");
  const [parsedPlayers, setParsedPlayers] = useState([]);
  const [loading, setLoading] = useState(false);

  const cleanRole = (r) => {
    if (!r) return "batsman";
    const clean = r.toLowerCase().trim();
    if (clean.includes("bat") || clean === "batsman" || clean === "batsmen") return "batsman";
    if (clean.includes("bowl") || clean === "bowler" || clean === "bowlers") return "bowler";
    if (clean.includes("all") || clean === "allrounder" || clean === "all-rounder") return "all-rounder";
    if (clean.includes("keep") || clean.includes("wk") || clean === "wicket-keeper" || clean === "wicketkeeper" || clean === "keeper") return "wicket-keeper";
    return "batsman";
  };

  const cleanIconRole = (i) => {
    if (!i) return "none";
    const clean = i.toLowerCase().trim();
    if (clean === "none" || clean === "no" || clean === "regular") return "none";
    if (clean.includes("seq") || clean.includes("sequence") || clean === "icon-player-sequence") return "icon-player-sequence";
    if (clean.includes("rand") || clean.includes("random") || clean === "icon-player-random") return "icon-player-random";
    if (clean.includes("icon") || clean.includes("marquee") || clean === "icon-player") return "icon-player-sequence";
    return "none";
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case "batsman": return "Batsman";
      case "bowler": return "Bowler";
      case "all-rounder": return "All-Rounder";
      case "wicket-keeper": return "Wicket Keeper";
      default: return role;
    }
  };

  useEffect(() => {
    if (!inputText.trim()) {
      setParsedPlayers([]);
      return;
    }

    const lines = inputText.split("\n");
    const list = [];

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return; // skip empty lines

      // Split by comma or tab
      const delimiter = trimmedLine.includes("\t") ? "\t" : ",";
      const parts = trimmedLine.split(delimiter).map(p => p.trim());

      const name = parts[0];
      if (!name) return; // skip if first column is empty

      const rawRole = parts[1] || "batsman";
      const role = cleanRole(rawRole);

      let basePrice = defaultBasePrice;
      const rawPrice = parts[2];
      if (rawPrice) {
        const parsedPrice = parseInt(rawPrice.replace(/[^0-9]/g, ""), 10);
        if (!isNaN(parsedPrice) && parsedPrice > 0) {
          basePrice = parsedPrice;
        }
      }

      const rawIcon = parts[3] || "none";
      const iconRole = cleanIconRole(rawIcon);

      list.push({
        name,
        role,
        base_price: basePrice,
        icon_role: iconRole,
        lineNumber: index + 1,
        isValid: true
      });
    });

    setParsedPlayers(list);
  }, [inputText, defaultBasePrice]);

  const handleImport = async () => {
    const validPlayers = parsedPlayers.filter(p => p.isValid);
    if (validPlayers.length === 0) {
      toast.error("No valid players to import");
      return;
    }

    setLoading(true);
    try {
      const records = validPlayers.map(p => ({
        tournament_id: tournamentId,
        name: p.name,
        role: p.role,
        base_price: p.base_price,
        icon_role: p.icon_role,
        status: "available",
      }));

      const { data, error } = await supabase
        .from("players")
        .insert(records)
        .select();

      if (error) throw error;

      toast.success(`Successfully imported ${validPlayers.length} players!`);
      
      // Update parent list optimistically
      if (data) {
        onSuccess?.(data);
      } else {
        onSuccess?.();
      }
      onClose();
    } catch (error) {
      console.error("Bulk import failed:", error);
      toast.error(error.message || "Failed to import players");
    } finally {
      setLoading(false);
    }
  };

  const validCount = parsedPlayers.filter(p => p.isValid).length;

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">
          Paste Players List
        </label>
        <p className="text-xs text-text-secondary/70 mb-2 font-sans">
          Format: <code className="font-mono text-primary bg-background-secondary px-1 py-0.5 border border-text-primary/10">Name, Role, Base Price, Icon Tag</code> (one per line)
          <br />
          Example:<br />
          <code className="font-mono text-text-secondary/80 block bg-[#1c2e35] p-2 mt-1 border border-[#283539] rounded text-[11px] leading-relaxed">
            Virat Kohli, batsman, 1000, icon<br />
            Jasprit Bumrah, bowler, 1000<br />
            Hardik Pandya, all-rounder, 500<br />
            MS Dhoni, wicket-keeper, 2000, sequence
          </code>
        </p>
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Paste names here... (e.g. Virat Kohli or Virat Kohli, batsman, 1000)"
          rows={6}
          className="w-full p-4 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-text-secondary/50 focus:outline-none focus:border-primary transition-colors font-mono text-sm leading-relaxed"
        />
      </div>

      {parsedPlayers.length > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs font-mono font-bold text-text-secondary">
            <span>PREVIEW ({validCount} Valid / {parsedPlayers.length} Total)</span>
            <span className="text-primary font-sans">Auto-detected roles & prices</span>
          </div>
          <div className="max-h-60 overflow-y-auto border-2 border-[var(--border-color)] bg-[var(--bg-primary)]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[var(--bg-secondary)] border-b border-[var(--border-color)] text-text-secondary font-bold font-mono">
                  <th className="p-2">#</th>
                  <th className="p-2">Name</th>
                  <th className="p-2">Role</th>
                  <th className="p-2 text-right">Base Price</th>
                  <th className="p-2">Icon</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {parsedPlayers.map((p, idx) => (
                  <tr key={idx} className="hover:bg-[var(--bg-secondary)]">
                    <td className="p-2 text-text-secondary font-mono">{idx + 1}</td>
                    <td className="p-2 font-bold text-[var(--text-primary)]">{p.name}</td>
                    <td className="p-2">
                      <span className="px-1.5 py-0.5 bg-background-secondary border border-text-primary/10 rounded font-mono text-[10px]">
                        {getRoleLabel(p.role)}
                      </span>
                    </td>
                    <td className="p-2 text-right font-mono font-semibold text-primary">
                      {p.base_price.toLocaleString()} pts
                    </td>
                    <td className="p-2 font-mono text-[10px]">
                      {p.icon_role !== "none" ? (
                        <span className="text-yellow-400 font-bold">★ Icon</span>
                      ) : (
                        <span className="text-text-secondary/40">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="h-11 px-5 bg-background-secondary hover:bg-background-tertiary text-text-primary border-2 border-[var(--border-color)] font-bold transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleImport}
          disabled={loading || validCount === 0}
          className="h-11 px-6 bg-primary hover:bg-primary-dark text-background-dark font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading ? (
            <>
              <div className="size-4 border-2 border-background-dark border-t-transparent rounded-full animate-spin"></div>
              Importing...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
              Import {validCount} Players
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default BulkImportPlayers;
