import { Link, useLocation } from "react-router-dom";
import toast from "react-hot-toast";

const Sidebar = ({ auctionState, tournament, tournamentId }) => {
  const location = useLocation();

  // Determine base path for tournament-specific or global routes
  const basePath = tournamentId ? `/tournament/${tournamentId}` : "";

  const getLinkClass = (path) => {
    const fullPath = tournamentId
      ? `${basePath}${path === "/" ? "" : path}`
      : path;
    const isActive =
      location.pathname === fullPath ||
      (path === "/" && location.pathname === basePath);
    return isActive
      ? "flex items-center gap-3 px-3 py-3 border-2 border-text-primary dark:border-text-secondary-dark bg-background-light dark:bg-card-dark text-text-primary dark:text-slate-100 font-display font-bold uppercase tracking-wider shadow-[3px_3px_0px_var(--border-color)]"
      : "flex items-center gap-3 px-3 py-3 border border-transparent hover:border-text-primary dark:hover:border-text-secondary-dark hover:bg-background-light dark:hover:bg-card-dark text-text-secondary dark:text-text-secondary-dark font-display font-medium uppercase tracking-wider hover:shadow-[3px_3px_0px_var(--border-color)] transition-all";
  };

  const copyPublicLink = async () => {
    if (!tournamentId) return;
    const url = `${window.location.origin}/live/${tournamentId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Public live link copied");
    } catch (e) {
      toast.error("Couldn't copy link");
    }
  };

  return (
    <aside className="relative overflow-hidden w-64 flex-shrink-0 border-r-3 border-text-primary dark:border-text-secondary-dark bg-background-light dark:bg-background-dark hidden md:flex flex-col">
      <div className="relative z-10 flex flex-col flex-1 overflow-hidden">
        <div className="p-6 pb-2">
          <div className="flex items-center gap-3 mb-6">
            <Link
              to="/"
              className="bg-primary/10 border-2 border-primary size-10 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors"
            >
              <span className="material-symbols-outlined">sports_cricket</span>
            </Link>
            <div className="flex flex-col">
              <h1 className="text-text-primary dark:text-slate-100 font-display text-lg font-black leading-none tracking-tight uppercase">
                Auction Pro
              </h1>
              <p className="text-text-secondary dark:text-text-secondary-dark text-xs font-mono font-bold uppercase mt-0.5">
                ORGANIZER PANEL
              </p>
            </div>
          </div>

          {/* Tournament Name if in tournament context */}
          {tournament && (
            <div className="mb-6 p-4 border-2 border-text-primary dark:border-text-secondary-dark bg-background-light dark:bg-card-dark shadow-[3px_3px_0px_var(--border-color)]">
              <p className="text-[10px] text-accent-crimson uppercase font-mono font-bold tracking-wider mb-1">
                CURRENT TOURNAMENT
              </p>
              <p className="text-text-primary dark:text-slate-100 font-display font-extrabold text-sm truncate">
                {tournament.name}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {tournamentId ? (
              // Tournament-specific navigation
              <>
                <Link className={getLinkClass("/")} to={basePath}>
                  <span
                    className="material-symbols-outlined"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    dashboard
                  </span>
                  <p className="text-sm leading-normal">Dashboard</p>
                </Link>
                <Link className={getLinkClass("/live")} to={`${basePath}/live`}>
                  <span className="material-symbols-outlined">live_tv</span>
                  <p className="text-sm leading-normal">Live Auction</p>
                </Link>
                <Link className={getLinkClass("/teams")} to={`${basePath}/teams`}>
                  <span className="material-symbols-outlined">groups</span>
                  <p className="text-sm leading-normal">Team Summary</p>
                </Link>
              </>
            ) : (
              // Global navigation (no tournament context)
              <>
                <Link className={getLinkClass("/")} to="/">
                  <span
                    className="material-symbols-outlined"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    dashboard
                  </span>
                  <p className="text-sm leading-normal">My Tournaments</p>
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="mt-auto p-6 flex flex-col gap-3">
          {tournamentId && (
            <div className="border-2 border-text-primary dark:border-text-secondary-dark bg-background-light dark:bg-card-dark p-4 shadow-[3px_3px_0px_var(--border-color)]">
              <div className="flex items-center gap-3 mb-3">
                <div className="size-8 border border-text-primary dark:border-text-secondary-dark bg-accent-amber/20 flex items-center justify-center text-accent-amber">
                  <span className="material-symbols-outlined text-[18px]">
                    bolt
                  </span>
                </div>
                <p className="text-xs font-mono font-bold text-text-primary dark:text-slate-100 uppercase">Live Status</p>
              </div>
              <p className="text-text-secondary dark:text-text-secondary-dark text-xs mb-4 leading-snug">
                {auctionState?.is_live
                  ? "Auction is currently live!"
                  : "Auction is currently inactive. Start to go live."}
              </p>
              <Link
                to={`${basePath}/live`}
                className="w-full h-10 border-2 border-text-primary dark:border-text-secondary-dark bg-primary hover:bg-primary-dark text-white text-xs font-bold font-display uppercase tracking-wider flex items-center justify-center shadow-[3px_3px_0px_var(--border-color)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_var(--border-color)] transition-all"
              >
                {auctionState?.is_live ? "View Live" : "Start Auction"}
              </Link>
              <button
                type="button"
                onClick={copyPublicLink}
                className="w-full h-10 mt-3 border-2 border-text-primary dark:border-text-secondary-dark bg-background-light dark:bg-card-dark hover:bg-background-tertiary text-text-primary dark:text-slate-100 text-xs font-bold font-display uppercase tracking-wider flex items-center justify-center gap-2 shadow-[3px_3px_0px_var(--border-color)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_var(--border-color)] transition-all"
              >
                <span className="material-symbols-outlined text-[16px]">link</span>
                Copy public link
              </button>
            </div>
          )}

          {/* Back to Tournaments Link */}
          <Link
            to="/"
            className="w-full h-10 border-2 border-text-primary dark:border-text-secondary-dark bg-background-light dark:bg-card-dark hover:bg-background-tertiary text-text-primary dark:text-slate-100 text-xs font-bold font-display uppercase tracking-wider flex items-center justify-center gap-2 shadow-[3px_3px_0px_var(--border-color)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_var(--border-color)] transition-all"
          >
            <span className="material-symbols-outlined text-[16px]">
              arrow_back
            </span>
            All Tournaments
          </Link>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
