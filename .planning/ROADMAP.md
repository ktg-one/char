# Roadmap: Luna (Local Visual AI Companion)

## Overview

Brownfield hardening milestone to make the flagship character (and future characters) feel consistently alive with strong visual/emote emergence. Uses SillyTavern-inspired prompt techniques (PHI, rich mes_example, refined card, character notes, positive framing, instruct-aware construction) while preserving the existing emote runtime, custom creator UI, and keeping all character/emote formats portable for multi-character support, Civitai assets, and future GIF/animation.

**Phase 1 is the critical foundation**: reliable model-driven visual layer (the "missing embodiment" for roleplay). This enables the larger ambition of immersive story-driven characters and famous/IP characters that "kill it" visually.

Longer-term platform vision (user direction): immersive story-driven characters, famous IPs, and roadmap from static PNG emote pairs into GIFs/animated expressions for superior lip-sync and emotional presence. Single vertical MVP slice for Phase 1; future phases can expand the scope without locking the current hardening work.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Character Fidelity Hardening** - Apply ST patterns to make characters reliably stay in character with strong visual/emote emergence; validate formats remain open for multi-char, story-driven features, Civitai, and GIF evolution

## Phase Details

### Phase 1: Character Fidelity Hardening
**Goal**: Characters feel more consistently alive with strong visual/emote emergence (personality holds across turns, visible face/LED is referable in-character, model chooses contextually appropriate expressions via `[emote: name]` tags); emote/character formats remain clean, documented, and open for future multi-character, immersive story-driven, famous/IP, and GIF/animated work.
**Mode:** mvp
**Depends on**: Nothing (first phase; brownfield — core architecture, emote runtime, custom emote creator UI, and basic prompt enforcement already shipped and working)
**Requirements**: CHAR-01, CHAR-02, CHAR-03, CHAR-04, CHAR-05, CHAR-06, PORT-01
**Success Criteria** (what must be TRUE):
  1. In extended conversation (10+ turns), responses consistently reflect the defined personality (warm, direct, empowering, curious, consent-focused) without drifting into generic assistant behavior or breaking character.
  2. Model outputs a valid `[emote: <name>]` tag as the exact last line on the vast majority of responses (e.g., ≥95% in a 20-turn capture); tag resolves to a known emote (builtin or custom) and triggers the corresponding image swap + lip-sync.
  3. User can reference the visible face, image, expression, or LED in-character ("I see your LED is blue", "your expression changed") and the character responds naturally about its current visual/emotive state, maintaining immersion.
  4. Emote choices are contextually appropriate across emotional shifts in a conversation (playful → serious → affectionate); the model does not default to a single emote regardless of content.
  5. Emote definition (emotes.json schema + per-emote entries) and character card (Tavern v3) formats are documented (EMOTE_GUIDE or equivalent up-to-date), fully describe the structure (name, keywords, color, closed/open PNG pairs, Tavern fields), and include explicit statements that the formats are designed to support additional characters, story-driven features, famous/IP characters, and future GIF/animated expression packs (via Civitai or other) without core rewrites.
**Plans**: TBD

Plans:
- [ ] 01-01: TBD (to be created via /gsd-plan-phase 1)
- [ ] 01-02: TBD
- [ ] 01-03: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → ...

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Character Fidelity Hardening | 0/TBD | In progress (infra slice shipped 2026-06-28) | - |

### 2026-06-28 infra slice (pre-plan, shipped)

Delivered outside formal GSD plans — launch + visual layer wiring for WSL handoff:

- Luna-only fresh install bootstrap (`characters.example.json`, default UI character)
- Expression resolve chain: `emotes.json` custom → `sprite_map` → `data/characters/Luna/` → defaults
- Pick pics UI: Emotions vs Scenes optgroups, modal scroll fix
- `scripts/start.sh` / `test.sh` (pytest then `app.py`); `mcp-install-wsl.sh`
- Repo `.mcp.json` + `config/hermes.example.yaml` (agentmemory spine)
- 25 pytest pass; Luna custom `.jpeg` assets + `luna-character.json` card mirror (CHAR-03 partial)

**Next:** `/gsd-plan-phase 1` for PHI, mes_example expansion, and model compliance validation (CHAR-01..06).

## Future Vision (Platform Ambition)

Beyond Phase 1 (the hardening foundation that makes the visual layer reliable):

- Immersive story-driven characters (narrative consistency, long-term memory, branching stories)
- Famous / IP characters (accurate personalities + visuals for well-known figures and licensed IPs; "even the famous ones will kill it")
- Roadmap to GIFs / animated expressions (evolve from static PNG mouth pairs to full animated emotes and expression packs for superior lip-sync, emotional presence, and immersion)
- Multi-character platform with Civitai asset integration (cards, GIF/expression packs, discovery)

The current 1-phase structure keeps Phase 1 focused and deliverable. Future phases can be inserted as decimal or subsequent integers once the visual embodiment foundation is solid. This directly supports capturing the dominant roleplay segment of the AI market with the missing "see and hear reacting in real time" layer.