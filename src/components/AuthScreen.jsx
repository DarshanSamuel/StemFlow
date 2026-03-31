import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Music4, Mail, Lock, ArrowRight, UserRound, Disc3 } from "lucide-react";
import toast from "react-hot-toast";
import { signIn, signUp, continueAsGuest } from "../lib/api";
import { useAuth } from "../hooks/useAuth";

export default function AuthScreen() {
  const { setAuth } = useAuth();
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      const fn = mode === "signin" ? signIn : signUp;
      const data = await fn(email.trim(), password);
      setAuth(data.user);
      toast.success(mode === "signin" ? "Welcome back!" : "Account created!");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = () => {
    const data = continueAsGuest();
    setAuth({ ...data.user, isGuest: true });
    toast.success("Continuing as guest — your projects won't be saved.");
  };

  return (
    <div className="min-h-screen bg-gradient-animated noise-overlay flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 rounded-full bg-accent/5 blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-80 h-80 rounded-full bg-stem-vocals/5 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-border-subtle opacity-20" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full border border-border-subtle opacity-10" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="relative">
              <Disc3 className="w-10 h-10 text-accent animate-spin-slow" />
              <div className="absolute inset-0 bg-accent/20 blur-xl rounded-full" />
            </div>
            <h1 className="font-display text-3xl font-bold tracking-tight">
              Stem<span className="text-accent">Flow</span>
            </h1>
          </div>
          <p className="text-content-secondary text-sm max-w-xs mx-auto leading-relaxed">
            AI-powered music stem separation. Upload a track, get vocals, drums, bass & more.
          </p>
        </div>

        {/* Auth card */}
        <div className="glass rounded-2xl p-8">
          {/* Tab switcher */}
          <div className="flex bg-surface-sunken rounded-lg p-1 mb-6">
            {["signin", "signup"].map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
                  mode === m
                    ? "bg-surface-raised text-content-primary shadow-sm"
                    : "text-content-muted hover:text-content-secondary"
                }`}
              >
                {m === "signin" ? "Sign In" : "Sign Up"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-surface-sunken border border-border-default rounded-lg pl-10 pr-4 py-3 text-sm text-content-primary placeholder:text-content-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
                autoComplete="email"
              />
            </div>

            {/* Password */}
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
              <input
                type="password"
                placeholder="Password (6+ characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-surface-sunken border border-border-default rounded-lg pl-10 pr-4 py-3 text-sm text-content-primary placeholder:text-content-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent hover:bg-accent-hover text-content-inverse font-semibold py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed glow-ring"
            >
              {loading ? (
                <div className="flex items-end h-5">
                  <span className="loading-bar" />
                  <span className="loading-bar" />
                  <span className="loading-bar" />
                </div>
              ) : (
                <>
                  {mode === "signin" ? "Sign In" : "Create Account"}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-border-default" />
            <span className="text-xs text-content-muted uppercase tracking-widest">or</span>
            <div className="flex-1 h-px bg-border-default" />
          </div>

          {/* Guest mode */}
          <button
            onClick={handleGuest}
            className="w-full bg-surface-sunken hover:bg-surface-overlay border border-border-default text-content-secondary hover:text-content-primary py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 text-sm"
          >
            <UserRound className="w-4 h-4" />
            Continue as Guest
          </button>
        </div>

        <p className="text-center text-xs text-content-muted mt-4">
          Powered by Meta's Demucs model · GPU-accelerated on Google Colab
        </p>
      </motion.div>
    </div>
  );
}
