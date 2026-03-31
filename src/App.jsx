import { Toaster } from "react-hot-toast";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import AuthScreen from "./components/AuthScreen";
import Dashboard from "./components/Dashboard";

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-animated noise-overlay">
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-end h-8">
            <span className="loading-bar" />
            <span className="loading-bar" />
            <span className="loading-bar" />
            <span className="loading-bar" />
            <span className="loading-bar" />
          </div>
          <p className="text-content-secondary font-body text-sm tracking-wide">
            Loading StemFlow...
          </p>
        </div>
      </div>
    );
  }

  return user ? <Dashboard /> : <AuthScreen />;
}

export default function App() {
  return (
    <AuthProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "var(--surface-overlay)",
            color: "var(--content-primary)",
            border: "1px solid var(--border-default)",
            fontFamily: '"DM Sans", sans-serif',
            fontSize: "14px",
          },
        }}
      />
      <AppContent />
    </AuthProvider>
  );
}
