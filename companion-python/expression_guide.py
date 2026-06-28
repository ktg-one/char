"""
Expression taxonomy for companions.

- **Emotions** (SFW): Go-Emotions face/mood tags — many labels can share one drawn face.
- **Scenes** (NSFW+): situational portrait tags — describe what is ON SCREEN, not a feeling.
"""

from __future__ import annotations

from typing import Any

# Default scene tags → what the user actually sees in the LED ring
DEFAULT_SCENE_DESCRIPTIONS: dict[str, str] = {
    "scene": "A narrative still — posed scene shot, not just a face. Use for story beats.",
    "shower": "She is in the shower; water, steam, wet skin visible in the portrait.",
    "bed": "She is on or in bed — lounging, lying down, intimate bedroom context.",
    "undress": "She is undressing or partially undressed; striptease / clothes coming off.",
    "orgasm": "Climax moment — intense pleasure, not a everyday facial expression.",
    "sitting": "Full or mid-body sitting pose, casual or posed.",
}

# Labels that are scenes, not facial emotions (for prompt split + UI)
SCENE_TAGS = frozenset(DEFAULT_SCENE_DESCRIPTIONS.keys())

# Drawing hint: ST labels that usually look identical in art — one sprite can serve many tags
EMOTION_DRAWING_GROUPS: list[dict[str, Any]] = [
    {
        "group": "warm / happy",
        "labels": ["joy", "amusement", "excitement", "love", "admiration", "approval", "gratitude", "optimism", "relief", "pride"],
        "hint": "One bright/smiling face can cover several of these; pick the pic that fits your character's default 'happy'.",
    },
    {
        "group": "soft negative",
        "labels": ["annoyance", "disapproval", "disappointment", "disgust"],
        "hint": "Hard to tell apart in art — one 'unimpressed / irritated' face is enough.",
    },
    {
        "group": "hurt / sad",
        "labels": ["sadness", "grief", "remorse", "disappointment"],
        "hint": "Downcast, tearful, or withdrawn — often one 'hurt' face works for all.",
    },
    {
        "group": "tense / anxious",
        "labels": ["nervousness", "fear", "embarrassment", "confusion", "surprise"],
        "hint": "Wide eyes, blush, or guarded look — can split 2–3 ways max, not five unique drawings.",
    },
    {
        "group": "flirty / wanting",
        "labels": ["desire", "curiosity", "caring"],
        "hint": "SFW flirt vs wanting — desire can stay separate when you add NSFW scene tags later.",
    },
    {
        "group": "neutral baseline",
        "labels": ["neutral", "realization"],
        "hint": "Resting face / listening.",
    },
]


def get_scene_descriptions(overrides: dict[str, str] | None = None) -> dict[str, str]:
    out = dict(DEFAULT_SCENE_DESCRIPTIONS)
    if overrides:
        out.update({k: v for k, v in overrides.items() if k and v})
    return out


def is_scene_tag(label: str) -> bool:
    return (label or "").strip().lower() in SCENE_TAGS


def emotion_labels_only(labels: list[str]) -> list[str]:
    return sorted(l for l in labels if not is_scene_tag(l))


def scene_labels_only(labels: list[str], extra_scenes: list[str] | None = None) -> list[str]:
    scenes = set(SCENE_TAGS)
    if extra_scenes:
        scenes.update(s.strip().lower() for s in extra_scenes)
    return sorted(l for l in labels if l.lower() in scenes or is_scene_tag(l))