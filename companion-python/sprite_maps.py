"""Per-character manual sprite picks — user assigns image files to expression tags."""

from __future__ import annotations

import json
import os
from typing import Any

SPRITE_MAPS_FILE = "sprite_maps.json"


def sprite_maps_path(app_root: str) -> str:
    return os.path.join(app_root, "data", SPRITE_MAPS_FILE)


def load_sprite_maps(app_root: str) -> dict[str, Any]:
    path = sprite_maps_path(app_root)
    if not os.path.exists(path):
        return {"characters": {}}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_sprite_maps(app_root: str, state: dict[str, Any]) -> None:
    path = sprite_maps_path(app_root)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2)


def _bootstrap_from_emotes_json(app_root: str, character: str) -> dict[str, str]:
    """One-time migration: emotes.json custom closed images → sprite_map filenames."""
    from characters import normalize_emote_registry, resolve_custom_image_url

    emotes_path = os.path.join(app_root, "data", "emotes.json")
    if not os.path.isfile(emotes_path):
        return {}
    with open(emotes_path, "r", encoding="utf-8") as f:
        registry = normalize_emote_registry(app_root, json.load(f))
    mapping: dict[str, str] = {}
    for entry in registry.get("custom", []):
        name = (entry.get("name") or "").strip()
        closed = (entry.get("images") or {}).get("closed") or ""
        if not name or not closed:
            continue
        resolved = resolve_custom_image_url(app_root, closed)
        mapping[name] = os.path.basename(
            resolved.split("/static/images/custom/")[-1]
        )
    if mapping:
        return set_character_sprite_map(app_root, character, mapping)
    return {}


def get_character_sprite_map(app_root: str, character: str) -> dict[str, str]:
    state = load_sprite_maps(app_root)
    raw = state.get("characters", {}).get(character, {})
    cleaned = {k: v for k, v in raw.items() if isinstance(v, str) and v}
    if cleaned:
        return cleaned
    # Legacy Luna: seed Pick pics from data/emotes.json on first access
    if character == "Luna":
        return _bootstrap_from_emotes_json(app_root, character)
    return {}


def set_character_sprite_map(app_root: str, character: str, mapping: dict[str, str]) -> dict[str, str]:
    state = load_sprite_maps(app_root)
    chars = state.setdefault("characters", {})
    cleaned = {str(k).strip(): os.path.basename(str(v).strip()) for k, v in mapping.items() if k and v}
    chars[character] = cleaned
    save_sprite_maps(app_root, state)
    return cleaned


def assign_sprite(app_root: str, character: str, expression: str, filename: str) -> dict[str, str]:
    current = get_character_sprite_map(app_root, character)
    current[expression.strip()] = os.path.basename(filename.strip())
    return set_character_sprite_map(app_root, character, current)


def clear_sprite_assignment(app_root: str, character: str, expression: str) -> dict[str, str]:
    current = get_character_sprite_map(app_root, character)
    current.pop(expression.strip(), None)
    return set_character_sprite_map(app_root, character, current)