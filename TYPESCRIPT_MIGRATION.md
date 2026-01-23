# TypeScript Migration Plan

## Overview
Convert the Cricket Auction Pro codebase from JavaScript to TypeScript for improved type safety, better IDE support, and enhanced maintainability.

## Benefits
- **Type Safety**: Catch errors at compile time instead of runtime
- **Better IDE Support**: Enhanced autocomplete and inline documentation
- **Easier Refactoring**: Confidently rename and restructure code
- **Self-Documenting**: Types serve as inline documentation

## Migration Strategy

### Phase 1: Setup TypeScript Infrastructure
- [ ] Install TypeScript and type definitions
  ```bash
  npm install --save-dev typescript @types/react @types/react-dom @types/node
  ```
- [ ] Create `tsconfig.json` with strict mode
- [ ] Rename `vite.config.js` to `vite.config.ts`
- [ ] Update build scripts if needed

### Phase 2: Convert Utility Files (Low Risk)
- [ ] `src/lib/supabase.js` → `src/lib/supabase.ts`
  - Add types for currency formatting functions
  - Type Supabase client properly
- [ ] `src/lib/logger.js` → `src/lib/logger.ts`
  - Add interfaces for log entries
- [ ] `src/lib/playerUtils.js` → `src/lib/playerUtils.ts`
  - Add Player, Team, Tournament interfaces

### Phase 3: Convert Context (Medium Risk)
- [ ] `src/context/AuthContext.jsx` → `src/context/AuthContext.tsx`
  - Type user object
  - Type auth functions (signIn, signUp, signOut)

### Phase 4: Convert Components (Medium Risk)
Start with smaller components:
- [ ] `src/components/Modal.jsx` → `src/components/Modal.tsx`
- [ ] `src/components/ErrorBoundary.jsx` → `src/components/ErrorBoundary.tsx`
- [ ] `src/components/Sidebar.jsx` → `src/components/Sidebar.tsx`
- [ ] `src/components/AddTeamForm.jsx` → `src/components/AddTeamForm.tsx`
- [ ] `src/components/AddPlayerForm.jsx` → `src/components/AddPlayerForm.tsx`

### Phase 5: Convert Pages (Higher Risk)
Convert pages one at a time, testing thoroughly:
- [ ] `src/pages/Login.jsx` → `src/pages/Login.tsx`
- [ ] `src/pages/Signup.jsx` → `src/pages/Signup.tsx`
- [ ] `src/pages/Tournaments.jsx` → `src/pages/Tournaments.tsx`
- [ ] `src/pages/Dashboard.jsx` → `src/pages/Dashboard.tsx`
- [ ] `src/pages/TournamentDashboard.jsx` → `src/pages/TournamentDashboard.tsx`
- [ ] `src/pages/TournamentTeams.jsx` → `src/pages/TournamentTeams.tsx`
- [ ] `src/pages/TournamentPlayers.jsx` → `src/pages/TournamentPlayers.tsx`
- [ ] `src/pages/LiveAuction.jsx` → `src/pages/LiveAuction.tsx`
- [ ] `src/pages/TournamentLive.jsx` → `src/pages/TournamentLive.tsx` (largest file - split first!)

### Phase 6: Convert Root Files
- [ ] `src/App.jsx` → `src/App.tsx`
- [ ] `src/main.jsx` → `src/main.tsx`

### Phase 7: Create Type Definitions
Create a central types file:
- [ ] `src/types/index.ts`
  ```typescript
  export interface Tournament {
    id: string;
    name: string;
    description: string;
    status: 'draft' | 'live' | 'completed';
    // ... other fields
  }
  
  export interface Team {
    id: string;
    name: string;
    short_name: string;
    total_purse: number;
    remaining_purse: number;
    // ... other fields
  }
  
  export interface Player {
    id: string;
    name: string;
    role: 'batsman' | 'bowler' | 'all-rounder' | 'wicket-keeper';
    base_price: number;
    status: 'available' | 'sold' | 'unsold';
    // ... other fields
  }
  
  export interface AuctionState {
    id: string;
    tournament_id: string;
    current_player_id: string | null;
    highest_bid: number;
    highest_bidder_id: string | null;
    is_live: boolean;
  }
  ```

### Phase 8: Update Tests
- [ ] Convert test files to `.test.ts` or `.test.tsx`
- [ ] Add type safety to test utilities

## Recommended TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",

    /* Linting */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

## Testing Strategy
- Run `npm test` after each file conversion
- Test critical user flows manually
- Ensure build passes: `npm run build`
- Check for type errors: `npx tsc --noEmit`

## Rollback Plan
- Commit each phase separately
- If issues arise, revert specific commits
- Keep JavaScript files until TypeScript versions are tested

## Estimated Timeline
- **Phase 1-3**: 2-3 hours (low risk)
- **Phase 4**: 3-4 hours (medium risk)
- **Phase 5**: 8-10 hours (high risk, split TournamentLive first!)
- **Phase 6-8**: 2-3 hours (final cleanup)

**Total**: ~15-20 hours

## Notes
- Start with `allowJs: true` in tsconfig to allow gradual migration
- Use `// @ts-ignore` sparingly for quick workarounds
- Prioritize public APIs and shared utilities first
- Consider splitting `TournamentLive.jsx` into smaller components before TypeScript conversion

## Success Criteria
- [ ] All files converted to `.ts` or `.tsx`
- [ ] Zero TypeScript errors: `npx tsc --noEmit`
- [ ] All tests passing
- [ ] Build succeeds
- [ ] No runtime errors in production
