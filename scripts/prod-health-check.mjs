import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

// Load .env.local (no secrets hardcoded in this file)
const env = {};
try {
  for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (m) env[m[1]] = (m[2] || "").trim().replace(/^["']|["']$/g, "");
  }
} catch {}

const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("❌ Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key);
let failures = 0;

const ok = (name, cond, detail = "") => {
  console.log(`${cond ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};
const info = (name, detail = "") => console.log(`ℹ️  ${name}${detail ? " — " + detail : ""}`);

console.log("=".repeat(70));
console.log("PHASE 1: ANON (PUBLIC) HEALTH CHECK — what the public viewer sees");
console.log("=".repeat(70));

// 1. Table reachability as anon
console.log("\n--- 1. Tables reachable as anon (RLS-filtered) ---");
for (const t of ["tournaments", "teams", "players", "auction_state"]) {
  const { data, error } = await supabase.from(t).select("id").limit(1000);
  if (error) ok(`table ${t}`, false, error.message);
  else ok(`table ${t}`, true, `${data.length} row(s) visible to anon`);
}

// 2. Live auction state rows
console.log("\n--- 2. Live auction state ---");
const { data: liveStates, error: liveErr } = await supabase
  .from("auction_state")
  .select("*")
  .eq("is_live", true);
if (liveErr) {
  ok("read live auction_state", false, liveErr.message);
} else {
  ok("read live auction_state", true, `${liveStates.length} live row(s)`);
  for (const s of liveStates) {
    info(`live tournament ${s.tournament_id.slice(0, 8)}…`, `highest_bid=${s.highest_bid} bidder=${s.highest_bidder_id ?? "null"} current_player=${s.current_player_id?.slice(0, 8) ?? "null"}`);
    // Integrity: bid without bidder
    if (s.highest_bid > 0 && !s.highest_bidder_id) {
      ok(`auction_state integrity ${s.tournament_id.slice(0, 8)}…`, false, `highest_bid=${s.highest_bid} but no bidder — inconsistent state`);
    }
    if (s.current_player_id && s.highest_bid === 0 && s.highest_bidder_id) {
      ok(`auction_state integrity ${s.tournament_id.slice(0, 8)}…`, false, "bidder set but bid is 0");
    }
  }
}

// 3. public_live_tournaments view (public viewer's fetchTournament uses this)
console.log("\n--- 3. public_live_tournaments view ---");
const { data: viewRows, error: viewErr } = await supabase
  .from("public_live_tournaments")
  .select("id, name, description, status");
if (viewErr) {
  ok("public_live_tournaments view", false, `${viewErr.code ?? ""} ${viewErr.message} → PUBLIC VIEWER WILL SHOW ERROR PAGE`);
} else {
  ok("public_live_tournaments view", true, `${viewRows.length} live tournament(s) exposed`);
  for (const v of viewRows) {
    info(`live: "${v.name}"`, `status=${v.status}`);
    if (v.status !== "live") {
      info(`⚠ status mismatch`, `tournament "${v.name}" is is_live=true but tournaments.status="${v.status}"`);
    }
  }
}

// 4. Cross-check: for each live state, can anon read its teams & players?
console.log("\n--- 4. Public viewer data access (teams/players of live tournaments) ---");
if (liveStates && liveStates.length > 0) {
  for (const s of liveStates) {
    const tid = s.tournament_id;
    const { data: teams, error: teamsErr } = await supabase
      .from("teams").select("*").eq("tournament_id", tid);
    const { data: players, error: playersErr } = await supabase
      .from("players").select("*").eq("tournament_id", tid);
    if (teamsErr) ok(`anon read teams for ${tid.slice(0,8)}…`, false, teamsErr.message);
    else ok(`anon read teams for ${tid.slice(0,8)}…`, true, `${teams.length} team(s)`);

    if (playersErr) ok(`anon read players for ${tid.slice(0,8)}…`, false, playersErr.message);
    else ok(`anon read players for ${tid.slice(0,8)}…`, true, `${players.length} player(s)`);

    // Data integrity on live-visible data
    for (const p of players ?? []) {
      if (p.status === "sold" && (!p.team_id || p.sold_price == null)) {
        ok(`player integrity "${p.name}"`, false, `status=sold but team_id=${p.team_id ?? "null"} sold_price=${p.sold_price ?? "null"} — evidence of non-atomic sold failure`);
      }
      if (p.status !== "sold" && p.sold_price != null) {
        info(`player "${p.name}"`, `status=${p.status} but sold_price=${p.sold_price} (leftover)`);
      }
      if (!p.name || p.base_price == null) {
        ok(`player "${p.name ?? "UNNAMED"}"`, false, "missing name or base_price");
      }
    }
    for (const t of teams ?? []) {
      if (t.remaining_purse < 0) ok(`team purse "${t.name}"`, false, `remaining_purse=${t.remaining_purse} is NEGATIVE`);
      if (t.remaining_purse > (t.total_purse ?? 0)) ok(`team purse "${t.name}"`, false, `remaining_purse > total_purse`);
      const sold = (players ?? []).filter((p) => p.team_id === t.id && p.status === "sold");
      const spent = sold.reduce((sum, p) => sum + (p.sold_price || 0), 0);
      const expected = (t.total_purse ?? 0) - (t.remaining_purse ?? 0);
      if (spent !== expected) {
        info(`team purse drift "${t.name}"`, `spent-from-players=${spent} vs purse-deduction=${expected} (diff ${spent - expected})`);
      }
      const iconsActual = sold.filter((p) => p.icon_role && p.icon_role !== "none").length;
      if (iconsActual !== (t.icon_player_count ?? 0)) {
        info(`icon count drift "${t.name}"`, `actual=${iconsActual} stored=${t.icon_player_count}`);
      }
    }
  }
} else {
  info("no live tournament right now", "teams/players public-access test skipped (nothing live)");
}

// 5. Realtime subscription as anon
console.log("\n--- 5. Realtime (public viewer live updates) ---");
if (liveStates && liveStates.length > 0) {
  const tid = liveStates[0].tournament_id;
  let status = "timeout";
  const channel = supabase
    .channel(`health-check-${Date.now()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "auction_state", filter: `tournament_id=eq.${tid}` }, () => {})
    .subscribe((s) => { status = s; if (s === "SUBSCRIBED" || s === "CHANNEL_ERROR" || s === "TIMED_OUT") { /* resolved */ } });
  await new Promise((r) => setTimeout(r, 6000));
  ok("realtime subscribe auction_state", status === "SUBSCRIBED", `status=${status}${status !== "SUBSCRIBED" ? " → public viewer will rely on 5s polling fallback only" : ""}`);
  await supabase.removeChannel(channel);
} else {
  info("realtime test skipped", "no live tournament to subscribe to");
}

console.log("\n" + "=".repeat(70));
console.log(failures === 0 ? `✅ PHASE 1 COMPLETE — no failures` : `❌ PHASE 1 COMPLETE — ${failures} failure(s)`);
console.log("=".repeat(70));
process.exit(failures === 0 ? 0 : 2);
