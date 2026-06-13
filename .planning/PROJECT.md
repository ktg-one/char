# Luna (Local Visual AI Companion)

## What This Is

Local-first visual AI companion platform that supplies the missing embodiment layer for the massive roleplay market (over 50% of AI usage). It combines local LLM chat + synced local TTS voice + real-time character visuals (image or GIF-based emoting and lip-sync). Users get immersive, story-driven characters that have faces, expressions, and physical presence the model controls in real time. The system uses hardened Tavern v3-style cards plus strict prompt techniques (dynamic emote injection, mandatory end-of-response [emote: name] tags, rich examples) so the model reliably drives personality, emotional state, *and* the visual layer.

The project is brownfield: core architecture, emote runtime (companion-python with mouth-sync pairs + custom emote creator UI), and basic prompt enforcement are already shipped (dual Flask apps, heavy local ML stack, vanilla JS UI, portable Windows deployment). Current focus (Phase 1) is hardening backend model fidelity so any character’s personality and visual/emote behavior reliably emerge and stay consistent.

Longer-term vision (roadmap open): immersive story-driven characters, famous/IP characters, and evolution from static PNG emote pairs to animated GIFs/expression packs for higher immersion. Formats and architecture kept portable for Civitai asset integration and multi-character support.

## Core Value

The roleplay experience you can *see and hear* reacting in real time — the visual and vocal embodiment layer that pure text companions lack. Personality that holds, a visible character the user can refer to, expressions the model itself decides, and user-extensible visuals — all local and story-immersive.

## Requirements

### Validated

- ✓ Dual-app Flask architecture (LocalSoundsAPI monolith for TTS inference pipelines (XTTS-v2 / FishSpeech / Kokoro), music generation (ACE-Step / Stable Audio + CLAP), LLM chat (llama.cpp + LM Studio / OpenRouter proxies), voice transcription, production assembly; companion-python for visual character viewer with emote-driven image swapping + real-time lip-sync tied to TTS) — existing and mapped
- ✓ Working emote system: model instructed to always append exact `[emote: name]` tag as the last line of every reply; backend `determine_emotion()` (tag priority > custom keywords > built-in heuristics); paired closed/open mouth images for lip-sync animation during playback; LED ring color per emote; customs override built-ins by name
- ✓ User-facing custom emote creator (header Emotes button → modal with list/thumbnails/keywords/delete; +Add form for name, comma-separated keywords, closed + open PNG uploads + previews, optional LED color; saves to JSON + static/images/custom/; immediate availability via dynamic prompt injection)
- ✓ Tavern v3 character card (`luna-character.json`) + detailed system instructions covering personality (warm, direct, empowering, curious, consent-focused), visual avatar awareness ("the image next to you", "my face", "your expression", LED), strict emote tag rule, and immersion ("never break character", never mention makers)
- ✓ Local-first stack with vendored/portable models and tools (PyTorch + specific inference libs, vendored fish-speech/ACE-Step, portable embedded Python 3.11, ffmpeg/rubberband, Whisper for verification/transcription)
- ✓ Basic history handling (recent turns sent for context), custom system prompt overrides, and separation of TTS voice provider (LocalSoundsAPI primary)
- ✓ Existing emote data + tests (companion-python/data/emotes.json with examples/overrides; test_emotes_api.py covering CRUD, duplicates, builtin conflicts)

### Active

- [ ] Harden character fidelity and visual/emote emergence so the backend model reliably stays in character and the defined personality + visual behavior actually emerge (using SillyTavern-inspired techniques). This is the foundation that makes immersive story-driven and famous characters "kill it" visually:
  - Extract core rules (stay fully in character, exact mandatory last-line `[emote: name]` format, visual ownership and natural references to "my face / the image next to you / expression / LED", key personality traits) into strong, short Post-History Instructions (PHI) placed last in the prompt for highest priority
  - Expand `mes_example` (and any in-prompt examples) with multiple rich, demonstrative turns that *show* personality in action, natural in-character discussion of the visual, correct tag usage, and emote choice tied to emotional context (few-shot learning for emergence)
  - Refine character description/personality fields for more specific, vivid, expression-aware details (appearance and behavior that manifests in the visible face)
  - Add Character's Note / Author's Note-style persistent anchors (or lightweight character lore) for immutable rules around consistency, visual awareness, and emote behavior
  - Apply positive framing ("write responses that...") and strategic repetition for key behaviors
  - Tune message construction (system prompt + examples + recent history + PHI) and any instruct template handling for better compliance on the local backends in use (llama.cpp, LM Studio, Ollama, etc.)
- [ ] Preserve and strengthen the model-driven emote approach (explicit tags chosen by the character) while keeping the runtime (tag parsing, keyword fallback, paired images for lip-sync, customs with keywords/color) intact
- [ ] Keep emote/character definition formats (JSON structure + image pairs, card) clean, documented, and portable
- [ ] Ensure the overall system (prompts, data formats, architecture) remains adaptable for future multi-character support, story-driven features, and Civitai asset pipelines

### Out of Scope (v1)

- Full multi-character implementation or character switching UI (roadmap left open)
- Direct Civitai app connection, card import/export, or expression pack integration code (roadmap left open; formats kept compatible/portable for future)
- Generative expression images or GIF animation (current system is user-provided static PNG pairs; roadmap to animated/GIF support)
- Cloud-only or non-local voice/LLM paths as primary (local-first remains core)
- Mobile companion or non-desktop packaging

## Context

Brownfield project in `D:\projects\silly\char` (git repo). Existing detailed codebase map in `.planning/codebase/` (ARCHITECTURE, STACK, STRUCTURE, etc.) from prior `/gsd-map-codebase`. Recent prior exploration in `docs/plans/2026-06-10-emote-creation-design.md` + `...-plan.md` (largely implemented as the current custom emote UI and supporting backend).

Heavy local ML focus: PyTorch ecosystem, specific TTS and music models (many vendored with their own inference stacks), Whisper, local LLM backends. Dual runtime (main API server + visual companion). Vanilla JS + Jinja frontend. Windows-centric portable deployment (Launch-*.bat, embedded Python). Emote images in static/custom with mouth pairs for animation. Brain/system prompts and settings presets for customization.

The visual emote capability (backend visibly changes the character image based on model output, synced to voice) plus the user creation flow is the delivered "alive companion" differentiator — the exact layer missing from text-only roleplay tools that dominate >50% of AI usage. This enables immersive story-driven experiences and famous/IP characters that feel physically present.

## Constraints

- **Local-first / privacy**: Primary voice (LocalSoundsAPI/Kokoro), LLM, and inference must remain local and offline-capable; cloud (ElevenLabs, OpenRouter, Gemini) is fallback/optional only.
- **Model compliance**: Local instruct/chat models vary in how well they follow long system rules vs. end-of-prompt instructions; hardening must account for this.
- **Portable deployment**: Vendored Python, tools (ffmpeg, rubberband), and models; no assumption of system packages.
- **UI/UX simplicity**: Current vanilla JS + modal patterns; avoid heavy framework changes in initial hardening.
- **Image assets for emotes**: User-provided transparent PNG pairs (recommended ~600x600, consistent framing for clean lip-sync switches); future roadmap to GIF/animated assets.
- **Story & IP scope**: Immersive story-driven and famous characters add narrative/lore and licensing considerations (deferred beyond v1 foundation).

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Harden character consistency and visual/emote emergence using SillyTavern patterns (strong PHI for rules/visual ownership, rich demonstrative mes_example, specific description, character note/lore anchors, positive framing, instruct-aware structuring) | Current prompts achieve mechanical emote switching but the model does not reliably stay in character or let the visual layer emerge strongly. ST techniques have proven effective for exactly this. This foundation makes immersive story-driven and famous characters viable at scale. | — Pending (primary active work / Phase 1) |
| Keep the explicit model-driven `[emote: name]` tag system (with dynamic customs injection and backend parsing) as the core visual control mechanism | Gives the character agency (model chooses emotion as part of roleplay) and enables clean lip-sync via paired images. Complements rather than replaces future animated/GIF approaches. | — Good (already shipped and effective; will be strengthened) |
| Leave roadmap explicitly open for additional characters, immersive story-driven features, famous/IP characters, and GIF/animated emote evolution | User requirement + market insight: the visual embodiment layer + roleplay demand creates massive upside for story-driven and licensed characters. Static PNG pairs are v1; roadmap to GIFs for higher immersion. | — Pending (ensure phases and data models support extension) |
| Keep emote/character data formats (JSON + image pairs, Tavern-style card) portable and documented for future Civitai adaptability (cards, expression packs, app connections, GIF workflows) | Civitai is the dominant ecosystem for character assets and expression generation. Future phases may add import, export, or direct integration without rewriting core definitions. | — Pending (maintain clean, extensible formats) |
| Local OpenAI-compatible path (llama.cpp / LM Studio / Ollama etc.) is the primary/recommended backend; Gemini ADK is secondary and optional | Matches existing code, deployment reality, and "local-first" core value. Prompt hardening must work especially well for common local instruct models. | — Good (already the default) |

## Platform Vision (Longer-Term)

The current v1 focus (Phase 1 hardening) delivers the reliable visual + voice embodiment layer. Subsequent work can expand into:
- Immersive story-driven characters (deeper lore, long-term memory, narrative consistency)
- Famous / IP characters (asset pipelines, licensing-aware workflows)
- GIF and animated expression support (evolve from static PNG mouth pairs to full animated emotes for superior lip-sync and emotional presence)
- Multi-character platform with Civitai integration for assets and discovery

This positions the project to capture the "missing layer" in the dominant roleplay segment of the AI market.

---

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state (users, feedback, metrics, additional characters, story features, or Civitai/GIF work)

---

*Last updated: 2026-06-14 after user insight on roleplay market + visual embodiment layer + story-driven / famous characters / GIF roadmap direction*