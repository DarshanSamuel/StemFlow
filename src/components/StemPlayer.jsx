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
  Volume2,
  VolumeX,
  SkipBack,
  Scissors,
  PackageOpen,
  Clock,
} from "lucide-react";
import toast from "react-hot-toast";
import { stemURL } from "../lib/api";

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

function StemChannel({ config, url, masterTime, isPlaying, onTimeUpdate }) {
  const audioRef = useRef(null);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(80);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [loading, setLoading] = useState(true);

  // Clip state
  const [clipStart, setClipStart] = useState("");
  const [clipEnd, setClipEnd] = useState("");
  const [clipping, setClipping] = useState(false);

  const Icon = config.icon;

  // Sync with master play/pause
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !url) return;

    if (isPlaying && !loading) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [isPlaying, url, loading]);

  // Sync master time (from first channel)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || masterTime === null || masterTime === undefined) return;
    if (Math.abs(audio.currentTime - masterTime) > 0.3) {
      audio.currentTime = masterTime;
    }
  }, [masterTime]);

  // Volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = muted ? 0 : volume / 100;
    }
  }, [volume, muted]);

  const handleTimeUpdate = () => {
    const t = audioRef.current?.currentTime || 0;
    setCurrentTime(t);
    if (onTimeUpdate) onTimeUpdate(t);

    // Clip boundary enforcement
    if (clipping && clipEnd && t >= parseFloat(clipEnd)) {
      audioRef.current.pause();
      audioRef.current.currentTime = parseFloat(clipStart) || 0;
      setClipping(false);
    }
  };

  const handlePreviewClip = () => {
    const start = parseFloat(clipStart) || 0;
    const end = parseFloat(clipEnd) || duration;
    if (start >= end) {
      toast.error("Start time must be before end time");
      return;
    }
    audioRef.current.currentTime = start;
    audioRef.current.play();
    setClipping(true);
  };

  const formatTime = (s) => {
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

  return (
    <div
      className={`${config.cardClass} bg-surface-raised rounded-xl p-4 space-y-3`}
    >
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onLoadedMetadata={() => {
          setDuration(audioRef.current?.duration || 0);
          setLoading(false);
        }}
        onTimeUpdate={handleTimeUpdate}
        onWaiting={() => setLoading(true)}
        onCanPlay={() => setLoading(false)}
      />

      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon
            className="w-4 h-4"
            style={{ color: `var(${config.colorVar})` }}
          />
          <span className="font-display text-sm font-semibold">
            {config.label}
          </span>
          {loading ? (
            <span className="text-xs text-content-muted animate-pulse">
              Loading...
            </span>
          ) : (
            <span className="text-xs font-mono text-content-muted">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          )}
        </div>

        <button
          onClick={handleDownload}
          className="p-1.5 rounded-md hover:bg-surface-overlay text-content-muted hover:text-content-primary transition-all"
          title={`Download ${config.label}`}
        >
          <Download className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Progress bar */}
      <div
        className="w-full bg-surface-sunken rounded-full h-1.5 cursor-pointer group"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const pct = (e.clientX - rect.left) / rect.width;
          const t = pct * duration;
          if (audioRef.current) audioRef.current.currentTime = t;
        }}
      >
        <div
          className="h-full rounded-full transition-all duration-100"
          style={{
            width: `${duration ? (currentTime / duration) * 100 : 0}%`,
            background: `var(${config.colorVar})`,
          }}
        />
      </div>

      {/* Volume control */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setMuted(!muted)}
          className="p-1 rounded text-content-muted hover:text-content-primary transition-colors"
        >
          {muted ? (
            <VolumeX className="w-3.5 h-3.5" />
          ) : (
            <Volume2 className="w-3.5 h-3.5" />
          )}
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
          className="flex-1 h-1 bg-surface-sunken rounded-full appearance-none cursor-pointer
                     [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3
                     [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full
                     [&::-webkit-slider-thumb]:bg-content-primary [&::-webkit-slider-thumb]:cursor-pointer"
        />
        <span className="text-xs font-mono text-content-muted w-8 text-right">
          {muted ? 0 : volume}
        </span>
      </div>

      {/* Clip controls */}
      <div className="flex items-center gap-2 pt-1 border-t border-border-subtle">
        <Clock className="w-3 h-3 text-content-muted flex-shrink-0" />
        <input
          type="number"
          placeholder="Start (s)"
          value={clipStart}
          onChange={(e) => setClipStart(e.target.value)}
          min="0"
          step="0.1"
          className="w-20 bg-surface-sunken border border-border-default rounded px-2 py-1 text-xs text-content-primary placeholder:text-content-muted focus:outline-none focus:border-accent/40"
        />
        <span className="text-xs text-content-muted">→</span>
        <input
          type="number"
          placeholder="End (s)"
          value={clipEnd}
          onChange={(e) => setClipEnd(e.target.value)}
          min="0"
          step="0.1"
          className="w-20 bg-surface-sunken border border-border-default rounded px-2 py-1 text-xs text-content-primary placeholder:text-content-muted focus:outline-none focus:border-accent/40"
        />
        <button
          onClick={handlePreviewClip}
          className="flex items-center gap-1 bg-surface-overlay hover:bg-surface-sunken border border-border-default rounded px-2 py-1 text-xs text-content-secondary hover:text-content-primary transition-all"
        >
          <Scissors className="w-3 h-3" />
          Preview
        </button>
      </div>
    </div>
  );
}

export default function StemPlayer({ project }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [masterTime, setMasterTime] = useState(0);
  const isMasterRef = useRef(true);

  const handleMasterTimeUpdate = useCallback((t) => {
    if (isMasterRef.current) {
      setMasterTime(t);
    }
  }, []);

  const togglePlay = () => setIsPlaying((p) => !p);

  const handleRestart = () => {
    setMasterTime(0);
    setIsPlaying(false);
    setTimeout(() => setMasterTime(0.001), 50);
  };

  const handleDownloadAll = () => {
    const stems = project.stems;
    Object.entries(stems).forEach(([key, idOrUrl]) => {
      if (!idOrUrl) return;
      const url = stemURL(idOrUrl);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${project.name}_${key}.mp3`;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });
    toast.success("Downloading all stems...");
  };

  return (
    <div className="glass rounded-2xl p-6 space-y-5">
      {/* Project header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-content-primary">
            {project.name}
          </h2>
          <p className="text-xs text-content-muted mt-0.5">
            4 separated stems · Streamed from MongoDB
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRestart}
            className="p-2 rounded-lg bg-surface-raised hover:bg-surface-overlay border border-border-default text-content-secondary hover:text-content-primary transition-all"
            title="Restart"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            onClick={togglePlay}
            className="p-2.5 rounded-lg bg-accent hover:bg-accent-hover text-content-inverse transition-all glow-ring"
            title={isPlaying ? "Pause All" : "Play All"}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5" />
            )}
          </button>
          <button
            onClick={handleDownloadAll}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-raised hover:bg-surface-overlay border border-border-default text-content-secondary hover:text-content-primary text-sm transition-all"
          >
            <PackageOpen className="w-4 h-4" />
            <span className="hidden sm:inline">All Stems</span>
          </button>
        </div>
      </div>

      {/* Stem grid — each channel gets its URL via stemURL(gridfsId) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {STEM_CONFIG.map((config, i) => (
          <motion.div
            key={config.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <StemChannel
              config={config}
              url={stemURL(project.stems?.[config.key])}
              isPlaying={isPlaying}
              masterTime={i === 0 ? undefined : masterTime}
              onTimeUpdate={i === 0 ? handleMasterTimeUpdate : undefined}
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
