# Cell 1: Install dependencies and ngrok
import subprocess, os

print("Installing Python packages...")
!pip install -q demucs fastapi uvicorn python-multipart pymongo

# Remove any pyngrok wrapper pretending to be ngrok
if os.path.exists("/usr/local/bin/ngrok"):
    if os.path.getsize("/usr/local/bin/ngrok") < 1_000_000:
        os.remove("/usr/local/bin/ngrok")

print("\nDownloading ngrok binary...")

INSTALLED = False

# Official ngrok install script
if not INSTALLED:
    print("  Trying official install script...")
    r = subprocess.run("curl -sSL https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null && echo 'deb https://ngrok-agent.s3.amazonaws.com buster main' | sudo tee /etc/apt/sources.list.d/ngrok.list && sudo apt-get update -qq && sudo apt-get install -qq -y ngrok", shell=True, capture_output=True, text=True)
    if subprocess.run(["which", "ngrok"], capture_output=True).returncode == 0:
        INSTALLED = True
        print("Installed via apt")


# Cell 2: Set up configuration variables and test MongoDB connection

# Get your free token at: https://dashboard.ngrok.com/get-started/your-authtoken
NGROK_AUTH_TOKEN = "3ArDqpVgQ6oSUDQSJU4KPDpsogZ_3vXGC9qAiJ1GVMrEs8rSY"

# MongoDB Atlas connection string (same one used in Vercel .env and Compass)
MONGODB_URI = "mongodb+srv://stemflow-app:4bJ05OF95mvhijhd@stemflow-cluster.ttsgags.mongodb.net/stemflow?appName=stemflow-cluster"

assert NGROK_AUTH_TOKEN != "YOUR_NGROK_AUTH_TOKEN_HERE", \
    "Set NGROK_AUTH_TOKEN! Get it from https://dashboard.ngrok.com"
assert MONGODB_URI != "YOUR_MONGODB_URI_HERE", \
    "Set MONGODB_URI! Get it from MongoDB Atlas → Connect → Drivers"
assert MONGODB_URI.startswith("mongodb"), \
    "MONGODB_URI should start with 'mongodb://' or 'mongodb+srv://'"

from pymongo import MongoClient
print("Testing MongoDB connection...")
try:
    _c = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=10000)
    _d = _c.get_default_database()
    _d.command("ping")
    print(f"Connected to database: '{_d.name}'")
    _c.close()
    del _c, _d
except Exception as e:
    print(f"Failed: {e}")
    print("   Check: connection string, network access (0.0.0.0/0), password encoding")
    raise

print(f"Ngrok token ready ({len(NGROK_AUTH_TOKEN)} chars)")
print("\nCell 2 complete. Proceed to Cell 3.")


# Cell 3: Main backend code (FastAPI + ngrok setup)
import os
import uuid
import shutil
import subprocess
import time
import json
import signal
import requests as req
from pathlib import Path
from threading import Thread

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

from pymongo import MongoClient
from gridfs import GridFS

# ─── Step 1: Kill anything leftover from previous runs ─────────────
print("Cleaning up previous processes...")
subprocess.run(["pkill", "-f", "ngrok"], capture_output=True)
subprocess.run(["pkill", "-f", "uvicorn"], capture_output=True)
# Also kill anything on port 8000
subprocess.run(["fuser", "-k", "8000/tcp"], capture_output=True)
time.sleep(2)
print("Clean")

# ─── Step 2: Authenticate ngrok binary ─────────────────────────────
print("\nAuthenticating ngrok...")
r = subprocess.run(
    ["ngrok", "config", "add-authtoken", NGROK_AUTH_TOKEN],
    capture_output=True, text=True,
)
if r.returncode == 0:
    print("ngrok authenticated")
else:
    print(f"ngrok auth output: {r.stderr.strip()}")

# ─── Step 3: Connect MongoDB + GridFS ──────────────────────────────
print("\nConnecting to MongoDB Atlas...")
mongo_client = MongoClient(MONGODB_URI)
db = mongo_client.get_default_database()
gridfs_bucket = GridFS(db, collection="stems")
print(f" Database: '{db.name}'")

# ─── Step 4: FastAPI App ──────────────────────────────────────────
app = FastAPI(title="StemFlow AI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path("/content/uploads")
OUTPUT_DIR = Path("/content/separated")
UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)


@app.get("/")
async def health():
    return {
        "status": "ok",
        "service": "StemFlow Colab Backend",
        "storage": "MongoDB GridFS",
        "database": db.name,
        "gpu": True,
    }


@app.post("/separate")
async def separate_audio(file: UploadFile = File(...)):
    """Full pipeline: receive → Demucs GPU → WAV→MP3 → GridFS → return IDs"""

    allowed = [
        "audio/mpeg", "audio/wav", "audio/x-wav",
        "audio/flac", "audio/ogg", "application/octet-stream",
    ]
    if file.content_type not in allowed:
        raise HTTPException(400, f"Unsupported: {file.content_type}")

    job_id = str(uuid.uuid4())[:12]
    safe_name = file.filename.replace(" ", "_")
    input_path = UPLOAD_DIR / f"{job_id}_{safe_name}"

    # Save upload
    try:
        contents = await file.read()
        with open(input_path, "wb") as f:
            f.write(contents)
        print(f"\n[{job_id}] Saved: {input_path.name} ({len(contents)/1048576:.1f} MB)")
    except Exception as e:
        raise HTTPException(500, f"Save failed: {e}")

    # Demucs
    try:
        print(f"🎵 [{job_id}] Running Demucs htdemucs_ft on GPU...")
        t0 = time.time()
        result = subprocess.run(
            ["python", "-m", "demucs.separate",
             "-n", "htdemucs_ft", "-d", "cuda",
             "-o", str(OUTPUT_DIR), str(input_path)],
            capture_output=True, text=True, timeout=600,
        )
        elapsed = time.time() - t0
        if result.returncode != 0:
            print(f"[{job_id}] Demucs error:\n{result.stderr[-400:]}")
            raise HTTPException(500, f"Demucs failed: {result.stderr[-200:]}")
        print(f"[{job_id}] Separated in {elapsed:.0f}s")
    except subprocess.TimeoutExpired:
        raise HTTPException(504, "Timed out (>10 min)")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Demucs error: {e}")

    # Find stems
    file_stem = input_path.stem
    stems_dir = OUTPUT_DIR / "htdemucs_ft" / file_stem
    if not stems_dir.exists():
        hits = list((OUTPUT_DIR / "htdemucs_ft").glob(f"{file_stem}*"))
        stems_dir = hits[0] if hits else None
        if not stems_dir:
            raise HTTPException(500, f"Output not found for {job_id}")

    # Convert + upload
    stem_ids = {}
    print(f"[{job_id}] Converting + uploading to GridFS...")

    for name in ["vocals", "drums", "bass", "other"]:
        wav = stems_dir / f"{name}.wav"
        mp3 = stems_dir / f"{name}.mp3"

        if not wav.exists():
            print(f"{name}.wav missing")
            stem_ids[name] = ""
            continue

        # WAV → MP3
        try:
            subprocess.run(
                ["ffmpeg", "-y", "-i", str(wav),
                 "-codec:a", "libmp3lame", "-b:a", "128k", "-ar", "44100",
                 str(mp3)],
                capture_output=True, timeout=120, check=True,
            )
        except Exception as e:
            print(f"ffmpeg ({name}): {e}")
            stem_ids[name] = ""
            continue

        # GridFS upload
        try:
            sz = mp3.stat().st_size
            with open(mp3, "rb") as f:
                gid = gridfs_bucket.put(
                    f,
                    filename=f"{job_id}_{name}.mp3",
                    content_type="audio/mpeg",
                    metadata={
                        "job_id": job_id, "stem": name,
                        "original_file": safe_name,
                        "contentType": "audio/mpeg",
                    },
                )
            stem_ids[name] = str(gid)
            print(f"{name}: {sz/1048576:.1f} MB → {gid}")
        except Exception as e:
            print(f"GridFS ({name}): {e}")
            stem_ids[name] = ""

    # Cleanup
    try:
        os.remove(input_path)
        shutil.rmtree(stems_dir, ignore_errors=True)
    except Exception:
        pass

    print(f"[{job_id}] Done!\n")
    return JSONResponse(content={
        "job_id": job_id,
        "vocals": stem_ids.get("vocals", ""),
        "drums": stem_ids.get("drums", ""),
        "bass": stem_ids.get("bass", ""),
        "other": stem_ids.get("other", ""),
    })


# ─── Step 5: Start server ─────────────────────────────────────────
print("\nStarting FastAPI on port 8000...")

def run_server():
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="warning")

server_thread = Thread(target=run_server, daemon=True)
server_thread.start()
time.sleep(3)

# Verify
try:
    r = req.get("http://127.0.0.1:8000/", timeout=5)
    print(f"Server running: {r.json()['status']}")
except Exception as e:
    print(f"Server check failed: {e}")
    print("   It might still be starting — continuing...")

# ─── Step 6: Start ngrok tunnel (binary, NOT pyngrok) ─────────────
print("\nStarting ngrok tunnel...")

ngrok_proc = subprocess.Popen(
    ["ngrok", "http", "8000", "--log=stdout", "--log-format=json"],
    stdout=subprocess.PIPE, stderr=subprocess.PIPE,
)
time.sleep(5)

# Get public URL from ngrok's local API
public_url = None
for attempt in range(15):
    try:
        r = req.get("http://127.0.0.1:4040/api/tunnels", timeout=3)
        for t in r.json().get("tunnels", []):
            if t.get("proto") == "https":
                public_url = t["public_url"]
                break
        if public_url:
            break
    except Exception:
        pass
    time.sleep(2)

if public_url:
    print("\n" + "=" * 65)
    print(f"PUBLIC API URL:  {public_url}")
    print("=" * 65)
    print(f"\nSet as VITE_COLAB_API_URL in Vercel environment variables")
    print(f"Test:  {public_url}/")
    print(f"MongoDB database: '{db.name}'")
else:
    print("\nCould not get tunnel URL from ngrok API.")
    print("\nTry manually in a new cell:")
    print("   !curl -s http://127.0.0.1:4040/api/tunnels | python3 -m json.tool")
    print("   Look for 'public_url' in the output.")

print(f"\nReady! Waiting for requests...\n")

# Keep alive
try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    print("\nStopping...")
    subprocess.run(["pkill", "-f", "ngrok"], capture_output=True)