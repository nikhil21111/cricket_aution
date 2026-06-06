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
      ? "flex items-center gap-3 px-3 py-3 rounded-xl nav-link-active group transition-all"
      : "flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-[#1c2e35] text-text-secondary hover:text-white transition-all";
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
    <aside className="w-64 flex-shrink-0 border-r border-[#283539] bg-background-dark hidden md:flex flex-col">
      <div className="p-6 pb-2">
        <div className="flex items-center gap-3 mb-4">
          <Link
            to="/"
            className="bg-primary/20 rounded-full size-10 flex items-center justify-center text-primary hover:bg-primary/30 transition-colors"
          >
            <span className="material-symbols-outlined">sports_cricket</span>
          </Link>
          <div className="flex flex-col">
            <h1 className="text-white text-lg font-bold leading-none tracking-tight">
              Auction Pro
            </h1>
            <p className="text-text-secondary text-xs font-normal">
              Organizer Panel
            </p>
          </div>
        </div>

        {/* Tournament Name if in tournament context */}
        {tournament && (
          <div className="mb-6 p-3 rounded-xl bg-[#1c2e35] border border-[#283539]">
            <p className="text-[10px] text-text-secondary uppercase font-bold tracking-wider mb-1">
              Current Tournament
            </p>
            <p className="text-white font-bold text-sm truncate">
              {tournament.name}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2">
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
                <p className="text-sm font-bold leading-normal">Dashboard</p>
              </Link>
              <Link className={getLinkClass("/live")} to={`${basePath}/live`}>
                <span className="material-symbols-outlined">live_tv</span>
                <p className="text-sm font-medium leading-normal">
                  Live Auction
                </p>
              </Link>
              <Link className={getLinkClass("/teams")} to={`${basePath}/teams`}>
                <span className="material-symbols-outlined">groups</span>
                <p className="text-sm font-medium leading-normal">
                  Team Summary
                </p>
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
                <p className="text-sm font-bold leading-normal">
                  My Tournaments
                </p>
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="mt-auto p-6">
        {tournamentId && (
          <div className="bg-gradient-to-br from-card-dark to-[#1c2e35] rounded-2xl p-4 border border-[#283539]">
            <div className="flex items-center gap-3 mb-3">
              <div className="size-8 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[18px]">
                  bolt
                </span>
              </div>
              <p className="text-xs font-bold text-white">Live Status</p>
            </div>
            <p className="text-text-secondary text-xs mb-3">
              {auctionState?.is_live
                ? "Auction is currently live!"
                : "Auction is currently inactive. Start to go live."}
            </p>
            <Link
              to={`${basePath}/live`}
              className="w-full h-8 bg-[#283539] hover:bg-[#3b4e54] text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center"
            >
              {auctionState?.is_live ? "View Live" : "Start Auction"}
            </Link>
            <button
              type="button"
              onClick={copyPublicLink}
              className="w-full h-8 mt-2 bg-[#1c2e35] hover:bg-[#283539] text-text-secondary hover:text-white text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[16px]">link</span>
              Copy public link
            </button>
          </div>
        )}

        {/* Back to Tournaments Link */}
        <Link
          to="/"
          className="w-full mt-3 h-10 bg-[#1c2e35] hover:bg-[#283539] text-text-secondary hover:text-white text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-[16px]">
            arrow_back
          </span>
          All Tournaments
        </Link>
      </div>
    </aside>
  );
};

export default Sidebar;
