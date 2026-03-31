import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getMe, signOut as apiSignOut } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const token = localStorage.getItem("sf_token");
    if (!token) {
      setLoading(false);
      return;
    }

    if (token === "guest") {
      setUser({ id: "guest", email: "guest@stemflow.app", isGuest: true });
      setLoading(false);
      return;
    }

    getMe()
      .then((data) => setUser(data.user))
      .catch(() => {
        localStorage.removeItem("sf_token");
      })
      .finally(() => setLoading(false));
  }, []);

  const signOut = useCallback(() => {
    apiSignOut();
    setUser(null);
  }, []);

  const setAuth = useCallback((userData) => {
    setUser(userData);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signOut, setAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
