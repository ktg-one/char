# External Integrations

**Analysis Date:** 2026-06-14

## APIs & External Services

**LLM Providers (local-first, multiple backends):**
- LM Studio (local OpenAI-compatible) — Primary recommended path for companion chat and LocalSoundsAPI chatbot routes
  - Client: raw `requests` streaming POST to `{LMSTUDIO_API_BASE}/chat/completions` (default http://127.0.0.1:1234/v1)
  - Config: `config.py:LMSTUDIO_API_BASE`; companion-python/app.py allows per-request override via `openai_url`
  - Files: `LocalSoundsAPI/models/lmstudio.py`, `LocalSoundsAPI/routes/lmstudio.py`, `companion-python/app.py` (call_openai_compatible)
- Ollama (local OpenAI-compatible) — Supported via same compat layer
  - Default fallback URL in companion: http://localhost:11434/v1
  - Files: `companion-python/app.py:247`
- OpenRouter (cloud LLM proxy) — Optional cloud path
  - Client: `requests.Session` to https://openrouter.ai/api/v1 (models list + streaming chat)
  - Auth: `OPENROUTER_API_KEY` from `config.py` (placeholder value "sk-or-v1-[your-key-numbers]")
  - Headers include HTTP-Referer and X-Title
  - Files: `LocalSoundsAPI/models/openrouter.py`, `LocalSoundsAPI/routes/openrouter.py`, `LocalSoundsAPI/static/js/modules/backend-openrouter.js`

**TTS Fallback (companion only):**
- ElevenLabs (cloud TTS) — Fallback ONLY when LocalSoundsAPI fails AND key is present
  - Direct REST (no SDK): POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id} with xi-api-key header
  - Model: eleven_turbo_v2_5
  - Env vars: ELEVENLABS_API_KEY (or legacy VOICE_ID), ELEVENLABS_VOICE_ID
  - Files: `companion-python/app.py:360-384` (inside /tts route)

**Optional Google Path (companion only):**
- Google Gemini via Google ADK / google-genai — Secondary, only activated if user selects "Gemini" provider in UI
  - Lazy import of `google.adk.runners.InMemoryRunner` + `google.genai.types`
  - Character agent loaded from companion-python/character.py ONLY on first Gemini use
  - Files: `companion-python/app.py:14-95` (_load_character_for_gemini and chat route)

**Model Hosting / Auto-Download:**
- Hugging Face Hub — Used for on-demand model acquisition via `huggingface_hub.snapshot_download`
  - Kokoro-82M (hexgrad/Kokoro-82M) — `models/kokoro.py:68`
  - XTTS-v2 (coqui/XTTS-v2) — `models/xtts.py:124`
  - Fish Speech (fishaudio/openaudio-s1-mini, gated — requires HF_TOKEN) — `models/fish.py:95`
  - Stable Audio Open 1.0 (stabilityai/stable-audio-open-1.0) — `models/stable_audio.py:52`
  - ACE-Step (ACE-Step/ACE-Step-v1-3.5B) — `models/ace_step_loader.py:58`
  - Whisper models (via whisper.load_model download_root) — `models/whisper.py:30`
  - Auth: optional HF_TOKEN env for gated repos (Fish)

## Data Storage

**Databases:**
- None in active use
- SQLAlchemy + alembic + sqlite3 appear in companion-python/requirements.txt but produce zero matches in source grep — dead/transitive deps only
- Local JSON files used for all state: brain/*.json (system prompts, history, archives), job.json (per-project TTS job state), emotes.json, settings JSON

**File Storage:**
- Local filesystem only (no S3, GCS, etc.)
- Key directories (LocalSoundsAPI):
  - voices/ — Reference speaker audio for XTTS/Fish cloning
  - output_tts/ (temp_* and project folders) — Generated audio + job.json
  - projects_output/ — User-named persistent project folders
  - models/*/ — Downloaded model weights (XTTS-v2, fish-speech, kokoro-82m, stable-audio-open-1.0, ace_step, whisper .pt, clap, etc.)
- companion-python/data/ — emotes.json, system_prompt.txt
- companion-python/static/images/custom/ — User-uploaded emote PNGs

**Caching:**
- Per-voice Whisper timing cache: voices/{stem}_timing.json (word timestamps + text)
- No Redis / external cache

## Authentication & Identity

**Auth Provider:**
- None (no user accounts, sessions are in-memory or file-based)
- API keys only:
  - OpenRouter: stored in config.py (not env)
  - ElevenLabs: env var (ELEVENLABS_API_KEY)
  - Gemini: runtime-injected into os.environ["GEMINI_API_KEY"] when selected
  - HF (gated models): HF_TOKEN env var (Fish Speech only)

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry, no Rollbar, etc.)

**Logs:**
- Python logging (basicConfig to StreamHandler in main.py; custom LogCaptureHandler in logger.py for in-app buffer)
- Per-route print() with timestamps for job progress (heavy in infer_* routes)
- No structured logging, no log shipping

## CI/CD & Deployment

**Hosting:**
- None — fully local desktop application
- Launchers are Windows .bat only

**CI Pipeline:**
- None detected (no .github/workflows, no GitHub Actions, no railway/vercel/heroku config in source)

**Containerization (subprojects only, not used by main app):**
- LocalSoundsAPI/fish-speech/ has docker/Dockerfile + compose files
- LocalSoundsAPI/ACE-Step/ has Dockerfile + docker-compose.yaml
- Main LocalSoundsAPI and companion-python have no Docker support in their launch paths

## Environment Configuration

**Required env vars (for full feature set):**
- LOCAL_SOUNDS_URL — Points companion TTS at LocalSoundsAPI (default http://127.0.0.1:5006)
- ELEVENLABS_API_KEY — Only needed for ElevenLabs cloud TTS fallback
- HF_TOKEN — Only needed to download gated Fish Speech model (openaudio-s1-mini)
- GEMINI_API_KEY — Only needed at runtime if Gemini provider is selected in companion settings

**Config files (committed, user-editable):**
- LocalSoundsAPI/config.py — Most paths, device defaults, audio post-process params, OPENROUTER_API_KEY placeholder
- LocalSoundsAPI/settings/*.json — UI preset state (A_default.json etc.)
- companion-python/data/system_prompt.txt — Optional server-side custom system prompt
- companion-python/data/emotes.json — Custom emote definitions

**Secrets location:**
- OPENROUTER_API_KEY: plaintext in config.py (user must replace placeholder)
- All other keys: environment variables only (never committed)

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None (all HTTP is request/response; no registered callbacks, no Stripe, no external event sources)

---

*Integration audit: 2026-06-14*
