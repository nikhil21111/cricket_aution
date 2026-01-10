import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ErrorBoundary from "./components/ErrorBoundary";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Tournaments from "./pages/Tournaments";
import TournamentDashboard from "./pages/TournamentDashboard";
import TournamentTeams from "./pages/TournamentTeams";
import TournamentPlayers from "./pages/TournamentPlayers";
import TournamentLive from "./pages/TournamentLive";
import LiveAuction from "./pages/LiveAuction";

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background-dark">
        <div className="flex flex-col items-center gap-4">
          <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Public Route (redirect to home if logged in)
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background-dark">
        <div className="flex flex-col items-center gap-4">
          <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return children;
};

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/signup"
        element={
          <PublicRoute>
            <Signup />
          </PublicRoute>
        }
      />

      {/* Protected Routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Tournaments />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tournament/:id"
        element={
          <ProtectedRoute>
            <TournamentDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tournament/:id/teams"
        element={
          <ProtectedRoute>
            <TournamentTeams />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tournament/:id/players"
        element={
          <ProtectedRoute>
            <TournamentPlayers />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tournament/:id/live"
        element={
          <ProtectedRoute>
            <TournamentLive />
          </ProtectedRoute>
        }
      />

      {/* Public live viewer */}
      <Route path="/live/:id" element={<LiveAuction />} />

      {/* Catch all - redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              background: "#1c2e35",
              color: "#fff",
              border: "1px solid #283539",
            },
          }}
        />
        <AppRoutes />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
