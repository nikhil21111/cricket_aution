import { useState } from "react";
import { supabase, uploadImage } from "../lib/supabase";
import toast from "react-hot-toast";

const AddPlayerForm = ({
  onClose,
  onSuccess,
  tournamentId,
  defaultBasePrice = 500,
}) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    role: "batsman",
    icon_role: "none",
    base_price: defaultBasePrice,
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [showCustomPrice, setShowCustomPrice] = useState(false);
  const [customPriceValue, setCustomPriceValue] = useState("");

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
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

    setLoading(true);
    try {
      let photo_url = null;

      // Upload photo if provided
      if (photoFile) {
        photo_url = await uploadImage("players", photoFile);
      }

      const { data, error } = await supabase.from("players").insert({
        name: formData.name,
        role: formData.role,
        icon_role: formData.icon_role,
        base_price: formData.base_price,
        photo_url,
        status: "available",
        tournament_id: tournamentId,
      }).select();

      if (error) throw error;

      toast.success("Player added successfully!");
      onSuccess?.(data && data[0]);
      onClose();
    } catch (error) {
      toast.error(error.message || "Failed to add player");
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
          className="w-full h-11 px-4 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-text-secondary/60 focus:outline-none focus:border-primary transition-colors"
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
                <p className="text-sm font-semibold text-[var(--text-primary)]">{item.label}</p>
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
          {/* Quick Select Buttons */}
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

          {/* Custom Button */}
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

          {/* Custom Input Field */}
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
                className="px-4 h-11 bg-primary hover:bg-primary-dark text-background-dark font-bold rounded-lg transition-colors"
              >
                Set
              </button>
            </div>
          )}

          {/* Current Value Display */}
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
            <span className="material-symbols-outlined text-[20px]">
              person_add
            </span>
            Add Player
          </>
        )}
      </button>
    </form>
  );
};

export default AddPlayerForm;
