import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FolderOpen, Trash2, Clock, Music2, Loader2, X, AlertTriangle } from "lucide-react";

/* ================================================================
   Delete Confirmation Dialog
   ================================================================ */
function DeleteDialog({ projectName, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Dialog */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className="relative z-10 w-full max-w-md bg-surface-raised border border-border-default rounded-2xl p-6 shadow-2xl"
      >
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-red-500/10 flex-shrink-0">
            <AlertTriangle className="w-6 h-6 text-red-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-display text-lg font-semibold text-content-primary">
              Delete Project
            </h3>
            <p className="text-sm text-content-secondary mt-2 leading-relaxed">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-content-primary">
                "{projectName}"
              </span>
              ? This will permanently remove the project and all its separated audio stems. This action cannot be undone.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-content-secondary hover:text-content-primary bg-surface-overlay hover:bg-surface-sunken border border-border-default transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-all"
          >
            Delete Project
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ================================================================
   Project List
   ================================================================ */
export default function ProjectList({
  projects,
  loading,
  selectedId,
  onSelect,
  onDelete,
}) {
  const [deleteTarget, setDeleteTarget] = useState(null);

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleDeleteClick = (e, project) => {
    e.stopPropagation();
    setDeleteTarget(project);
  };

  const handleConfirmDelete = () => {
    if (deleteTarget) {
      onDelete(deleteTarget._id);
      setDeleteTarget(null);
    }
  };

  return (
    <>
      {/* Delete confirmation dialog */}
      <AnimatePresence>
        {deleteTarget && (
          <DeleteDialog
            projectName={deleteTarget.name}
            onConfirm={handleConfirmDelete}
            onCancel={() => setDeleteTarget(null)}
          />
        )}
      </AnimatePresence>

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
                  className={`w-full text-left rounded-xl p-3.5 transition-all duration-200 group flex items-start gap-3 ${
                    selectedId === project._id
                      ? "bg-accent-muted border border-accent/20"
                      : "hover:bg-surface-sunken border border-transparent"
                  }`}
                >
                  {/* Icon */}
                  <div
                    className={`mt-0.5 w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
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
                    onClick={(e) => handleDeleteClick(e, project)}
                    className="opacity-0 group-hover:opacity-100 p-2 rounded-lg hover:bg-red-500/10 text-content-muted hover:text-red-400 transition-all flex-shrink-0"
                    title="Delete project"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </>
  );
}
