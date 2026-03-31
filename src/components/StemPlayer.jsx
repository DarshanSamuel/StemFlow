import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Play,
  Pause,
  Download,
  Mic,
  Drum,
  Guitar,
  Layers,
  Music,
  Volume2,
  VolumeX,
  SkipBack,
  SkipForward,
  Scissors,
  PackageOpen,
  Clock,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import { stemURL } from "../lib/api";

/* ================================================================
   Stem config — each instrument has a color + icon
   ================================================================ */
const STEM_CONFIG = [
  {
    key: "vocals",
    label: "Vocals",
    icon: Mic,
    colorVar: "--stem-vocals",
    cardClass: "stem-card-vocals",
  },
  {
    key: "drums",
    label: "Drums",
    icon: Drum,
    colorVar: "--stem-drums",
    cardClass: "stem-card-drums",
  },
  {
    key: "bass",
    label: "Bass",
    icon: Guitar,
    colorVar: "--stem-bass",
    cardClass: "stem-card-bass",
  },
  {
    key: "other",
    label: "Other",
    icon: Layers,
    colorVar: "--stem-other",
    cardClass: "stem-card-other",
  },
];

/* ================================================================
   Individual Stem/Track Channel
   - Own play/pause, rewind 5s, forward 5s
   - Volume slider + mute
   - Clip preview (start/end)
   - Download button
   ================================================================ */
function TrackChannel({ config, url, isMaster }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(80);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Clip state
  const [clipStart, setClipStart] = useState("");
  const [clipEnd, setClipEnd] = useState("");
  const [clipping, setClipping] = useState(false);

  const Icon = config.icon;

  // Volume sync
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = muted ? 0 : volume / 100;
    }
  }, [volume, muted]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || loading) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().then(() => setPlaying(true)).catch(() => {});
    }
  };

  const seekBy = (seconds) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(duration, audio.currentTime + seconds));
  };

  const handleTimeUpdate = () => {
    const t = audioRef.current?.currentTime || 0;
    setCurrentTime(t);

    if (clipping && clipEnd && t >= parseFloat(clipEnd)) {
      audioRef.current.pause();
      audioRef.current.currentTime = parseFloat(clipStart) || 0;
      setPlaying(false);
      setClipping(false);
    }
  };

  const handlePreviewClip = () => {
    const start = parseFloat(clipStart) || 0;
    const end = parseFloat(clipEnd) || duration;
    if (start >= end) {
      toast.error("Start must be before end");
      return;
    }
    audioRef.current.currentTime = start;
    audioRef.current.play();
    setPlaying(true);
    setClipping(true);
  };

  const handleEnded = () => setPlaying(false);

  const formatTime = (s) => {
    if (!s || isNaN(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const handleDownload = () => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${config.label.toLowerCase()}.mp3`;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const progressPct = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className={`${isMaster ? "border-l-[3px] border-accent" : config.cardClass} bg-surface-raised rounded-xl p-5 space-y-4`}
    >
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onLoadedMetadata={() => {
          setDuration(audioRef.current?.duration || 0);
          setLoading(false);
          setError(false);
        }}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onWaiting={() => setLoading(true)}
        onCanPlay={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setError(true);
        }}
      />

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Icon
            className="w-5 h-5"
            style={{ color: isMaster ? "var(--accent)" : `var(${config.colorVar})` }}
          />
          <span className="font-display text-base font-semibold">
            {config.label}
          </span>
          {loading && !error && (
            <Loader2 className="w-4 h-4 text-content-muted animate-spin" />
          )}
          {error && (
            <span className="text-xs text-red-400">Failed to load</span>
          )}
        </div>

        {!isMaster && (
          <button
            onClick={handleDownload}
            className="p-2 rounded-lg hover:bg-surface-overlay text-content-muted hover:text-content-primary transition-all"
            title={`Download ${config.label}`}
          >
            <Download className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Timeline / progress bar ── */}
      <div className="space-y-1.5">
        <div
          className="w-full bg-surface-sunken rounded-full h-2 cursor-pointer group"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            if (audioRef.current) audioRef.current.currentTime = pct * duration;
          }}
        >
          <div
            className="h-full rounded-full transition-all duration-150"
            style={{
              width: `${progressPct}%`,
              background: isMaster ? "var(--accent)" : `var(${config.colorVar})`,
            }}
          />
        </div>
        <div className="flex justify-between text-xs font-mono text-content-muted">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* ── Transport controls: Rewind / Play-Pause / Forward ── */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => seekBy(-5)}
          className="p-2.5 rounded-lg bg-surface-sunken hover:bg-surface-overlay text-content-secondary hover:text-content-primary transition-all"
          title="Rewind 5s"
        >
          <SkipBack className="w-5 h-5" />
        </button>

        <button
          onClick={togglePlay}
          disabled={loading || error}
          className="p-3 rounded-xl text-content-inverse transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: isMaster ? "var(--accent)" : `var(${config.colorVar})`,
          }}
          title={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
        </button>

        <button
          onClick={() => seekBy(5)}
          className="p-2.5 rounded-lg bg-surface-sunken hover:bg-surface-overlay text-content-secondary hover:text-content-primary transition-all"
          title="Forward 5s"
        >
          <SkipForward className="w-5 h-5" />
        </button>
      </div>

      {/* ── Volume ── */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setMuted(!muted)}
          className="p-1.5 rounded text-content-muted hover:text-content-primary transition-colors"
        >
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
        <input
          type="range"
          min="0"
          max="100"
          value={muted ? 0 : volume}
          onChange={(e) => {
            setVolume(Number(e.target.value));
            if (muted) setMuted(false);
          }}
          className="flex-1 h-1.5 bg-surface-sunken rounded-full appearance-none cursor-pointer
                     [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4
                     [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full
                     [&::-webkit-slider-thumb]:bg-content-primary [&::-webkit-slider-thumb]:cursor-pointer"
        />
        <span className="text-xs font-mono text-content-muted w-8 text-right">
          {muted ? 0 : volume}
        </span>
      </div>

      {/* ── Clip controls (not on master track) ── */}
      {!isMaster && (
        <div className="flex items-center gap-2.5 pt-2 border-t border-border-subtle">
          <Clock className="w-4 h-4 text-content-muted flex-shrink-0" />
          <input
            type="number"
            placeholder="Start (s)"
            value={clipStart}
            onChange={(e) => setClipStart(e.target.value)}
            min="0"
            step="0.1"
            className="w-24 bg-surface-sunken border border-border-default rounded-lg px-3 py-1.5 text-sm text-content-primary placeholder:text-content-muted focus:outline-none focus:border-accent/40"
          />
          <span className="text-sm text-content-muted">→</span>
          <input
            type="number"
            placeholder="End (s)"
            value={clipEnd}
            onChange={(e) => setClipEnd(e.target.value)}
            min="0"
            step="0.1"
            className="w-24 bg-surface-sunken border border-border-default rounded-lg px-3 py-1.5 text-sm text-content-primary placeholder:text-content-muted focus:outline-none focus:border-accent/40"
          />
          <button
            onClick={handlePreviewClip}
            className="flex items-center gap-1.5 bg-surface-overlay hover:bg-surface-sunken border border-border-default rounded-lg px-3 py-1.5 text-sm text-content-secondary hover:text-content-primary transition-all"
          >
            <Scissors className="w-4 h-4" />
            Preview
          </button>
        </div>
      )}
    </div>
  );
}

/* ================================================================
   Main StemPlayer
   - Master track at top
   - 4 separated stems in grid
   - "Download All as ZIP" for stems only
   ================================================================ */
export default function StemPlayer({ project }) {
  const [zipping, setZipping] = useState(false);

  // Resolve master track URL — could be a blob URL or GridFS ID
  const masterUrl = project.masterUrl
    ? project.masterUrl.startsWith("blob:") || project.masterUrl.startsWith("http")
      ? project.masterUrl
      : stemURL(project.masterUrl)
    : null;

  const handleDownloadAllZip = async () => {
    setZipping(true);
    try {
      // Dynamically load JSZip from CDN
      const JSZip = (await import("https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm")).default;
      const zip = new JSZip();

      const stemEntries = Object.entries(project.stems || {}).filter(
        ([, val]) => val && val.length > 0
      );

      // Fetch each stem and add to zip
      for (const [key, idOrUrl] of stemEntries) {
        const url = stemURL(idOrUrl);
        try {
          const resp = await fetch(url);
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const blob = await resp.blob();
          zip.file(`${project.name}_${key}.mp3`, blob);
        } catch (err) {
          console.warn(`Failed to fetch ${key}:`, err);
          toast.error(`Could not include ${key} in zip`);
        }
      }

      // Generate and download zip
      const content = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(content);
      a.download = `${project.name}_stems.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
      toast.success("ZIP downloaded!");
    } catch (err) {
      console.error("ZIP error:", err);
      // Fallback: download individually
      toast.error("ZIP failed — downloading files individually...");
      Object.entries(project.stems || {}).forEach(([key, idOrUrl]) => {
        if (!idOrUrl) return;
        const url = stemURL(idOrUrl);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${project.name}_${key}.mp3`;
        a.target = "_blank";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      });
    } finally {
      setZipping(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* ── Project header + Download All ── */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold text-content-primary">
              {project.name}
            </h2>
            <p className="text-sm text-content-muted mt-1">
              {masterUrl ? "5 tracks" : "4 separated stems"} · Individual controls per track
            </p>
          </div>

          <button
            onClick={handleDownloadAllZip}
            disabled={zipping}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-content-inverse text-sm font-medium transition-all disabled:opacity-50 glow-ring"
          >
            {zipping ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <PackageOpen className="w-4 h-4" />
            )}
            {zipping ? "Zipping..." : "Download Stems as ZIP"}
          </button>
        </div>
      </div>

      {/* ── Master Track ── */}
      {masterUrl && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <TrackChannel
            config={{
              key: "master",
              label: "Master Track (Original)",
              icon: Music,
              colorVar: "--accent",
              cardClass: "",
            }}
            url={masterUrl}
            isMaster={true}
          />
        </motion.div>
      )}

      {/* ── Separated Stems Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {STEM_CONFIG.map((config, i) => (
          <motion.div
            key={config.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <TrackChannel
              config={config}
              url={stemURL(project.stems?.[config.key])}
              isMaster={false}
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
