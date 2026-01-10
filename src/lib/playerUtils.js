// Shared player utilities to avoid duplication across components

export const roles = [
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

export const iconRoles = [
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

export const getRoleColor = (role) => {
  switch (role) {
    case "batsman":
      return "text-primary bg-primary/10 border-primary/20";
    case "bowler":
      return "text-green-400 bg-green-500/10 border-green-500/20";
    case "all-rounder":
      return "text-orange-400 bg-orange-500/10 border-orange-500/20";
    case "wicket-keeper":
      return "text-purple-400 bg-purple-500/10 border-purple-500/20";
    default:
      return "text-gray-400 bg-gray-500/10 border-gray-500/20";
  }
};

export const getRoleLabel = (role) => {
  switch (role) {
    case "batsman":
      return "Batsman";
    case "bowler":
      return "Bowler";
    case "all-rounder":
      return "All-Rounder";
    case "wicket-keeper":
      return "WK";
    default:
      return role || "Unknown";
  }
};

export const getIconRoleLabel = (iconRole) => {
  if (!iconRole) return null;
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

export const getIconRoleColor = (iconRole) => {
  if (!iconRole) return "";
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

export const isIconPlayer = (player) => {
  return player?.icon_role && player.icon_role !== "none";
};

export const isIconPlayerType = (iconRole) => {
  return iconRole && iconRole.startsWith("icon-player");
};

// Safe string operations
export const safeStartsWith = (str, prefix) => {
  return typeof str === "string" && str.startsWith(prefix);
};

export const safeString = (str, fallback = "") => {
  return typeof str === "string" ? str : fallback;
};
