# 🏏 Cricket Auction Pro

# █▀▀ █▀█ █ █▀▀ █ █ █▀▀ ▀█▀   █▀█ █▀█ █▀█
# █▄▄ █▀▄ █ █▄▄ █▄█ ██▄  █    █▀▀ █▀▄ █▄█

> **LIVE SITE:** [https://aution-cric.netlify.app/](https://aution-cric.netlify.app/)
> **COVERAGE:** 100% passing tests (38/38)

---

### 📰 THE CORE STACK

```text
┌───────────────────────────┬───────────────────────────┐
│ FRONTEND UTILITIES        │ STORAGE & REALTIME        │
├───────────────────────────┼───────────────────────────┤
│ React 18.2 + Vite 5       │ Supabase Auth & PG Database│
│ Tailwind CSS (Custom Dark)│ Realtime Bidding Sync     │
│ jsPDF (Newspaper Roster)  │ Supabase Storage (Photos) │
└───────────────────────────┴───────────────────────────┘
```

### ⚡ FEATURES
* 🏏 **Bidding Queue**: Zero-collision bidding serializes DB calls during rapid clicks.
*  Purse Monitor: Responsive dashboard lock limits height, showing scrolling purse cards.
* 📂 **Batch Import**: Immediate CSV upload for players/teams with local validation.
* 🏆 **PDF Manifest**: Download high-contrast news-style squad rosters.

### 🚀 COMMANDS
```bash
npm install     # Install packages
npm run dev     # Launch local environment
npx vitest run  # Run test suite
```
