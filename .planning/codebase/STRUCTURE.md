# Codebase Structure

**Analysis Date:** 2026-06-14

## Directory Layout

```
D:\projects\silly\char/
├── LocalSoundsAPI/                 # Primary service (Flask TTS + music + chatbot)
│   ├── main.py                     # Entry point; app factory + run
│   ├── config.py                   # Paths, device resolver, tuning constants
│   ├── tools.py                    # Portable bin wiring (ffmpeg/rubberband/espeak)
│   ├── text_utils.py               # Chunkers (xtts/fish/kokoro) + whisper sanitize
│   ├── save_utils.py               # handle_save(temp → final + rel)
│   ├── logger.py                   # (present, usage minimal)
│   ├── audio_post.py               # Shared post-process + CLAP scoring
│   ├── audio_post_XTTS.py          # XTTS-specific post + whisper verify
│   ├── audio_post_FISH.py          # Fish-specific post + whisper verify
│   ├── audio_post_KOKORO.py        # Kokoro-specific post + whisper verify
│   │
│   ├── routes/                     # All HTTP surfaces (blueprints)
│   │   ├── __init__.py             # bp + register_blueprints(app)
│   │   ├── static.py               # Home, status probes, /audio passthrough
│   │   ├── voice.py                # /voices, /speakers, /upload, /refresh_voices
│   │   ├── model.py                # /load, /unload, /fish_*, /kokoro_*, /whisper_*
│   │   ├── infer_xtts.py           # /infer + /xtts_cancel + helpers
│   │   ├── infer_fish.py           # /fish_infer + /fish_cancel
│   │   ├── infer_kokoro.py         # /kokoro_infer + /kokoro_cancel + /kokoro_status + /kokoro_voices
│   │   ├── voice_transcribe.py     # /voice_transcribe*, blueprint "voice_transcribe" (no prefix)
│   │   ├── chatbot.py              # /chatbot/* (brain, load, unload, infer, status)
│   │   ├── lmstudio.py             # /lmstudio/* (infer, status, models)
│   │   ├── openrouter.py           # /openrouter/* (infer, status, models)
│   │   ├── production.py           # /production/* (upload, list, transcribe, make_video)
│   │   ├── ace_step.py             # /ace_* (load/unload/status/infer)
│   │   ├── stable_audio.py         # /stable_* (load/unload/status/cancel/infer)
│   │   ├── settings_manager.py     # /settings/* (list/save/load/delete presets)
│   │   └── admin.py                # /shutdown
│   │
│   ├── models/                     # Model adapters (lazy load/unload + infer wrappers)
│   │   ├── __init__.py             # Re-exports common symbols
│   │   ├── xtts.py                 # Coqui XTTS-v2 + speaker manager
│   │   ├── fish.py                 # FishSpeech wrapper + FishSpeechDemo
│   │   ├── kokoro.py               # Kokoro-82M KPipeline + 20 English voices
│   │   ├── whisper.py              # OpenAI Whisper (medium.en default)
│   │   ├── llama.py                # llama.cpp GGUF (thread-locked, tensor_split)
│   │   ├── stable_audio.py         # Stable Audio 1.0 + CLAP
│   │   ├── stable_audio_state.py   # is_model_loaded / set_* device flags
│   │   ├── ace_step_loader.py      # ACE-Step 3.5B adapter (sys.path hack + ACEStepPipeline)
│   │   ├── ace_generate.py         # (thin wrapper or legacy)
│   │   ├── lmstudio.py             # LM Studio OpenAI-compatible client
│   │   ├── openrouter.py           # OpenRouter Bearer + streaming client
│   │   ├── clap.py                 # CLAP (HTSAT) loader for scoring
│   │   └── kokoro-82m/             # Bundled Kokoro weights + voice .pt files
│   │
│   ├── templates/                  # Jinja2 UI shell
│   │   ├── base.html
│   │   ├── index.html              # Includes all feature rows
│   │   └── includes/
│   │       ├── toolbar.html
│   │       ├── upload_card.html
│   │       ├── xtts_row.html
│   │       ├── fish_row.html
│   │       ├── kokoro_row.html
│   │       ├── stable_audio_row.html
│   │       ├── ace_step_row.html
│   │       ├── production_row.html
│   │       ├── chatbot_row.html
│   │       ├── cheat_sheet_row.html
│   │       ├── helpful_links_row.html
│   │       └── reference_separator.html
│   │
│   ├── static/                     # CSS + JS (vanilla, ESM modules)
│   │   ├── css/
│   │   │   ├── bootstrap.min.css
│   │   │   └── style.css
│   │   ├── icons/bootstrap-icons/
│   │   ├── js/
│   │   │   ├── app.js              # Bootstraps + dynamic imports per path
│   │   │   ├── production.js
│   │   │   └── modules/
│   │   │       ├── ui-helpers.js
│   │   │       ├── upload.js
│   │   │       ├── settings.js
│   │   │       ├── model-xtts.js
│   │   │       ├── generate-xtts.js
│   │   │       ├── model-fish.js
│   │   │       ├── generate-fish.js
│   │   │       ├── model-kokoro.js
│   │   │       ├── generate-kokoro.js
│   │   │       ├── model-stable-audio.js
│   │   │       ├── generate-stable-audio.js
│   │   │       ├── model-ace-step.js
│   │   │       ├── generate-ace-step.js
│   │   │       ├── model-whisper.js
│   │   │       ├── chatbot.js
│   │   │       ├── chatbot-core.js
│   │   │       ├── backend-local.js
│   │   │       ├── backend-lmstudio.js
│   │   │       ├── backend-openrouter.js
│   │   │       └── system-prompt-manager.js
│   │   └── favicon.ico
│   │
│   ├── bin/                        # Portable CLI tools (committed)
│   │   ├── ffmpeg/bin/
│   │   ├── rubberband/
│   │   └── espeak-ng/              # (DLL + data for Kokoro phonemizer)
│   │
│   ├── voices/                     # User-provided reference audio for cloning (runtime)
│   ├── output_tts/                 # Temp artifacts + temp_* job dirs (gitignored in spirit)
│   ├── projects_output/            # Named save jobs (user-created, persists)
│   │
│   ├── brain/                      # Chatbot "brain" state (committed examples + runtime)
│   │   ├── system_prompt.json
│   │   ├── *.json                  # Named prompt presets (e.g., "5 minute pod cast.json")
│   │   └── context_history/
│   │       ├── current.json
│   │       └── archives/*.json
│   │
│   ├── settings/                   # UI preset snapshots (user-created JSON)
│   │   ├── A_default.json
│   │   └── *.json
│   │
│   ├── ACE-Step/                   # Vendored ACE-Step music subsystem (full repo)
│   │   ├── acestep/                # Python package (pipeline_ace_step.py, models/, schedulers/, ...)
│   │   ├── infer.py / infer-api.py / trainer.py / trainer-api.py
│   │   ├── config/, examples/, assets/, docs/
│   │   └── models/ace_step/        # Downloaded weights (NOT in repo; runtime)
│   │
│   ├── fish-speech/                # Vendored Fish Speech TTS subsystem (full repo)
│   │   ├── fish_speech/            # Python package
│   │   ├── tools/
│   │   ├── docker/, docs/
│   │   └── models/fish-speech/     # Downloaded weights (runtime)
│   │
│   ├── models/                     # Also holds downloaded model dirs at runtime:
│   │   ├── XTTS-v2/                # (downloaded on first load if missing)
│   │   ├── fish-speech/            # (OpenAudio S1-mini etc.)
│   │   ├── stable-audio-open-1.0/
│   │   ├── ace_step/
│   │   ├── clap-htsat-unfused/
│   │   └── medium.en.pt (or base.en.pt, large-v3.pt) for Whisper
│   │
│   ├── python/                     # Vendored Python interpreter (portable mode; bulk)
│   ├── __pycache__/                # (ignored)
│   ├── requirements.txt
│   └── pyproject.toml              # (present; content not inspected)
│
├── companion-python/               # Separate visual companion app (Luna)
│   ├── app.py                      # Flask app; emote API + chat UI
│   ├── character.py                # Gemini ADK agent (ONLY imported for Gemini backend)
│   ├── data/
│   │   ├── emotes.json             # Custom emote definitions (name, keywords, color, images)
│   │   └── system_prompt.txt
│   ├── static/
│   │   ├── app.js                  # Mouth sync, emote modal, chat, TTS wiring
│   │   ├── style.css
│   │   └── images/
│   │       ├── char-mouth-closed.png
│   │       ├── char-mouth-open.png
│   │       └── custom/*.png
│   ├── templates/index.html
│   ├── Skill/skill.md
│   ├── EMOTE_GUIDE.md
│   ├── luna-character.json
│   ├── luna_emote_prompts.txt
│   ├── test_emotes_api.py
│   └── requirements.txt
│
├── docs/
│   └── plans/
│       └── 2026-06-10-*.md         # Design/planning artifacts (emote creation)
│
├── screenshots/                    # Verification images (UI states, emotes, etc.)
│
├── Launch-Luna.bat                 # Convenience launcher (companion + main?)
├── package-lock.json               # (incidental; JS tooling)
│
└── .planning/                      # (generated by this process)
    └── codebase/
        ├── ARCHITECTURE.md
        └── STRUCTURE.md
```

## Directory Purposes

**`LocalSoundsAPI/` (root of service):**
- Purpose: Self-contained local AI voice + music + chatbot studio
- Contains: All Python source, Flask app, routes, model adapters, templates, JS, vendored subsystems (ACE-Step, fish-speech), portable bins, user data dirs (voices, output, projects, brain, settings)
- Key invariant: Run from this directory; relative paths in `config.py` assume `APP_ROOT` is here

**`LocalSoundsAPI/routes/`**
- Purpose: Blueprint modules; each file owns a slice of HTTP surface and orchestrates its domain
- Pattern: `from . import bp` (shared main blueprint) OR define own `bp = Blueprint(..., url_prefix=...)` and export it
- Registration: `routes/__init__.py` imports and calls `app.register_blueprint(...)` in `register_blueprints(app)`

**`LocalSoundsAPI/models/`**
- Purpose: Adapter layer between routes and third-party model runtimes
- Pattern: Each file exposes `load_*`, `unload_*`, and either a module-global handle (e.g., `tts_model`) or a high-level class (e.g., `FishSpeechDemo`)
- Side effects: `torch.cuda.empty_cache()` on unload; auto-download on first load if weights missing
- Re-exports: `models/__init__.py` re-exports common symbols for convenience imports in routes

**`LocalSoundsAPI/templates/` + `static/`**
- Purpose: Server-rendered MPA shell + client-side feature modules
- Pattern: `base.html` → `index.html` → `{% include "includes/*_row.html" %}`; `app.js` does dynamic `import("./modules/*.js")` then calls `init*()` functions
- No bundler: native ESM, `type="module"` script tag
- Production page: `/production` path triggers `import("./js/production.js")` instead of the main module set

**`LocalSoundsAPI/brain/`**
- Purpose: Chatbot "long-term memory": system prompts (default + named presets) and chat history (current + archives)
- Files: `system_prompt.json`, `*.json` (named prompts), `context_history/current.json`, `context_history/archives/<ts>_<name>.json`
- Accessed exclusively via `/chatbot/brain/*` endpoints

**`LocalSoundsAPI/settings/`**
- Purpose: UI preset snapshots (all form values serialized) for reproducible sessions
- CRUD via `/settings/list|save|load|delete`
- Naming: user-provided; stored as `<name>.json`

**`LocalSoundsAPI/voices/`**
- Purpose: Reference audio for voice cloning (XTTS cloned mode, Fish ref, Kokoro not used for cloning)
- Populated by user upload via UI or direct copy

**`LocalSoundsAPI/output_tts/` and `projects_output/`**
- Purpose: Generation artifacts
- `output_tts/`: temp job dirs (`temp_<model>_<ts>/`) and stray files; often deleted on startup (`DELETE_OUTPUT_ON_STARTUP`)
- `projects_output/`: user-named save locations; `job.json` lives next to final audio chunks

**`LocalSoundsAPI/bin/`**
- Purpose: Portable CLI tools so the app runs without global installs
- Expected: `ffmpeg/bin/ffmpeg.exe`, `ffmpeg/bin/ffprobe.exe`, `rubberband/rubberband.exe`, `espeak-ng/` (DLL + data)
- Wired at startup by `tools.py` (AudioSegment.ffmpeg, PATH injection)

**`LocalSoundsAPI/ACE-Step/` and `fish-speech/`**
- Purpose: Full vendored inference stacks for music (ACE) and TTS (Fish)
- Integration: ACE via direct import after `sys.path.insert`; Fish via subprocess invoking its own scripts against its venv or the portable python
- Model weights: downloaded into `LocalSoundsAPI/models/ace_step/` and `LocalSoundsAPI/models/fish-speech/`

**`companion-python/`**
- Purpose: Independent visual character frontend (Luna) that consumes LocalSoundsAPI TTS
- Own Flask app, own static/templates, own emote system
- Talks to main service via configurable `LOCAL_SOUNDS_URL` (or direct calls)
- Gemini ADK path only loads if user selects Gemini backend (guarded import of `character.py`)

## Key File Locations

**Entry Points:**
- `LocalSoundsAPI/main.py`: `if __name__ == "__main__": app.run(...)`; also `register_blueprints(app)` at import time
- `companion-python/app.py`: `app = Flask(__name__)` + routes + `if __name__ == "__main__":`

**Configuration:**
- `LocalSoundsAPI/config.py`: all path constants (`VOICE_DIR`, `OUTPUT_DIR`, `PROJECTS_OUTPUT`, `FISH_*`, `KOKORO_*`, `LLM_DIRECTORY`, `LMSTUDIO_API_BASE`, `OPENROUTER_API_KEY`) + `resolve_device()` + per-TTS post-process tuning
- `LocalSoundsAPI/tools.py`: portable tool verification + environment side effects

**Core Logic:**
- `LocalSoundsAPI/routes/infer_*.py`: full TTS pipelines (chunk, job, retry, verify, assemble)
- `LocalSoundsAPI/routes/chatbot.py`: local LLM + brain endpoints
- `LocalSoundsAPI/routes/production.py`: media + transcription + video
- `LocalSoundsAPI/models/*.py`: each adapter's load/unload/infer surface

**Testing:**
- `companion-python/test_emotes_api.py`: pytest for emote API
- No centralized test suite for LocalSoundsAPI (manual + screenshots)

## Naming Conventions

**Files:**
- Routes: `infer_<model>.py` for generation, `model.py` for load/unload, `<domain>.py` otherwise (chatbot, production, admin, settings_manager)
- Models: `<model>.py` (lowercase, matches package where possible)
- Post-process: `audio_post*.py` (shared or per-TTS)
- Utils: `text_utils.py`, `save_utils.py`, `tools.py`

**Directories:**
- `routes/`, `models/`, `templates/`, `static/` — standard Flask layout
- `brain/`, `settings/`, `voices/`, `output_tts/`, `projects_output/` — domain data dirs at service root
- `ACE-Step/`, `fish-speech/` — vendored subsystem roots (preserve upstream casing)
- `companion-python/` — sibling package, not under LocalSoundsAPI

**Functions (Python):**
- Loaders: `load_<thing>(device=None) -> (bool, str)`
- Unloaders: `unload_<thing>() -> None`
- Status: `<thing>_status` route or `is_model_loaded()` / `<thing>_loaded` flags
- Inference entry (routes): `infer` or `<model>_infer`

**JS (ESM modules):**
- `model-<feature>.js` → `init<Feature>Model()` + `setMode(...)` where relevant
- `generate-<feature>.js` → `init<Feature>Generate()`
- `backend-<provider>.js` → `setup<Provider>Backend()`
- `chatbot-core.js` + thin `chatbot.js` coordinator

## Where to Add New Code

**New TTS Model (e.g., "FooTTS"):**
- Primary code:
  - `LocalSoundsAPI/models/foo.py` — `load_foo(device)`, `unload_foo()`, `foo_model` or `pipeline`, inference wrapper
  - `LocalSoundsAPI/routes/infer_foo.py` — POST `/foo_infer` (copy pattern from infer_kokoro.py), cancel route, job.json, chunking via `text_utils`, post-process + verify, assembly
  - `LocalSoundsAPI/routes/model.py` — add `/foo_load`, `/foo_unload`, `/foo_status` if model needs explicit UI load button
- UI:
  - `LocalSoundsAPI/templates/includes/foo_row.html` (new include)
  - `LocalSoundsAPI/static/js/modules/model-foo.js`, `generate-foo.js`
  - Wire in `app.js` dynamic import list + init calls
- Config: add any `FOO_*` paths/tuning to `config.py`
- Registration: import in `routes/__init__.py` if new blueprint; otherwise just `from . import infer_foo` under shared `bp`

**New LLM Backend:**
- `LocalSoundsAPI/models/<provider>.py` — client that yields token chunks (follow `lmstudio.py` or `openrouter.py`)
- `LocalSoundsAPI/routes/<provider>.py` — blueprint with `url_prefix='/<provider>'`, `/infer` (stream), `/status`, `/models` if applicable
- Register blueprint in `routes/__init__.py`
- Frontend: `static/js/modules/backend-<provider>.js`, wire into `chatbot.js` select + coordinator

**New Music/SFX Generator:**
- Similar to TTS: `models/<name>.py` adapter + `routes/<name>.py` route module
- Follow stable_audio or ace_step pattern (multi-variant, CLAP or other scoring, save vs. base64)
- Add row include + two JS modules

**New Setting or Brain Feature:**
- Backend: add endpoint in `routes/settings_manager.py` or `routes/chatbot.py` under existing blueprints
- Frontend: extend `modules/settings.js` or `modules/system-prompt-manager.js` / `chatbot-core.js`

**Utilities:**
- Shared helpers → `text_utils.py` (text transforms), `save_utils.py` (file mgmt), `audio_post.py` (shared audio cleanup)
- Avoid putting domain logic in these

## Special Directories

**`LocalSoundsAPI/python/`**
- Purpose: Vendored Python 3.11 interpreter for portable single-folder execution
- Generated: No (manually placed or via portable-packager)
- Committed: Yes (very large; bulk)
- Exclude from exploration: treat as opaque runtime

**`LocalSoundsAPI/ACE-Step/` and `fish-speech/`**
- Purpose: Full upstream repos for their respective models
- Generated: No (git subtrees or manual clones)
- Committed: Yes (source); weights under `models/` are runtime-only
- Modification: Prefer upstream-compatible changes; local patches should be isolated

**`output_tts/temp_*` and stray files under `output_tts/`**
- Purpose: Transient generation artifacts
- Generated: Yes (by inference routes)
- Committed: No (should be gitignored or cleaned on startup via `DELETE_OUTPUT_ON_STARTUP`)
- Lifecycle: created per job; final outputs moved to `projects_output/` or returned base64 + deleted

**`LocalSoundsAPI/projects_output/`**
- Purpose: User-authored named projects with `job.json` + final audio + optional media
- Generated: Yes (user save actions)
- Committed: No (user data)
- Structure per project: `job.json`, `chunk_###.wav`, `<stem>_final.<fmt>`, optional images/video/srt

**`companion-python/__pycache__/` and `LocalSoundsAPI/__pycache__/`**
- Purpose: Python bytecode caches
- Generated: Yes
- Committed: No (standard ignore)
- Safe to delete

**`.planning/codebase/`**
- Purpose: GSD-generated architecture/structure maps (this docset)
- Generated: Yes (by `/gsd-map-codebase`)
- Committed: Yes (intentionally; consumed by planner/executor)
- Do not edit by hand; regenerate when codebase changes

---

*Structure analysis: 2026-06-14*
