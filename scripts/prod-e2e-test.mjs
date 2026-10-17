import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// PHASE 2: AUTHENTICATED E2E TEST against the REAL Supabase project.
// Creates a disposable QA tournament, replicates every DB operation the app
// performs (selectPlayer / placeBid / markSold / markUnsold / unsold round /
// endAuction), verifies public RLS policies from an anon client, then cleans
// up. Real user data is only ever READ (via anon live policies), never touched.
// ---------------------------------------------------------------------------

const env = {};
for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) env[m[1]] = (m[2] || "").trim().replace(/^["']|["']$/g, "");
}
const URL = env.VITE_SUPABASE_URL;
const KEY = env.VITE_SUPABASE_ANON_KEY;

let failures = 0;
const ok = (name, cond, detail = "") => {
  console.log(`${cond ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};
const section = (t) => console.log(`\n--- ${t} ---`);

// Owner client (QA account created through public signup)
const owner = createClient(URL, KEY);
const email = `qa-bot-${Date.now()}@example.com`;
const password = "Qa-" + Math.random().toString(36).slice(2, 10) + "!9";
const { data: su, error: suErr } = await owner.auth.signUp({ email, password });
if (suErr || !su.session) {
  console.log("❌ could not create QA session:", suErr?.message ?? "no session");
  process.exit(1);
}
console.log(`🔐 QA account: ${email}`);
const UID = su.session.user.id;

// Anon client (what the public viewer uses)
const anon = createClient(URL, KEY);

const TS = Date.now();
const T_NAME = `QA TEST — SAFE TO DELETE ${TS}`;
let tid, teamA, teamB, pIcon, pBatsman, pBowler;

// --- Setup -----------------------------------------------------------------
section("SETUP (owner writes)");
{
  const { data, error } = await owner.from("tournaments")
    .insert({ name: T_NAME, description: "automated QA — will be deleted", default_purse: 10000, default_base_price: 500, status: "draft", user_id: UID })
    .select().single();
  ok("create tournament", !error, error?.message ?? `id=${data.id.slice(0, 8)}…`);
  tid = data.id;

  const { error: asErr } = await owner.from("auction_state")
    .insert({ tournament_id: tid, is_live: false, highest_bid: 0 });
  ok("create auction_state", !asErr, asErr?.message);

  const { data: teams, error: tErr } = await owner.from("teams")
    .insert([
      { tournament_id: tid, name: "QA Alpha", short_name: "QAA", color: "#22c55e", total_purse: 10000, remaining_purse: 10000 },
      { tournament_id: tid, name: "QA Beta", short_name: "QAB", color: "#f97316", total_purse: 10000, remaining_purse: 10000 },
    ])
    .select();
  ok("create 2 teams", !tErr && teams?.length === 2, tErr?.message);
  [teamA, teamB] = teams;

  const { data: players, error: pErr } = await owner.from("players")
    .insert([
      { tournament_id: tid, name: "QA Icon Player", role: "batsman", icon_role: "icon-player-sequence", base_price: 1000, status: "available" },
      { tournament_id: tid, name: "QA Batsman", role: "batsman", icon_role: "none", base_price: 500, status: "available" },
      { tournament_id: tid, name: "QA Bowler", role: "bowler", icon_role: "none", base_price: 500, status: "available" },
    ])
    .select();
  ok("create 3 players", !pErr && players?.length === 3, pErr?.message);
  [pIcon, pBatsman, pBowler] = players;
}

// --- THE KEY POLICY TEST ----------------------------------------------------
section("PUBLIC RLS POLICY TEST (anon while is_live=true)");
{
  await owner.from("auction_state").update({ is_live: true, current_player_id: pIcon.id })
    .eq("tournament_id", tid);

  const { data: viewRows } = await anon.from("public_live_tournaments").select("id, name").eq("id", tid);
  ok("anon sees tournament in public_live_tournaments view", (viewRows ?? []).length === 1,
    (viewRows ?? []).length === 1 ? `name="${viewRows[0].name}"` : "VIEW DID NOT EXPOSE IT");

  const { data: aTeams } = await anon.from("teams").select("*").eq("tournament_id", tid);
  ok("anon reads live tournament's TEAMS", (aTeams ?? []).length === 2,
    (aTeams ?? []).length === 2 ? "policy works" : `GOT ${aTeams?.length} — PUBLIC SQUADS INVISIBLE`);

  const { data: aPlayers } = await anon.from("players").select("*").eq("tournament_id", tid);
  ok("anon reads live tournament's PLAYERS", (aPlayers ?? []).length === 3,
    (aPlayers ?? []).length === 3 ? "policy works" : `GOT ${aPlayers?.length} — PUBLIC SQUADS INVISIBLE`);

  // anon must NOT be able to write
  const { error: wErr } = await anon.from("auction_state")
    .update({ highest_bid: 999999 }).eq("tournament_id", tid);
  const { data: after } = await owner.from("auction_state").select("highest_bid").eq("tournament_id", tid).single();
  ok("anon CANNOT modify auction_state", !wErr && after.highest_bid !== 999999,
    after.highest_bid !== 999999 ? "write correctly blocked" : "SECURITY HOLE: anon wrote a bid!");
}

// --- BID FLOW (replicates placeBid's serialized queue write) ---------------
section("BID FLOW (app-equivalent writes)");
{
  const bid1 = { teamId: teamA.id, amount: pIcon.base_price, time: new Date().toLocaleTimeString() };
  await owner.from("auction_state").update({ highest_bid: bid1.amount, highest_bidder_id: bid1.teamId, bid_history: JSON.stringify([bid1]) })
    .eq("tournament_id", tid);

  const bid2 = { teamId: teamB.id, amount: pIcon.base_price + 500, time: new Date().toLocaleTimeString() };
  const { error } = await owner.from("auction_state")
    .update({ highest_bid: bid2.amount, highest_bidder_id: bid2.teamId, bid_history: JSON.stringify([bid2, bid1]) })
    .eq("tournament_id", tid);
  ok("place 2 sequential bids", !error, error?.message);

  const { data: s } = await owner.from("auction_state").select("*").eq("tournament_id", tid).single();
  ok("highest_bid persisted", s.highest_bid === bid2.amount, `got ${s.highest_bid}`);
  ok("bid_history persisted + parseable", Array.isArray(JSON.parse(s.bid_history)) && JSON.parse(s.bid_history).length === 2);
  ok("highest bidder is team B", s.highest_bidder_id === teamB.id);
}

// --- SOLD FLOW (replicates markSold's parallel writes) ----------------------
section("SOLD FLOW");
{
  const soldPrice = pIcon.base_price + 500;
  const newPurse = teamB.remaining_purse - soldPrice;
  const [r1, r2, r3] = await Promise.all([
    owner.from("players").update({ status: "sold", sold_price: soldPrice, team_id: teamB.id }).eq("id", pIcon.id),
    owner.from("teams").update({ remaining_purse: newPurse, icon_player_count: 1 }).eq("id", teamB.id),
    owner.from("auction_state").update({ current_player_id: null, highest_bid: 0, highest_bidder_id: null, bid_history: null }).eq("tournament_id", tid),
  ]);
  ok("parallel sold writes", !r1.error && !r2.error && !r3.error,
    [r1.error, r2.error, r3.error].filter(Boolean).map(e => e.message).join("; "));

  const { data: p } = await owner.from("players").select("*").eq("id", pIcon.id).single();
  const { data: t } = await owner.from("teams").select("*").eq("id", teamB.id).single();
  ok("player marked sold with team+price", p.status === "sold" && p.team_id === teamB.id && p.sold_price === soldPrice);
  ok("purse deducted correctly", t.remaining_purse === newPurse, `${t.remaining_purse} (expected ${newPurse})`);
  ok("icon count incremented", t.icon_player_count === 1);
  const { data: s } = await owner.from("auction_state").select("*").eq("tournament_id", tid).single();
  ok("auction state cleared", s.current_player_id === null && s.highest_bid === 0 && s.bid_history === null);
}

// --- UNSOLD + UNSOLD ROUND ---------------------------------------------------
section("UNSOLD + UNSOLD ROUND");
{
  await owner.from("auction_state").update({ current_player_id: pBatsman.id, is_live: true }).eq("tournament_id", tid);
  const { error } = await owner.from("players").update({ status: "unsold" }).eq("id", pBatsman.id);
  ok("mark unsold", !error, error?.message);
  const { error: e2 } = await owner.from("players").update({ status: "available" })
    .eq("tournament_id", tid).eq("status", "unsold");
  ok("unsold round restores availability", !e2, e2?.message);
  const { data: chk } = await owner.from("players").select("status").eq("id", pBatsman.id).single();
  ok("player back to available", chk.status === "available");
}

// --- END AUCTION -------------------------------------------------------------
section("END AUCTION");
{
  await Promise.all([
    owner.from("auction_state").update({ is_live: false, current_player_id: null, highest_bid: 0, highest_bidder_id: null, bid_history: null }).eq("tournament_id", tid),
    owner.from("tournaments").update({ status: "completed" }).eq("id", tid),
  ]);
  const { data: viewRows } = await anon.from("public_live_tournaments").select("id").eq("id", tid);
  ok("ended tournament hidden from public view", (viewRows ?? []).length === 0);
  const { data: aTeams } = await anon.from("teams").select("id").eq("tournament_id", tid);
  ok("ended tournament teams hidden from anon", (aTeams ?? []).length === 0);
}

// --- REAL-DATA ANON AUDIT (their live tournaments, read-only) ----------------
section("REAL LIVE TOURNAMENTS (anon, read-only)");
{
  const { data: live } = await anon.from("auction_state").select("*").eq("is_live", true);
  console.log(`   live auction_state rows: ${(live ?? []).length}`);
  for (const s of live ?? []) {
    const { data: v } = await anon.from("public_live_tournaments").select("name, status").eq("id", s.tournament_id).single();
    const { data: tt } = await anon.from("teams").select("id").eq("tournament_id", s.tournament_id);
    const { data: pp } = await anon.from("players").select("id").eq("tournament_id", s.tournament_id);
    console.log(`   • ${s.tournament_id.slice(0, 8)}… status="${v?.status}" | anon sees teams=${tt?.length} players=${pp?.length} | bid=${s.highest_bid} bidder=${s.highest_bidder_id ? "set" : "null"}`);
    if (s.highest_bid > 0 && !s.highest_bidder_id) {
      ok(`integrity ${s.tournament_id.slice(0,8)}…`, false, "bid > 0 with no bidder");
    }
  }
}

// --- CLEANUP ------------------------------------------------------------------
section("CLEANUP (delete QA tournament)");
{
  await owner.from("players").delete().eq("tournament_id", tid);
  await owner.from("teams").delete().eq("tournament_id", tid);
  const { error: asErr } = await owner.from("auction_state").delete().eq("tournament_id", tid);
  const { error: tErr } = await owner.from("tournaments").delete().eq("id", tid);
  ok("delete QA tournament", !tErr, [asErr, tErr].filter(Boolean).map(e => e.message).join("; "));
  const { data: gone } = await owner.from("tournaments").select("id").eq("id", tid);
  ok("QA tournament fully removed", (gone ?? []).length === 0);
}

console.log("\n" + "=".repeat(70));
console.log(failures === 0 ? "✅ PHASE 2 COMPLETE — all checks passed" : `❌ PHASE 2 — ${failures} failure(s)`);
console.log("=".repeat(70));
process.exit(failures === 0 ? 0 : 2);
