import { useState } from 'react'
import { Link } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import Modal from '../components/Modal'
import AddTeamForm from '../components/AddTeamForm'
import AddPlayerForm from '../components/AddPlayerForm'
import { formatCurrency, formatShortCurrency } from '../lib/supabase'

const Dashboard = ({ teams, players, auctionState, refreshData }) => {
  const [showAddTeam, setShowAddTeam] = useState(false)
  const [showAddPlayer, setShowAddPlayer] = useState(false)

  const totalPurse = teams.reduce((sum, t) => sum + (t.total_purse || 0), 0)
  const remainingPurse = teams.reduce((sum, t) => sum + (t.remaining_purse || 0), 0)
  const soldPlayers = players.filter(p => p.status === 'sold').length
  const availablePlayers = players.filter(p => p.status === 'available').length

  const getRoleColor = (role) => {
    switch (role) {
      case 'batsman': return 'text-primary bg-primary/10 border-primary/20'
      case 'bowler': return 'text-green-400 bg-green-500/10 border-green-500/20'
      case 'all-rounder': return 'text-orange-400 bg-orange-500/10 border-orange-500/20'
      case 'wicket-keeper': return 'text-purple-400 bg-purple-500/10 border-purple-500/20'
      default: return 'text-gray-400 bg-gray-500/10 border-gray-500/20'
    }
  }

  const getRoleLabel = (role) => {
    switch (role) {
      case 'batsman': return 'Batsman'
      case 'bowler': return 'Bowler'
      case 'all-rounder': return 'All-Rounder'
      case 'wicket-keeper': return 'WK'
      default: return role
    }
  }

  return (
    <div className="flex h-screen w-full">
      <Sidebar auctionState={auctionState} />
      
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-background-dark relative">
        {/* Header */}
        <header className="h-20 flex-shrink-0 flex items-center justify-between px-6 border-b border-[#283539] bg-background-dark/50 backdrop-blur-md sticky top-0 z-20">
          <div className="flex flex-col">
            <h2 className="text-white text-2xl font-black tracking-tight">Dashboard</h2>
            <p className="text-text-secondary text-sm hidden sm:block">Welcome back, organize your mega auction.</p>
          </div>
          <div className="flex items-center gap-4">
            <button className="hidden sm:flex items-center justify-center size-10 rounded-full bg-[#1c2e35] text-white hover:bg-[#283539] transition-colors">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <div className="flex items-center gap-3 pl-4 border-l border-[#283539]">
              <div className="size-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                A
              </div>
              <div className="hidden md:flex flex-col">
                <p className="text-white text-sm font-bold leading-none">Admin User</p>
                <p className="text-text-secondary text-xs leading-none mt-1">Organizer</p>
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-20">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 max-w-7xl mx-auto">
            
            {/* Hero Card */}
            <div className="col-span-1 md:col-span-2 relative group overflow-hidden rounded-2xl bg-card-dark border border-[#283539] shadow-lg transition-all hover:border-primary/50">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent"></div>
              <div className="relative z-10 p-6 h-full flex flex-col justify-end min-h-[200px]">
                <div className="flex items-start justify-between mb-4">
                  <div className="bg-primary/20 backdrop-blur-sm p-2 rounded-lg text-primary">
                    <span className="material-symbols-outlined">trophy</span>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-md border ${
                    auctionState?.is_live 
                      ? 'bg-green-500/20 text-green-400 border-green-500/20' 
                      : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/20'
                  }`}>
                    {auctionState?.is_live ? 'Live' : 'Setup Mode'}
                  </span>
                </div>
                <h3 className="text-3xl font-black text-white mb-2">Cricket Mega Auction</h3>
                <p className="text-gray-300 text-sm mb-6 max-w-md">Configure teams, add players, and manage live bidding sessions.</p>
                <div className="flex gap-3">
                  <Link 
                    to="/live" 
                    className="flex items-center justify-center gap-2 h-10 px-6 bg-primary hover:bg-primary/90 text-background-dark text-sm font-bold rounded-lg transition-colors shadow-[0_0_15px_rgba(13,185,242,0.3)]"
                  >
                    <span className="material-symbols-outlined text-[20px]">play_arrow</span>
                    {auctionState?.is_live ? 'View Live' : 'Start Auction'}
                  </Link>
                  <Link 
                    to="/teams"
                    className="flex items-center justify-center gap-2 h-10 px-4 bg-[#283539] hover:bg-[#3b4e54] text-white text-sm font-bold rounded-lg transition-colors"
                  >
                    View Teams
                  </Link>
                </div>
              </div>
            </div>

            {/* Stats Card: Total Teams */}
            <div className="bg-card-dark rounded-2xl p-6 border border-[#283539] flex flex-col justify-between hover:bg-card-hover transition-colors group">
              <div className="flex justify-between items-start">
                <div className="bg-[#283539] p-2 rounded-lg text-white group-hover:text-primary transition-colors">
                  <span className="material-symbols-outlined">groups</span>
                </div>
                {teams.length > 0 && (
                  <span className="text-xs font-medium text-green-400 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">check_circle</span>
                    Active
                  </span>
                )}
              </div>
              <div className="mt-4">
                <p className="text-text-secondary text-sm font-medium mb-1">Total Teams</p>
                <p className="text-white text-3xl font-bold font-display tracking-tight">{teams.length}</p>
              </div>
            </div>

            {/* Stats Card: Total Players */}
            <div className="bg-card-dark rounded-2xl p-6 border border-[#283539] flex flex-col justify-between hover:bg-card-hover transition-colors group">
              <div className="flex justify-between items-start">
                <div className="bg-[#283539] p-2 rounded-lg text-white group-hover:text-primary transition-colors">
                  <span className="material-symbols-outlined">person</span>
                </div>
                <span className="text-xs font-medium text-text-secondary">Available: {availablePlayers}</span>
              </div>
              <div className="mt-4">
                <p className="text-text-secondary text-sm font-medium mb-1">Total Players</p>
                <p className="text-white text-3xl font-bold font-display tracking-tight">{players.length}</p>
              </div>
            </div>

            {/* Team Management Card */}
            <div className="col-span-1 md:col-span-2 row-span-2 bg-card-dark rounded-2xl border border-[#283539] flex flex-col overflow-hidden">
              <div className="p-5 border-b border-[#283539] flex items-center justify-between bg-[#16262c]">
                <div>
                  <h3 className="text-white text-lg font-bold">Teams</h3>
                  <p className="text-text-secondary text-xs">Manage franchises and budgets</p>
                </div>
                <button 
                  onClick={() => setShowAddTeam(true)}
                  className="flex items-center justify-center size-9 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-background-dark transition-all"
                >
                  <span className="material-symbols-outlined">add</span>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {teams.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="size-16 rounded-full bg-[#1c2e35] flex items-center justify-center text-text-secondary mb-4">
                      <span className="material-symbols-outlined text-3xl">groups</span>
                    </div>
                    <p className="text-text-secondary text-sm mb-4">No teams added yet</p>
                    <button 
                      onClick={() => setShowAddTeam(true)}
                      className="px-4 py-2 bg-primary text-background-dark text-sm font-bold rounded-lg hover:bg-primary-dark transition-colors"
                    >
                      Add First Team
                    </button>
                  </div>
                ) : (
                  teams.map((team) => {
                    const spent = team.total_purse - team.remaining_purse
                    const spentPercent = (spent / team.total_purse) * 100
                    const teamPlayers = players.filter(p => p.team_id === team.id)
                    
                    return (
                      <div 
                        key={team.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-[#1c2e35]/50 hover:bg-[#1c2e35] transition-colors group cursor-pointer border border-transparent hover:border-[#283539]"
                      >
                        <div className="flex items-center gap-4">
                          <div 
                            className="size-12 rounded-full flex items-center justify-center text-white font-bold text-sm border border-white/10 overflow-hidden"
                            style={{ backgroundColor: team.color }}
                          >
                            {team.logo_url ? (
                              <img src={team.logo_url} alt={team.name} className="w-full h-full object-cover" />
                            ) : (
                              team.short_name
                            )}
                          </div>
                          <div>
                            <p className="text-white font-bold text-sm">{team.name}</p>
                            <p className="text-text-secondary text-xs">
                              {formatShortCurrency(team.remaining_purse)} / {formatShortCurrency(team.total_purse)} • {teamPlayers.length} players
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 w-24">
                          <span className="text-white font-bold text-xs">{spentPercent.toFixed(0)}% spent</span>
                          <div className="w-full h-1.5 bg-[#283539] rounded-full overflow-hidden">
                            <div 
                              className="h-full rounded-full transition-all"
                              style={{ width: `${spentPercent}%`, backgroundColor: team.color }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Player Pool Card */}
            <div className="col-span-1 md:col-span-2 row-span-2 bg-card-dark rounded-2xl border border-[#283539] flex flex-col overflow-hidden">
              <div className="p-5 border-b border-[#283539] flex items-center justify-between bg-[#16262c]">
                <div>
                  <h3 className="text-white text-lg font-bold">Player Pool</h3>
                  <p className="text-text-secondary text-xs">Available players for auction</p>
                </div>
                <button 
                  onClick={() => setShowAddPlayer(true)}
                  className="flex items-center justify-center size-9 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-background-dark transition-all"
                >
                  <span className="material-symbols-outlined">person_add</span>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {players.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="size-16 rounded-full bg-[#1c2e35] flex items-center justify-center text-text-secondary mb-4">
                      <span className="material-symbols-outlined text-3xl">person</span>
                    </div>
                    <p className="text-text-secondary text-sm mb-4">No players added yet</p>
                    <button 
                      onClick={() => setShowAddPlayer(true)}
                      className="px-4 py-2 bg-primary text-background-dark text-sm font-bold rounded-lg hover:bg-primary-dark transition-colors"
                    >
                      Add First Player
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {players.filter(p => p.status === 'available').slice(0, 5).map((player) => (
                      <div 
                        key={player.id}
                        className="bg-[#1c2e35]/30 rounded-xl p-3 border border-transparent hover:border-[#283539] hover:bg-[#1c2e35] transition-all group relative"
                      >
                        <div className="flex flex-col items-center text-center">
                          <div 
                            className="size-14 rounded-full bg-gray-700 mb-3 border-2 border-[#283539] flex items-center justify-center text-text-secondary overflow-hidden"
                          >
                            {player.photo_url ? (
                              <img src={player.photo_url} alt={player.name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="material-symbols-outlined text-2xl">person</span>
                            )}
                          </div>
                          <h4 className="text-white font-bold text-sm line-clamp-1">{player.name}</h4>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 border ${getRoleColor(player.role)}`}>
                            {getRoleLabel(player.role)}
                          </span>
                          <p className="text-white font-bold text-sm mt-2">{formatShortCurrency(player.base_price)}</p>
                        </div>
                      </div>
                    ))}
                    
                    {/* Add Player Button */}
                    <button 
                      onClick={() => setShowAddPlayer(true)}
                      className="bg-[#1c2e35]/30 rounded-xl p-3 border border-dashed border-[#3b4e54] hover:border-primary hover:bg-primary/5 transition-all flex flex-col items-center justify-center text-center min-h-[140px] group"
                    >
                      <div className="size-12 rounded-full bg-[#283539] flex items-center justify-center mb-2 group-hover:bg-primary group-hover:text-background-dark transition-colors text-white">
                        <span className="material-symbols-outlined">add</span>
                      </div>
                      <p className="text-text-secondary text-xs font-medium group-hover:text-primary">Add Player</p>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Remaining Purse Stats Card */}
            <div className="bg-card-dark rounded-2xl p-6 border border-[#283539] flex flex-col justify-between hover:bg-card-hover transition-colors group">
              <div className="flex justify-between items-start">
                <div className="bg-[#283539] p-2 rounded-lg text-white group-hover:text-primary transition-colors">
                  <span className="material-symbols-outlined">account_balance_wallet</span>
                </div>
              </div>
              <div className="mt-4">
                <p className="text-text-secondary text-sm font-medium mb-1">Remaining Purse</p>
                <p className="text-white text-2xl font-bold font-display tracking-tight">{formatShortCurrency(remainingPurse)}</p>
                {totalPurse > 0 && (
                  <>
                    <div className="w-full bg-[#283539] rounded-full h-1.5 mt-3">
                      <div 
                        className="bg-primary h-1.5 rounded-full" 
                        style={{ width: `${(remainingPurse / totalPurse) * 100}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-text-secondary mt-2">
                      {((remainingPurse / totalPurse) * 100).toFixed(0)}% of total budget remaining
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Quick Action: Start Auction */}
            <Link 
              to="/live"
              className="bg-card-dark rounded-2xl p-6 border border-[#283539] flex flex-col justify-center items-center hover:bg-card-hover hover:border-primary/50 transition-colors cursor-pointer group text-center gap-3"
            >
              <div className="size-12 rounded-full bg-[#283539] flex items-center justify-center text-white group-hover:bg-primary group-hover:text-background-dark transition-all">
                <span className="material-symbols-outlined text-2xl">gavel</span>
              </div>
              <div>
                <p className="text-white font-bold text-sm">Start Auction</p>
                <p className="text-text-secondary text-xs mt-1">Begin live bidding session</p>
              </div>
            </Link>
          </div>
        </div>
      </main>

      {/* Add Team Modal */}
      <Modal isOpen={showAddTeam} onClose={() => setShowAddTeam(false)} title="Add New Team">
        <AddTeamForm onClose={() => setShowAddTeam(false)} onSuccess={refreshData} />
      </Modal>

      {/* Add Player Modal */}
      <Modal isOpen={showAddPlayer} onClose={() => setShowAddPlayer(false)} title="Add New Player">
        <AddPlayerForm onClose={() => setShowAddPlayer(false)} onSuccess={refreshData} />
      </Modal>
    </div>
  )
}

export default Dashboard
