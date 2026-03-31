import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileAudio, Zap } from "lucide-react";

const ACCEPTED = {
  "audio/mpeg": [".mp3"], "audio/wav": [".wav"], "audio/x-wav": [".wav"],
  "audio/flac": [".flac"], "audio/ogg": [".ogg"],
};

export default function Uploader({ onUpload, uploading, uploadProgress }) {
  const onDrop = useCallback((accepted, rejected) => {
    if (rejected.length > 0) {
      alert(rejected[0]?.errors?.[0]?.code === "file-too-large"
        ? "File too large (max 100 MB)." : "Unsupported format.");
      return;
    }
    if (accepted.length > 0) onUpload(accepted[0]);
  }, [onUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: ACCEPTED, maxSize: 100 * 1024 * 1024, multiple: false, disabled: uploading,
  });

  return (
    <div className="glass rounded-2xl p-5">
      <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-content-muted mb-4 flex items-center gap-2">
        <Upload className="w-4 h-4" />Upload Track
      </h2>
      <div {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-7 text-center cursor-pointer transition-all duration-300 ${
          uploading ? "border-accent/30 bg-accent-muted cursor-wait"
          : isDragActive ? "border-accent bg-accent-muted dropzone-active"
          : "border-border-default hover:border-content-muted hover:bg-surface-sunken/50"
        }`}>
        <input {...getInputProps()} />
        {uploading ? (
          <div className="space-y-3">
            <Upload className="w-10 h-10 mx-auto text-accent animate-pulse" />
            <p className="text-sm font-semibold text-accent">Uploading file...</p>
            <div className="w-full bg-surface-sunken rounded-full h-2.5 overflow-hidden">
              <div className="h-full bg-accent rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
            </div>
            <p className="text-xs text-content-muted font-mono">{uploadProgress}%</p>
          </div>
        ) : (
          <div className="space-y-2">
            <FileAudio className={`w-12 h-12 mx-auto transition-colors ${isDragActive ? "text-accent" : "text-content-muted"}`} />
            <p className="text-sm text-content-secondary">
              {isDragActive ? <span className="text-accent font-medium">Drop here</span>
              : <>Drag & drop or <span className="text-accent font-medium underline underline-offset-2">browse</span></>}
            </p>
            <p className="text-xs text-content-muted">MP3, WAV, FLAC, OGG — up to 100 MB</p>
          </div>
        )}
      </div>
      {!uploading && (
        <p className="mt-3 text-xs text-content-muted flex items-center gap-1.5 justify-center">
          <Zap className="w-3.5 h-3.5 text-accent" />Meta Demucs htdemucs_ft on GPU
        </p>
      )}
    </div>
  );
}
