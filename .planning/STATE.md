---
gsd_state_version: '1.0'  # placeholder; syncStateFrontmatter overwrites on first state.* call
status: in_progress
progress:
  total_phases: 1
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 15
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-14)

**Core value:** A companion that feels consistently alive: personality that holds across turns, a visible face the user can see/refer to, and expressions the model itself decides and that users can extend — all locally.
**Current focus:** Phase 1: Character Fidelity Hardening

## Current Position

Phase: 1 of 1 (Character Fidelity Hardening)
Plan: TBD of TBD in current phase
Status: Infra slice shipped — formal Phase 1 plans still pending (`/gsd-plan-phase 1`)
Last activity: 2026-06-28 — Luna emote wiring, Pick pics (Emotions/Scenes), WSL launch scripts, MCP manifest, 25 pytest pass, planning sync + git push for WSL handoff.
Progress: [█░░░░░░░░░] 15% (infra; CHAR prompt-hardening not yet plan-executed)

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: N/A
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Character Fidelity Hardening | 0 | TBD | N/A |

**Recent Trend:**
- Last 5 plans: N/A (no plans executed yet)
- Trend: N/A

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Phase 1]: Roadmap structure derived from v1 requirements — all CHAR-01..06 + PORT-01 map to single Phase 1 (Character Fidelity Hardening) as one vertical MVP slice; no artificial splits imposed.
- [Phase 1]: Openness constraints (multi-char roadmap left open, Civitai formats kept portable) captured as non-functional requirement PORT-01 and reflected in Phase 1 success criteria (documentation + extensibility statements).
- [Phase 1]: Mirrored June card (top popular Chub childhood best friend: long ~10k desc, character_book lore, multiple images/greetings, versatile wholesome/sexy tags, post-history "closeness is normal" rules) into standard Tavern v3 luna-character.json (companion-python/). Kept format 100% standard/portable. Enriched mes_example to ~1719 chars with emotional range + natural visual self-ref ("the image next to you", "my face", "LED", "expression") + [emote: name] at literal end. Adapted post-history for visual avatar closeness (referring to image/face is familiar/casual like touchy childhood friend — not auto romance/sex). Creator notes credit source + explain visual system + runtime emote injection. This executes CHAR-03 (pull strong public card as base) + feeds CHAR-02 (rich examples for emergence).
- [Phase 1]: Confirmed Launch-Luna.bat (root) launches both: LocalSoundsAPI (voice/Kokoro on 5006 via portable Single.bat, kills old ports, waits ready) + companion-python/app.py (UI+chat+emotes on 5000, opens browser). Other bats: LocalSoundsAPI portable Single/Multi. Use this to test updated card + high-RP small models (Gemma 12B QAT, nvfp4 quantized; 16GB 5070 Ti limit, no 70B).

### Pending Todos

[From .planning/todos/pending/ — ideas captured during sessions]

- Test mirrored June card in luna-character.json: launch via Launch-Luna.bat with one of user's high-RP small models (Gemma 12B QAT or nvfp4). Verify reliable [emote: name] at end of responses, natural visual self-refs in character ("image", "face", "LED", "expression"), consistent personality without drift, image/LED updates. Check if emotes fire first (before full Phase 1 plans). Record results in todo or learnings. (Phase 1 execution step)
- If test passes, capture learnings; if not, refine prompt (add/strengthen PHI for emote/visual rules in app.py LUNA_INSTRUCTION) or pick next top card (Quinn/Sage) for alternate mirror.
- Roadmap follow-up (post Phase 1): evolve asset system from static PNG pairs (placeholders now; user generates realistic/anime-IRL visuals — hard to "move") to GIFs/animated expressions for superior lip-sync (user's strength). Support multiple images/greetings from the mirrored June card. Add to v2/GIF-0x.
- Model experiments: test untried high-RP small models user has (beyond Gemma QAT) with updated card for best format adherence (emote tags + visual refs) on 16GB VRAM. nvfp4 for efficiency.

### Blockers/Concerns

[Issues that affect future work]

None yet.

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-06-28 (WSL prep + Luna emote wiring)
Stopped at: Companion launch-ready (25 pytest pass). MCP stack in repo `.mcp.json`. WSL install script at `companion-python/scripts/mcp-install-wsl.sh`. Pushed `f0e8daa` (2026-06-28); history scrubbed of tracked `.env` — **rotate OpenAI key** if it was ever exposed.
Resume file: `.planning/STATE.md` (this section) + repo-root `.mcp.json`

### 2026-06-28 handoff (read this first)

**Product:** Luna = release character. Asuka = dev-only (IP), not in public builds. Levels/monetization parked.

**What shipped this session:**
- Expression system: LLM emits `[emote: tag]`; user maps images via Pick pics / `sprite_maps.json` / `data/emotes.json`
- Resolve order: `emotes.json` custom → `sprite_map` → `data/characters/Luna/` → `static/img/default-expressions/`
- Luna art: `static/images/custom/*.jpeg` (committed when pushed); `emotes.json` paths updated to `.jpeg`
- UI: modal scroll fix; Pick pics Emotions vs Scenes optgroups
- Launch: `companion-python/scripts/start.sh` (pytest then `app.py`), `test.sh`
- Fresh install bootstraps Luna-only from `data/characters.example.json`
- MCP dev stack (Hermes helmet = agentmemory, not an LLM): see repo-root `.mcp.json`

**WSL resume:**
```bash
cd ~/projects/char
git pull
./companion-python/scripts/mcp-install-wsl.sh
cd companion-python && cp .env.example .env && chmod +x scripts/*.sh && ./scripts/start.sh
```
Services: companion `:5000`, Ollama `:11434`, LocalSoundsAPI `:5006`, agentmemory `:3111`

**Still manual:** scene pic assignment in Pick pics; Asuka paths via `/mnt/f/...` in `.env`; rotate API keys if `.env` ever hit remote; run `/gsd-plan-phase 1` for formal CHAR prompt-hardening plans.

**Agent context layers (outside repo):**
1. This file + `.planning/codebase/*` — project intent and architecture (GSD)
2. Git — code, tests, `emotes.json`, `.mcp.json` (after commit)
3. `agentmemory` — cross-session dev memory (`memory_recall` / Hermes); requires daemon on `:3111`
4. Conversation — **not** persisted; new Cursor/Grok/Claude session has zero chat history unless 1–3 are used
