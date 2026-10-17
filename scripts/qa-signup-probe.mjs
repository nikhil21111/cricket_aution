import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) env[m[1]] = (m[2] || "").trim().replace(/^["']|["']$/g, "");
}

const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;

// Try to sign up a throwaway QA account through the public signup endpoint
// (exactly what the app's Signup page does). If email confirmation is
// disabled, we get a session immediately and can run full E2E tests.
const email = `qa-bot-${Date.now()}@example.com`;
const password = "Qa-" + Math.random().toString(36).slice(2, 10) + "!9";

const supabase = createClient(url, key);
const { data, error } = await supabase.auth.signUp({ email, password });

if (error) {
  console.log("SIGNUP_ERROR:", error.message);
  process.exit(1);
}

if (data.session) {
  console.log("SIGNUP_OK_WITH_SESSION");
  console.log("EMAIL:", email);
  console.log("PASSWORD:", password);
} else {
  console.log("SIGNUP_NEEDS_EMAIL_CONFIRMATION");
  console.log("EMAIL:", email);
  console.log("PASSWORD:", password);
  console.log("DETAIL: user created but no session returned — confirmation required");
}
