const API_BASE = "/api";
const COLAB_URL = import.meta.env.VITE_COLAB_API_URL || "";

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("sf_token");
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export function stemURL(gridfsId) {
  if (!gridfsId) return "";
  if (gridfsId.startsWith("http") || gridfsId.startsWith("/") || gridfsId.startsWith("blob:")) return gridfsId;
  return `${API_BASE}/stems/${gridfsId}`;
}

/* Auth */
export async function signUp(email, password) {
  const data = await apiFetch("/auth/signup", { method: "POST", body: JSON.stringify({ email, password }) });
  if (data.token) localStorage.setItem("sf_token", data.token);
  return data;
}
export async function signIn(email, password) {
  const data = await apiFetch("/auth/signin", { method: "POST", body: JSON.stringify({ email, password }) });
  if (data.token) localStorage.setItem("sf_token", data.token);
  return data;
}
export async function getMe() { return apiFetch("/auth/me"); }
export function signOut() { localStorage.removeItem("sf_token"); }
export function continueAsGuest() {
  localStorage.setItem("sf_token", "guest");
  return { user: { id: "guest", email: "guest@stemflow.app" } };
}

/* Projects */
export async function getProjects() { return apiFetch("/projects"); }
export async function getProject(id) { return apiFetch(`/projects/${id}`); }
export async function createProject(d) { return apiFetch("/projects", { method: "POST", body: JSON.stringify(d) }); }
export async function deleteProject(id) { return apiFetch(`/projects/${id}`, { method: "DELETE" }); }

/* Health check — tests if Colab is running */
export async function checkColabHealth() {
  if (!COLAB_URL) return { ok: false, error: "VITE_COLAB_API_URL not set" };
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${COLAB_URL}/`, { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      return { ok: true, data };
    }
    return { ok: false, error: `Status ${res.status}` };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/* Upload file — progress ONLY tracks the upload, nothing else */
export function uploadFileToColab(file, onUploadProgress) {
  if (!COLAB_URL) return Promise.reject(new Error("Colab API URL not configured."));

  const formData = new FormData();
  formData.append("file", file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onUploadProgress) {
        onUploadProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch { reject(new Error("Invalid JSON from Colab")); }
      } else {
        let msg = `Colab error (${xhr.status})`;
        try { const e = JSON.parse(xhr.responseText); msg = e.error || e.detail || msg; } catch {}
        reject(new Error(msg));
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Network error — is Colab running?")));
    xhr.addEventListener("timeout", () => reject(new Error("Timed out (>10 min)")));

    xhr.open("POST", `${COLAB_URL}/separate`);
    xhr.timeout = 600000;
    xhr.send(formData);
  });
}
