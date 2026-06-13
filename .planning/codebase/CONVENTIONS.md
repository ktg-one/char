# Coding Conventions

**Analysis Date:** 2026-06-14

## Naming Patterns

**Files:**
- Python modules: `snake_case.py` (e.g., `save_utils.py`, `text_utils.py`, `audio_post_XTTS.py`)
- Route modules: `snake_case.py` under `routes/` (e.g., `infer_kokoro.py`, `voice_transcribe.py`)
- Model wrappers: single-word or hyphenated-kebab in dir, `snake_case.py` file (e.g., `models/kokoro.py`, `models/ace_step_loader.py`)
- Blueprint files: match their purpose (`settings_manager.py`, `voice_transcribe.py`)
- JS modules: `kebab-case.js` under `static/js/modules/` (e.g., `generate-kokoro.js`, `model-xtts.js`)
- JSON configs/prompts: `snake_case.json` or `kebab-case.json` (e.g., `emotes.json`, `system_prompt.json`, `A_default.json`)
- Batch launchers: `Pascal-Kebab.bat` or `Title Case.bat` (e.g., `Launch-Luna.bat`, `LocalSoundsAPI-Multi.bat`)

**Functions:**
- `snake_case` for all Python functions (public and private)
- Private helpers: `_snake_case` prefix (e.g., `_ts()`, `_record_chunk_error()`, `_allowed()`)
- Route handler functions: match the endpoint verb/noun (e.g., `kokoro_infer()`, `fish_load()`, `upload()`)
- JS: `camelCase` for functions (e.g., `initXTTSModel()`, `handleFiles()`, `refreshFileList()`)
- JS helpers: short single-letter aliases allowed at module scope (`const $ = s => document.querySelector(s)`)

**Variables:**
- `snake_case` in Python
- `camelCase` in JS
- Module-level globals for shared state: `model_loaded`, `tts_model`, `pipeline`, `whisper_model`, `llm`
- Config constants: `ALL_CAPS_SNAKE` (e.g., `XTTS_PADDING_SECONDS`, `FISH_AUTO_TRIGGER_JOB_RECOVERY_ATTEMPTS`)
- Device identifiers: mixed — raw user input (`"0"`, `"cpu"`) resolved via `resolve_device()` to canonical `"cuda:N"` or `"cpu"`

**Types:**
- No strict typing enforced
- Return tuples documented as `Tuple[bool, str]` in docstrings for load/unload functions (e.g., `load_kokoro`, `load_fish`, `load_xtts`)
- JSON payloads use lowercase keys with underscores (e.g., `"chunks_completed"`, `"verify_whisper"`)
- Route responses: `{"success": bool}` or `{"error": str}` or `{"message": str}` — inconsistent but these three shapes dominate

## Code Style

**Formatting:**
- No formatter enforced (no black, ruff, autopep8)
- Indentation: 4 spaces
- Line length: no enforced limit — long lines (100–120+) are common in inference routes
- Blank lines: used for visual grouping inside long functions; 2+ blank lines between top-level definitions is not consistent
- Trailing commas: inconsistent in multi-line dicts/lists

**Linting:**
- None in root or `LocalSoundsAPI/`
- `fish-speech/pyrightconfig.json` exists only to exclude `data/` and `filelists/` from type checking — not a project-wide type policy
- No `.eslintrc`, no `prettier`, no `biome` for JS

## Import Organization

**Order (observed pattern):**
1. Standard library (`import os`, `import json`, `import time`, `from pathlib import Path`, `from collections import deque`)
2. Third-party (`import torch`, `import numpy as np`, `from flask import ...`, `from huggingface_hub import ...`)
3. Local application imports:
   - `from config import ...`
   - `from . import bp` (inside routes)
   - `import models.xxx as xxx_mod` or `from models.xxx import ...`
   - `from text_utils import ...`, `from save_utils import ...`
   - `from audio_post_XXX import ...`

**Path Aliases:**
- None. All imports are relative to repo root or explicit `sys.path.insert` (e.g., ACE-Step adds its own repo dir)

**Common import anti-patterns:**
- Duplicate imports inside the same file (e.g., `from save_utils import handle_save` appears twice in `infer_kokoro.py`)
- Lazy imports inside route handlers to avoid heavy startup cost (`from models.llama import llm, model_loaded` inside `/infer`)
- Wildcard-like conditional imports with try/except to make optional features degrade gracefully (Whisper in `routes/model.py`)

## Error Handling

**Patterns:**
- Most route handlers wrap core logic in `try: ... except Exception as e: ...` and return `{"error": str(e)}` or a canned message with HTTP 200 or 500
- "Soft failure" for chunked jobs: on permanent failure after retries, still return HTTP 200 with `{"error": "generation_failed", "recover_command": "##recover## ..."}` so the UI can offer recovery
- Job state (`job.json`) helpers (`_record_chunk_error`, `_update_chunk_success`, `_mark_job_failed`) universally use bare `except: pass` to never break a generation due to bookkeeping
- Cancellation: queue-based token (`cancel_queue.put(True)`) checked inside loops; returns HTTP 499 with `{"error": "Cancelled"}`
- Resource cleanup on unload paths: `torch.cuda.empty_cache()`, `gc.collect()`, `del obj` — called from multiple places; no single owner
- Whisper verification failures are treated as retryable errors, not fatal

**Do this:**
- For chunked TTS jobs, always update `job.json` inside try/finally or equivalent so partial progress is never lost
- Use `is_cancelled()` helper (or equivalent) at the top of each chunk loop
- Return `499` for client-initiated cancellation so callers can distinguish from server errors

**Do not:**
- Do not let bookkeeping exceptions (json write failures) abort an in-flight generation
- Do not raise through streaming generators without yielding an error token first

## Logging

**Framework:**
- Dual approach:
  1. Standard `logging` configured in `main.py` (`logging.basicConfig(level=INFO, format='[%(asctime)s] %(levelname)s: %(message)s')`)
  2. Per-module `print(f"[{_ts()}] TAG message")` where `_ts()` returns `time.strftime("%H:%M:%S")`
- `LocalSoundsAPI/logger.py` installs a `LogCaptureHandler` that appends formatted messages to a global `deque(maxlen=30)` for in-app log tailing
- Production routes use `log = logging.getLogger(__name__)` and `log.info`/`log.warning`/`log.error`
- Inference routes (kokoro, fish, xtts) use `print` exclusively with bracketed timestamps and ALL-CAPS tags (`[KOKORO_INFER]`, `[FISH RETRY]`)
- No structured logging, no log levels in the print-based paths

**When to log:**
- On entry to long-running inference endpoints (dump of key params)
- On every chunk success/failure/retry
- On model load/unload (device, success/fail)
- On cancellation detection
- On job recovery entry

**Do not log:**
- Raw audio bytes or full prompt text (privacy / log spam)
- Inside hot per-sample loops

## Comments

**When to Comment:**
- Module docstrings on model wrappers and complex route files explaining ownership and invariants (e.g., `models/kokoro.py`, `models/fish.py`, `routes/infer_kokoro.py`)
- Inline `←` or `#` arrows pointing out non-obvious coupling or "why this line only" (e.g., `env["PYTHONPATH"] = str(FISH_REPO_DIR)   # ← THIS LINE ONLY`)
- Recovery logic (`##recover##`) is heavily commented because it is a user-facing escape hatch
- "Magic" values and thresholds in `config.py` have explanatory comments

**JSDoc/TSDoc:**
- None in JS. Functions have no formal docs; behavior is inferred from call sites and UI labels

## Function Design

**Size:**
- Route handlers for inference are intentionally large (200–500 lines) because they orchestrate: param extraction, job.json lifecycle, chunking, retries, verification, assembly, format conversion, and cancellation — all in one function
- Supporting helpers are small (`_ts()`, `_ffmpeg_args(fmt)`, `_allowed(name)`)
- Model wrappers separate `load_*`/`unload_*` from the actual inference class/method (e.g., `FishSpeechDemo` class inside `models/fish.py`)

**Parameters:**
- Route handlers take no explicit params beyond Flask `request` — all config comes from JSON body or query args
- Model load functions: `device=None` (resolved internally via `resolve_device`)
- Inference functions accept explicit scalar params (temperature, top_p, etc.) rather than a single options dict — makes call sites self-documenting

**Return Values:**
- Load/unload: `tuple[bool, str]` — `(success, message)`
- Inference routes: JSON with either success shape (`{"filename", "saved_to", ...}` or `{"audio_base64": ...}`) or error shape (`{"error": ..., "reason": ...}`)
- Generators (streaming LLM/TTS tokens) yield raw text chunks; error text is yielded with `[TAG ERROR]` prefix so the client can surface it in the stream

## Module Design

**Exports:**
- Model modules expose a small set of globals + functions:
  - `load_*`, `unload_*`
  - status flags (`model_loaded`, `fish_loaded`, etc.)
  - device ids (`device_id`, `fish_device_id`)
  - the live pipeline/object when relevant (`pipeline`, `tts_model`, `llm`)
- Routes do not export; they only register Flask endpoints

**Barrel Files:**
- `routes/__init__.py` acts as a barrel: imports all submodules (to trigger registration) and exports `register_blueprints(app)`
- No JS barrel; `app.js` explicitly imports each module and calls its `init*` function

**Global mutable state (accepted pattern here):**
- All TTS/ASR/music models are singletons at module scope
- Device changes trigger unload-then-reload inside the load function
- No dependency injection; modules import each other directly when they need to coordinate (e.g., `infer_kokoro.py` imports `models.kokoro` and `models.whisper`)

**Cross-module coordination rules (observed):**
- Whisper is loaded on-demand only when `verify_whisper: true` is passed; otherwise explicitly unloaded to free VRAM
- On device switch for a model, the old instance on the old device is unloaded before loading the new one
- Cancellation is cooperative via a shared `queue.Queue` token; there is no thread kill

---

*Convention analysis: 2026-06-14*
