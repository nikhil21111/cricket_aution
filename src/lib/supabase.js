import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Missing Supabase environment variables. Please check your .env file or deployment environment settings."
  );
}

// Create client with fallback to prevent crash (will show auth error instead)
export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-key"
);

// Helper to upload image to Supabase Storage
export const uploadImage = async (bucket, file) => {
  const fileExt = file.name.split(".").pop();
  const fileName = `${Date.now()}-${Math.random()
    .toString(36)
    .substr(2, 9)}.${fileExt}`;

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(fileName, file);

  if (error) throw error;

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(fileName);

  return publicUrl;
};

// Format currency in points format
export const formatCurrency = (amount) => {
  if (!amount && amount !== 0) return "0 pts";

  if (amount >= 1000000) {
    const value = amount / 1000000;
    return `${value.toFixed(2)}M pts`;
  } else if (amount >= 1000) {
    const value = amount / 1000;
    return `${value.toFixed(value % 1 === 0 ? 0 : 2)}K pts`;
  }
  return `${amount.toLocaleString()} pts`;
};

// Format short currency
export const formatShortCurrency = (amount) => {
  if (!amount && amount !== 0) return "0 pts";

  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}M pts`;
  } else if (amount >= 1000) {
    return `${(amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1)}K pts`;
  }
  return `${amount} pts`;
};
