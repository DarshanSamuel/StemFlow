import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Scissors, Play, Pause, Download, Music, Mic, Drum, Guitar, Layers, PackageOpen, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { stemURL } from "../../lib/api";

const ALL_TRACKS = [
  { key: "master", label: "Master Track", icon: Music, colorVar: "--accent" },
  { key: "vocals", label: "Vocals", icon: Mic, colorVar: "--stem-vocals" },
  { key: "drums", label: "Drums", icon: Drum, colorVar: "--stem-drums" },
  { key: "bass", label: "Bass", icon: Guitar, colorVar: "--stem-bass" },
  { key: "other", label: "Other", icon: Layers, colorVar: "--stem-other" },
];

const fmt = (s) => {
  if (!s || isNaN(s)) return "0:00:00";
  const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const sec = Math.floor(s % 60);
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

const parseHMS = (str) => {
  const parts = str.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
};

function ClipTrack({ trackKey, label, icon: Icon, colorVar, url, project }) {
  const audioRef = useRef(null);
  const barRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [dur, setDur] = useState(0);
  const [cur, setCur] = useState(0);
  const [clipStart, setClipStart] = useState(0);
  const [clipEnd, setClipEnd] = useState(0);
  const [startText, setStartText] = useState("0:00:00");
  const [endText, setEndText] = useState("0:00:00");
  const [clipping, setClipping] = useState(false);
  const [dragging, setDragging] = useState(null); // "start" | "end" | null
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (dur > 0 && clipEnd === 0) {
      setClipEnd(dur);
      setEndText(fmt(dur));
    }
  }, [dur]);

  const updateStart = (val) => {
    const v = Math.max(0, Math.min(val, clipEnd - 0.1));
    setClipStart(v); setStartText(fmt(v));
  };
  const updateEnd = (val) => {
    const v = Math.max(clipStart + 0.1, Math.min(val, dur));
    setClipEnd(v); setEndText(fmt(v));
  };

  const handleBarClick = (e) => {
    if (!barRef.current || !dur) return;
    const rect = barRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const t = pct * dur;
    if (audioRef.current) audioRef.current.currentTime = t;
  };

  const handleSliderDrag = useCallback((e) => {
    if (!dragging || !barRef.current || !dur) return;
    const rect = barRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const t = pct * dur;
    if (dragging === "start") updateStart(t);
    else updateEnd(t);
  }, [dragging, dur, clipStart, clipEnd]);

  useEffect(() => {
    if (!dragging) return;
    const up = () => setDragging(null);
    window.addEventListener("mousemove", handleSliderDrag);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", handleSliderDrag); window.removeEventListener("mouseup", up); };
  }, [dragging, handleSliderDrag]);

  const togglePlay = () => {
    if (!audioRef.current || err) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play().catch(() => {}); setPlaying(true); }
  };

  const previewClip = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = clipStart;
    audioRef.current.play(); setPlaying(true); setClipping(true);
  };

  const handleTimeUpdate = () => {
    const t = audioRef.current?.currentTime || 0;
    setCur(t);
    if (clipping && t >= clipEnd) {
      audioRef.current.pause(); audioRef.current.currentTime = clipStart;
      setPlaying(false); setClipping(false);
    }
  };

  const downloadClip = () => {
    if (!url) return;
    const a = document.createElement("a"); a.href = url;
    a.download = `${project.name}_${trackKey}_clip.mp3`;
    a.target = "_blank"; document.body.appendChild(a); a.click(); document.body.removeChild(a);
    toast("Full file downloaded — use start/end times for trimming in your audio editor", { icon: "ℹ️" });
  };

  const startPct = dur ? (clipStart / dur) * 100 : 0;
  const endPct = dur ? (clipEnd / dur) * 100 : 100;
  const curPct = dur ? (cur / dur) * 100 : 0;

  return (
    <div className="glass rounded-xl p-5 space-y-4">
      <audio ref={audioRef} src={url} preload="metadata"
        onLoadedMetadata={() => { setDur(audioRef.current?.duration || 0); setErr(false); }}
        onTimeUpdate={handleTimeUpdate} onEnded={() => { setPlaying(false); setClipping(false); }}
        onError={() => setErr(true)} />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Icon className="w-5 h-5" style={{ color: `var(${colorVar})` }} />
          <span className="font-display text-base font-semibold">{label}</span>
          {err && <span className="text-xs text-red-400">Failed to load</span>}
        </div>
        <button onClick={downloadClip} className="p-2 rounded-lg hover:bg-surface-overlay text-content-muted hover:text-content-primary transition-all" title="Download">
          <Download className="w-4 h-4" />
        </button>
      </div>

      {/* ── Interactive seekbar with clip range sliders ── */}
      <div className="relative pt-4 pb-2 select-none" ref={barRef}>
        {/* Background bar */}
        <div className="w-full h-2.5 bg-surface-sunken rounded-full cursor-pointer relative" onClick={handleBarClick}>
          {/* Clip region highlight */}
          <div className="absolute top-0 h-full rounded-full opacity-25" style={{
            left: `${startPct}%`, width: `${endPct - startPct}%`, background: `var(${colorVar})`,
          }} />
          {/* Current position */}
          <div className="absolute top-0 h-full rounded-full" style={{
            width: `${curPct}%`, background: `var(${colorVar})`, opacity: 0.7,
          }} />
        </div>

        {/* Start handle */}
        <div className="absolute top-1.5" style={{ left: `calc(${startPct}% - 8px)` }}
          onMouseDown={(e) => { e.preventDefault(); setDragging("start"); }}>
          <div className="w-4 h-6 rounded-sm cursor-ew-resize flex items-center justify-center"
            style={{ background: `var(${colorVar})` }}>
            <div className="w-0.5 h-3 bg-white/60 rounded" />
          </div>
        </div>

        {/* End handle */}
        <div className="absolute top-1.5" style={{ left: `calc(${endPct}% - 8px)` }}
          onMouseDown={(e) => { e.preventDefault(); setDragging("end"); }}>
          <div className="w-4 h-6 rounded-sm cursor-ew-resize flex items-center justify-center"
            style={{ background: `var(${colorVar})` }}>
            <div className="w-0.5 h-3 bg-white/60 rounded" />
          </div>
        </div>
      </div>

      {/* Timestamps + inputs */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs text-content-muted font-medium">Start</span>
          <input type="text" value={startText}
            onChange={(e) => { setStartText(e.target.value); const t = parseHMS(e.target.value); if (!isNaN(t)) updateStart(t); }}
            onBlur={() => setStartText(fmt(clipStart))}
            className="w-24 bg-surface-sunken border border-border-default rounded-lg px-3 py-2 text-sm font-mono text-content-primary focus:outline-none focus:border-accent/40 text-center" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-content-muted font-medium">End</span>
          <input type="text" value={endText}
            onChange={(e) => { setEndText(e.target.value); const t = parseHMS(e.target.value); if (!isNaN(t)) updateEnd(t); }}
            onBlur={() => setEndText(fmt(clipEnd))}
            className="w-24 bg-surface-sunken border border-border-default rounded-lg px-3 py-2 text-sm font-mono text-content-primary focus:outline-none focus:border-accent/40 text-center" />
        </div>
        <span className="text-xs text-content-muted font-mono">Duration: {fmt(clipEnd - clipStart)}</span>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <button onClick={togglePlay} disabled={err}
          className="p-2.5 rounded-xl text-content-inverse transition-all disabled:opacity-30"
          style={{ background: `var(${colorVar})` }}>
          {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
        </button>
        <button onClick={previewClip} disabled={err}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-raised hover:bg-surface-overlay border border-border-default text-sm font-medium text-content-secondary hover:text-content-primary transition-all disabled:opacity-30">
          <Scissors className="w-4 h-4" />Preview Clip
        </button>
        <span className="text-xs font-mono text-content-muted ml-auto">{fmt(cur)}</span>
      </div>
    </div>
  );
}

export default function AudioClipping({ project }) {
  const [zipping, setZipping] = useState(false);

  const getURL = (key) => {
    if (key === "master") {
      const m = project.masterUrl;
      if (!m) return "";
      return m.startsWith("blob:") || m.startsWith("http") ? m : stemURL(m);
    }
    return stemURL(project.stems?.[key]);
  };

  const availableTracks = ALL_TRACKS.filter(t => {
    if (t.key === "master") return !!project.masterUrl;
    return !!project.stems?.[t.key];
  });

  const downloadAllZip = async () => {
    setZipping(true);
    try {
      const JSZip = (await import("https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm")).default;
      const zip = new JSZip();
      for (const t of availableTracks) {
        const url = getURL(t.key);
        if (!url || url.startsWith("blob:")) continue;
        const r = await fetch(url);
        if (r.ok) zip.file(`${project.name}_${t.key}.mp3`, await r.blob());
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = `${project.name}_clips.zip`; document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(a.href);
      toast.success("ZIP downloaded!");
    } catch { toast.error("ZIP failed"); }
    finally { setZipping(false); }
  };

  return (
    <div className="space-y-4">
      <div className="glass rounded-xl p-5 flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold">{project.name}</h2>
          <p className="text-sm text-content-muted mt-0.5">Set clip ranges with draggable handles · HH:MM:SS</p>
        </div>
        <button onClick={downloadAllZip} disabled={zipping}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-content-inverse text-sm font-medium transition-all disabled:opacity-50 glow-ring">
          {zipping ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackageOpen className="w-4 h-4" />}
          {zipping ? "Zipping..." : "Download All as ZIP"}
        </button>
      </div>

      {availableTracks.map((t, i) => (
        <motion.div key={t.key} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
          <ClipTrack trackKey={t.key} label={t.label} icon={t.icon} colorVar={t.colorVar} url={getURL(t.key)} project={project} />
        </motion.div>
      ))}
    </div>
  );
}
