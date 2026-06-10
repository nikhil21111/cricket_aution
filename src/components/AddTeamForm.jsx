import { useState } from "react";
import { supabase, uploadImage } from "../lib/supabase";
import toast from "react-hot-toast";

const AddTeamForm = ({
  onClose,
  onSuccess,
  tournamentId,
  defaultPurse = 10000,
}) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    short_name: "",
    color: "#0db9f2",
    total_purse: defaultPurse,
  });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [showCustomPurse, setShowCustomPurse] = useState(false);
  const [customPurseValue, setCustomPurseValue] = useState("");

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
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
      let logo_url = null;

      // Upload logo if provided
      if (logoFile) {
        logo_url = await uploadImage("logos", logoFile);
      }

      const { data, error } = await supabase.from("teams").insert({
        name: formData.name,
        short_name: formData.short_name.toUpperCase(),
        color: formData.color,
        logo_url,
        total_purse: formData.total_purse,
        remaining_purse: formData.total_purse,
        tournament_id: tournamentId,
      }).select();

      if (error) throw error;

      toast.success("Team added successfully!");
      onSuccess?.(data && data[0]);
      onClose();
    } catch (error) {
      toast.error(error.message || "Failed to add team");
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
          className="w-full h-11 px-4 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-text-secondary/60 focus:outline-none focus:border-primary transition-colors"
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
          className="w-full h-11 px-4 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-text-secondary/60 focus:outline-none focus:border-primary transition-colors uppercase"
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
            className="flex-1 h-11 px-4 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)] text-[var(--text-primary)] font-mono focus:outline-none focus:border-primary transition-colors"
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
          <div className="flex items-center justify-between p-3 rounded-lg bg-[#1c2e35] border border-[#283539]">
            <span className="text-text-secondary text-sm">
              Selected Budget:
            </span>
            <span className="text-primary font-bold text-lg">
              {formData.total_purse.toLocaleString()} pts
            </span>
          </div>
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
            Adding...
          </>
        ) : (
          <>
            <span className="material-symbols-outlined text-[20px]">add</span>
            Add Team
          </>
        )}
      </button>
    </form>
  );
};

export default AddTeamForm;
