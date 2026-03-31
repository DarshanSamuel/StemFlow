import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Disc3, LogOut, Music } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../hooks/useAuth";
import { getProjects, createProject, deleteProject, separateTrack } from "../lib/api";
import Uploader from "./Uploader";
import ProjectList from "./ProjectList";
import StemPlayer from "./StemPlayer";

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ pct: 0, msg: "" });

  // Fetch projects on mount
  useEffect(() => {
    if (user?.isGuest) {
      setLoadingProjects(false);
      return;
    }
    fetchProjects();
  }, [user]);

  const fetchProjects = async () => {
    try {
      const data = await getProjects();
      setProjects(data.projects || []);
    } catch (err) {
      toast.error("Failed to load projects");
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleUpload = useCallback(
    async (file) => {
      setProcessing(true);
      setProgress({ pct: 0, msg: "Preparing upload..." });

      try {
        // Step 1: Send to Colab → Demucs → GridFS upload
        // Returns GridFS ObjectId strings for each stem
        setProgress({ pct: 5, msg: "Connecting to AI server..." });

        const result = await separateTrack(file, (pct, msg) => {
          setProgress({ pct, msg });
        });

        setProgress({ pct: 85, msg: "Saving project..." });

        // result = { vocals: "gridfs_id", drums: "gridfs_id", ... }
        const projectData = {
          name: file.name.replace(/\.[^/.]+$/, ""),
          stems: {
            vocals: result.vocals,
            drums: result.drums,
            bass: result.bass,
            other: result.other,
          },
        };

        if (!user?.isGuest) {
          const saved = await createProject(projectData);
          setProjects((prev) => [saved.project, ...prev]);
          setSelectedProject(saved.project);
        } else {
          const guestProject = {
            _id: `guest-${Date.now()}`,
            ...projectData,
            createdAt: new Date().toISOString(),
          };
          setProjects((prev) => [guestProject, ...prev]);
          setSelectedProject(guestProject);
        }

        setProgress({ pct: 100, msg: "Done!" });
        toast.success("Stems separated successfully!");
      } catch (err) {
        toast.error(err.message || "Separation failed");
        console.error("Separation error:", err);
      } finally {
        setProcessing(false);
        setProgress({ pct: 0, msg: "" });
      }
    },
    [user]
  );

  const handleDeleteProject = async (projectId) => {
    if (user?.isGuest) {
      setProjects((prev) => prev.filter((p) => p._id !== projectId));
      if (selectedProject?._id === projectId) setSelectedProject(null);
      return;
    }

    try {
      await deleteProject(projectId);
      setProjects((prev) => prev.filter((p) => p._id !== projectId));
      if (selectedProject?._id === projectId) setSelectedProject(null);
      toast.success("Project deleted");
    } catch (err) {
      toast.error("Failed to delete project");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-animated noise-overlay">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-border-default">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Disc3 className="w-6 h-6 text-accent animate-spin-slow" />
            <span className="font-display text-lg font-bold tracking-tight">
              Stem<span className="text-accent">Flow</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-content-muted hidden sm:block font-mono">
              {user?.email}
            </span>
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 text-sm text-content-secondary hover:text-content-primary bg-surface-raised hover:bg-surface-overlay border border-border-default rounded-lg px-3 py-1.5 transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="lg:col-span-4 xl:col-span-3 space-y-5"
          >
            <Uploader
              onUpload={handleUpload}
              processing={processing}
              progress={progress}
            />
            <ProjectList
              projects={projects}
              loading={loadingProjects}
              selectedId={selectedProject?._id}
              onSelect={setSelectedProject}
              onDelete={handleDeleteProject}
            />
          </motion.div>

          {/* RIGHT COLUMN */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="lg:col-span-8 xl:col-span-9"
          >
            {selectedProject ? (
              <StemPlayer project={selectedProject} />
            ) : (
              <div className="glass rounded-2xl p-12 flex flex-col items-center justify-center min-h-[500px] text-center">
                <div className="relative mb-6">
                  <Music className="w-16 h-16 text-content-muted" />
                  <div className="absolute inset-0 bg-accent/5 blur-2xl rounded-full" />
                </div>
                <h3 className="font-display text-xl font-semibold text-content-secondary mb-2">
                  No Track Selected
                </h3>
                <p className="text-content-muted text-sm max-w-sm leading-relaxed">
                  Upload a music file and separate it into stems, or select a
                  previous project from the sidebar to start mixing.
                </p>
              </div>
            )}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
