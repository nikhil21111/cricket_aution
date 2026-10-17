import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) env[m[1]] = (m[2] || "").trim().replace(/^["']|["']$/g, "");
}
const URL = env.VITE_SUPABASE_URL;
const KEY = env.VITE_SUPABASE_ANON_KEY;

const owner = createClient(URL, KEY);
const email = `qa-bot-${Date.now()}@example.com`;
const password = "Qa-" + Math.random().toString(36).slice(2, 10) + "!9";
const { data: su, error: suErr } = await owner.auth.signUp({ email, password });
if (suErr || !su.session) { console.log("❌ no QA session:", suErr?.message); process.exit(1); }
const UID = su.session.user.id;
const anon = createClient(URL, KEY);

const ids = [];
const mk = async (name) => {
  const { data, error } = await owner.from("tournaments")
    .insert({ name, user_id: UID, status: "draft", default_purse: 10000, default_base_price: 500 })
    .select().single();
  if (error) { console.log("❌ create", name, error.message); process.exit(1); }
  const { error: e2 } = await owner.from("auction_state").insert({ tournament_id: data.id, is_live: false });
  if (e2) console.log("❌ auction_state:", e2.message);
  ids.push(data.id);
  return data.id;
};
const inView = async (tid) => {
  const { data } = await anon.from("public_live_tournaments").select("id, name, status").eq("id", tid);
  return data ?? [];
};
const cleanup = async () => {
  for (const tid of ids) {
    await owner.from("auction_state").delete().eq("tournament_id", tid);
    await owner.from("tournaments").delete().eq("id", tid);
  }
};

console.log("=== VIEW BEHAVIOR DISAMBIGUATION ===\n");

// T1: created, NEVER live
const t1 = await mk(`QA VIEWTEST never-live ${Date.now()}`);
const t1rows = await inView(t1);
console.log(`T1 (never live): in public view? ${t1rows.length > 0 ? "YES ❌ (view does not filter by live!)" : "no ✅"}`);
if (t1rows.length) console.log("   row:", JSON.stringify(t1rows[0]));

// T2: set live, then ended with error checking
const t2 = await mk(`QA VIEWTEST live-then-ended ${Date.now()}`);
const { error: liveErr } = await owner.from("auction_state").update({ is_live: true }).eq("tournament_id", t2);
console.log(`\nT2 set is_live=true: ${liveErr ? "ERROR " + liveErr.message : "ok"}`);
const t2live = await inView(t2);
console.log(`T2 (live): in public view? ${t2live.length > 0 ? "YES ✅" : "no ❌"}`);

const { data: readBack, error: rbErr } = await owner.from("auction_state").select("is_live").eq("tournament_id", t2).single();
console.log(`T2 is_live read-back: ${JSON.stringify(readBack?.is_live)} ${rbErr ? "ERR " + rbErr.message : ""}`);

const { error: endErr1 } = await owner.from("auction_state").update({ is_live: false }).eq("tournament_id", t2);
const { error: endErr2 } = await owner.from("tournaments").update({ status: "completed" }).eq("id", t2);
console.log(`T2 end writes: ${endErr1?.message ?? "auction_state ok"} / ${endErr2?.message ?? "tournament ok"}`);
const { data: rb2 } = await owner.from("auction_state").select("is_live").eq("tournament_id", t2).single();
console.log(`T2 is_live after end: ${JSON.stringify(rb2?.is_live)}`);
const t2ended = await inView(t2);
console.log(`T2 (ended): in public view? ${t2ended.length > 0 ? "YES ❌ (view keeps ended tournaments!)" : "no ✅"}`);
if (t2ended.length) console.log("   row:", JSON.stringify(t2ended[0]));

// Also: can anon still read auction_state of ended tournament?
const { data: aState } = await anon.from("auction_state").select("is_live").eq("tournament_id", t2);
console.log(`T2 auction_state visible to anon after end: ${aState?.length ?? 0} row(s)`);

await cleanup();
const { data: gone } = await owner.from("tournaments").select("id").in("id", ids);
console.log(`\ncleanup: ${gone?.length === 0 ? "✅ removed" : "❌ still present"}`);
