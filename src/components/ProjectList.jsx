import { motion, AnimatePresence } from "framer-motion";
import { FolderOpen, Trash2, Clock, Music2, Loader2 } from "lucide-react";

export default function ProjectList({
  projects,
  loading,
  selectedId,
  onSelect,
  onDelete,
}) {
  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="glass rounded-2xl p-5">
      <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-content-muted mb-4 flex items-center gap-2">
        <FolderOpen className="w-4 h-4" />
        Projects
        {projects.length > 0 && (
          <span className="ml-auto bg-surface-sunken text-content-secondary text-xs font-mono px-2 py-0.5 rounded-full">
            {projects.length}
          </span>
        )}
      </h2>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 text-content-muted animate-spin" />
        </div>
      ) : projects.length === 0 ? (
        <div className="py-8 text-center">
          <Music2 className="w-8 h-8 text-content-muted mx-auto mb-2" />
          <p className="text-sm text-content-muted">No projects yet</p>
          <p className="text-xs text-content-muted mt-1">
            Upload a track to get started
          </p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
          <AnimatePresence>
            {projects.map((project, i) => (
              <motion.button
                key={project._id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => onSelect(project)}
                className={`w-full text-left rounded-lg p-3 transition-all duration-200 group flex items-start gap-3 ${
                  selectedId === project._id
                    ? "bg-accent-muted border border-accent/20"
                    : "hover:bg-surface-sunken border border-transparent"
                }`}
              >
                {/* Icon */}
                <div
                  className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    selectedId === project._id
                      ? "bg-accent/20 text-accent"
                      : "bg-surface-overlay text-content-muted"
                  }`}
                >
                  <Music2 className="w-4 h-4" />
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium truncate ${
                      selectedId === project._id
                        ? "text-accent"
                        : "text-content-primary"
                    }`}
                  >
                    {project.name}
                  </p>
                  <p className="text-xs text-content-muted flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" />
                    {formatDate(project.createdAt)}
                  </p>
                </div>

                {/* Delete button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Delete this project?")) onDelete(project._id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-red-500/10 text-content-muted hover:text-red-400 transition-all flex-shrink-0"
                  title="Delete project"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
