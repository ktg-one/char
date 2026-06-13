# Requirements: Luna (Local Visual AI Companion)

**Defined:** 2026-06-14
**Core Value:** A companion that feels consistently alive: personality that holds across turns, a visible face the user can see/refer to, and expressions the model itself decides and that users can extend — all locally.

## v1 Requirements

Requirements for initial hardening milestone. Focused on making the backend model reliably stay in character and let Luna's personality + visual/emote behavior emerge strongly, using SillyTavern best practices, while preserving the shipped emote runtime + creator UI and keeping formats open for future multi-character + Civitai work.

### Character Fidelity & Visual/Emote Emergence (Hardening)

- [ ] **CHAR-01**: Adopt/strengthen SillyTavern-style Post-History Instructions (PHI — last in prompt, high priority) containing the core rules for staying in character as Luna, exact mandatory last-line `[emote: name]` format, visual ownership ("my face", "the image next to you", "your expression", LED ring), and key personality anchors
- [ ] **CHAR-02**: Expand `mes_example` (and in-prompt examples) with multiple rich, demonstrative turns that *show* personality in action, natural in-character references to the visible face/image/LED/expression, correct `[emote: name]` tag usage, and emote choice tied to emotional context (few-shot learning for emergence)
- [ ] **CHAR-03**: Refine the Luna Tavern v3 character card (description + personality fields) for more specific, vivid, expression-aware details so traits are observable in the visible face and behavior; pull a strong public card from Civitai/community as base/inspiration if it accelerates
- [ ] **CHAR-04**: Add Character's Note / Author's Note equivalent (or lightweight character lore) for persistent consistency anchors around visual awareness, emote behavior, and core personality that must not drift
- [ ] **CHAR-05**: Apply positive framing, strategic repetition of key behaviors, and instruct-aware message construction (system + examples + history + PHI) when building prompts for local backends so models reliably follow the visual/emote rules and stay in character
- [ ] **CHAR-06**: Keep the model-driven `[emote: name]` tag mechanism (character agency) as primary while strengthening it with the above; document possibility of hybrid (ST-style classifier fallback) in future

### Portability & Future Openness (Non-Functional for v1)

- [ ] **PORT-01**: Ensure emote/character definition formats (JSON structure with name/keywords/color + closed/open image pairs, Tavern-style card) remain clean, documented, and extensible so additional characters and Civitai card/expression pack/app connections can be added without core rewrites

## v2 Requirements

Deferred (acknowledged for later roadmap).

### Multi-Character Support

- **MULTI-01**: Support switching between multiple characters (each with own card, emote set, and visual assets)
- **MULTI-02**: Shared or per-character settings for voice, prompt overrides, and emote behavior

### Civitai Ecosystem Integration

- **CIV-01**: Import character cards and/or expression packs directly from Civitai
- **CIV-02**: Export Luna (or other) cards + emote image sets in Civitai-compatible format
- **CIV-03**: Optional generative expression images using Civitai models / LoRAs (beyond user-provided static pairs)

## Out of Scope

Explicitly excluded for this initialization / first milestone. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Full multi-character implementation or switching UI | Roadmap explicitly left open; v1 focuses on hardening one flagship (Luna) |
| Direct Civitai app connection, import/export code, or expression pack integration | Formats kept portable/adaptable as non-functional; actual work deferred |
| Switching from model-driven tag to pure classifier-based expressions (or vice-versa) | Current agency design is kept and strengthened; hybrid noted as possible future |
| Generative (AI-created) emote images | Current system is user-provided static PNG pairs with lip-sync |
| Non-local primary voice or LLM | Local-first (LocalSoundsAPI + local backends) remains core constraint |
| Mobile companion or non-desktop packaging | Out of current brownfield scope |

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
*Last updated: 2026-06-14 after initial definition (hardening scope from ST patterns + user direction for multi-char + Civitai openness)*