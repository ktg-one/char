# Testing Patterns

**Analysis Date:** 2026-06-14

## Test Framework

**Runner:**
- pytest (only in `companion-python/`)
- Version: 9.0.3 (inferred from `__pycache__` artifact `test_emotes_api.cpython-313-pytest-9.0.3.pyc`)
- No `pytest.ini`, `pyproject.toml` `[tool.pytest]`, or `conftest.py` — configuration is implicit/defaults

**Assertion Library:**
- Built-in `assert` statements (no `unittest.TestCase`, no `pytest` plugins, no `expect` style)

**Run Commands:**
```bash
# From companion-python/ directory
cd companion-python
python -m pytest test_emotes_api.py -q              # Run all tests
python -m pytest test_emotes_api.py -q --tb=short   # With short tracebacks
python -m pytest test_emotes_api.py -q -rA          # Extra summary info
```
There are no watch, coverage, or parallel test commands wired up.

## Test File Organization

**Location:**
- Co-located with the code under test when it exists: `companion-python/test_emotes_api.py` sits next to `companion-python/app.py`
- No tests anywhere under `LocalSoundsAPI/` or `LocalSoundsAPI/routes/`, `LocalSoundsAPI/models/`
- No tests for `tools.py`, `text_utils.py`, `save_utils.py`, audio post-processors, or any inference route

**Naming:**
- `test_<feature>_api.py` (the only example)
- Test functions: `test_<action>_<scenario>` (e.g., `test_create_emote_duplicate`, `test_delete_builtin_emote`)

**Structure:**
```
companion-python/
├── app.py
├── test_emotes_api.py     # only test file in entire repo
└── data/
    └── emotes.json        # mutated by tests via save_emotes()
```

## Test Structure

**Suite Organization:**
```python
import pytest
import json
import os
import tempfile
from app import app, load_emotes, save_emotes

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

@pytest.fixture
def sample_emote():
    return {
        'name': 'test-emote',
        'keywords': ['test', 'example'],
        'color': '#FF0000'
    }

def test_get_emotes_empty(client):
    """Test getting emotes when none exist"""
    save_emotes({'custom': []})   # explicit state reset
    resp = client.get('/api/emotes')
    assert resp.status_code == 200
    data = resp.get_json()
    assert 'custom' in data
    assert len(data['custom']) == 0
```

**Patterns:**
- Each test that mutates persistent storage (`emotes.json`) calls `save_emotes({'custom': []})` at the start to reset
- No `unittest.TestCase` classes; all are plain functions
- Docstrings on every test function describing the scenario
- Fixtures provide the Flask test client and sample data objects
- No `setup_function`/`teardown_function`; state reset is inline at the top of each test

**Setup/Teardown:**
- None at module or session scope
- Per-test reset via direct calls to the same `save_emotes`/`load_emotes` helpers used by the app

## Mocking

**Framework:**
- None. No `unittest.mock`, no `pytest-mock`, no `responses`, no `freezegun`

**What is "mocked":**
- Nothing. The single test suite only exercises the emote CRUD surface which writes/reads a local JSON file
- HTTP calls inside `companion-python/app.py` (to local LLM backends or ElevenLabs) are never exercised in tests

**What NOT to mock (current reality):**
- Model loading, audio I/O, subprocess calls to external repos (Fish, ACE-Step), Whisper, network calls to OpenRouter/LM Studio — none of these have test coverage, so there is no mocking policy yet

## Fixtures and Factories

**Test Data:**
- Inline dict literals for emotes
- `sample_emote` fixture returns a canonical emote shape used by create tests
- State reset payloads are hardcoded: `{'custom': []}`

**Location:**
- Defined inside `test_emotes_api.py` (no separate `factories.py` or `fixtures/`)

**External side effects:**
- Tests write to `companion-python/data/emotes.json` relative to the module under test
- No temp directory isolation; the file is mutated in place and reset between tests

## Coverage

**Requirements:**
- None enforced. No coverage configuration, no CI gate, no badge

**View Coverage:**
```bash
# Would require installing pytest-cov first (not in any requirements.txt)
cd companion-python
pip install pytest-cov
python -m pytest test_emotes_api.py --cov=app --cov-report=term-missing
```
This command has never been run in this codebase (no evidence in repo).

## Test Types

**Unit Tests:**
- Only the emote API surface in `companion-python/`
- Scope: CRUD of custom emotes, duplicate detection, conflict with built-in names, delete guards
- Approach: direct HTTP calls against Flask test client + JSON roundtrips

**Integration Tests:**
- None. The existing tests are closer to "controller tests" that happen to touch a JSON file

**E2E Tests:**
- Not used. No Playwright, Cypress, Selenium, or browser automation anywhere
- No contract tests against the LocalSoundsAPI endpoints from the companion UI

## Common Patterns

**Async Testing:**
- None in Python. The `companion-python/app.py` has `async` route handlers, but they are not covered by tests
- JS side uses `async/await` + `fetch`, but there are no JS tests at all

**Error Testing:**
- `test_create_emote_duplicate` asserts HTTP 400 on duplicate name
- `test_create_emote_conflicts_builtin` asserts HTTP 400 when name matches a built-in emote
- `test_delete_builtin_emote` asserts HTTP 400 on delete attempt
- Pattern: call the endpoint, assert status code, do not assert error body shape (inconsistent with production error shapes)

**Stateful resource tests:**
- Every mutating test starts by calling `save_emotes({'custom': []})` to guarantee a clean slate
- No test uses `pytest` temp directories or `tmp_path` fixture; the app's own `EMOTES_FILE` path is used directly

**Missing patterns (to be introduced if tests are added for LocalSoundsAPI):**
- No tests for text chunking utilities (`split_text_xtts`, `split_text_fish`, `split_text_kokoro`)
- No tests for `handle_save` temp-to-final logic or relative path computation
- No tests for audio post-processors (de-ess, trim, loudness)
- No tests for job.json state machine or recovery flow
- No tests for device resolution (`resolve_device`)
- No tests for any model wrapper load/unload or the global singleton contract

---

*Testing analysis: 2026-06-14*
