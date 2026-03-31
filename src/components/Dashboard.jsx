import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Disc3, LogOut, Music, Scissors, Sliders, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../hooks/useAuth";
import { getProjects, createProject, deleteProject, uploadFileToColab } from "../lib/api";
import Uploader from "./Uploader";
import ProjectList from "./ProjectList";
import StemExtraction from "./tabs/StemExtraction";
import AudioClipping from "./tabs/AudioClipping";
import AudioMixing from "./tabs/AudioMixing";

const TABS = [
  { id: "extraction", label: "Stem Extraction", icon: Sparkles },
  { id: "clipping", label: "Audio Clipping", icon: Scissors },
  { id: "mixing", label: "Audio Mixing", icon: Sliders },
];

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [activeTab, setActiveTab] = useState("extraction");

  // Upload + processing state
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [separating, setSeparating] = useState(false);

  useEffect(() => {
    if (user?.isGuest) { setLoadingProjects(false); return; }
    fetchProjects();
  }, [user]);

  const fetchProjects = async () => {
    try {
      const data = await getProjects();
      setProjects(data.projects || []);
    } catch { toast.error("Failed to load projects"); }
    finally { setLoadingProjects(false); }
  };

  const handleUpload = useCallback(async (file) => {
    const masterBlobURL = URL.createObjectURL(file);
    setUploading(true);
    setUploadProgress(0);
    setSeparating(false);
    setActiveTab("extraction");

    try {
      // Phase 1: Upload (progress is real upload %)
      setSeparating(false);
      const result = await new Promise((resolve, reject) => {
        uploadFileToColab(file, (pct) => {
          setUploadProgress(pct);
          if (pct >= 100 && !separating) {
            setUploading(false);
            setSeparating(true);
          }
        }).then(resolve).catch(reject);
      });

      // Phase 2: Save project
      const projectData = {
        name: file.name.replace(/\.[^/.]+$/, ""),
        stems: { vocals: result.vocals, drums: result.drums, bass: result.bass, other: result.other },
        masterUrl: masterBlobURL,
      };

      if (!user?.isGuest) {
        const saved = await createProject({ name: projectData.name, stems: projectData.stems });
        const proj = { ...saved.project, masterUrl: masterBlobURL };
        setProjects(prev => [proj, ...prev]);
        setSelectedProject(proj);
      } else {
        const proj = { _id: `guest-${Date.now()}`, ...projectData, createdAt: new Date().toISOString() };
        setProjects(prev => [proj, ...prev]);
        setSelectedProject(proj);
      }
      toast.success("Stems separated successfully!");
    } catch (err) {
      toast.error(err.message || "Separation failed");
      URL.revokeObjectURL(masterBlobURL);
    } finally {
      setUploading(false);
      setSeparating(false);
      setUploadProgress(0);
    }
  }, [user]);

  const handleDeleteProject = async (projectId) => {
    if (user?.isGuest) {
      setProjects(prev => prev.filter(p => p._id !== projectId));
      if (selectedProject?._id === projectId) setSelectedProject(null);
      return;
    }
    try {
      await deleteProject(projectId);
      setProjects(prev => prev.filter(p => p._id !== projectId));
      if (selectedProject?._id === projectId) setSelectedProject(null);
      toast.success("Project deleted");
    } catch { toast.error("Failed to delete project"); }
  };

  return (
    <div className="min-h-screen bg-gradient-animated noise-overlay">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 glass border-b border-border-default">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Disc3 className="w-6 h-6 text-accent animate-spin-slow" />
            <span className="font-display text-lg font-bold tracking-tight">
              Stem<span className="text-accent">Flow</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-content-muted hidden sm:block font-mono">{user?.email}</span>
            <button onClick={signOut} className="flex items-center gap-1.5 text-sm text-content-secondary hover:text-content-primary bg-surface-raised hover:bg-surface-overlay border border-border-default rounded-lg px-3 py-1.5 transition-all">
              <LogOut className="w-3.5 h-3.5" /><span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* ── LEFT SIDEBAR (common) ── */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}
            className="lg:col-span-4 xl:col-span-3 space-y-5">
            <Uploader
              onUpload={handleUpload}
              uploading={uploading}
              uploadProgress={uploadProgress}
            />
            <ProjectList
              projects={projects}
              loading={loadingProjects}
              selectedId={selectedProject?._id}
              onSelect={setSelectedProject}
              onDelete={handleDeleteProject}
            />
          </motion.div>

          {/* ── RIGHT MAIN AREA ── */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.1 }}
            className="lg:col-span-8 xl:col-span-9 space-y-4">

            {/* Tab bar */}
            <div className="glass rounded-xl p-1.5 flex gap-1">
              {TABS.map(tab => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
                      active ? "bg-surface-raised text-accent shadow-sm" : "text-content-muted hover:text-content-secondary"
                    }`}>
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Tab content */}
            {!selectedProject ? (
              <div className="glass rounded-2xl p-12 flex flex-col items-center justify-center min-h-[450px] text-center">
                <Music className="w-16 h-16 text-content-muted mb-4" />
                <h3 className="font-display text-xl font-semibold text-content-secondary mb-2">No Track Selected</h3>
                <p className="text-content-muted text-sm max-w-sm">Upload a music file or select a project from the sidebar.</p>
              </div>
            ) : (
              <>
                {activeTab === "extraction" && (
                  <StemExtraction project={selectedProject} separating={separating} />
                )}
                {activeTab === "clipping" && (
                  <AudioClipping project={selectedProject} />
                )}
                {activeTab === "mixing" && (
                  <AudioMixing project={selectedProject} />
                )}
              </>
            )}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
