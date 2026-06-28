# Requirements: Luna (Local Visual AI Companion)

**Defined:** 2026-06-14
**Core Value:** The roleplay experience you can *see and hear* reacting in real time — the visual and vocal embodiment layer that pure text companions lack. Personality that holds, a visible character the user can refer to, expressions the model itself decides, and user-extensible visuals — all local and story-immersive.

## v1 Requirements

Requirements for initial hardening milestone. Focused on making the backend model reliably stay in character and let Luna's personality + visual/emote behavior emerge strongly, using SillyTavern best practices. This is the foundation that makes immersive story-driven characters and famous IPs "kill it" with the visual layer.

### Character Fidelity & Visual/Emote Emergence (Hardening)

- [ ] **CHAR-01**: Adopt/strengthen SillyTavern-style Post-History Instructions (PHI — last in prompt, high priority) containing the core rules for staying in character as Luna, exact mandatory last-line `[emote: name]` format, visual ownership ("my face", "the image next to you", "your expression", LED ring), and key personality anchors
- [ ] **CHAR-02**: Expand `mes_example` (and in-prompt examples) with multiple rich, demonstrative turns that *show* personality in action, natural in-character references to the visible face/image/LED/expression, correct `[emote: name]` tag usage, and emote choice tied to emotional context (few-shot learning for emergence)
- [~] **CHAR-03**: Refine the Luna Tavern v3 character card (description + personality fields) for more specific, vivid, expression-aware details so traits are observable in the visible face and behavior; pull a strong public card from Civitai/community as base/inspiration if it accelerates — *partial: June Chub card mirrored to `luna-character.json` (2026-06-28); needs live model validation*
- [ ] **CHAR-04**: Add Character's Note / Author's Note equivalent (or lightweight character lore) for persistent consistency anchors around visual awareness, emote behavior, and core personality that must not drift
- [ ] **CHAR-05**: Apply positive framing, strategic repetition of key behaviors, and instruct-aware message construction (system + examples + history + PHI) when building prompts for local backends so models reliably follow the visual/emote rules and stay in character
- [ ] **CHAR-06**: Keep the model-driven `[emote: name]` tag mechanism (character agency) as primary while strengthening it with the above; document possibility of hybrid (ST-style classifier fallback) in future

### Portability & Future Openness (Non-Functional for v1)

- [~] **PORT-01**: Ensure emote/character definition formats (JSON structure with name/keywords/color + closed/open image pairs, Tavern-style card) remain clean, documented, and extensible so additional characters, story-driven features, and Civitai card/expression pack/app connections (including future GIF workflows) can be added without core rewrites — *partial: `EMOTE_GUIDE.md`, `characters.example.json`, `sprite_maps.json` pattern, gitignored per-machine state (2026-06-28)*

## v2 Requirements

Deferred (acknowledged for later roadmap). These build on the v1 hardening foundation to deliver the full product vision: immersive story-driven roleplay with the visual embodiment layer.

### Immersive Story-Driven Characters

- **STORY-01**: Support for long-term narrative consistency, character memory across sessions, and story state tracking (e.g., via enhanced lorebooks or dedicated memory systems)
- **STORY-02**: Tools or card extensions for branching story elements, world-building, and plot-aware responses while maintaining visual/emote reactivity
- **STORY-03**: Multi-scene / multi-arc character experiences where the visual state (emotes, expressions) evolves with the story

### Famous / IP Characters

- **IP-01**: Support for well-known characters (famous people, fictional IPs) with accurate personality, voice style, and visual representation
- **IP-02**: Asset pipelines (via Civitai or similar) for generating consistent images/GIFs for famous characters while respecting the emote + lip-sync system
- **IP-03**: Licensing / usage guardrails and documentation for commercial or public deployment of IP-based characters

### Animated Expression / GIF Support (Roadmap to GIFs)

- **GIF-01**: Replace or augment static PNG closed/open mouth pairs with animated GIFs or sprite sequences for superior lip-sync and emotional expression during TTS playback
- **GIF-02**: User-extensible animated emote system (GIF upload / pack support in the creator UI, with the same keyword + tag control)
- **GIF-03**: Civitai integration hooks for discovering / importing pre-made GIF expression packs and mapping them to the [emote: name] system
- **GIF-04**: Performance considerations for animated assets (loading, caching, fallback to static PNGs)

### Multi-Character Platform

- **MULTI-01**: Support switching between multiple characters (each with own card, emote set / GIF pack, and visual assets)
- **MULTI-02**: Shared or per-character settings for voice, prompt overrides, story state, and emote behavior
- **MULTI-03**: Platform-level features for managing a library of story-driven or famous characters

## Out of Scope (v1)

Explicitly excluded for this initialization / first milestone. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Full multi-character implementation or switching UI | Roadmap explicitly left open; v1 focuses on hardening the visual embodiment foundation for one flagship (extendable later) |
| Direct Civitai app connection, card import/export, GIF pack integration, or story tools | Formats kept portable/adaptable as non-functional; actual implementation deferred |
| Generative expression images or full GIF animation | Current system is user-provided static PNG pairs with lip-sync; roadmap to animated/GIF support |
| Cloud-only or non-local voice or LLM paths as primary | Local-first (LocalSoundsAPI + local backends) remains core constraint |
| Mobile companion or non-desktop packaging | Out of current brownfield scope |
| Licensing, commercial distribution, or public IP character hosting | Legal/commercial considerations deferred until after technical foundation |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CHAR-01 | Phase 1 | Pending |
| CHAR-02 | Phase 1 | Pending |
| CHAR-03 | Phase 1 | Pending |
| CHAR-04 | Phase 1 | Pending |
| CHAR-05 | Phase 1 | Pending |
| CHAR-06 | Phase 1 | Pending |
| PORT-01 | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 7 total
- Mapped to phases: 7
- Unmapped: 0 ✓

---

*Requirements defined: 2026-06-14*
*Last updated: 2026-06-14 after user insight on roleplay market + visual embodiment layer + immersive story-driven characters + famous IPs + roadmap to GIFs*