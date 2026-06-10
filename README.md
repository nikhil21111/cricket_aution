# 🏏 Cricket Auction Pro

**Live Demo**: [https://aution-cric.netlify.app/](https://aution-cric.netlify.app/)

A real-time cricket player auction platform built with React and Supabase. Manage tournaments, teams, and conduct live auctions with real-time bidding updates and celebration animations.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-18.2-blue.svg)
![Supabase](https://img.shields.io/badge/Supabase-2.38-green.svg)

## ✨ Features

### 🎯 Core Features
- **Tournament Management**: Create and manage multiple cricket tournaments
- **Team Management**: Add teams with custom logos, colors, and purse budgets
- **Player Pool**: Build your player database with roles, base prices, and photos
- **Live Auction**: Real-time bidding interface with automatic updates
- **Public Viewer**: Share live auction link for read-only spectator access

### 🎨 Auction Experience
- **Real-time Bidding**: Live updates via Supabase Realtime subscriptions
- **Smart Bid Logic**: First bid starts at base price, subsequent bids add increments
- **Category-based Ordering**: Auction by role (Batsman, Bowler, All-Rounder, Wicket-Keeper)
- **Icon Players**: Special player categories with custom auction order
- **Random Mode**: Randomize player selection within categories
- **Celebration Animations**: 
  - 🎉 Fireworks when player is SOLD
  - 🦆 Duck animation when player goes UNSOLD
- **Unsold Round**: Give unsold players a second chance

### 🛠️ Technical Features
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Dark Theme**: Beautiful dark UI with smooth animations
- **Error Boundaries**: Graceful error handling
- **Offline Support**: Fallback polling when realtime is blocked
- **Authentication**: Secure user authentication with Supabase Auth
- **Row Level Security**: Proper RLS policies for data isolation

## 🏗️ Architecture

### Tech Stack
```
Frontend:
├── React 18.2 (UI framework)
├── React Router 6 (routing)
├── Tailwind CSS 3.3 (styling)
├── Vite 5.0 (build tool)
└── Fireworks.js (celebration animations)

Backend:
├── Supabase (PostgreSQL database)
├── Supabase Realtime (live subscriptions)
├── Supabase Auth (authentication)
└── Supabase Storage (image hosting)
```

### Project Structure
```
src/
├── components/          # Reusable UI components
│   ├── AddPlayerForm.jsx
│   ├── AddTeamForm.jsx
│   ├── ErrorBoundary.jsx
│   ├── Modal.jsx
│   └── Sidebar.jsx
├── context/            # React context providers
│   └── AuthContext.jsx
├── lib/                # Utilities and services
│   ├── supabase.js     # Supabase client & helpers
│   └── playerUtils.js  # Player utility functions
├── pages/              # Route components
│   ├── Login.jsx
│   ├── Signup.jsx
│   ├── Tournaments.jsx
│   ├── TournamentDashboard.jsx
│   ├── TournamentTeams.jsx
│   ├── TournamentPlayers.jsx
│   ├── TournamentLive.jsx    # Organizer auction control
│   └── LiveAuction.jsx        # Public viewer
├── App.jsx             # App routes & protected routes
├── main.jsx            # Entry point
└── index.css           # Global styles & animations
```

### Database Schema
See `database-schema.sql` for complete schema. Key tables:
- **tournaments**: Tournament metadata
- **teams**: Team information and budgets
- **players**: Player pool with status tracking
- **auction_state**: Current auction state (real-time updates)

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Supabase account ([sign up free](https://supabase.com))

### 1. Clone the repository
```bash
git clone https://github.com/nikhil21111/cricket_aution.git
cd cricket_aution
```

### 2. Install dependencies
```bash
npm install
```

### 3. Setup Supabase

#### Create a Supabase project
1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Copy your project URL and anon key

#### Run database schema
1. Open Supabase SQL Editor
2. Copy and run `database-schema.sql`

#### Setup RLS policies
For public live viewer access, run the RLS policies in the SQL editor:

```sql
-- auction_state public read when live
DROP POLICY IF EXISTS "Public can view live auction_state" ON auction_state;
CREATE POLICY "Public can view live auction_state" ON auction_state
	FOR SELECT USING (is_live = TRUE);

-- teams public read when tournament is live
DROP POLICY IF EXISTS "Public can view live teams" ON teams;
CREATE POLICY "Public can view live teams" ON teams
	FOR SELECT USING (
		EXISTS (
			SELECT 1 FROM auction_state a
			WHERE a.tournament_id = teams.tournament_id
			AND a.is_live = TRUE
		)
	);

-- players public read when tournament is live
DROP POLICY IF EXISTS "Public can view live players" ON players;
CREATE POLICY "Public can view live players" ON players
	FOR SELECT USING (
		EXISTS (
			SELECT 1 FROM auction_state a
			WHERE a.tournament_id = players.tournament_id
			AND a.is_live = TRUE
		)
	);

-- tournaments public read when live
DROP POLICY IF EXISTS "Public can view live tournaments" ON tournaments;
CREATE POLICY "Public can view live tournaments" ON tournaments
	FOR SELECT USING (
		EXISTS (
			SELECT 1 FROM auction_state a
			WHERE a.tournament_id = tournaments.id
			AND a.is_live = TRUE
		)
	);
```

### 4. Configure environment variables

Create `.env.local` file:
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 5. Run development server
```bash
npm run dev
```

Visit `http://localhost:5173` 🎉

## 📦 Deployment

### Deploy to Vercel (Recommended)

1. **Install Vercel CLI** (optional)
```bash
npm i -g vercel
```

2. **Deploy**
```bash
vercel
```

3. **Set environment variables** in Vercel dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

4. **Redeploy** to apply env vars

### Deploy to Netlify

1. **Connect repository** to Netlify
2. **Build settings**:
   - Build command: `npm run build`
   - Publish directory: `dist`
3. **Environment variables**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

### Environment Variables
| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_SUPABASE_URL` | Your Supabase project URL | ✅ Yes |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anonymous key | ✅ Yes |

**⚠️ Important**: Never commit `.env.production` or real credentials to git!

## 🎮 How to Use

### 1. Create Tournament
- Sign up / Login
- Click "Create Tournament"
- Set tournament name, description, and default settings

### 2. Add Teams
- Navigate to tournament dashboard
- Add teams with names, logos, colors, and purse budgets

### 3. Add Players
- Add players to the pool
- Set name, role, base price, and photo (optional)
- Mark special "Icon Players" if needed

### 4. Start Live Auction
- Click "Start Auction" from dashboard
- Select players in sequence or random mode
- Teams place bids in real-time
- Mark players as SOLD or UNSOLD
- Continue until all players are auctioned

### 5. Share with Viewers
- Copy the public live link from dashboard
- Share with spectators for read-only access
- They see real-time updates without login

## 🧪 Testing

### Run tests
```bash
npm test
```

### Test coverage
```bash
npm run test:coverage
```

### Key test files
- `src/lib/__tests__/supabase.test.js` - Currency formatting, utilities
- `src/lib/__tests__/auction.test.js` - Bid logic, price calculations
- `src/components/__tests__/AddPlayerForm.test.jsx` - Form validation

## 🛠️ Development

### Code structure guidelines
- Keep components under 300 lines
- Extract logic into custom hooks
- Use TypeScript for type safety (migration in progress)
- Follow React best practices

### Logging
The app uses a structured logging system:
```javascript
import { logger } from './lib/logger';

logger.info('Auction started', { tournamentId, playerId });
logger.error('Bid failed', { error, teamId });
```

Logs are sent to console in development and can be piped to external services in production.

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development workflow
1. Check existing issues or create new one
2. Assign yourself to the issue
3. Create feature branch
4. Write tests for new features
5. Ensure all tests pass
6. Submit PR with clear description

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with ❤️ by [Nikhil](https://github.com/nikhil21111)
- Inspired by IPL auction format
- Fireworks animation by [fireworks-js](https://github.com/crashmax-dev/fireworks-js)
- Duck animation by CSS community

## 🐛 Known Issues

- Large player lists (500+) may experience performance issues
- Mobile landscape mode needs UI optimization
- Safari may require page refresh for realtime updates

See [GitHub Issues](https://github.com/nikhil21111/cricket_aution/issues) for full list.

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/nikhil21111/cricket_aution/issues)
- **Discussions**: [GitHub Discussions](https://github.com/nikhil21111/cricket_aution/discussions)
- **Email**: support@example.com (replace with your email)

## 🗺️ Roadmap

- [ ] TypeScript migration
- [ ] Advanced analytics dashboard
- [ ] CSV import for bulk player upload
- [ ] Mobile app (React Native)
- [ ] Video streaming integration
- [ ] Multi-language support

---

Made with 🏏 and ⚡ by Nikhil
