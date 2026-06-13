<!-- refreshed: 2026-06-14 -->
# Architecture

**Analysis Date:** 2026-06-14

## System Overview

```text
┌─────────────────────────────────────────────────────────────────┐
│                        Web UI (Browser)                          │
│  Jinja2 templates + vanilla JS modules (dynamic import)          │
│  `LocalSoundsAPI/templates/` + `LocalSoundsAPI/static/js/`       │
├─────────────────────────────────────────────────────────────────┤
│                      Flask Application                           │
│  `LocalSoundsAPI/main.py` (entry)                                │
│  • register_blueprints() → routes/__init__.py                    │
│  • /file/<path> static file server (whitelist by extension)      │
├──────────────────┬──────────────────┬───────────────────────────┤
│   TTS Routes     │  Music Routes    │   LLM/Chatbot Routes      │
│  infer_xtts.py   │  stable_audio.py │  chatbot.py (local llama) │
│  infer_fish.py   │  ace_step.py     │  lmstudio.py (proxy)      │
│  infer_kokoro.py │                  │  openrouter.py (proxy)    │
│  voice.py        │                  │  voice_transcribe.py      │
├──────────────────┴──────────────────┴───────────────────────────┤
│                      Model Adapters (models/)                    │
│  xtts.py | fish.py | kokoro.py | whisper.py | llama.py          │
│  stable_audio.py | ace_step_loader.py | lmstudio.py | openrouter.py
├─────────────────────────────────────────────────────────────────┤
│  External Subsystems (integrated, not vendored logic)            │
│  • ACE-Step/ (acestep/ pipeline + infer-api.py)                  │
│  • fish-speech/ (fish_speech/ inference + tools)                 │
├─────────────────────────────────────────────────────────────────┤
│  Output & State                                                  │
│  • output_tts/ (temp + job artifacts)                            │
│  • projects_output/ (named save jobs)                            │
│  • voices/ (reference audio for cloning)                         │
│  • brain/ (system_prompt.json + context_history/*.json)          │
│  • settings/*.json (UI preset snapshots)                         │
└─────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| `main.py` | Flask app bootstrap, blueprint registration, file serving, startup cleanup | `LocalSoundsAPI/main.py` |
| `routes/__init__.py` | Central blueprint aggregator, `register_blueprints(app)` | `LocalSoundsAPI/routes/__init__.py` |
| `routes/infer_*.py` | TTS generation pipelines (XTTS/Fish/Kokoro) with chunking, retry, Whisper verify, job.json tracking, cancellation, assembly | `LocalSoundsAPI/routes/infer_xtts.py`, `infer_fish.py`, `infer_kokoro.py` |
| `routes/model.py` | Model load/unload/status endpoints for XTTS, Fish, Kokoro, Whisper | `LocalSoundsAPI/routes/model.py` |
| `routes/chatbot.py` | Local llama.cpp backend: model load/unload/infer + brain system (prompts + history + archives) | `LocalSoundsAPI/routes/chatbot.py` |
| `routes/lmstudio.py` | Proxy to LM Studio OpenAI-compatible endpoint, streaming | `LocalSoundsAPI/routes/lmstudio.py` |
| `routes/openrouter.py` | Proxy to OpenRouter, model list + streaming inference | `LocalSoundsAPI/routes/openrouter.py` |
| `routes/production.py` | Media upload, Whisper transcription (word-timed), SRT + timing.json, video assembly via FFmpeg | `LocalSoundsAPI/routes/production.py` |
| `routes/ace_step.py` | ACE-Step music gen: load/unload/infer, multi-variant + CLAP ranking, save or base64 | `LocalSoundsAPI/routes/ace_step.py` |
| `routes/stable_audio.py` | Stable Audio 1.0 gen: load/unload/infer, CLAP scoring, save or base64 | `LocalSoundsAPI/routes/stable_audio.py` |
| `routes/settings_manager.py` | CRUD for UI preset JSON files under `settings/` | `LocalSoundsAPI/routes/settings_manager.py` |
| `routes/admin.py` | Shutdown (unload all + kill ffmpeg/rubberband) | `LocalSoundsAPI/routes/admin.py` |
| `routes/voice.py` | Voice file list, upload, refresh for cloning references | `LocalSoundsAPI/routes/voice.py` |
| `routes/voice_transcribe.py` | Voice reference transcription (word-timed) with device-smart reload + cancel | `LocalSoundsAPI/routes/voice_transcribe.py` |
| `routes/static.py` | Home template render, simple status probes, audio passthrough | `LocalSoundsAPI/routes/static.py` |
| `models/xtts.py` | Coqui XTTS-v2 lazy load/unload, built-in + cloned speakers | `LocalSoundsAPI/models/xtts.py` |
| `models/fish.py` | FishSpeech (OpenAudio S1-mini) subprocess wrapper + `FishSpeechDemo` class | `LocalSoundsAPI/models/fish.py` |
| `models/kokoro.py` | Kokoro-82M KPipeline load/unload, 20 English voices | `LocalSoundsAPI/models/kokoro.py` |
| `models/whisper.py` | OpenAI Whisper (medium.en default) load/unload for verification + transcription | `LocalSoundsAPI/models/whisper.py` |
| `models/llama.py` | llama.cpp GGUF load (thread-locked, tensor_split GPU pinning) + streaming infer | `LocalSoundsAPI/models/llama.py` |
| `models/stable_audio.py` | Stable Audio 1.0 + CLAP scoring pipeline | `LocalSoundsAPI/models/stable_audio.py` |
| `models/ace_step_loader.py` | ACE-Step 3.5B pipeline adapter (via ACE-Step/acestep/) | `LocalSoundsAPI/models/ace_step_loader.py` |
| `models/lmstudio.py` | LM Studio client (OpenAI /v1 chat/completions streaming) | `LocalSoundsAPI/models/lmstudio.py` |
| `models/openrouter.py` | OpenRouter client (Bearer + streaming SSE) | `LocalSoundsAPI/models/openrouter.py` |
| `config.py` | Path constants, device resolver, per-TTS post-process tuning params | `LocalSoundsAPI/config.py` |
| `text_utils.py` | Hierarchical chunkers (`split_text_*`) + Whisper sanitization | `LocalSoundsAPI/text_utils.py` |
| `save_utils.py` | `handle_save()`: temp → final path + relative POSIX path | `LocalSoundsAPI/save_utils.py` |
| `tools.py` | Portable tool wiring (ffmpeg/ffprobe/rubberband PATH) + verification | `LocalSoundsAPI/tools.py` |
| `companion-python/app.py` | Separate Flask app: Luna visual companion, emote system, mouth sync | `companion-python/app.py` |
| `companion-python/character.py` | Gemini ADK agent definition (ONLY loaded when Gemini backend selected) | `companion-python/character.py` |

## Pattern Overview

**Overall:** Modular Flask monolith with lazy-loaded model adapters and per-domain inference pipelines.

**Key Characteristics:**
- **Blueprints for route domains** — each major capability (TTS model, music model, LLM backend, production tools, settings, admin) owns its blueprint(s)
- **Lazy model lifecycle** — models load on first use or explicit `/load`, unload on explicit `/unload` or shutdown; device changes trigger reload
- **Job-oriented long jobs** — TTS/music gens create `job.json` under `projects_output/<name>/` or `output_tts/temp_*` for progress, recovery (`##recover##`), and crash safety
- **Chunk → verify → retry loop** — long text splits into chunks; each chunk runs generation → optional Whisper verification → post-process; failures retry (default 3) before permanent fail
- **Streaming LLM** — all three backends (local llama.cpp, LM Studio, OpenRouter) stream tokens as plain text over SSE
- **Shared brain state** — chatbot routes and frontend share `/chatbot/brain/*` endpoints for system prompt (with file-based presets) and rolling context history (current + timestamped archives)
- **Preset snapshots** — UI settings serialized to `settings/<name>.json` via `/settings/*` for reproducible sessions
- **Portable bins** — ffmpeg, rubberband, espeak-ng bundled under `bin/`; `tools.py` wires them at startup

## Layers

**Web / Presentation:**
- Purpose: Render UI shell + serve static assets; dynamic module loading for feature groups
- Location: `LocalSoundsAPI/templates/` (Jinja2) + `LocalSoundsAPI/static/` (css/js)
- Contains: `base.html`, per-row includes, `app.js` (bootstrap + dynamic imports), `modules/*.js` (feature-isolated), `production.js`
- Depends on: Flask `url_for`, browser fetch/EventSource
- Used by: Browser only

**API / Routes:**
- Purpose: HTTP surface for every capability; orchestration of model calls + post-processing + persistence
- Location: `LocalSoundsAPI/routes/`
- Contains: One file per major domain (infer_*, model, chatbot, lmstudio, openrouter, production, ace_step, stable_audio, settings_manager, admin, voice, voice_transcribe, static)
- Depends on: `models/*`, `config`, `text_utils`, `save_utils`, `audio_post*`
- Used by: Web layer (and direct clients)

**Model Adapters:**
- Purpose: Encapsulate third-party model loading, device handling, and high-level inference wrappers
- Location: `LocalSoundsAPI/models/`
- Contains: One file per backend (xtts, fish, kokoro, whisper, llama, stable_audio, ace_step_loader, lmstudio, openrouter) + supporting state modules
- Depends on: External packages (TTS, fish_speech via subprocess, kokoro, whisper, llama_cpp, diffusers, etc.), `config.resolve_device()`
- Used by: Routes layer only (never imported by templates or JS)

**Subsystems (vendored but not reimplemented):**
- Purpose: Provide full inference stacks for ACE-Step (music) and Fish Speech (TTS)
- Location: `LocalSoundsAPI/ACE-Step/`, `LocalSoundsAPI/fish-speech/`
- Contains: Their own `acestep/` / `fish_speech/` packages, pipelines, trainers, CLIs
- Depends on: Their own requirements + model weights under `models/`
- Used by: Model adapters invoke their entry points (subprocess for fish, direct import path hack for ACE-Step)

**Configuration & State:**
- Purpose: Centralize paths, tuning constants, secrets (keys), and user-authored prompt/podcast scripts
- Location: `LocalSoundsAPI/config.py`, `settings/*.json`, `brain/*.json`, `brain/context_history/`
- Contains: Path constants, device resolver, per-model post-process params (padding, LUFS, silence trim), preset JSONs, system prompts, chat archives
- Depends on: `pathlib`, `torch` (for CUDA detection in resolver)
- Used by: Everything

**Companion (separate process):**
- Purpose: Visual character (Luna) with emote-driven face swaps + mouth open/close sync; optional Gemini ADK path
- Location: `companion-python/`
- Contains: Its own Flask app (`app.py`), character definition (`character.py`, only for Gemini), emote data (`data/emotes.json`), static images + client JS
- Depends on: Its own `requirements.txt`; talks to LocalSoundsAPI TTS via URL config
- Used by: Independent browser tab (different port)

## Data Flow

### Primary TTS Generation Path (XTTS / Fish / Kokoro)

1. **UI click** → `generate-*.js` builds payload from form fields (`LocalSoundsAPI/static/js/modules/generate-*.js`)
2. **POST /infer or /fish_infer or /kokoro_infer** → route handler (`routes/infer_*.py`)
3. **Chunking** → `text_utils.split_text_*()` produces ≤N-char chunks
4. **Job setup** → create `job.json` under `projects_output/<name>/` or `output_tts/temp_*` with `chunks[]`, `chunks_completed`, `parameters`, `missing_files`
5. **Per-chunk loop**:
   - Auto-load model if not loaded (device from UI or config default)
   - Generate raw wav via model adapter
   - Post-process (audio_post_*.py: de-reverb, de-ess, trim, LUFS)
   - Optional: Whisper verification (transcribe chunk → compare to source text within tolerance)
   - On verify fail → `handle_save(..., always_save_fails=True)`, raise → retry path
   - On success → move to `chunk_###.wav`, `_update_chunk_success(job_file, i, dur)`
6. **Cancellation** → `/xtts_cancel` etc. puts token in shared `queue.Queue`; loop checks `is_cancelled()`
7. **Recovery** → if text == `"##recover##"` + `save_path`, reload job.json, resume from `chunks_completed`
8. **Final assembly** → if all chunks present: pad + inter-chunk silence + pad → optional ffmpeg convert → write `*_final.<fmt>`
9. **Response** → if `save_path` provided: JSON `{filename, saved_to, saved_rel, ...}`; else base64 + unlink temp

### Music Generation Path (Stable Audio / ACE-Step)

1. UI → POST `/stable_infer` or `/ace_infer`
2. Route validates, resolves save vs. play-in-browser
3. Auto-load if needed
4. Generate N variants (`num_waveforms_per_prompt`)
5. Post-process each (audio_post.py helpers)
6. Score each with CLAP (`score_with_clap` or integrated)
7. Sort by score descending; first is "BEST"
8. If save: convert format, `handle_save`, return `{saved_files: [{filename, rel_path, score, is_best, seed?}, ...]}`
9. Else: base64 each, unlink temps, return `{audios: [{audio_base64, score, is_best}, ...]}`

### Chatbot Inference Path (any backend)

1. UI (`chatbot-core.js`) reads 6 inference sliders + system prompt from `/chatbot/brain/system_prompt`
2. Builds `payloadMessages = [{role:"system", ...}, ...history]`
3. Chooses endpoint by backend select: `/chatbot/infer | /lmstudio/infer | /openrouter/infer`
4. For local: ensure model loaded via `/chatbot/load` (if not already)
5. POST → route streams tokens as plain text chunks (SSE `data: ...`)
6. Frontend accumulates into assistant message bubble, re-renders
7. On done: `saveHistory()` POSTs clean history (no system) to `/chatbot/brain/history`
8. "Send to TTS" buttons copy assistant text into target input

### Brain / Prompt Management

- `system_prompt.json` (default) + user-named `*.json` under `brain/`
- `GET/POST /chatbot/brain/system_prompt?file=...` — load/save; on save with filename, also writes named copy
- `DELETE /chatbot/brain/system_prompt?delete=...` — cannot delete active
- `GET /chatbot/brain/list_system_prompts` — all except `system_prompt.json` + `current.json`
- History: `current.json` (rolling), archives under `context_history/archives/`
- `POST /chatbot/brain/save_archive` — timestamp + sanitized name
- Archives loadable; on load, prepends to existing (keeps current system)

### Production Video Path

1. Upload media (audio + images/video) to project dir via `/production/upload_media`
2. Select audio → `/production/transcribe` → Whisper word timestamps → write `*.srt` (3-word lines) + `*_timing.json`
3. `/production/make_video` → read SRT, build FFmpeg filtergraph per resolution/mode (transparent/color/images)
4. Output `video_<stem>_<res>.mp4` or `_alpha.webm`

### File Serving

- `/file/<filename>?rel=<posix-or-windows-path>` — only serves if `rel` basename matches and extension in whitelist; otherwise 400/404
- `/audio/<filename>` — legacy passthrough from OUTPUT_DIR or VOICE_DIR
- Static assets via Flask `static/` as usual

## Key Abstractions

**Job State (`job.json`):**
- Purpose: Crash-safe, resumable long-running generation record
- Examples: `projects_output/MyPodcast/job.json`, `output_tts/temp_fish_123/job.json`
- Pattern: Written at start with `chunks[]` skeleton; mutated in place via seek+truncate for `chunks_completed`, per-chunk `duration_sec`/`verification_passed`/`processing_error`, `status`, `final_file`, `missing_files`

**Model Handle Globals (per adapter):**
- Pattern: Module-level `tts_model`, `model_loaded`, `pipeline`, `fish_loaded`, `whisper_model`, `llm`, etc.
- Lifecycle: `load_*` sets them; `unload_*` dels + `torch.cuda.empty_cache()`
- Device awareness: many adapters track `_current_device` or `device_id`; load checks and reloads on mismatch

**Chunk Splitters (`text_utils.py`):**
- Hierarchical: sentences → clauses → words; merge tiny follow-on chunks (<30/40 chars)
- Per-model limits: XTTS 250, Fish 300, Kokoro 500 (tuned for quality vs. latency)

**Brain Messages:**
- Always starts with `{role:"system", content: <current system prompt>}`
- History POSTs exclude system; on load, system is re-fetched and prepended
- Archives store only user/assistant turns

**Device Resolution (`config.resolve_device`):**
- Accepts: `None` (auto cuda:0 or cpu), `"cpu"`, `"0"`, `"1"`, `"cuda:0"`
- Returns canonical `"cuda:N"` or `"cpu"`
- Used uniformly by all model loads

## Entry Points

**LocalSoundsAPI (primary service):**
- Location: `LocalSoundsAPI/main.py`
- Triggers: `python main.py --port 5006` (or the .bat wrappers)
- Responsibilities: create Flask app, register all blueprints, mkdir VOICE/OUTPUT, `load_speakers()`, run werkzeug on 0.0.0.0 with threaded=True, processes=1

**Companion (visual character):**
- Location: `companion-python/app.py`
- Triggers: `python app.py` (separate port)
- Responsibilities: serve Luna UI, manage emotes, proxy TTS calls to LocalSoundsAPI, optional Gemini ADK path

**Standalone CLIs (subsystems):**
- ACE-Step: `infer.py`, `trainer.py`, `infer-api.py`, `trainer-api.py`
- Fish Speech: its own CLI entrypoints under `fish-speech/`

## Architectural Constraints

- **Threading:** Flask dev server with `threaded=True, processes=1`. Long jobs (TTS, music, transcription) run on worker threads; model loads are synchronous and can block. llama.cpp load is protected by `model_lock` (threading.Lock) + `loading_in_progress` flag.
- **Global mutable state:** All model adapters use module-level singletons (`tts_model`, `pipeline`, `llm`, `whisper_model`, etc.). No DI container. Unload is best-effort; crashes can leave stale VRAM until process restart.
- **Device pinning:** llama.cpp uses `tensor_split` + `main_gpu` to force a specific GPU at construction time; cannot move after load. Other models support reload-on-device-change.
- **No auth:** All endpoints are open on LAN. OPENROUTER_API_KEY lives in `config.py` (plaintext).
- **Path assumptions:** Many paths are relative to APP_ROOT (repo checkout). Portable mode expects `bin/`, `models/`, `voices/`, `settings/`, `brain/` alongside `main.py`.
- **Circular risk:** `models/__init__.py` re-exports many symbols; `routes/model.py` imports from `models.*` directly. Within a domain the split is clean (routes orchestrate, models adapt).

## Anti-Patterns

### God-Size Inference Routes

**What happens:** `infer_xtts.py`, `infer_fish.py`, `infer_kokoro.py` are each 400-500 lines containing: param logging, recovery branching, job.json lifecycle, per-chunk retry loop, post-process + verify, assembly, ffmpeg, error helpers, and route-specific cancel queues.

**Why it's wrong:** Business logic, HTTP handling, and job state machine are entangled; hard to test, easy to introduce subtle state bugs when editing one path.

**Do this instead:** Extract a `GenerationJob` class or module that owns job.json CRUD, chunk lifecycle, retry policy, and cancellation token. Route becomes: build request → create job → run(job) → respond. (Current code is intentionally pragmatic for a local tool; future refactor target.)

### Module-Level Model Singletons

**What happens:** `tts_model`, `llm`, `pipeline`, etc. are `global` at module scope; every function reads/writes them.

**Why it's wrong:** Hidden coupling across call sites; unload in one place doesn't guarantee consistency; testing requires heavy mocking or process isolation.

**Do this instead:** For new adapters, consider instance-based handles returned from `load_*` and passed explicitly, or a small registry. For this codebase the pragmatic fix is documenting the lifecycle clearly and ensuring every load/unload path goes through the same two functions.

### Direct Subprocess Spawning Without Shell Safety

**What happens:** FFmpeg and rubberband invoked via `subprocess.run([...])` with constructed arg lists; paths interpolated into filter strings for subtitles.

**Why it's wrong:** User-controlled filenames or project dirs can contain quotes/escapes; current code does minimal sanitization (e.g., `srt_ffmpeg = str(srt_path).replace("\\","/").replace(":","\\:")`).

**Do this instead:** Use `shlex.quote` on any interpolated path in complex filter graphs, or write the SRT to a known temp and pass only that basename under a controlled `-i` context. (Low risk for local single-user tool, but worth noting.)

## Error Handling

**Strategy:** Per-chunk try/except with bounded retries; permanent failure records to job.json and returns 200 with `{error, reason, failed_at_chunk, job_folder, recover_command}` so UI can offer one-click recovery.

**Patterns:**
- Whisper verify fail → save fail chunk → raise → retry (up to N)
- Model load fail → unload + return error
- Cancel → 499 with `{"error":"Cancelled"}`
- Assembly with missing chunks → 200 with `{"status":"incomplete", "recover_command":"##recover## ..."}`
- LLM streaming errors → yield error text chunk (frontend shows alert)

## Cross-Cutting Concerns

**Logging:** `print()` with bracketed prefixes (`[XTTS_INFER]`, `[CHATBOT]`, etc.) + `logging.basicConfig` at INFO. Werkzeug logs suppressed. No structured logging or log levels beyond ad-hoc.

**Validation:** Minimal. Routes check for required keys and basic numeric bounds; most coercion (`int()`, `float()`) is inline and can raise (caught by outer try in some paths).

**Authentication:** None. OPENROUTER_API_KEY is embedded in source/config.

**Cancellation:** Domain-specific `queue.Queue` singletons (`cancel_queue`) per inference route; frontend POSTs to `/<model>_cancel` to inject a token. Loop checks `is_cancelled()` between chunks.

**State Persistence:** 
- Ephemeral: model handles in RAM
- Durable: `job.json`, `*_timing.json`, `settings/*.json`, `brain/*.json`, `context_history/current.json`, archives
- No DB; filesystem is source of truth for jobs, prompts, presets

---

*Architecture analysis: 2026-06-14*
