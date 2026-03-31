/* ================================================================
   api.js — Centralized API client for StemFlow
   
   All audio stems are stored in MongoDB GridFS and streamed
   through /api/stems/[gridfs_id]. No external storage needed.
   ================================================================ */

const API_BASE = "/api";
const COLAB_URL = import.meta.env.VITE_COLAB_API_URL || "";

/**
 * Helper: makes an authenticated fetch to our Vercel API routes
 */
async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("sf_token");

  const headers = {
    ...(options.headers || {}),
  };

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }

  return data;
}

/* ================================================================
   Stem URL Helper
   ================================================================ */

export function stemURL(gridfsId) {
  if (!gridfsId) return "";
  if (gridfsId.startsWith("http") || gridfsId.startsWith("/")) return gridfsId;
  return `${API_BASE}/stems/${gridfsId}`;
}

/* ---- Auth endpoints ---- */

export async function signUp(email, password) {
  const data = await apiFetch("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (data.token) localStorage.setItem("sf_token", data.token);
  return data;
}

export async function signIn(email, password) {
  const data = await apiFetch("/auth/signin", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (data.token) localStorage.setItem("sf_token", data.token);
  return data;
}

export async function getMe() {
  return apiFetch("/auth/me");
}

export function signOut() {
  localStorage.removeItem("sf_token");
}

export function continueAsGuest() {
  localStorage.setItem("sf_token", "guest");
  return { user: { id: "guest", email: "guest@stemflow.app" } };
}

/* ---- Project endpoints ---- */

export async function getProjects() {
  return apiFetch("/projects");
}

export async function getProject(id) {
  return apiFetch(`/projects/${id}`);
}

export async function createProject(projectData) {
  return apiFetch("/projects", {
    method: "POST",
    body: JSON.stringify(projectData),
  });
}

export async function deleteProject(id) {
  return apiFetch(`/projects/${id}`, { method: "DELETE" });
}

/* ================================================================
   Colab / Demucs Processing
   
   Progress stages:
     0-40%   → Uploading file to Colab server
     40-45%  → Upload complete, AI is starting
     45-85%  → AI separation in progress (we poll, but can't track exact %)
     85-95%  → Saving stems to MongoDB
     95-100% → Done
   ================================================================ */

export async function separateTrack(file, onProgress) {
  if (!COLAB_URL) {
    throw new Error(
      "Colab API URL is not configured. Set VITE_COLAB_API_URL in your .env file."
    );
  }

  const formData = new FormData();
  formData.append("file", file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let uploadDone = false;

    // Upload progress: 0% → 40%
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        const pct = Math.round((e.loaded / e.total) * 40);
        onProgress(pct, "uploading");
      }
    });

    xhr.upload.addEventListener("load", () => {
      uploadDone = true;
      if (onProgress) {
        onProgress(42, "processing");
      }
    });

    // Simulate progress while waiting for AI to finish
    let fakeProgress = 42;
    const progressInterval = setInterval(() => {
      if (uploadDone && fakeProgress < 82) {
        fakeProgress += 0.5;
        if (onProgress) {
          onProgress(Math.round(fakeProgress), "processing");
        }
      }
    }, 1000);

    xhr.addEventListener("load", () => {
      clearInterval(progressInterval);

      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          if (onProgress) onProgress(90, "saving");
          const data = JSON.parse(xhr.responseText);
          if (onProgress) onProgress(100, "done");
          resolve(data);
        } catch {
          reject(new Error("Invalid JSON response from Colab server"));
        }
      } else {
        let msg = `Colab server error (${xhr.status})`;
        try {
          const err = JSON.parse(xhr.responseText);
          msg = err.error || err.detail || msg;
        } catch {
          /* use default */
        }
        reject(new Error(msg));
      }
    });

    xhr.addEventListener("error", () => {
      clearInterval(progressInterval);
      reject(new Error("Network error — is the Colab server running?"));
    });

    xhr.addEventListener("timeout", () => {
      clearInterval(progressInterval);
      reject(
        new Error("Request timed out — Demucs processing may take a while. Try again.")
      );
    });

    xhr.open("POST", `${COLAB_URL}/separate`);
    xhr.timeout = 600000;
    xhr.send(formData);
  });
}
