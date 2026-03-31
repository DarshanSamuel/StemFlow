import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileAudio, Zap } from "lucide-react";

const ACCEPTED = {
  "audio/mpeg": [".mp3"],
  "audio/wav": [".wav"],
  "audio/x-wav": [".wav"],
  "audio/flac": [".flac"],
  "audio/ogg": [".ogg"],
};
const MAX_SIZE = 100 * 1024 * 1024; // 100 MB

export default function Uploader({ onUpload, processing, progress }) {
  const onDrop = useCallback(
    (accepted, rejected) => {
      if (rejected.length > 0) {
        const code = rejected[0]?.errors?.[0]?.code;
        if (code === "file-too-large") {
          alert("File is too large. Maximum size is 100 MB.");
        } else {
          alert("Unsupported file format. Please upload MP3, WAV, FLAC, or OGG.");
        }
        return;
      }
      if (accepted.length > 0) {
        onUpload(accepted[0]);
      }
    },
    [onUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    maxSize: MAX_SIZE,
    multiple: false,
    disabled: processing,
  });

  return (
    <div className="glass rounded-2xl p-5">
      <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-content-muted mb-4 flex items-center gap-2">
        <Upload className="w-4 h-4" />
        Upload Track
      </h2>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-300 ${
          processing
            ? "border-accent/30 bg-accent-muted cursor-wait"
            : isDragActive
            ? "border-accent bg-accent-muted dropzone-active"
            : "border-border-default hover:border-content-muted hover:bg-surface-sunken/50"
        }`}
      >
        <input {...getInputProps()} />

        {processing ? (
          <div className="space-y-3">
            {/* Waveform animation */}
            <div className="flex items-end justify-center h-8">
              <span className="loading-bar" />
              <span className="loading-bar" />
              <span className="loading-bar" />
              <span className="loading-bar" />
              <span className="loading-bar" />
            </div>

            <p className="text-sm font-medium text-accent">{progress.msg || "Processing..."}</p>

            {/* Progress bar */}
            <div className="w-full bg-surface-sunken rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress.pct}%` }}
              />
            </div>
            <p className="text-xs text-content-muted font-mono">{progress.pct}%</p>
          </div>
        ) : (
          <div className="space-y-2">
            <FileAudio
              className={`w-10 h-10 mx-auto transition-colors ${
                isDragActive ? "text-accent" : "text-content-muted"
              }`}
            />
            <p className="text-sm text-content-secondary">
              {isDragActive ? (
                <span className="text-accent font-medium">Drop your file here</span>
              ) : (
                <>
                  Drag & drop audio file, or{" "}
                  <span className="text-accent font-medium underline underline-offset-2">
                    browse
                  </span>
                </>
              )}
            </p>
            <p className="text-xs text-content-muted">
              MP3, WAV, FLAC, OGG — up to 100 MB
            </p>
          </div>
        )}
      </div>

      {/* Separate button */}
      {!processing && (
        <p className="mt-3 text-xs text-content-muted flex items-center gap-1.5 justify-center">
          <Zap className="w-3 h-3 text-accent" />
          Uses Meta Demucs htdemucs_ft on GPU
        </p>
      )}
    </div>
  );
}
