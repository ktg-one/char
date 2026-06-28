"""
Per-character familiarity (XP → levels) gates companion access and intimate content.

- Global level = highest familiarity level across all characters (unlocks new companions).
- Per-character level gates expressions, gallery, videos, and RP intimacy tone.
"""

from __future__ import annotations

import json
import os
from typing import Any

FAMILIARITY_FILE = "familiarity.json"

# Cumulative XP thresholds: index = level (1-based), value = min XP for that level
LEVEL_XP_THRESHOLDS = [0, 25, 60, 120, 200, 320, 480, 700, 1000, 1400, 1900]

XP_PER_USER_MESSAGE = 12
XP_PER_ASSISTANT_REPLY = 8

FAMILIARITY_TONE: dict[int, str] = {
    1: "Polite and introductory. Light warmth only — you're still getting to know them.",
    2: "Comfortable banter and mild flirtation. You're warming up.",
    3: "Open flirtation and emotional honesty. Vulnerable moments are okay.",
    4: "Deep trust — bold teasing, intimate scenarios, and matching visuals when tagged.",
    5: "Maximum closeness — uninhibited intimacy in voice and sprites that are unlocked.",
}


def familiarity_path(app_root: str) -> str:
    return os.path.join(app_root, "data", FAMILIARITY_FILE)


def default_familiarity_state() -> dict[str, Any]:
    return {"characters": {}}


def load_familiarity(app_root: str) -> dict[str, Any]:
    path = familiarity_path(app_root)
    if not os.path.exists(path):
        return default_familiarity_state()
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_familiarity(app_root: str, state: dict[str, Any]) -> None:
    path = familiarity_path(app_root)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2)


def level_from_xp(xp: int) -> int:
    xp = max(0, xp)
    level = 1
    for i, threshold in enumerate(LEVEL_XP_THRESHOLDS):
        if xp >= threshold:
            level = max(level, i + 1)
    return min(level, len(LEVEL_XP_THRESHOLDS))


def xp_for_next_level(level: int) -> int | None:
    if level >= len(LEVEL_XP_THRESHOLDS):
        return None
    return LEVEL_XP_THRESHOLDS[level]


def progress_to_next_level(xp: int) -> dict[str, Any]:
    level = level_from_xp(xp)
    next_threshold = xp_for_next_level(level)
    if next_threshold is None:
        return {"level": level, "xp": xp, "progress": 1.0, "next_xp": None}
    prev_threshold = LEVEL_XP_THRESHOLDS[level - 1] if level > 1 else 0
    span = max(1, next_threshold - prev_threshold)
    progress = min(1.0, (xp - prev_threshold) / span)
    return {"level": level, "xp": xp, "progress": round(progress, 3), "next_xp": next_threshold}


def get_character_familiarity(app_root: str, character: str) -> dict[str, Any]:
    state = load_familiarity(app_root)
    raw = state.get("characters", {}).get(character, {})
    xp = int(raw.get("xp", 0))
    prog = progress_to_next_level(xp)
    return {
        "character": character,
        "xp": xp,
        "messages": int(raw.get("messages", 0)),
        **prog,
    }


def global_familiarity_level(app_root: str) -> int:
    state = load_familiarity(app_root)
    levels = [
        level_from_xp(int(entry.get("xp", 0)))
        for entry in state.get("characters", {}).values()
    ]
    return max(levels) if levels else 1


def grant_familiarity_xp(
    app_root: str,
    character: str,
    *,
    user_message: bool = False,
    assistant_reply: bool = False,
) -> dict[str, Any]:
    state = load_familiarity(app_root)
    chars = state.setdefault("characters", {})
    entry = chars.setdefault(character, {"xp": 0, "messages": 0})
    before = progress_to_next_level(int(entry.get("xp", 0)))

    if user_message:
        entry["xp"] = int(entry.get("xp", 0)) + XP_PER_USER_MESSAGE
        entry["messages"] = int(entry.get("messages", 0)) + 1
    if assistant_reply:
        entry["xp"] = int(entry.get("xp", 0)) + XP_PER_ASSISTANT_REPLY

    after = progress_to_next_level(int(entry["xp"]))
    save_familiarity(app_root, state)

    return {
        "character": character,
        "xp_gained": (XP_PER_USER_MESSAGE if user_message else 0)
        + (XP_PER_ASSISTANT_REPLY if assistant_reply else 0),
        "before_level": before["level"],
        "after_level": after["level"],
        "leveled_up": after["level"] > before["level"],
        **after,
        "global_level": global_familiarity_level(app_root),
    }


def required_level_for_expression(
    content_unlocks: dict[str, Any],
    expression: str,
) -> int:
    expr_map = content_unlocks.get("expressions") or {}
    if isinstance(expr_map, dict) and expression in expr_map:
        return max(1, int(expr_map[expression]))
    default_min = content_unlocks.get("default_expression_level")
    if default_min is not None:
        return max(1, int(default_min))
    return 1


def required_level_for_gallery(content_unlocks: dict[str, Any]) -> int:
    return max(1, int(content_unlocks.get("gallery", 1)))


def required_level_for_videos(content_unlocks: dict[str, Any]) -> int:
    return max(1, int(content_unlocks.get("videos", 1)))


def is_expression_unlocked(
    content_unlocks: dict[str, Any],
    expression: str,
    familiarity_level: int,
) -> bool:
    return familiarity_level >= required_level_for_expression(content_unlocks, expression)


def clamp_expression_to_unlocked(
    content_unlocks: dict[str, Any],
    expression: str,
    familiarity_level: int,
    *,
    fallback: str = "neutral",
) -> str:
    if is_expression_unlocked(content_unlocks, expression, familiarity_level):
        return expression
    # Step down to nearest unlocked tier
    req = required_level_for_expression(content_unlocks, expression)
    if familiarity_level < req:
        safe = ["neutral", "joy", "curiosity", fallback]
        for candidate in safe:
            if is_expression_unlocked(content_unlocks, candidate, familiarity_level):
                return candidate
    return fallback


def familiarity_tone_for_level(level: int) -> str:
    tier = min(max(level, 1), max(FAMILIARITY_TONE.keys()))
    while tier >= 1 and tier not in FAMILIARITY_TONE:
        tier -= 1
    return FAMILIARITY_TONE.get(tier, FAMILIARITY_TONE[1])


def familiarity_summary(app_root: str) -> dict[str, Any]:
    state = load_familiarity(app_root)
    per_char = {
        name: progress_to_next_level(int(entry.get("xp", 0)))
        for name, entry in state.get("characters", {}).items()
    }
    return {
        "global_level": global_familiarity_level(app_root),
        "characters": per_char,
        "thresholds": LEVEL_XP_THRESHOLDS,
    }