import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Play, Pause, SkipBack, Volume2, VolumeX, Mic, Drum, Guitar, Layers } from "lucide-react";
import { stemURL } from "../../lib/api";

const STEMS = [
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

/* Inline style for a visible slider thumb — orange/amber */
const sliderStyle = `
  .mixer-slider { -webkit-appearance: none; appearance: none; background: transparent; cursor: pointer; }
  .mixer-slider::-webkit-slider-runnable-track { height: 8px; background: var(--surface-sunken); border-radius: 9999px; }
  .mixer-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 18px; height: 18px; border-radius: 50%; background: #f59e0b; margin-top: -5px; border: 2px solid #0c0e12; cursor: pointer; }
  .mixer-slider::-moz-range-track { height: 8px; background: var(--surface-sunken); border-radius: 9999px; }
  .mixer-slider::-moz-range-thumb { width: 18px; height: 18px; border-radius: 50%; background: #f59e0b; border: 2px solid #0c0e12; cursor: pointer; }
`;

export default function AudioMixing({ project }) {
  const audioRefs = useRef({});
  const [playing, setPlaying] = useState(false);
  const [masterTime, setMasterTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volumes, setVolumes] = useState({ vocals: 80, drums: 80, bass: 80, other: 80 });
  const [muted, setMuted] = useState({ vocals: false, drums: false, bass: false, other: false });
  const [solo, setSolo] = useState(null);
  const [masterVol, setMasterVol] = useState(100);

  useEffect(() => {
    STEMS.forEach(s => {
      const a = audioRefs.current[s.key];
      if (!a) return;
      const isMuted = muted[s.key] || (solo && solo !== s.key);
      a.volume = isMuted ? 0 : (volumes[s.key] / 100) * (masterVol / 100);
    });
  }, [volumes, muted, solo, masterVol]);

  const playAll = () => { STEMS.forEach(s => audioRefs.current[s.key]?.play().catch(() => {})); setPlaying(true); };
  const pauseAll = () => { STEMS.forEach(s => audioRefs.current[s.key]?.pause()); setPlaying(false); };
  const togglePlay = () => playing ? pauseAll() : playAll();

  const restart = () => {
    STEMS.forEach(s => { if (audioRefs.current[s.key]) audioRefs.current[s.key].currentTime = 0; });
    setMasterTime(0);
    if (playing) playAll();
  };

  const seekTo = (pct) => {
    const t = pct * duration;
    STEMS.forEach(s => { if (audioRefs.current[s.key]) audioRefs.current[s.key].currentTime = t; });
    setMasterTime(t);
  };

  const handleTimeUpdate = () => {
    const a = audioRefs.current.vocals;
    if (a) { setMasterTime(a.currentTime); if (!duration && a.duration) setDuration(a.duration); }
  };

  const toggleSolo = (key) => setSolo(prev => prev === key ? null : key);
  const toggleMute = (key) => setMuted(prev => ({ ...prev, [key]: !prev[key] }));
  const setVol = (key, val) => setVolumes(prev => ({ ...prev, [key]: val }));

  return (
    <div className="space-y-4">
      {/* Inject slider styles */}
      <style>{sliderStyle}</style>

      <div className="glass rounded-xl p-5">
        <h2 className="font-display text-xl font-bold">{project.name}</h2>
        <p className="text-sm text-content-muted mt-0.5">Mix stems together — adjust volumes, mute & solo</p>
      </div>

      {/* Hidden audio elements */}
      {STEMS.map(s => (
        <audio key={s.key} ref={el => { audioRefs.current[s.key] = el; }}
          src={stemURL(project.stems?.[s.key])} preload="metadata"
          onTimeUpdate={s.key === "vocals" ? handleTimeUpdate : undefined}
          onEnded={() => setPlaying(false)}
          onLoadedMetadata={() => { if (s.key === "vocals" && audioRefs.current.vocals) setDuration(audioRefs.current.vocals.duration); }}
          style={{ display: "none" }} />
      ))}

      {/* Master transport */}
      <div className="glass rounded-xl p-5 space-y-4">
        <div className="w-full bg-surface-sunken rounded-full h-2.5 cursor-pointer"
          onClick={e => { const r = e.currentTarget.getBoundingClientRect(); seekTo((e.clientX - r.left) / r.width); }}>
          <div className="h-full bg-accent rounded-full transition-all duration-150"
            style={{ width: `${duration ? (masterTime / duration) * 100 : 0}%` }} />
        </div>
        <div className="flex justify-between text-xs font-mono text-content-muted">
          <span>{fmt(masterTime)}</span><span>{fmt(duration)}</span>
        </div>

        <div className="flex items-center justify-center gap-4">
          <button onClick={restart} className="p-2.5 rounded-xl bg-surface-raised hover:bg-surface-overlay border border-border-default text-content-secondary hover:text-content-primary transition-all">
            <SkipBack className="w-5 h-5" />
          </button>
          <button onClick={togglePlay} className="p-3.5 rounded-xl bg-accent hover:bg-accent-hover text-content-inverse transition-all glow-ring">
            {playing ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
          </button>
        </div>

        {/* Master volume */}
        <div className="flex items-center gap-3 pt-2 border-t border-border-subtle">
          <span className="text-xs font-medium text-content-muted w-20">Master Vol</span>
          <input type="range" min="0" max="100" value={masterVol}
            onChange={e => setMasterVol(Number(e.target.value))}
            className="mixer-slider flex-1" />
          <span className="text-xs font-mono text-content-muted w-8 text-right">{masterVol}</span>
        </div>
      </div>

      {/* Stem faders */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {STEMS.map((s, i) => {
          const Icon = s.icon;
          const isMuted = muted[s.key] || (solo && solo !== s.key);
          const isSoloed = solo === s.key;
          return (
            <motion.div key={s.key} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className={`glass rounded-xl p-5 space-y-4 ${isMuted ? "opacity-50" : ""}`}
              style={{ borderLeft: `3px solid var(${s.colorVar})` }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Icon className="w-5 h-5" style={{ color: `var(${s.colorVar})` }} />
                  <span className="font-display text-base font-semibold">{s.label}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => toggleMute(s.key)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${muted[s.key] ? "bg-red-500/20 text-red-400" : "bg-surface-sunken text-content-muted hover:text-content-primary"}`}>
                    M
                  </button>
                  <button onClick={() => toggleSolo(s.key)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${isSoloed ? "text-content-inverse" : "bg-surface-sunken text-content-muted hover:text-content-primary"}`}
                    style={isSoloed ? { background: `var(${s.colorVar})` } : {}}>
                    S
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button onClick={() => toggleMute(s.key)} className="text-content-muted hover:text-content-primary">
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <input type="range" min="0" max="100" value={isMuted ? 0 : volumes[s.key]}
                  onChange={e => { setVol(s.key, Number(e.target.value)); if (muted[s.key]) toggleMute(s.key); }}
                  className="mixer-slider flex-1" />
                <span className="text-xs font-mono text-content-muted w-8 text-right">
                  {isMuted ? 0 : volumes[s.key]}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
