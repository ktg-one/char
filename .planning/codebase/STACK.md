# Technology Stack

**Analysis Date:** 2026-06-14

## Languages

**Primary:**
- Python 3.11 — Core application runtime (LocalSoundsAPI/python/ portable embed; .cpython-311.pyc files throughout LocalSoundsAPI/; python311._pth and python311.dll confirm)

**Secondary:**
- JavaScript (vanilla, ES modules) — Frontend UI logic only (LocalSoundsAPI/static/js/ and companion-python/static/)
- HTML + Jinja2 templates — Server-rendered UI (LocalSoundsAPI/templates/, companion-python/templates/)
- CSS — Styling (Bootstrap bundle + custom)

## Runtime

**Environment:**
- Windows desktop (primary target; Launch-*.bat, portable python + bin/ exes)
- Portable self-contained Python 3.11 distribution vendored at LocalSoundsAPI/python/
- No system Python dependency for LocalSoundsAPI; companion-python uses system `python` in its launcher

**Package Manager:**
- pip (pinned requirements.txt files)
- uv (used by fish-speech subproject; uv.lock present)
- Lockfile: requirements.txt (pinned, no lockfile for main app); uv.lock for fish-speech; package-lock.json at repo root is empty placeholder (no real Node deps)

## Frameworks

**Core:**
- Flask 3.x (Blueprints, Jinja2, Werkzeug) — Primary web server and API for both LocalSoundsAPI (main.py) and companion-python (app.py)
- Flask Blueprints extensively used for modular routes (LocalSoundsAPI/routes/__init__.py registers voice, chatbot, infer_*, lmstudio, openrouter, production, settings, etc.)

**ML / Audio:**
- PyTorch (torch, torchaudio, torchvision) — Core tensor engine for all TTS, music, and audio models
- Hugging Face Transformers + Diffusers — Model loading (StableAudioPipeline, etc.)
- Coqui TTS (`from TTS.api import TTS`) — XTTS-v2 loader (models/xtts.py)
- kokoro package (`from kokoro import KPipeline`) — Kokoro-82M inference (models/kokoro.py)
- llama-cpp-python (`from llama_cpp import Llama`) — Direct GGUF local LLM inference with tensor splitting (models/llama.py)
- OpenAI Whisper package (`import whisper`) — Local transcription + verification (models/whisper.py)
- Fish Speech — Vendored source (fish-speech/fish_speech/), invoked exclusively via subprocess (models/fish.py, routes/infer_fish.py)
- ACE-Step — Vendored (ACE-Step/acestep/), pipeline loaded directly (models/ace_step_loader.py, routes/ace_step.py)
- Stable Audio — diffusers.StableAudioPipeline + CLAP scoring (models/stable_audio.py)

**HTTP / Async:**
- httpx (async, companion-python/app.py for chat/TTS proxying)
- requests (sync streaming to LM Studio / OpenRouter)

**Audio Processing:**
- soundfile, numpy, scipy, librosa, pydub (with portable ffmpeg), pyloudnorm, noisereduce, torchaudio.transforms
- rubberband (vendored exe for pitch/timing)

**Frontend / Templating:**
- Jinja2 (Flask templates)
- Vanilla JS + Bootstrap 5 bundle (no bundler, no React/Vue/Svelte)

**Optional / Secondary:**
- google-genai + google-adk (only for Gemini provider in companion-python; lazily imported)
- gradio, uvicorn, lightning, hydra-core (in fish-speech and ACE-Step subprojects)
- mcp (listed in companion-python/requirements.txt; not imported in app source)

## Key Dependencies

**Critical (LocalSoundsAPI):**
- torch / torchaudio / torchvision — All inference
- TTS (Coqui) — XTTS
- kokoro — Kokoro TTS
- llama-cpp — Local GGUF chat
- whisper (OpenAI) — Transcription + verification
- huggingface_hub — snapshot_download for auto model acquisition (Kokoro, XTTS, Fish, Stable Audio, ACE-Step)
- soundfile, numpy, scipy, pydub — Audio I/O and post-processing
- Flask — Web server
- pydantic, pydantic-settings — Config (limited use)

**Critical (companion-python):**
- Flask + Jinja2 + Werkzeug
- httpx (async chat + TTS proxy)
- python-dotenv
- google-adk + google-genai (conditional)
- ElevenLabs direct REST fallback (no SDK)

**Infrastructure / Tools (vendored in LocalSoundsAPI/bin/):**
- ffmpeg + ffprobe (for format conversion, used by pydub and explicit subprocess)
- rubberband (pitch/time adjustment)
- espeak-ng (required by Kokoro phonemizer; DLL + data wired in models/kokoro.py and config.py)

**Subproject manifests:**
- LocalSoundsAPI/fish-speech/pyproject.toml — fish-speech with torch extras (cpu/cu126/cu128/cu129 via uv)
- LocalSoundsAPI/ACE-Step/requirements.txt + setup.py — ACE-Step music gen

## Configuration

**Environment:**
- LocalSoundsAPI/config.py — Hardcoded paths + constants (VOICE_DIR, OUTPUT_DIR, model paths, padding/trim params per engine, OPENROUTER_API_KEY placeholder, LLM_DIRECTORY, LMSTUDIO_API_BASE, device resolver)
- companion-python/app.py — load_dotenv(); env vars: LOCAL_SOUNDS_URL (for sibling LocalSoundsAPI), ELEVENLABS_API_KEY / VOICE_ID (fallback), GEMINI_API_KEY (runtime), HOST/PORT
- No .env committed; keys either in config.py (placeholder) or user env

**Build / Runtime:**
- Portable launchers: LocalSoundsAPI/(portable) LocalSoundsAPI-*.bat set PATH to bundled python/ + bin/ then exec main.py
- Launch-Luna.bat — Orchestrates LocalSoundsAPI on 5006 + companion-python on 5000
- No build step for main app; subprojects have their own (setup.py for ACE, uv for fish)

## Platform Requirements

**Development:**
- Windows 10/11 (bat scripts, .exe tools, portable python)
- NVIDIA GPU strongly recommended (CUDA device selection pervasive; "0" or "cuda:0" patterns in config and all loaders)
- ~ tens of GB disk for models (auto-downloaded to LocalSoundsAPI/models/)
- The vendored LocalSoundsAPI/python/ is a full Python 3.11 distribution (excluded from searches)

**Production:**
- Same as dev — designed as local desktop companion, not a hosted service
- Optional Dockerfiles exist inside fish-speech/ and ACE-Step/ but are not used by the main launch flow

---

*Stack analysis: 2026-06-14*
