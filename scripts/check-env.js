import fs from 'fs';
import path from 'path';

// Helper to parse simple .env files
function loadEnvFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      content.split('\n').forEach(line => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          const key = match[1];
          let value = match[2] || '';
          // Remove surrounding quotes if any
          if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
          if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      });
    }
  } catch (e) {
    // Ignore
  }
}

// Load env files in order of Vite priority
loadEnvFile(path.resolve(process.cwd(), '.env.local'));
loadEnvFile(path.resolve(process.cwd(), '.env'));

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
