// Environment variable check script
// This runs before build to ensure required env vars are set

const requiredEnvVars = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"];

const missing = [];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    missing.push(envVar);
  }
}

if (missing.length > 0) {
  console.warn("\n⚠️  Warning: Missing environment variables:");
  missing.forEach((v) => console.warn(`   - ${v}`));
  console.warn(
    "\nMake sure to set these in your deployment platform (Netlify/Vercel).\n"
  );
  // Don't exit with error - let the build continue
  // The app will show an error message if env vars are missing at runtime
}

console.log("✅ Environment check completed");
