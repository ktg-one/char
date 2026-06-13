# Codebase Concerns

**Analysis Date:** 2026-06-14

## Tech Debt

**No .gitignore at repository root:**
- Issue: `.git` directory exists (`D:\projects\silly\char\.git`) but no `.gitignore` file present at root. All vendored content, binaries, and generated artifacts are eligible for commit.
- Files: Repository root (no `.gitignore`)
- Impact: 57,724 files under `LocalSoundsAPI/` + 68,544 files under `LocalSoundsAPI/python/` (full Python 3.11 embed) + model weights (kokoro-v1_0.pth: 312 MB) + CUDA DLLs (torch_cuda.dll: 1.28 GB) will bloat `.git` on first `git add .`. Current git objects: 426 loose objects, 18.07 MiB for 10 commits. Future commits will explode in size.
- Fix approach: Create root `.gitignore` immediately. Exclude: `LocalSoundsAPI/python/`, `LocalSoundsAPI/fish-speech/`, `LocalSoundsAPI/ACE-Step/`, `LocalSoundsAPI/bin/`, `LocalSoundsAPI/models/*/`, `LocalSoundsAPI/output_tts/`, `LocalSoundsAPI/__pycache__/`, `*.pth`, `*.dll`, `*.pyd`, `*.exe` (selectively), `.venv/`, `*.log`, `*.wav`, `*.mp3`. Add `.gitignore` before any mass `git add`.

**Secrets and machine-specific paths committed to source:**
- Issue: `OPENROUTER_API_KEY = "sk-or-v1-[your-key-numbers]"` hardcoded in `config.py:134`. `LLM_DIRECTORY = r"E:\LL STUDIO"` hardcoded in `config.py:44`. Settings JSON files (`settings/A_default.json:78`, `settings/AA_notes.json:90`) also contain `E:\LL STUDIO\...` absolute paths.
- Files: `LocalSoundsAPI/config.py`, `LocalSoundsAPI/settings/A_default.json`, `LocalSoundsAPI/settings/AA_notes.json`
- Impact: API key leakage if repo is public or shared. Absolute path breaks on any machine except the original developer's `E:` drive. `chatbot.py:34` (`scan_models`) and `chatbot.py:6` import `LLM_DIRECTORY` and call `Path(LLM_DIRECTORY).rglob("*.gguf")` — will fail or scan wrong location.
- Fix approach: Remove key from source (use `os.getenv("OPENROUTER_API_KEY", "")` or fail fast). Replace `LLM_DIRECTORY` with env var + sensible default (e.g., `./models/llm`). Add `.env.example`. Sanitize or ignore `settings/*.json` for user-specific paths, or store relative paths only.

**Vendored everything — maintenance and conflict risk:**
- Issue: Full Python 3.11 embed (`LocalSoundsAPI/python/`: 68,544 files), fish-speech vendored at `LocalSoundsAPI/fish-speech/` (140 files under source control, but full repo is large), ACE-Step vendored at `LocalSoundsAPI/ACE-Step/` (106 files). `requirements.txt` (37 pinned packages) is incomplete — actual runtime imports torch, TTS, kokoro, whisper, fish_speech.*, acestep.*, etc. from the embedded site-packages, not from pip install.
- Files: `LocalSoundsAPI/python/`, `LocalSoundsAPI/fish-speech/`, `LocalSoundsAPI/ACE-Step/`, `LocalSoundsAPI/requirements.txt`, `LocalSoundsAPI/pyproject.toml`
- Impact: Updating any vendored component requires manual re-vendor (no lockfile discipline). Fish-speech and ACE-Step have their own `pyproject.toml`/`requirements.txt` — version skew possible. Embedded Python (68k files) makes repo clones slow and storage-heavy. Subprocess PYTHONPATH hacks in `models/fish.py:177,215` (`env["PYTHONPATH"] = str(FISH_REPO_DIR)`) assume exact vendored layout.
- Fix approach: Document vendoring policy. Consider git submodules or separate "portable bundle" release process that vendors on build, not in source. Add CI check that `requirements.txt` + embedded site-packages are consistent. For fish/ACE, either pin exact commits in submodules or document "run vendor script" step.

**No test infrastructure or CI:**
- Issue: Zero test files, zero CI config in project. Search for `pytest|test_|.github/workflows|Makefile|tox` across project root yields only venv noise and `.claude/gsd-core/workflows/` (orchestrator scaffolding, not project tests). `companion-python/test_emotes_api.py` exists but is isolated.
- Files: Repository root (no `pytest.ini`, `pyproject.toml` `[tool.pytest]`, `.github/workflows/`, `tests/`)
- Impact: All inference paths (kokoro/xtts/fish/whisper/ace/llama), job recovery, post-processing, file serving, and brain persistence are untested. Regressions will only surface in manual runs. `##recover##` logic in `infer_kokoro.py:123-158` and `infer_xtts.py:100-142` is complex and untested.
- Fix approach: Add minimal test harness (pytest + fixtures for temp dirs). Start with unit tests for `text_utils.py` splitters, `save_utils.py`, config resolution. Add smoke test that loads config without side effects. Add `.github/workflows/ci.yml` that runs lint + unit tests (skip heavy model loads in CI via env flag).

## Known Bugs

**Duplicate inference route implementations (near-identical copies):**
- Issue: `routes/infer_kokoro.py` (480 lines) and `routes/infer_xtts.py` (484 lines) contain duplicated job.json state machine, recovery logic (`##recover##`), chunk assembly, retry loops, post-processing dispatch, and helper functions (`_record_chunk_error`, `_update_chunk_success`, `_mark_job_failed`). `infer_fish.py` follows a similar pattern. Changes to job schema or recovery semantics must be applied in 2–3 places or they diverge.
- Files: `LocalSoundsAPI/routes/infer_kokoro.py`, `LocalSoundsAPI/routes/infer_xtts.py`, `LocalSoundsAPI/routes/infer_fish.py`
- Impact: Inconsistent behavior between models (e.g., kokoro writes `chunk_retry_counts` at line 326, xtts writes it at line 315 but only inside the success path; fish may differ). Bug fixes in one file do not propagate. Maintenance cost multiplies with each new model.
- Fix approach: Extract shared `job_manager.py` or `inference_session.py` with `JobState` class, `recover_job()`, `record_chunk_result()`, `assemble_final()`. Make `infer_*.py` thin adapters that call the shared session. Add contract tests that all models produce the same job.json shape.

**Silent bare `except: pass` patterns throughout:**
- Issue: Hundreds of `except: pass` or `except Exception as e: ... pass` that swallow errors without logging or propagating. Examples: `infer_kokoro.py:330` (retry count write), `379` (missing chunks write), `422` (final status write), `450`/`466` (job helpers), `audio_post_KOKORO.py:189`, `audio_post_FISH.py:184`, `audio_post_XTTS.py:226` (whisper transcript writes), `openrouter.py:64`/`105` (health/stream errors).
- Files: `LocalSoundsAPI/routes/infer_kokoro.py`, `LocalSoundsAPI/routes/infer_xtts.py`, `LocalSoundsAPI/audio_post_*.py`, `LocalSoundsAPI/models/openrouter.py`, others
- Impact: Failures (disk full, permission denied, JSON corruption, whisper crash) are invisible. Jobs appear "stuck" or produce corrupt `job.json`. Post-mortem debugging requires adding prints ad-hoc.
- Fix approach: Replace bare `except: pass` with `except Exception as e: logging.exception("...")` or at minimum `print(f"[ERROR] {e}")`. For non-critical writes (job.json bookkeeping), log at WARNING and continue. Add a project-wide lint rule (`try/except Exception: pass` forbidden).

**Inconsistent model loader APIs and global state:**
- Issue: Each model module uses different load/unload contracts:
  - `kokoro.py`: `load_kokoro() -> (bool, str)`, `unload_kokoro() -> (bool, str)`, globals `pipeline`, `model_loaded`, `device_id`
  - `xtts.py`: `load_xtts() -> (bool, str)`, `unload_xtts() -> None`, globals `tts_model`, `model_loaded`, `speaker_manager`
  - `fish.py`: `load_fish() -> (bool, str)`, `unload_fish() -> (bool, str)`, globals `fish_loaded`, `fish_device_id`; plus `FishSpeechDemo` class that spawns its own temp dirs
  - `whisper.py`: `load_whisper() -> bool`, `unload_whisper() -> None`, globals `whisper_model`, `_current_device`
  - `ace_step_loader.py`: `load_ace() -> bool`, `unload_ace() -> None`, globals `pipe`, `model_loaded`, `_current_gpu`
  - `llama.py`: `load_llama() -> str`, `unload_llama() -> None`, globals `llm`, `model_loaded`, `loading_in_progress`, plus `threading.Lock`
- Files: `LocalSoundsAPI/models/kokoro.py`, `xtts.py`, `fish.py`, `whisper.py`, `ace_step_loader.py`, `llama.py`
- Impact: `routes/admin.py:6-8` must know every unload function. Status routes (`/status`, `/fish_status`, `kokoro_status`) duplicate the same pattern. No single "unload_all" that is guaranteed complete. Race conditions possible if two routes call load concurrently (only llama has a lock).
- Fix approach: Define a `ModelHandle` protocol or base class with `load(device) -> Result`, `unload() -> None`, `is_loaded() -> bool`, `get_status() -> dict`. Register models in a central registry. Provide `unload_all()` that iterates registry. Add locking per model or a global "model op" lock.

**Fish subprocess + PYTHONPATH hack is fragile:**
- Issue: `models/fish.py:177,215` sets `env["PYTHONPATH"] = str(FISH_REPO_DIR)` then calls `sys.executable -m fish_speech.models.dac.inference` and `fish_speech.models.text2semantic.inference` with `cwd=FISH_REPO_DIR`. Also writes to `FISH_REPO_DIR / "fake.npy"` and `FISH_REPO_DIR / "fake.wav"` (lines 222, 265) as implicit shared state between subprocesses.
- Files: `LocalSoundsAPI/models/fish.py`
- Impact: Any change to fish-speech layout, or running multiple FishSpeechDemo instances, or a prior run leaving stale `fake.npy`, corrupts subsequent runs. No isolation between concurrent inferences. `atexit` cleanup (line 65) only covers `self.temp_dir`, not repo-level artifacts.
- Fix approach: Use a dedicated temp working directory per `FishSpeechDemo` instance. Copy or symlink required checkpoints into it. Pass explicit `--output-dir` style flags instead of relying on `cwd` + `fake.*` files. Remove writes to `FISH_REPO_DIR`.

## Security Considerations

**Unauthenticated file serving endpoints:**
- Issue: `main.py:44` (`/file/<path:filename>`) and `routes/static.py:22` (`/audio/<path:filename>`) serve files with user-controlled paths. Validation in `/file/` checks `p.name == filename` and suffix whitelist, but if `rel` param is absolute and matches, it serves from anywhere (`p.is_absolute(): pass` at line 62-63). `/audio/` iterates `OUTPUT_DIR` and `VOICE_DIR` without auth. No session, no API key, no origin check.
- Files: `LocalSoundsAPI/main.py:44-72`, `LocalSoundsAPI/routes/static.py:22-27`
- Impact: If server is reachable on LAN (binds `0.0.0.0`), any network peer can read all audio outputs and reference voices. If an attacker can place a file with a whitelisted suffix in a location the server process can read, `/file/?rel=...` may serve it. No rate limiting.
- Fix approach: Remove or guard `/file/` endpoint (use `/audio/` only for temp outputs, require a short-lived token or job_id). For `/audio/`, ensure it only serves from `OUTPUT_DIR` and `VOICE_DIR` (it does) but add optional token check if exposing beyond localhost. Add `app.before_request` that rejects non-localhost unless explicitly enabled. Document "localhost only" threat model.

**Server binds to all interfaces with no authentication:**
- Issue: `main.py:84-85`: `app.run(host="0.0.0.0", ...)`; `companion-python/app.py:556`: `app.run(host=host, port=port, debug=True)`. No Flask auth, no reverse-proxy auth assumed, no API key middleware. `debug=True` in companion-python exposes werkzeug console.
- Files: `LocalSoundsAPI/main.py:84-90`, `companion-python/app.py:556`
- Impact: Any device on the same network can access all endpoints (`/infer`, `/kokoro_infer`, `/production/make_video`, `/chatbot/infer`, `/shutdown`, file serving). Debug mode in companion-python allows arbitrary code execution via werkzeug debugger if triggered.
- Fix approach: Default `host="127.0.0.1"`. Add env flag `BIND_HOST` for explicit LAN exposure. Add optional bearer token check (simple header) for non-localhost. Remove `debug=True` from production paths; use `FLASK_DEBUG` only locally.

**Subprocess calls with unsanitized paths (command injection risk):**
- Issue: `routes/production.py:248-253` (ffprobe duration), `248-347` (ffmpeg make_video with `srt_ffmpeg = str(srt_path).replace("\\","/").replace(":","\\:")` — incomplete escaping), `ace_step.py:250-257` (ffmpeg convert), `infer_kokoro.py:403-406`, `infer_xtts.py:393-396`, `infer_fish.py:385` (ffmpeg format conversion), `tools.py:30` (rubberband --version). User-controlled `project_dir`, `filename`, `audio_file` flow into these paths via `Path(project_dir).resolve() / filename`.
- Files: `LocalSoundsAPI/routes/production.py`, `LocalSoundsAPI/routes/ace_step.py`, `LocalSoundsAPI/routes/infer_*.py`, `LocalSoundsAPI/tools.py`
- Impact: On Windows, path segments containing `&`, `|`, `>`, `"` may be interpreted by cmd.exe when passed to subprocess without `shell=False` + list form (some are lists, some may not be). The `srt_ffmpeg` colon escaping is a heuristic, not a proper quote. If an attacker can control `project_dir` or upload a file with a malicious name, they may influence the ffmpeg command line.
- Fix approach: Always pass `subprocess.run(cmd_list, ...)` with arguments as list elements, never construct shell strings. Use `shlex.quote` on any interpolated path for ffmpeg filter strings (subtitles=...). Validate that `project_dir` is under an allowlist (e.g., `PROJECTS_OUTPUT` or `OUTPUT_DIR`) and reject `..` traversal. Add integration test that feeds a path with special characters and asserts it is treated literally.

**No input validation or sandbox on LLM directory scan:**
- Issue: `routes/chatbot.py:32-36` (`/chatbot/scan_models`) accepts `LLM_DIRECTORY` from config (hardcoded to `E:\LL STUDIO`) and returns `Path(LLM_DIRECTORY).rglob("*.gguf")` with no depth limit, no symlink guard, no size filter. `load` endpoint (`/chatbot/load`) then passes that path to `load_llama` which opens it with `llama_cpp`.
- Files: `LocalSoundsAPI/routes/chatbot.py:32-36`, `LocalSoundsAPI/models/llama.py:51-71`
- Impact: If `LLM_DIRECTORY` is changed to `/` or `C:\`, the scan will enumerate the entire filesystem for `.gguf` files and return paths. Loading an attacker-provided `.gguf` (or a file that llama_cpp misparses) could crash the process or trigger vulnerabilities in the GGUF parser / CUDA kernels.
- Fix approach: Constrain `LLM_DIRECTORY` to a subdirectory under `APP_ROOT` or a documented "user models" location. Add depth limit (e.g., 5 levels) and max file size check before calling `Llama()`. Log and reject paths that escape the allowed root.

## Performance Bottlenecks

**Multiple heavy ML models competing for VRAM with no coordination:**
- Issue: Five models can be loaded simultaneously: ACE-Step 3.5B (bfloat16, `ace_step_loader.py:75-82`), Fish S1-mini (subprocess but still allocates GPU in fish_speech), Kokoro-82M (loaded on CPU or CUDA), XTTS-v2 (full model on device), Whisper (medium.en or large-v3, `config.py:19`). `resolve_device` defaults to `cuda:0` for all. No central VRAM budget, no priority, no "evict least-recently-used" policy. `admin.py:26-32` (`/shutdown`) unloads only xtts/whisper/fish, not kokoro/ace/llama.
- Files: `LocalSoundsAPI/config.py:18-32` (model paths), `models/*.py` (loaders), `routes/admin.py:26-32`
- Impact: First time all models are touched (e.g., user opens TTS tab, music tab, chatbot, and enables whisper verify), OOM or CUDA allocator fragmentation occurs. Subsequent loads may fail or fall back to CPU silently. Startup time is high because `main.py:42` calls `load_speakers()` (which triggers XTTS speaker load) and lazy loads cascade on first inference.
- Fix approach: Add a `VRAMManager` or simple registry that tracks loaded models and their approximate sizes. On load request, evict models not needed for the current operation (e.g., unload whisper after verification pass, unload ace when switching to TTS). Make `/shutdown` call `unload_all()` across the registry. Add a `/status/models` endpoint that reports per-model device + VRAM if possible (`torch.cuda.memory_allocated`).

**Temp directory accumulation and disk bloat:**
- Issue: `DELETE_OUTPUT_ON_STARTUP = True` in `config.py:10` and `main.py:32-37` deletes `OUTPUT_DIR` on start, but any crash or manual start without running `main.py` leaves artifacts. `output_tts/` currently contains 25+ `temp_kokoro_*` directories (each with `job.json` + chunk WAVs). `FishSpeechDemo.__init__` (fish.py:151) creates `tempfile.mkdtemp(dir=str(OUTPUT_DIR))` per instance and registers for atexit cleanup, but if the process is killed, these leak. `ace_step.py:195`, `stable_audio.py:178`, `save_utils.py:30` also write `ace_tmp_*`, `stable_temp_*`, `*_fail_*` into OUTPUT_DIR.
- Files: `LocalSoundsAPI/output_tts/` (observed 25+ dirs), `LocalSoundsAPI/config.py:9-10`, `LocalSoundsAPI/main.py:32-37`, `LocalSoundsAPI/models/fish.py:59-65,151-152`, `LocalSoundsAPI/routes/ace_step.py:195`, `LocalSoundsAPI/routes/stable_audio.py:178`
- Impact: Long-running server accumulates gigabytes of WAVs + JSON in `output_tts/`. If user never restarts, disk fills. Temp dirs are not age-based or size-capped.
- Fix approach: Add a periodic cleanup task (background thread or `before_request` hook with time gate) that removes `temp_*` dirs older than N hours. Add a config knob `OUTPUT_DIR_MAX_AGE_HOURS`. On shutdown (admin.py), walk OUTPUT_DIR and remove temp dirs. For Fish, ensure `__del__` + atexit both fire; consider a "temp session" subdir that is always cleaned on Fish unload.

**Startup time and cold-load latency:**
- Issue: `main.py` imports trigger: `from routes import register_blueprints` (imports all route modules), `from models.xtts import load_speakers` (line 11), `load_speakers()` call (line 42). Each model module imports heavy deps at top level (torch, TTS, whisper, kokoro, fish_speech via subprocess but still imports numpy/soundfile). First inference for any model triggers `snapshot_download` if the model dir is empty (kokoro.py:66-73, xtts.py:119-130, fish.py:93-100, ace_step_loader.py:56-65, whisper.py:28-30).
- Files: `LocalSoundsAPI/main.py:1-42`, all `models/*.py` top-level imports, `config.py` (evaluated on every `from config import`)
- Impact: Cold start on a fresh machine (no models cached) can take minutes of downloads + CUDA init before the Flask server even binds. Subsequent starts still pay torch import + speaker load cost even if user only wants Kokoro.
- Fix approach: Defer heavy imports until first use (lazy import inside `load_*` functions). Make `load_speakers()` lazy (call it from `load_xtts` if not loaded, not at module import time in main.py). Add a "preload" flag or admin endpoint to warm models in background after server is up. Document expected cold-start time and required disk space (~10+ GB for all models + Python embed).

## Fragile Areas

**Config is a single mutable Python file imported everywhere:**
- Issue: `config.py` defines 30+ constants (paths, paddings, retry counts, API keys, device settings). It is imported by 29+ files (`grep` found 30 matches across 29 files). There is no schema, no validation, no environment override for most values. `resolve_device` (config.py:51-77) has complex fallback logic that prints to stdout and can return surprising values for malformed input.
- Files: `LocalSoundsAPI/config.py` (single source of truth), 29 importers
- Impact: Changing a path constant or adding a new model requires touching config.py and verifying every importer. Typos in config values (e.g., wrong `WHISPER_PATH.stem`) cause silent misbehavior (whisper.py:10). No way to override a single value for a test without monkeypatching or env-specific config.py copies.
- Fix approach: Split config into: (1) static defaults in code or a `defaults.yaml`, (2) user overrides via `settings/*.json` or `.env`, (3) a `Config` dataclass or Pydantic model with validation. Provide `get_config()` that merges sources. Make `resolve_device` a pure function with no prints; log via `logging`.

**Global mutable state in every model module:**
- Issue: All model modules use module-level globals for the loaded instance (`pipeline`, `tts_model`, `fish_loaded`, `whisper_model`, `pipe`, `llm`). There is no instance-per-session or context manager pattern. `unload_*` functions mutate these globals. Concurrent requests (Flask is threaded: main.py:88) can interleave loads/unloads.
- Files: `LocalSoundsAPI/models/*.py` (all), `LocalSoundsAPI/routes/*.py` (callers)
- Impact: Race: request A starts loading kokoro on cuda:0, request B checks `kokoro_mod.model_loaded` (still False), also calls load — two KPipeline instances or one wins and the other sees partial state. Unload during inference (admin shutdown) can delete the object mid-call. Hard to write unit tests that need two different model configurations.
- Fix approach: Introduce a `ModelSession` or use a context manager per request that holds a weakref or lease. Or accept the global pattern but add a `threading.RLock` per model (like llama's `model_lock`) and enforce acquire/release in load/unload/infer. Document that the server is single-tenant and concurrent model ops are not supported.

**Job recovery (`##recover##`) and job.json are ad-hoc and underspecified:**
- Issue: Recovery is implemented by sending a magic text `##recover##` plus `save_path` (infer_kokoro.py:123, infer_xtts.py:100, similar in fish). The server reads `job.json`, copies parameters, and resumes from `chunks_completed`. There is no formal state machine, no locking around job.json reads/writes, and no version field. Multiple helpers mutate the same file with bare `try: ... except: pass`.
- Files: `LocalSoundsAPI/routes/infer_kokoro.py:122-158,440-477`, `LocalSoundsAPI/routes/infer_xtts.py:97-142,432-471`, `LocalSoundsAPI/routes/infer_fish.py` (similar)
- Impact: If two recovery requests arrive, or a generation is running while recovery is requested, `job.json` can be corrupted or chunks double-counted. If the schema changes (new field), old job.json files cause KeyError or silent fallback. No test that a job can be recovered after process restart.
- Fix approach: Define a `Job` dataclass or TypedDict with version. Use atomic write (write to `.tmp`, rename) for job.json. Add a lockfile per job dir (`job.lock`) or an in-process lock keyed by job_dir. Add a dedicated `POST /jobs/{id}/recover` endpoint instead of magic text. Write a test that creates a partial job.json, restarts the app (or mocks), sends recover, and asserts only missing chunks are re-generated.

**LLM chat history and brain prompts stored as raw JSON with no schema:**
- Issue: `brain/system_prompt.json`, `brain/context_history/current.json`, `brain/context_history/archives/*.json`, and per-project `job.json` files are written with `json.dump(..., indent=2)` and read with `json.load` with no schema validation, no migration path, no checksum. `chatbot.py:24-27` writes a default system prompt at import time if missing.
- Files: `LocalSoundsAPI/brain/`, `LocalSoundsAPI/routes/chatbot.py:24-30,105-141`
- Impact: If a future change renames a field or changes the shape of history entries, all existing archives become unreadable or produce garbage prompts. No way to detect truncation or partial writes. `current.json` can grow unbounded (full chat history) with no pruning policy.
- Fix approach: Add a lightweight schema (pydantic or `jsonschema`) for `SystemPrompt`, `ChatHistory`, `JobState`. On read, validate and either reject or migrate. Add a max history length or archive-on-N-turns policy. Stop writing defaults at import time (do it lazily on first access or via a setup step).

## Scaling Limits

**Single-process Flask with blocking inference:**
- Issue: `main.py:84-90`: `app.run(..., threaded=True, processes=1)`. All inference (kokoro/xtts/fish/ace/whisper/llama) runs in request threads. `infer_llama` streams tokens while holding `model_lock` (llama.py:124). Fish and ACE run long-running subprocesses or diffusion loops. No request timeout, no max concurrent jobs.
- Impact: A single long job (e.g., 10-minute ACE music gen, or a 5-minute TTS with 20 chunks + whisper verify) blocks the entire server for other users/endpoints. `/shutdown` (admin.py:26) can only be called from another request; if all threads are busy, it is unreachable. Memory grows with concurrent base64 audio returns (infer_kokoro.py:433, infer_xtts.py:425).
- Fix approach: Offload heavy work to a task queue (RQ, Celery, or `concurrent.futures.ProcessPoolExecutor` with a bounded pool). Return 202 + job_id immediately; poll `/jobs/{id}/status`. Make `/shutdown` able to signal a shutdown event that workers check. Cap concurrent jobs and queue the rest.

**Unbounded growth of projects_output/ and brain archives:**
- Issue: `PROJECTS_OUTPUT` (config.py:37) receives every saved TTS job (`handle_save` in save_utils.py). `ARCHIVE_DIR` receives every "save archive" action (chatbot.py:113-125). No size limit, no retention policy, no index. Each job dir contains N chunk WAVs + final + job.json.
- Impact: Disk usage grows linearly with usage. No UI to browse or prune old projects. If the user creates thousands of projects, `list_audio` / `list_images` (production.py:58-95) with `recursive=True` will be slow.
- Fix approach: Add a "projects" index (SQLite or simple JSON) that tracks created_at, size, last_accessed. Add admin UI or CLI to list and delete old projects. Add a retention policy (e.g., delete projects older than 30 days unless marked "keep").

**VRAM and RAM limits implicit in model sizes:**
- Issue: Config comments document VRAM requirements (whisper medium.en: ~5 GB, large-v3: ~10 GB; config.py:18-20). No enforcement. `resolve_device` will happily return `cuda:0` even if remaining VRAM is 100 MB. Fish and ACE allocate inside their own subprocesses / CUDA contexts, invisible to the main process's `torch.cuda` accounting.
- Impact: First user who loads "large-v3" whisper + XTTS + starts an ACE gen will OOM. The server may crash or produce CUDA errors that are caught as generic "generation failed".
- Fix approach: Add a pre-flight check in load functions: query `torch.cuda.mem_get_info()` and compare against a per-model budget table. If insufficient, return a structured error (`{"error": "insufficient_vram", "required_gb": X, "available_gb": Y}`). For subprocess models (fish, ace), document that they have their own budgets and may fail independently.

## Dependencies at Risk

**OpenRouter API key is a single point of failure and cost center:**
- Issue: `models/openrouter.py` uses `OPENROUTER_API_KEY` from config for all chat completions and model listing. The key is hardcoded (currently a placeholder). `health_check` (line 54-65) and `infer_openrouter` (line 67-108) make unauthenticated-looking requests if the key is empty or invalid (they will fail at the API).
- Files: `LocalSoundsAPI/models/openrouter.py`, `LocalSoundsAPI/config.py:134`, `LocalSoundsAPI/routes/openrouter.py` (importer)
- Impact: If the key is valid and committed, it can be abused for arbitrary spend. If the key expires or is rate-limited, all OpenRouter-backed chatbot features silently degrade (fallback in `get_models` returns only POPULAR_MODELS, but inference will yield error tokens).
- Fix approach: Require the key via env var. Add a startup warning if `OPENROUTER_API_KEY` is missing or looks like the placeholder. Add circuit-breaker logic: if health_check fails N times, disable OpenRouter routes and surface a clear message to the UI.

**llama-cpp-python + CUDA binaries are fragile on Windows:**
- Issue: `models/llama.py` imports `from llama_cpp import Llama` and passes `tensor_split`, `rpc_tensor=True`, `main_gpu`. The embedded Python has `ggml-cuda.dll` (720 MB) duplicated in two locations (`python/Lib/site-packages/llama_cpp/lib/` and `bin/`). `LLM_GPU_ID` is forced at import time (line 9-15) and raises if invalid.
- Files: `LocalSoundsAPI/models/llama.py`, `LocalSoundsAPI/python/Lib/site-packages/llama_cpp/`
- Impact: CUDA driver or toolkit version skew between host and the embedded DLLs causes immediate crash on `load_llama`. `tensor_split` + `rpc_tensor` is an advanced / experimental path; if llama-cpp-python changes its API, this breaks. Two copies of ggml-cuda.dll waste disk and risk version skew.
- Fix approach: Document the exact CUDA driver requirement. Remove the duplicate ggml-cuda.dll (keep one canonical location, update llama_cpp to find it). Make `LLM_GPU_ID` resolution lazy (fail at load time, not import time) so the rest of the server can start even if llama is misconfigured.

**Hugging Face downloads are unauthenticated except for Fish:**
- Issue: `kokoro.py:68-72`, `xtts.py:124-129`, `ace_step_loader.py:58-64` call `snapshot_download(..., local_dir_use_symlinks=False)` with no `token`. `fish.py:95-100` passes `token=os.getenv("HF_TOKEN")`. If any of these repos become gated or rate-limit anonymous access, downloads fail.
- Files: `LocalSoundsAPI/models/kokoro.py`, `xtts.py`, `ace_step_loader.py`, `fish.py`
- Impact: First run on a fresh machine (or after deleting model dirs) will fail for gated repos. Error messages are generic ("Load failed") and do not tell the user to set `HF_TOKEN`.
- Fix approach: For all `snapshot_download` calls, pass `token=os.getenv("HF_TOKEN")` (None is fine for public). Improve error messages: if `snapshot_download` raises `RepositoryNotFoundError` or `GatedRepoError`, surface "Set HF_TOKEN env var and run `huggingface-cli login`".

## Missing Critical Features

**No graceful degradation when a model or tool is missing:**
- Issue: If `bin/ffmpeg/bin/ffmpeg.exe` is absent, any ffmpeg-dependent path (post-process with speed != 1.0, format conversion, video export, duration probe) will raise unhandled or return opaque errors. Same for `bin/rubberband/`, `bin/espeak-ng/`. `tools.py:verify_portable_tools` is called at startup (main.py:82) but its failures are only printed, not enforced.
- Files: `LocalSoundsAPI/tools.py`, `LocalSoundsAPI/bin/`, callers in `audio_post_*.py`, `routes/production.py`, `infer_*.py`
- Impact: User sees "generation failed" or a Python traceback in logs, with no actionable message like "ffmpeg.exe not found at bin/ffmpeg/bin/ffmpeg.exe — download the portable bundle".
- Fix approach: Make `verify_portable_tools` return a structured result. On missing critical tool, either refuse to start (with clear message) or mark the feature as unavailable and have routes return `{"error": "ffmpeg_missing", "hint": "..."}`. Add a `/status/tools` endpoint.

**No model download progress or resumability exposed to UI:**
- Issue: `snapshot_download` calls in model loaders use default `tqdm_class` (or `None` for ACE). Progress is printed to console only. If the download is interrupted, the next run may resume (some do, some don't) but the UI has no visibility — the first inference just hangs.
- Files: `LocalSoundsAPI/models/kokoro.py:68`, `xtts.py:124`, `fish.py:95`, `ace_step_loader.py:58`, `whisper.py:30`
- Impact: User clicks "generate" and the browser spinner runs for 5-30 minutes with no feedback. If it fails partway, they have no idea whether to retry or check disk space.
- Fix approach: Wrap `snapshot_download` with a callback or use `tqdm_class` that writes to a shared progress file or in-memory dict. Expose `GET /status/downloads` that returns `{ "kokoro": { "status": "downloading", "progress": 0.42 } }`. Frontend polls and shows a progress bar.

**No centralized logging or log retention:**
- Issue: Logging is a mix of `print(...)`, `logging.info(...)`, and `logging.getLogger(__name__)`. `main.py:23-28` configures root logging to stream only (no file). `companion-python/app.py` has its own setup. No log rotation, no log level control, no request ID correlation.
- Files: `LocalSoundsAPI/main.py:23-28`, `LocalSoundsAPI/logger.py` (exists but not wired everywhere), scattered prints
- Impact: When a user reports "it broke", there is no log file to attach. Long-running server logs grow unbounded in the terminal/session. Debug prints (e.g., `[KOKORO DEBUG]`) are always on.
- Fix approach: Use `logging` consistently (remove stray prints or route them through a logger). Add a `RotatingFileHandler` to `logger.py` and import it in main.py. Add env var `LOG_LEVEL` and `LOG_FILE`. Include request correlation (e.g., `X-Request-ID` header) in inference routes so a single generation's logs can be grepped.

---

*Concerns audit: 2026-06-14*
