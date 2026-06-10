import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import toast from "react-hot-toast";

const PRESET_COLORS = [
  "#0db9f2", // Light Blue
  "#fdb913", // Yellow/Gold
  "#ef4444", // Crimson Red
  "#a855f7", // Purple
  "#22c55e", // Green
  "#f97316", // Orange
  "#ec4899", // Pink
  "#14b8a6", // Teal
];

const BulkImportTeams = ({
  onClose,
  onSuccess,
  tournamentId,
  defaultPurse = 10000,
}) => {
  const [inputText, setInputText] = useState("");
  const [parsedTeams, setParsedTeams] = useState([]);
  const [loading, setLoading] = useState(false);

  const generateInitials = (name) => {
    if (!name) return "TEAM";
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) {
      return words.map(w => w[0]).join("").toUpperCase().slice(0, 4);
    }
    return name.trim().slice(0, 3).toUpperCase();
  };

  useEffect(() => {
    if (!inputText.trim()) {
      setParsedTeams([]);
      return;
    }

    const lines = inputText.split("\n");
    const list = [];

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return; // skip empty lines

      const delimiter = trimmedLine.includes("\t") ? "\t" : ",";
      const parts = trimmedLine.split(delimiter).map(p => p.trim());

      const name = parts[0];
      if (!name) return; // skip if first column is empty

      // Auto short name or custom
      const shortName = (parts[1] || generateInitials(name)).toUpperCase().slice(0, 4);

      // Auto color cycling or custom
      let color = parts[2] || "";
      if (!color || !color.startsWith("#") || color.length < 4) {
        color = PRESET_COLORS[index % PRESET_COLORS.length];
      }

      // Auto purse/budget or custom
      let purse = defaultPurse;
      const rawPurse = parts[3];
      if (rawPurse) {
        const parsedPurse = parseInt(rawPurse.replace(/[^0-9]/g, ""), 10);
        if (!isNaN(parsedPurse) && parsedPurse > 0) {
          purse = parsedPurse;
        }
      }

      list.push({
        name,
        short_name: shortName,
        color,
        total_purse: purse,
        isValid: true
      });
    });

    setParsedTeams(list);
  }, [inputText, defaultPurse]);

  const handleImport = async () => {
    const validTeams = parsedTeams.filter(t => t.isValid);
    if (validTeams.length === 0) {
      toast.error("No valid teams to import");
      return;
    }

    setLoading(true);
    try {
      const records = validTeams.map(t => ({
        tournament_id: tournamentId,
        name: t.name,
        short_name: t.short_name,
        color: t.color,
        total_purse: t.total_purse,
        remaining_purse: t.total_purse, // starts full
        icon_player_count: 0
      }));

      const { data, error } = await supabase
        .from("teams")
        .insert(records)
        .select();

      if (error) throw error;

      toast.success(`Successfully imported ${validTeams.length} teams!`);
      
      if (data) {
        onSuccess?.(data);
      } else {
        onSuccess?.();
      }
      onClose();
    } catch (error) {
      console.error("Bulk team import failed:", error);
      toast.error(error.message || "Failed to import teams");
    } finally {
      setLoading(false);
    }
  };

  const validCount = parsedTeams.filter(t => t.isValid).length;

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">
          Paste Teams List
        </label>
        <p className="text-xs text-text-secondary/70 mb-2 font-sans">
          Format: <code className="font-mono text-primary bg-background-secondary px-1 py-0.5 border border-text-primary/10">Team Name, Short Name, Hex Color, Budget</code> (one per line)
          <br />
          Example:<br />
          <code className="font-mono text-text-secondary/80 block bg-[#1c2e35] p-2 mt-1 border border-[#283539] rounded text-[11px] leading-relaxed">
            Mumbai Indians, MI, #0db9f2, 10000<br />
            Chennai Super Kings, CSK, #fdb913, 10000<br />
            Royal Challengers Bangalore, RCB, #ef4444<br />
            Kolkata Knight Riders
          </code>
        </p>
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Paste names here... (e.g. Mumbai Indians or Mumbai Indians, MI, #0db9f2)"
          rows={6}
          className="w-full p-4 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-text-secondary/50 focus:outline-none focus:border-primary transition-colors font-mono text-sm leading-relaxed"
        />
      </div>

      {parsedTeams.length > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs font-mono font-bold text-text-secondary">
            <span>PREVIEW ({validCount} Valid / {parsedTeams.length} Total)</span>
            <span className="text-primary font-sans">Auto-detected initials & colors</span>
          </div>
          <div className="max-h-60 overflow-y-auto border-2 border-[var(--border-color)] bg-[var(--bg-primary)]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[var(--bg-secondary)] border-b border-[var(--border-color)] text-text-secondary font-bold font-mono">
                  <th className="p-2">#</th>
                  <th className="p-2">Name</th>
                  <th className="p-2">Short Name</th>
                  <th className="p-2">Color</th>
                  <th className="p-2 text-right">Budget</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {parsedTeams.map((t, idx) => (
                  <tr key={idx} className="hover:bg-[var(--bg-secondary)]">
                    <td className="p-2 text-text-secondary font-mono">{idx + 1}</td>
                    <td className="p-2 font-bold text-[var(--text-primary)]">{t.name}</td>
                    <td className="p-2 font-mono font-bold text-slate-100">{t.short_name}</td>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="size-4 border border-text-primary/20 rounded-full"
                          style={{ backgroundColor: t.color }}
                        />
                        <span className="font-mono text-[10px] text-text-secondary">{t.color}</span>
                      </div>
                    </td>
                    <td className="p-2 text-right font-mono font-semibold text-primary">
                      {t.total_purse.toLocaleString()} pts
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
              Import {validCount} Teams
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default BulkImportTeams;
