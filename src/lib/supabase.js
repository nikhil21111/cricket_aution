import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta?.env?.VITE_SUPABASE_URL || 'https://lobpauefngjeiewtpzul.supabase.co'
const supabaseAnonKey = import.meta?.env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvYnBhdWVmbmdqZWlld3RwenVsIiwicm9zZSI6ImFub24iLCJpYXQiOjE3Njc4NTA4MzIsImV4cCI6MjA4MzQyNjgzMn0.4m60-a8MUa7HIPgal1MsA9H7yAostxJ7ZUUK8VkS0NY'

if (!import.meta?.env?.VITE_SUPABASE_URL || !import.meta?.env?.VITE_SUPABASE_ANON_KEY) {
  console.warn('Supabase env vars missing at build; using baked-in fallback. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Helper to upload image to Supabase Storage
export const uploadImage = async (bucket, file) => {
  const fileExt = file.name.split('.').pop()
  const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`
  
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(fileName, file)
  
  if (error) throw error
  
  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(fileName)
  
  return publicUrl
}

// Format currency in points format
export const formatCurrency = (amount) => {
  if (!amount && amount !== 0) return '0 pts'
  
  if (amount >= 1000000) {
    const value = amount / 1000000
    return `${value.toFixed(2)}M pts`
  } else if (amount >= 1000) {
    const value = amount / 1000
    return `${value.toFixed(value % 1 === 0 ? 0 : 2)}K pts`
  }
  return `${amount.toLocaleString()} pts`
}

// Format short currency
export const formatShortCurrency = (amount) => {
  if (!amount && amount !== 0) return '0 pts'
  
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}M pts`
  } else if (amount >= 1000) {
    return `${(amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1)}K pts`
  }
  return `${amount} pts`
}

// Format points for display
export const formatPoints = (amount) => {
  if (!amount && amount !== 0) return '0'
  return amount.toLocaleString()
}
