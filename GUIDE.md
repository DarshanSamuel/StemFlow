# StemFlow — Complete Setup & Deployment Guide
## 100% MongoDB Edition · With MongoDB Compass Instructions

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Why MongoDB GridFS for Audio Storage](#2-why-mongodb-gridfs-for-audio-storage)
3. [Part A: MongoDB Atlas Setup (Detailed)](#part-a-mongodb-atlas-setup)
4. [Part B: MongoDB Compass Setup & Usage](#part-b-mongodb-compass-setup--usage)
5. [Part C: Google Colab Backend Setup](#part-c-google-colab-backend-setup)
6. [Part D: Ngrok Tunnel Setup](#part-d-ngrok-tunnel-setup)
7. [Part E: Frontend (React + Vite)](#part-e-frontend-react--vite)
8. [Part F: Vercel Serverless API Routes](#part-f-vercel-serverless-api-routes)
9. [Part G: Deploy to Vercel](#part-g-deploy-to-vercel)
10. [Part H: End-to-End Testing](#part-h-end-to-end-testing)
11. [Troubleshooting](#troubleshooting)
12. [Environment Variable Reference](#environment-variable-reference)

---

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         USER'S BROWSER                                   │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │   React Frontend (Vite + Tailwind)  — Hosted on Vercel          │    │
│  │   • Auth screens (Sign In / Sign Up / Guest)                    │    │
│  │   • Upload component with drag-and-drop                        │    │
│  │   • Project sidebar listing past separations                   │    │
│  │   • 4-channel stem player (volume, clip preview, download)     │    │
│  └───────────┬────────────────────────┬────────────────────────────┘    │
│              │                        │                                  │
│     ┌────────▼────────────┐  ┌────────▼──────────────────┐              │
│     │ Vercel Serverless    │  │ Google Colab + Ngrok       │             │
│     │ API Routes           │  │ (GPU AI Processing)        │             │
│     │                      │  │                            │             │
│     │ /api/auth/*          │  │ POST /separate             │             │
│     │ /api/projects/*      │  │  1. Runs Demucs on T4 GPU  │             │
│     │ /api/stems/[id]  ◄───┤  │  2. WAV → MP3 via ffmpeg   │             │
│     │   (streams audio)    │  │  3. Uploads MP3 to GridFS  │             │
│     └────────┬─────────────┘  └────────┬─────────────────┘              │
│              │                          │                                │
│              │     ┌────────────────────▼──────────────────┐             │
│              └────►│       MongoDB Atlas  (M0 Free)        │             │
│                    │                                       │             │
│                    │  Cluster: stemflow-cluster             │             │
│                    │  Database: stemflow                    │             │
│                    │                                       │             │
│                    │  Collections:                         │             │
│                    │    users           (accounts)         │             │
│                    │    projects        (metadata)         │             │
│                    │    stems.files     (GridFS index)     │             │
│                    │    stems.chunks    (audio binary)     │             │
│                    └───────────────────────────────────────┘             │
└──────────────────────────────────────────────────────────────────────────┘
```

**Everything lives in one MongoDB Atlas cluster. No Supabase, no Cloudinary, no S3.**

---

## 2. Why MongoDB GridFS for Audio Storage

**GridFS** is MongoDB's built-in specification for storing files larger than the
16 MB BSON document limit. It splits files into 255 KB chunks and stores them
across two collections.

Why this works:

- **One dependency** — a single MongoDB cluster for auth, projects, AND audio files
- **No extra accounts** — no Supabase, Cloudinary, or AWS signup
- **Atomic cleanup** — deleting a project removes its audio automatically
- **Free tier fits** — M0 has 512 MB; at ~15 MB per project (4 MP3 stems), ~30 projects fit
- **Streaming support** — Vercel serves audio via GridFSBucket.openDownloadStream()
  with HTTP Range header support for seeking/scrubbing

---

## Part A: MongoDB Atlas Setup

This section walks through every single screen and click. Follow it exactly.

### A1. Create Atlas Account

1. Go to **https://www.mongodb.com/cloud/atlas/register**
2. Sign up with:
   - Your **email address**, or
   - **Sign in with Google** (fastest)
3. Verify your email if prompted
4. You'll land on the Atlas welcome page

### A2. Create Organization & Project

Atlas organizes things in a hierarchy: **Organization → Project → Cluster → Database → Collections**

When you first sign up, Atlas may auto-create these. If not, or if you want clean naming:

**Create an Organization:**
1. Click your name (top-left) → **Organizations** → **Create an Organization**
2. Organization name: **`StemFlow`**
3. Cloud service: **MongoDB Atlas**
4. Click **Next** → **Create Organization**

**Create a Project inside it:**
1. Inside the StemFlow organization, click **New Project**
2. Project name: **`stemflow-prod`**
3. Click **Next** → **Create Project**

You're now inside the stemflow-prod project. This is where your cluster lives.

**What you have so far:**
```
Organization: StemFlow
  └── Project: stemflow-prod
```

### A3. Deploy a Free Cluster

1. You should see a **"Create a Deployment"** or **"Build a Database"** button — click it
2. Choose the **M0 Free** tier (the free forever option)
3. Configuration:
   - **Provider**: Any (AWS, Google Cloud, or Azure) — they all work the same
   - **Region**: Pick the one **closest to you geographically**:
     - India → `Mumbai (ap-south-1)` on AWS, or `Mumbai` on GCP
     - US East → `Virginia (us-east-1)`
     - Europe → `Frankfurt` or `Ireland`
   - **Cluster name**: **`stemflow-cluster`**
     - ⚠️ This name **cannot be changed later**, so type it exactly
4. Click **Create Deployment** (or "Create Cluster")
5. Wait ~2-3 minutes for provisioning. A green "Active" status appears when ready.

**Your hierarchy now:**
```
Organization: StemFlow
  └── Project: stemflow-prod
       └── Cluster: stemflow-cluster   (M0 Free, 512 MB storage)
```

### A4. Create Database User

This is the programmatic login for your app (NOT your Atlas website login).

1. Left sidebar → **Database Access** (under SECURITY)
2. Click **Add New Database User**
3. Authentication method: **Password**
4. Fill in:
   - **Username**: **`stemflow-app`**
   - **Password**: Click **Autogenerate Secure Password**
   - ⚠️ **COPY THIS PASSWORD NOW** — save it in a notes app or password manager. Atlas will NOT show it again.
5. Database User Privileges:
   - Select **Built-in Role** → **Read and write to any database**
6. Click **Add User**

**What you created:**
```
Database User:
  Username: stemflow-app
  Password: (the one you just copied and saved)
  Role:     readWriteAnyDatabase
```

### A5. Configure Network Access

1. Left sidebar → **Network Access** (under SECURITY)
2. Click **Add IP Address**
3. Click **ALLOW ACCESS FROM ANYWHERE** (adds `0.0.0.0/0`)
   - Required because Vercel serverless functions and Google Colab both have dynamic IPs
4. Comment (optional): `Development - All IPs`
5. Click **Confirm**

The entry shows as `0.0.0.0/0` with status **Active**.

### A6. Get Your Connection String

1. Left sidebar → **Database** (under DEPLOYMENT)
2. Find `stemflow-cluster` with a green **Active** badge
3. Click the **Connect** button
4. Choose **Drivers**
5. Driver: **Node.js** (any version)
6. You'll see a string like:
   ```
   mongodb+srv://stemflow-app:<db_password>@stemflow-cluster.a1b2c3d.mongodb.net/?retryWrites=true&w=majority&appName=stemflow-cluster
   ```

7. **Modify the string** — two replacements:

   a) Replace `<db_password>` with your **actual password** from Step A4

   b) Add the **database name** `/stemflow` before the `?`

   **Before (what Atlas gives you):**
   ```
   mongodb+srv://stemflow-app:MyS3cur3P@ss@stemflow-cluster.a1b2c3d.mongodb.net/?retryWrites=true&w=majority&appName=stemflow-cluster
   ```

   **After (what you actually use):**
   ```
   mongodb+srv://stemflow-app:MyS3cur3P@ss@stemflow-cluster.a1b2c3d.mongodb.net/stemflow?retryWrites=true&w=majority&appName=stemflow-cluster
   ```

   The `/stemflow` tells Mongoose, PyMongo, AND Compass which database to use.

8. **Save this final string.** This is your `MONGODB_URI`.

**Complete naming reference:**
```
Atlas Organization:    StemFlow
Atlas Project:         stemflow-prod
Cluster name:          stemflow-cluster
Database name:         stemflow              ← in the connection string path
Database user:         stemflow-app
Database password:     (your saved password)
Collections (auto):    users, projects, stems.files, stems.chunks

Full connection string:
mongodb+srv://stemflow-app:<PASSWORD>@stemflow-cluster.XXXXX.mongodb.net/stemflow?retryWrites=true&w=majority&appName=stemflow-cluster
```

### A7. Understanding the Database Structure

When the app runs for the first time, **4 collections** auto-create inside `stemflow`.

```
stemflow-cluster (Atlas Cluster, M0 Free)
  └── stemflow (Database)
       ├── users              ← Created by Mongoose when first user signs up
       ├── projects           ← Created by Mongoose when first project is saved
       ├── stems.files        ← Created by GridFS when first stem is uploaded
       └── stems.chunks       ← Created by GridFS when first stem is uploaded
```

#### `users` Collection Schema

```json
{
  "_id":          ObjectId("665f1a2b3c4d5e6f7a8b9c0d"),
  "email":        "user@example.com",
  "passwordHash": "$2a$12$LJ3n7x8K9mN2pQ4rS5tU6...",
  "createdAt":    ISODate("2025-07-15T10:30:00Z"),
  "updatedAt":    ISODate("2025-07-15T10:30:00Z"),
  "__v":          0
}
```

| Field         | Type     | Details                                    |
|---------------|----------|--------------------------------------------|
| _id           | ObjectId | Auto-generated unique ID                   |
| email         | String   | Unique, indexed, stored as lowercase       |
| passwordHash  | String   | bcrypt hash, 12 salt rounds (irreversible) |
| createdAt     | Date     | Auto-set by Mongoose timestamps            |
| updatedAt     | Date     | Auto-updated on any modification           |
| __v           | Number   | Mongoose internal version key              |

#### `projects` Collection Schema

```json
{
  "_id":       ObjectId("665f2b3c4d5e6f7a8b9c0d1e"),
  "userId":    ObjectId("665f1a2b3c4d5e6f7a8b9c0d"),
  "name":      "My Song",
  "stems": {
    "vocals":  "665fa1b2c3d4e5f6a7b8c9d0",
    "drums":   "665fa1b2c3d4e5f6a7b8c9d1",
    "bass":    "665fa1b2c3d4e5f6a7b8c9d2",
    "other":   "665fa1b2c3d4e5f6a7b8c9d3"
  },
  "createdAt": ISODate("2025-07-15T10:35:00Z"),
  "updatedAt": ISODate("2025-07-15T10:35:00Z"),
  "__v":       0
}
```

| Field          | Type     | Details                                          |
|----------------|----------|--------------------------------------------------|
| _id            | ObjectId | Auto-generated project ID                        |
| userId         | ObjectId | References users._id (indexed for fast lookups)  |
| name           | String   | Original filename without extension              |
| stems.vocals   | String   | GridFS ObjectId string → points to stems.files   |
| stems.drums    | String   | GridFS ObjectId string                           |
| stems.bass     | String   | GridFS ObjectId string                           |
| stems.other    | String   | GridFS ObjectId string                           |

**Key relationship:** Each value in `stems` (e.g. `"665fa1b2c3d4e5f6a7b8c9d0"`)
is the `_id` of a document in `stems.files`.

#### `stems.files` Collection (GridFS Metadata)

```json
{
  "_id":        ObjectId("665fa1b2c3d4e5f6a7b8c9d0"),
  "filename":   "a1b2c3d4e5f6_vocals.mp3",
  "length":     3984127,
  "chunkSize":  261120,
  "uploadDate": ISODate("2025-07-15T10:34:45Z"),
  "metadata": {
    "job_id":        "a1b2c3d4e5f6",
    "stem":          "vocals",
    "original_file": "My_Song.mp3",
    "contentType":   "audio/mpeg"
  }
}
```

| Field                  | Type     | Details                                     |
|------------------------|----------|---------------------------------------------|
| _id                    | ObjectId | The ID referenced by projects.stems.*       |
| filename               | String   | Format: {job_id}_{stem_name}.mp3            |
| length                 | Number   | File size in bytes (3984127 = ~3.8 MB)      |
| chunkSize              | Number   | 261120 bytes = 255 KB (GridFS default)      |
| uploadDate             | Date     | When the Colab backend uploaded this file   |
| metadata.job_id        | String   | Unique ID for the separation job            |
| metadata.stem          | String   | "vocals", "drums", "bass", or "other"       |
| metadata.original_file | String   | Original uploaded filename                  |
| metadata.contentType   | String   | "audio/mpeg" (MP3)                          |

#### `stems.chunks` Collection (GridFS Binary Data)

```json
{
  "_id":      ObjectId("665fa1b2c3d4e5f6a7b8c9e0"),
  "files_id": ObjectId("665fa1b2c3d4e5f6a7b8c9d0"),
  "n":        0,
  "data":     BinData(0, "//uQxAAAAAANIAAAAAExBTUUz...")
}
```

A 3.8 MB MP3 produces ~15 chunks (3,800,000 / 261,120 ≈ 15).

---

## Part B: MongoDB Compass Setup & Usage

### B1. Install Compass

1. Download: **https://www.mongodb.com/try/download/compass**
2. Choose your OS (Windows / macOS / Linux)
3. Download the **full version** (not "Read Only" or "Isolated")
4. Install and launch

### B2. Connect to Your Cluster

1. Open Compass → you'll see a **"New Connection"** screen
2. In the URI field, paste your connection string:
   ```
   mongodb+srv://stemflow-app:YOUR_PASSWORD@stemflow-cluster.XXXXX.mongodb.net/stemflow?retryWrites=true&w=majority&appName=stemflow-cluster
   ```
3. Click **Connect**
4. The left sidebar shows your cluster

**Save it as a favorite:**
- Click the ⭐ icon → name it **`StemFlow Production`**
- It'll appear under Favorites next time you open Compass

**If connection fails:**
- Verify Network Access includes `0.0.0.0/0`
- Check your password has no unescaped special chars
- Ensure your firewall allows outbound on port 27017

### B3. Browsing Your Database

Left sidebar after connecting:
```
stemflow-cluster
  ├── admin              ← MongoDB internal (ignore)
  ├── local              ← MongoDB internal (ignore)
  └── stemflow           ← YOUR DATABASE — click this
       ├── users
       ├── projects
       ├── stems.files
       └── stems.chunks
```

> **Note:** Collections appear only after data is written. If the database is
> empty, sign up one user or run a separation first, then click the refresh
> button (circular arrow icon) in Compass.

### B4. Inspecting Users

Click **`users`** in the sidebar.

**Documents tab** shows all registered accounts. You'll see:
```
_id:          665f1a2b3c4d5e6f7a8b9c0d
email:        "john@example.com"
passwordHash: "$2a$12$LJ3n7x8K..."      ← bcrypt hash (cannot be reversed)
createdAt:    2025-07-15T10:30:00.000+00:00
updatedAt:    2025-07-15T10:30:00.000+00:00
```

**Indexes tab** — you should see two indexes:
- `_id_` — default primary index
- `email_1` — unique index that prevents duplicate email signups

**Schema tab** — click this for a visual breakdown of field types and value distributions.

### B5. Inspecting Projects

Click **`projects`** in the sidebar. Each document = one stem separation:

```
_id:       665f2b3c4d5e6f7a8b9c0d1e
userId:    665f1a2b3c4d5e6f7a8b9c0d          ← links to users._id
name:      "Bohemian Rhapsody"
stems:
  vocals:  "665fa1b2c3d4e5f6a7b8c9d0"        ← GridFS file ID
  drums:   "665fa1b2c3d4e5f6a7b8c9d1"
  bass:    "665fa1b2c3d4e5f6a7b8c9d2"
  other:   "665fa1b2c3d4e5f6a7b8c9d3"
createdAt: 2025-07-15T10:35:00.000+00:00
```

**Find all projects by a specific user:**
1. Copy the user's `_id` from the `users` collection
2. In the `projects` filter bar, type:
   ```json
   { "userId": ObjectId("665f1a2b3c4d5e6f7a8b9c0d") }
   ```
3. Press Enter

**Cross-reference a stem file:**
1. Copy a stem ID from a project (e.g. the vocals value)
2. Switch to `stems.files`
3. Filter:
   ```json
   { "_id": ObjectId("665fa1b2c3d4e5f6a7b8c9d0") }
   ```
4. You'll see the file's size, upload date, and metadata

### B6. Inspecting GridFS Audio Stems

#### In stems.files

Click **`stems.files`**. Each document is one MP3 stem:

```
_id:        665fa1b2c3d4e5f6a7b8c9d0
filename:   "a1b2c3d4e5f6_vocals.mp3"
length:     3984127                              ← ~3.8 MB
chunkSize:  261120                               ← 255 KB per chunk
uploadDate: 2025-07-15T10:34:45.000+00:00
metadata:
  job_id:        "a1b2c3d4e5f6"
  stem:          "vocals"
  original_file: "Bohemian_Rhapsody.mp3"
  contentType:   "audio/mpeg"
```

#### In stems.chunks

Click **`stems.chunks`** — the raw binary data:
```
files_id: 665fa1b2c3d4e5f6a7b8c9d0      ← links to stems.files._id
n:        0                               ← chunk 0 = first 255 KB
data:     Binary("//uQxAAAAA...")         ← raw MP3 bytes
```

### B7. Useful Compass Queries

Paste these into the filter bar at the top of any collection:

| What you want                                | Collection     | Filter                                                     |
|----------------------------------------------|----------------|-------------------------------------------------------------|
| All users                                    | users          | `{}`                                                        |
| Find user by email                           | users          | `{ "email": "john@example.com" }`                           |
| All projects                                 | projects       | `{}`                                                        |
| Projects by a specific user                  | projects       | `{ "userId": ObjectId("PASTE_USER_ID_HERE") }`              |
| Projects from last 7 days                    | projects       | `{ "createdAt": { "$gte": ISODate("2025-07-08") } }`        |
| Find project by song name                    | projects       | `{ "name": "My Song" }`                                     |
| All GridFS audio files                       | stems.files    | `{}`                                                        |
| Stems for a specific separation job          | stems.files    | `{ "metadata.job_id": "a1b2c3d4e5f6" }`                     |
| Only vocal stems                             | stems.files    | `{ "metadata.stem": "vocals" }`                              |
| Only drum stems                              | stems.files    | `{ "metadata.stem": "drums" }`                               |
| Files larger than 5 MB                       | stems.files    | `{ "length": { "$gt": 5242880 } }`                          |
| Files smaller than 1 MB                      | stems.files    | `{ "length": { "$lt": 1048576 } }`                          |
| Files uploaded today                         | stems.files    | `{ "uploadDate": { "$gte": ISODate("2025-07-15") } }`       |
| Chunks for a specific file                   | stems.chunks   | `{ "files_id": ObjectId("PASTE_FILE_ID_HERE") }`            |
| Count total chunks                           | stems.chunks   | `{}` then check the document count in the bottom status bar |

**Sorting:**
- Click the **Sort** button next to the filter bar
- Newest projects first: `{ "createdAt": -1 }`
- Largest files first: `{ "length": -1 }`
- Alphabetical by name: `{ "name": 1 }`

### B8. Managing Storage in Compass

**Check collection sizes:**
1. Click the **`stemflow`** database name (not a collection, the database itself)
2. You'll see a summary view with document counts and data sizes per collection
3. `stems.chunks` will always be the largest — that's where audio bytes live

**Storage math:**
```
Per stem separation (4-minute song):
  4 stems × ~3.8 MB (MP3 128kbps) = ~15 MB stored in GridFS

MongoDB M0 capacity: 512 MB
  → ~30 full projects at 4 minutes each
  → ~50+ projects at 2 minutes each
```

**Freeing space via the app:**
- Delete projects in the web UI → the API auto-deletes their GridFS stems

**Freeing space manually in Compass:**
1. Go to `projects` → find the project to delete → click the trash icon
2. Note the 4 stem IDs from its `stems` field
3. Go to `stems.files` → delete each of the 4 documents by their `_id`
4. GridFS auto-cleans orphaned chunks (or you can delete from `stems.chunks`
   using `{ "files_id": ObjectId("...") }` for each file)

**Check total storage in Atlas:**
1. Atlas web dashboard → **Database** → click your cluster name
2. **Metrics** tab → look at **Data Size** and **Storage Size**

---

## Part C: Google Colab Backend Setup

The Colab notebook is structured as **3 separate cells**. Run them in order.

### Step 1: Open Colab & Enable GPU

- Go to [colab.research.google.com](https://colab.research.google.com) → **New notebook**
- Menu: **Runtime** → **Change runtime type** → **T4 GPU** → Save

### Step 2: Create 3 Cells

Open `colab_backend.py` from this project. It contains 3 clearly marked sections
(`CELL 1`, `CELL 2`, `CELL 3`). Paste each section into its own Colab cell.

**CELL 1 — Install Dependencies** (run once per session):
```
Installs: demucs, fastapi, uvicorn, pymongo
Downloads the ngrok binary DIRECTLY (not via pyngrok — this avoids the
"HTTP Error 500" bug where pyngrok's downloader fails on ngrok's CDN)
```

**CELL 2 — Configuration** (edit, then run):
```python
NGROK_AUTH_TOKEN = "your_token_from_ngrok_dashboard"
MONGODB_URI = "mongodb+srv://stemflow-admin:PASS@stemflow-cluster.XXXXX.mongodb.net/stemflow?retryWrites=true&w=majority&appName=stemflow-cluster"
```
- Use the **exact same MONGODB_URI** as Vercel and Compass — all three connect
  to the same `stemflow` database
- This cell validates both values and tests the MongoDB connection before proceeding

**CELL 3 — Start Server + Tunnel** (run last):
- Connects to MongoDB GridFS
- Starts FastAPI on port 8000
- Launches ngrok binary as a subprocess (no pyngrok needed)
- Reads the public URL from ngrok's local API at `http://127.0.0.1:4040`
- Prints the public URL

### Step 3: Run Cells 1 → 2 → 3

After Cell 3, you'll see:
```
=================================================================
  🌐  PUBLIC API URL:  https://abcd-12-34-56-78.ngrok-free.app
=================================================================

  📋  Set this as VITE_COLAB_API_URL in your Vercel env vars
  🗄️  Storage: MongoDB GridFS → database 'stemflow'

🚀 Server is running! Waiting for requests...
```

Copy the URL → set as `VITE_COLAB_API_URL` in Vercel.

### Verifying After a Separation

After a successful separation, verify in Compass:
1. Open Compass → refresh `stems.files` → **4 new entries** appear
2. Refresh `projects` (after frontend saves) → new project document with stem IDs
3. You can trace the full chain: project `stems.vocals` → `stems.files._id` → `stems.chunks.files_id`

### Troubleshooting Ngrok in Colab

If you see **"Failed to get ngrok tunnel URL"**:
1. Check that your `NGROK_AUTH_TOKEN` is correct (re-copy from dashboard)
2. Try running ngrok manually in a new cell: `!ngrok http 8000 &`
3. Then open `http://127.0.0.1:4040` in your browser to see the URL
4. If ngrok download fails (403/500 errors), try the alternative download:
   ```
   !wget -q https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz -O /tmp/ngrok.tgz
   !tar -xzf /tmp/ngrok.tgz -C /usr/local/bin/
   ```

### Important Notes

- Sessions expire after ~12-24 hours
- Ngrok URL changes every restart → update in Vercel env vars + redeploy
- Keep the Colab tab open — closing kills the server
- Processing time: ~30-90 seconds for a typical 3-4 minute song on T4

---

## Part D: Ngrok Tunnel Setup

1. Sign up at [ngrok.com](https://ngrok.com) → verify email
2. Dashboard → **Your Authtoken** → copy the token string
3. Paste into `NGROK_AUTH_TOKEN` in Colab Cell 2
4. Cell 3 handles the rest: installs the binary, starts the tunnel, prints the URL

**Why we don't use pyngrok:** The `pyngrok` Python library tries to download
the ngrok binary from ngrok's CDN, which frequently returns HTTP 500 errors
in Colab. Instead, Cell 1 downloads the binary directly using `wget` and
places it at `/usr/local/bin/ngrok`. Cell 3 runs it as a subprocess.

**Free tier limits:** 1 tunnel, URL changes per restart, ~40 req/min, 8-hour sessions.
**Paid ($8/mo):** Static domain that never changes — eliminates Vercel redeploy hassle.

---

## Part E: Frontend (React + Vite)

### Project Structure

```
stemflow/
├── api/                          # Vercel serverless functions
│   ├── _lib/
│   │   ├── db.js                # MongoDB + Mongoose + GridFS
│   │   └── auth.js              # JWT + CORS helpers
│   ├── auth/
│   │   ├── signup.js            # POST /api/auth/signup
│   │   ├── signin.js            # POST /api/auth/signin
│   │   └── me.js                # GET  /api/auth/me
│   ├── projects/
│   │   ├── index.js             # GET + POST /api/projects
│   │   └── [id].js              # GET + DELETE /api/projects/:id
│   └── stems/
│       └── [id].js              # GET /api/stems/:gridfs_id  ← audio stream
├── src/
│   ├── components/
│   │   ├── AuthScreen.jsx
│   │   ├── Dashboard.jsx
│   │   ├── Uploader.jsx
│   │   ├── ProjectList.jsx
│   │   └── StemPlayer.jsx
│   ├── hooks/useAuth.jsx
│   ├── lib/api.js               # HTTP client + stemURL() helper
│   ├── App.jsx, main.jsx, index.css
├── colab_backend.py
├── package.json, vite.config.js, tailwind.config.js, vercel.json
└── .env.example
```

### Key Concept: stemURL()

```js
stemURL("665fa1b2c3d4e5f6a7b8c9d0")
// → "/api/stems/665fa1b2c3d4e5f6a7b8c9d0"
```

This becomes the `<audio src="...">`. The Vercel function streams MP3 from GridFS.

---

## Part F: Vercel Serverless API Routes

| Method | Path               | Auth? | Purpose                              |
|--------|--------------------|-------|--------------------------------------|
| POST   | /api/auth/signup   | No    | Create account, return JWT           |
| POST   | /api/auth/signin   | No    | Login, return JWT                    |
| GET    | /api/auth/me       | Yes   | Validate token                       |
| GET    | /api/projects      | Yes   | List user's projects                 |
| POST   | /api/projects      | Yes   | Save project (name + 4 GridFS IDs)   |
| GET    | /api/projects/[id] | Yes   | Get single project                   |
| DELETE | /api/projects/[id] | Yes   | Delete project + GridFS stems        |
| GET    | /api/stems/[id]    | No    | Stream MP3 from GridFS               |

The `/api/stems/[id]` route supports HTTP Range headers for audio seeking.

---

## Part G: Deploy to Vercel

### Step 1: Push to GitHub

```bash
cd stemflow
git init && git add . && git commit -m "StemFlow"
git remote add origin https://github.com/YOU/stemflow.git
git push -u origin main
```

### Step 2: Import to Vercel

vercel.com → Add New Project → select repo → Framework: Vite → Root: ./

### Step 3: Set Environment Variables

Vercel → Settings → Environment Variables:

| Name                 | Value                                                               |
|----------------------|---------------------------------------------------------------------|
| MONGODB_URI          | mongodb+srv://stemflow-app:PASS@stemflow-cluster.XXX.mongodb.net/stemflow?... |
| JWT_SECRET           | (random 64-char hex string)                                        |
| VITE_COLAB_API_URL   | https://xxxx.ngrok-free.app                                        |

Generate JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Step 4: Deploy

Click Deploy → live at https://stemflow-xxx.vercel.app

### Updating Ngrok URL

New Colab session → new URL → update VITE_COLAB_API_URL in Vercel → **Redeploy**.

---

## Part H: End-to-End Testing

1. **Colab health:** `curl https://NGROK_URL/`
2. **Test separation:** `curl -X POST https://NGROK_URL/separate -F "file=@song.mp3"`
3. **Verify in Compass:** Refresh stems.files → 4 new documents
4. **Test streaming:** `curl -I https://VERCEL_URL/api/stems/GRIDFS_ID`
5. **Browser flow:** Upload → play → seek → volume → download → refresh → persists

---

## Troubleshooting

| Problem                               | Solution                                                                |
|----------------------------------------|-------------------------------------------------------------------------|
| Compass won't connect                  | Check 0.0.0.0/0 in Atlas Network Access. Verify password.              |
| stemflow database not visible          | Run the app first. Empty databases don't show. Click refresh in Compass.|
| Collections missing                    | Created lazily. Sign up → users appears. Separate → stems.* appear.    |
| Colab not responding                   | Re-run cell. Check Ngrok URL is current.                               |
| Audio won't play                       | Check /api/stems/ID returns 200 in DevTools Network tab.               |
| Demucs failed                          | Ensure T4 GPU runtime. Try shorter file. Check Colab cell stderr.      |
| Storage full (512 MB)                  | Delete old projects in the app. Check Atlas Metrics tab.               |
| Ngrok URL changed                      | Update VITE_COLAB_API_URL in Vercel and redeploy.                      |
| Password special chars in URI          | Use the exact string Atlas gives you (it auto-encodes).                |
| stems.files shows 0 documents          | Run a separation first. Colab creates these when uploading stems.      |

---

## Environment Variable Reference

**Total: 3 variables in Vercel + 1 in Colab**

| Variable              | Where Used         | Description                        |
|-----------------------|--------------------|------------------------------------|
| MONGODB_URI           | Vercel + Colab     | Atlas connection string            |
| JWT_SECRET            | Vercel only        | JWT signing key (64+ hex chars)    |
| VITE_COLAB_API_URL    | Vercel (frontend)  | Current Ngrok public URL           |
| NGROK_AUTH_TOKEN       | Colab only         | Ngrok auth token                   |

All three services (Vercel, Colab, Compass) use the **same MONGODB_URI** pointing
to the same `stemflow` database on the same `stemflow-cluster` in the same Atlas project.
