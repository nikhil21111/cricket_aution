# Design System — Cricket Auction Pro

## Product Context
- **What this is:** A real-time cricket player auction platform for managing tournaments, bidding, and tracking team budgets.
- **Who it's for:** Tournament organizers, team representatives, and cricket fans watching the auction live.
- **Space/industry:** Sports technology and auction software.
- **Project type:** Interactive web app with real-time dashboards and spectator public views.

## Aesthetic Direction
- **Direction:** Modern Sports Editorial.
- **Decoration level:** Intentional (sharp 1px solid borders, off-white/light gray surfaces, high-contrast layouts, scoreboards).
- **Mood:** High-energy, print-inspired sports magazine layout with data-dense bento boxes and bold typography.
- **Reference style:** Tactile Brutalism with athletic layout styling.

## Typography
- **Display/Hero:** Outfit — Used for main headings, section titles, and action triggers. Styled as bold/extrabold, uppercase, and tight letter-spacing.
- **Body:** Source Sans 3 — Used for readability of labels, forms, descriptions, and user inputs.
- **UI/Labels:** Source Sans 3 (bold for key statuses).
- **Data/Tables:** Geist Mono — Used for bid numbers, currency values (Cr / Lakhs), clock counters, and table rows to ensure tabular-nums alignment.
- **Code:** Geist Mono.
- **Loading:** Loaded from Google Fonts:
  `https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&family=Source+Sans+3:ital,wght@0,300;0,400;0,600;0,700;1,400&family=Geist+Mono:wght@400;700&display=swap`
- **Scale:**
  - Hero Display: 3.5rem (56px) / leading-tight
  - Section Headings: 2rem (32px)
  - Card Titles: 1.25rem (20px)
  - UI Labels: 0.875rem (14px)
  - Monospace Data: 1.15rem / 2rem / 2.25rem

## Color Palette (High-Contrast Sports Editorial)
- **Approach:** Restrained High-Contrast.
- **Primary Accent:** `#E11D48` (Editorial Crimson) — Used for critical highlights, high bids, active bidding states, and key CTAs.
- **Secondary Accent:** `#2563EB` (Stadium Cobalt) — Used for secondary actions, team indicators, and status tags.
- **Success Tone:** `#10B981` (Pitch Green) — Used for SOLD status badges and successful bid logs.
- **Warning/Pending Tone:** `#F59E0B` (Stadium Amber) — Used for ACTIVE BIDDING status and clock urgency.
- **Neutrals (Light Theme - Default):**
  - Background Primary: `#FFFFFF`
  - Background Secondary: `#F8FAFC`
  - Background Tertiary: `#F1F5F9`
  - Text Primary: `#0F172A` (Editorial Ink)
  - Text Secondary: `#475569`
  - Borders: `#0F172A` (1px solid or 2px solid)
- **Neutrals (Dark Theme - Toggle):**
  - Background Primary: `#0F172A`
  - Background Secondary: `#1E293B`
  - Text Primary: `#F8FAFC`
  - Text Secondary: `#94A3B8`
  - Borders: `#F8FAFC`
  - Primary Accent (Dark): `#FB7185`
  - Secondary Accent (Dark): `#60A5FA`

## Spacing & Borders
- **Base unit:** 8px.
- **Density:** Compact & high-density (sports-dashboard grids).
- **Scale:** `xs: 4px`, `sm: 8px`, `md: 16px`, `lg: 24px`, `xl: 32px`.
- **Border radius:** Sharp (0px) for cards, buttons, badges, and containers to achieve the raw editorial style.
- **Shadows:** Hard flat offsets rather than soft blurs (e.g. `box-shadow: 4px 4px 0px #0F172A`).

## Layout & Structure
- **Bento Grid:** Information must be organized into high-contrast boxed cells with clear 1px/2px borders.
- **Scoreboard Navbar:** Tightly padded header containing secondary monospaced breadcrumbs above a primary bold title, next to a structured bid-clock timer box.
- **Bidding Console Grid:** Bidding triggers for teams must be grouped in a clean grid (e.g. 2 columns for multi-team bidding) rather than cluttering pages.
- **Scrollable Sidebar List:** Large team listings must have a fixed height with custom scrollbars to remain compact.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-06 | Redesign from Stadium Night Glow to Modern Sports Editorial | Move away from dark-only glassmorphic preset to a light/dark high-contrast magazine print style with Outfit and Geist Mono. |
