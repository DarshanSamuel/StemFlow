# 🎵 StemFlow — AI Music Stem Separator

<div align="center">

**Upload a song. Get vocals, drums, bass & instruments — separated by AI.**

Built with React + Vite · MongoDB GridFS · Meta Demucs · Google Colab GPU · Vercel

[Live Demo](https://stemflow-vercel.vercel.app) · [Report Bug](https://github.com/DarshanSamuel/StemFlow/issues) · [Request Feature](https://github.com/DarshanSamuel/StemFlow/issues)

</div>

---

## What It Does

StemFlow is a full-stack web app that uses Meta's **Demucs** deep learning model to separate any music file into its individual stems:

| Stem | What It Isolates |
|------|-----------------|
| 🎤 **Vocals** | Singing, rapping, spoken word |
| 🥁 **Drums** | Kick, snare, hi-hats, percussion |
| 🎸 **Bass** | Bass guitar, sub-bass, low-end |
| 🎹 **Other** | Piano, guitar, synths, strings, everything else |

Upload an MP3 or WAV → AI separates it on a free GPU → play, clip, mix, and download each stem independently.

---

## Features

### 🎛️ Three Workspace Tabs

- **Stem Extraction** — Upload and separate tracks with real-time Colab health monitoring, play individual stems, download as ZIP or individually
- **Audio Clipping** — Interactive range sliders on the seekbar for every track (master + all stems), HH:MM:SS timestamps synced with draggable handles, clip preview playback
- **Audio Mixing** — Play all 4 stems simultaneously with individual volume faders, Mute (M) and Solo (S) per stem, master volume control, synced transport

### 🔐 Authentication
- Email/password sign-up and sign-in with JWT
- Guest mode for quick testing (no persistence)

### 💾 100% MongoDB Storage
- User accounts, project metadata, AND audio files all stored in a single MongoDB Atlas cluster
- Audio stems stored via GridFS (chunked binary storage)
- No external storage services needed — no S3, no Supabase, no Cloudinary

### 🖥️ Colab GPU Backend
- Runs Meta's `htdemucs_ft` (fine-tuned Hybrid Transformer) model
- Free T4 GPU on Google Colab
- WAV → MP3 conversion (128 kbps) to save storage
- Ngrok tunnel exposes the API to the internet

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, Framer Motion, Lucide Icons |
| Backend API | Vercel Serverless Functions (Node.js) |
| Database | MongoDB Atlas (Mongoose + native GridFS) |
| AI Model | Meta Demucs `htdemucs_ft` (PyTorch) |
| GPU Runtime | Google Colab (T4 GPU, free tier) |
| Tunneling | Ngrok |
| Auth | JWT + bcrypt |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [MongoDB Atlas](https://www.mongodb.com/atlas) account (free M0 tier)
- [Google Colab](https://colab.research.google.com) (free, with GPU)
- [Ngrok](https://ngrok.com) account (free tier)
- [Vercel](https://vercel.com) account (free tier)

### 1. Clone the Repository

```bash
git clone https://github.com/DarshanSamuel/StemFlow.git
cd StemFlow
npm install
```

### 2. Set Up MongoDB Atlas

1. Create a free M0 cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Create a database user with read/write permissions
3. Set Network Access to `0.0.0.0/0` (required for Vercel + Colab)
4. Get your connection string and add `/stemflow` as the database name:
   ```
   mongodb+srv://user:pass@cluster.xxxxx.mongodb.net/stemflow?retryWrites=true&w=majority
   ```

Collections are auto-created on first use: `users`, `projects`, `stems.files`, `stems.chunks`

### 3. Set Up Google Colab Backend

1. Open [Google Colab](https://colab.research.google.com) → new notebook
2. Set runtime to **T4 GPU** (Runtime → Change runtime type)
3. Copy `colab_backend.py` into 3 Colab cells (marked as Cell 1, 2, 3)
4. Fill in `NGROK_AUTH_TOKEN` and `MONGODB_URI` in Cell 2
5. Run cells 1 → 2 → 3
6. Copy the ngrok URL printed in the output

### 4. Configure Environment Variables

Create a `.env` file:
```bash
cp .env.example .env
```

Fill in:
```env
MONGODB_URI=mongodb+srv://...
JWT_SECRET=<random 64+ char hex string>
VITE_COLAB_API_URL=https://xxxx.ngrok-free.app
```

Generate a JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 5. Run Locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### 6. Deploy to Vercel

1. Push to GitHub
2. Import the repo on [vercel.com](https://vercel.com)
3. Set framework to **Vite**
4. Add the 3 environment variables (`MONGODB_URI`, `JWT_SECRET`, `VITE_COLAB_API_URL`)
5. Deploy

---

## Project Structure

```
stemflow/
├── api/                              # Vercel serverless functions
│   ├── _lib/
│   │   ├── db.js                     # MongoDB + Mongoose + GridFS
│   │   └── auth.js                   # JWT + CORS helpers
│   ├── auth/
│   │   ├── signup.js                 # POST /api/auth/signup
│   │   ├── signin.js                 # POST /api/auth/signin
│   │   └── me.js                     # GET  /api/auth/me
│   ├── projects/
│   │   ├── index.js                  # GET + POST /api/projects
│   │   └── [id].js                   # GET + DELETE /api/projects/:id
│   └── stems/
│       ├── [id].js                   # GET /api/stems/:gridfs_id
│       └── debug.js                  # GET /api/stems/debug (diagnostics)
│
├── src/                              # React frontend
│   ├── components/
│   │   ├── AuthScreen.jsx            # Login / register / guest
│   │   ├── Dashboard.jsx             # Main layout + tab routing
│   │   ├── Uploader.jsx              # Drag-and-drop upload
│   │   ├── ProjectList.jsx           # Sidebar + delete dialog
│   │   └── tabs/
│   │       ├── StemExtraction.jsx    # Separation + playback + download
│   │       ├── AudioClipping.jsx     # Interactive range clipping
│   │       └── AudioMixing.jsx       # Multi-stem mixer
│   ├── hooks/useAuth.jsx             # Auth context
│   ├── lib/api.js                    # HTTP client + helpers
│   ├── App.jsx, main.jsx, index.css
│
├── colab_backend.py                  # Google Colab notebook code
├── package.json
├── vite.config.js
├── tailwind.config.js
├── vercel.json
├── GUIDE.md                          # Detailed setup guide
└── .env.example
```

---

## API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/auth/signup` | No | Create account |
| `POST` | `/api/auth/signin` | No | Login, receive JWT |
| `GET` | `/api/auth/me` | Yes | Validate token |
| `GET` | `/api/projects` | Yes | List user's projects |
| `POST` | `/api/projects` | Yes | Create project |
| `GET` | `/api/projects/:id` | Yes | Get project |
| `DELETE` | `/api/projects/:id` | Yes | Delete project + stems |
| `GET` | `/api/stems/:id` | No | Stream audio from GridFS |
| `GET` | `/api/stems/debug` | No | Diagnostic info |

---

## How Demucs Works

[Demucs](https://github.com/facebookresearch/demucs) is Meta's open-source music source separation model. StemFlow uses the `htdemucs_ft` variant — a Hybrid Transformer architecture fine-tuned on the MUSDB18-HQ dataset.

**Processing pipeline:**
1. Audio file uploaded to Colab server
2. `python -m demucs.separate -n htdemucs_ft -d cuda` runs on T4 GPU
3. Produces 4 WAV stems (~40 MB each for a 4-min song)
4. FFmpeg converts WAV → MP3 at 128 kbps (~3.8 MB each)
5. MP3s uploaded to MongoDB GridFS
6. GridFS ObjectId strings returned to frontend

**Typical processing time:** 30–90 seconds on a T4 GPU for a 3–4 minute song.

---

## Storage

Everything lives in MongoDB Atlas:

| Collection | Purpose | Size per project |
|------------|---------|-----------------|
| `users` | Accounts | ~0.5 KB |
| `projects` | Metadata + stem IDs | ~0.5 KB |
| `stems.files` | GridFS file index | ~2 KB (4 entries) |
| `stems.chunks` | Audio binary data | ~15 MB (4 stems) |

**M0 free tier (512 MB)** fits approximately **30 projects**.

---

## Environment Variables

| Variable | Where Used | Description |
|----------|-----------|-------------|
| `MONGODB_URI` | Vercel + Colab | MongoDB Atlas connection string |
| `JWT_SECRET` | Vercel | JWT signing secret (64+ chars) |
| `VITE_COLAB_API_URL` | Frontend | Ngrok URL to Colab server |
| `NGROK_AUTH_TOKEN` | Colab only | Ngrok auth token |

---

## Known Limitations

- **Colab sessions expire** after ~12–24 hours; ngrok URL changes each restart
- **M0 storage** limited to 512 MB (~30 projects)
- **No real-time export** of clipped/mixed audio (browser playback only; full files download)
- **Master track persistence** — master track uses a browser blob URL for the current session; reloading loses it (stems persist in MongoDB)

---

## Acknowledgments

- [Meta Demucs](https://github.com/facebookresearch/demucs) — music source separation model
- [Google Colab](https://colab.research.google.com) — free GPU runtime
- [MongoDB Atlas](https://www.mongodb.com/atlas) — database + GridFS storage
- [Vercel](https://vercel.com) — frontend hosting + serverless functions
- [Ngrok](https://ngrok.com) — tunneling for Colab

---

## License

This project is for educational and personal use. Demucs is licensed under MIT by Meta Research.
