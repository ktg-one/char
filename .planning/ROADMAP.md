# Roadmap: Luna (Local Visual AI Companion)

## Overview

Brownfield hardening milestone to make the flagship character (Luna) feel consistently alive through stronger personality consistency, natural visual/emote emergence, and reliable model-driven expression tags. Uses SillyTavern-inspired prompt techniques (PHI, rich mes_example, refined card, character notes, positive framing, instruct-aware construction) while preserving the existing emote runtime, custom creator UI, and keeping all character/emote formats portable for future multi-character support and Civitai adaptability. Single vertical MVP slice: one hardened Luna that demonstrates the "alive companion" core value.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Character Fidelity Hardening** - Apply ST patterns to make Luna reliably stay in character with strong visual/emote emergence; validate formats remain open for multi-char and Civitai

## Phase Details

### Phase 1: Character Fidelity Hardening
**Goal**: Luna feels more consistently alive with strong visual/emote emergence (personality holds across turns, visible face is referable in-character, model chooses contextually appropriate expressions via `[emote: name]` tags); emote/character formats remain clean, documented, and open for future multi-character and Civitai work.
**Mode:** mvp
**Depends on**: Nothing (first phase; brownfield — core architecture, emote runtime, custom emote creator UI, and basic prompt enforcement already shipped and working)
**Requirements**: CHAR-01, CHAR-02, CHAR-03, CHAR-04, CHAR-05, CHAR-06, PORT-01
**Success Criteria** (what must be TRUE):
  1. In extended conversation (10+ turns), Luna's responses consistently reflect the defined personality (warm, direct, empowering, curious, consent-focused) without drifting into generic assistant behavior or breaking character.
  2. Model outputs a valid `[emote: <name>]` tag as the exact last line on the vast majority of responses (e.g., ≥95% in a 20-turn capture); tag resolves to a known emote (builtin or custom) and triggers the corresponding image swap + lip-sync.
  3. User can reference Luna's visible face, image, expression, or LED ("I see your LED is blue", "your expression changed") and Luna responds naturally in-character about her current visual/emotive state, maintaining immersion.
  4. Emote choices are contextually appropriate across emotional shifts in a conversation (playful → serious → affectionate); the model does not default to a single emote regardless of content.
  5. Emote definition (emotes.json schema + per-emote entries) and character card (luna-character.json Tavern v3) formats are documented (EMOTE_GUIDE or equivalent up-to-date), fully describe the structure (name, keywords, color, closed/open PNG pairs, Tavern fields), and include explicit statements that the formats are designed to support additional characters and Civitai card/expression pack/app connections without core rewrites.
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
| 1. Character Fidelity Hardening | 0/TBD | Not started | - |
