import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Download, Mic, Drum, Guitar, Layers, Music, Loader2, PackageOpen, AlertTriangle, CheckCircle2, Play, Pause, Brain } from "lucide-react";
import toast from "react-hot-toast";
import { stemURL, checkColabHealth } from "../../lib/api";

const STEMS = [
  { key: "vocals", label: "Vocals", icon: Mic, colorVar: "--stem-vocals", cardClass: "stem-card-vocals" },
  { key: "drums", label: "Drums", icon: Drum, colorVar: "--stem-drums", cardClass: "stem-card-drums" },
  { key: "bass", label: "Bass", icon: Guitar, colorVar: "--stem-bass", cardClass: "stem-card-bass" },
  { key: "other", label: "Other", icon: Layers, colorVar: "--stem-other", cardClass: "stem-card-other" },
];

function MiniPlayer({ url, label, color, icon: Icon, onDownload }) {
  const ref = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [dur, setDur] = useState(0);
  const [cur, setCur] = useState(0);
  const [err, setErr] = useState(false);

  const fmt = (s) => {
    if (!s || isNaN(s)) return "0:00:00";
    const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const sec = Math.floor(s % 60);
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const toggle = () => {
    if (!ref.current || err) return;
    playing ? ref.current.pause() : ref.current.play().catch(() => {});
    setPlaying(!playing);
  };

  return (
    <div className={`bg-surface-raised rounded-xl p-4 space-y-3 ${err ? "opacity-50" : ""}`}
      style={{ borderLeft: `3px solid var(${color})` }}>
      <audio ref={ref} src={url} preload="metadata"
        onLoadedMetadata={() => { setDur(ref.current?.duration || 0); setErr(false); }}
        onTimeUpdate={() => setCur(ref.current?.currentTime || 0)}
        onEnded={() => setPlaying(false)}
        onError={() => setErr(true)} />

      {/* Header: icon + label ... play + download */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5" style={{ color: `var(${color})` }} />
          <span className="font-display text-sm font-semibold">{label}</span>
          {err && <span className="text-xs text-red-400">Failed to load</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggle} disabled={err}
            className="p-2 rounded-lg transition-all disabled:opacity-30"
            style={{ background: `var(${color})20`, color: `var(${color})` }}>
            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          {onDownload && (
            <button onClick={onDownload}
              className="p-2 rounded-lg hover:bg-surface-overlay text-content-muted hover:text-content-primary transition-all"
              title={`Download ${label}`}>
              <Download className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Seekbar */}
      <div className="w-full bg-surface-sunken rounded-full h-1.5 cursor-pointer"
        onClick={e => {
          if (ref.current) {
            ref.current.currentTime = ((e.clientX - e.currentTarget.getBoundingClientRect().left) / e.currentTarget.offsetWidth) * dur;
          }
        }}>
        <div className="h-full rounded-full transition-all duration-150"
          style={{ width: `${dur ? (cur / dur) * 100 : 0}%`, background: `var(${color})` }} />
      </div>
      <div className="flex justify-between text-xs font-mono text-content-muted">
        <span>{fmt(cur)}</span><span>{fmt(dur)}</span>
      </div>
    </div>
  );
}

export default function StemExtraction({ project, separating }) {
  const [colabOk, setColabOk] = useState(null);
  const [zipping, setZipping] = useState(false);

  useEffect(() => {
    checkColabHealth().then(r => setColabOk(r.ok));
    const iv = setInterval(() => checkColabHealth().then(r => setColabOk(r.ok)), 30000);
    return () => clearInterval(iv);
  }, []);

  const downloadOne = (key, id) => {
    const a = document.createElement("a");
    a.href = stemURL(id); a.download = `${project.name}_${key}.mp3`;
    a.target = "_blank"; document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const downloadZip = async () => {
    setZipping(true);
    try {
      const JSZip = (await import("https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm")).default;
      const zip = new JSZip();
      for (const [k, v] of Object.entries(project.stems || {})) {
        if (!v) continue;
        const resp = await fetch(stemURL(v));
        if (resp.ok) zip.file(`${project.name}_${k}.mp3`, await resp.blob());
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = `${project.name}_stems.zip`; document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(a.href);
      toast.success("ZIP downloaded!");
    } catch { toast.error("ZIP failed"); }
    finally { setZipping(false); }
  };

  const masterUrl = project.masterUrl
    ? (project.masterUrl.startsWith("blob:") || project.masterUrl.startsWith("http") ? project.masterUrl : stemURL(project.masterUrl))
    : null;

  return (
    <div className="space-y-4">
      {/* Colab status */}
      <div className={`glass rounded-xl px-5 py-3 flex items-center gap-3 ${colabOk === false ? "border-red-500/30" : ""}`}>
        {colabOk === null ? <Loader2 className="w-4 h-4 animate-spin text-content-muted" />
          : colabOk ? <CheckCircle2 className="w-4 h-4 text-stem-bass" />
          : <AlertTriangle className="w-4 h-4 text-red-400" />}
        <span className="text-sm text-content-secondary">
          {colabOk === null ? "Checking Colab..." : colabOk ? "Colab GPU backend is online" : "Colab backend is offline — start your Colab notebook first"}
        </span>
      </div>

      {/* Separating state */}
      {separating && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-xl p-6 flex flex-col items-center gap-4">
          <Brain className="w-10 h-10 text-accent animate-pulse" />
          <p className="text-base font-semibold text-accent">AI is separating stems...</p>
          <p className="text-sm text-content-muted">This takes 30–90 seconds on a T4 GPU</p>
          <div className="flex items-end h-10">
            <span className="loading-bar" /><span className="loading-bar" /><span className="loading-bar" /><span className="loading-bar" /><span className="loading-bar" />
          </div>
        </motion.div>
      )}

      {/* Header + downloads */}
      <div className="glass rounded-xl p-5 flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold">{project.name}</h2>
          <p className="text-sm text-content-muted mt-0.5">Separated stems</p>
        </div>
        <button onClick={downloadZip} disabled={zipping}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-content-inverse text-sm font-medium transition-all disabled:opacity-50 glow-ring">
          {zipping ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackageOpen className="w-4 h-4" />}
          {zipping ? "Zipping..." : "Download ZIP"}
        </button>
      </div>

      {/* Master track */}
      {masterUrl && (
        <MiniPlayer url={masterUrl} label="Master Track (Original)" color="--accent" icon={Music} />
      )}

      {/* Stem grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {STEMS.map((s, i) => (
          <motion.div key={s.key} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <MiniPlayer
              url={stemURL(project.stems?.[s.key])}
              label={s.label} color={s.colorVar} icon={s.icon}
              onDownload={() => downloadOne(s.key, project.stems?.[s.key])}
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
