"""
SillyTavern-compatible expression system for Luna.

Mirrors ST Character Expressions extension:
- 28 Go-Emotions labels (distilbert-base-uncased-go-emotions)
- Flat sprite folders per character: data/characters/<name>/
- Filename = label (joy.png, anger.gif, joy-1.png)
- ZIP sprite pack import (flat structure)
- Local text classification when model omits [emote: tag]

Reference: https://docs.sillytavern.app/extensions/expression-images/
"""

from __future__ import annotations

import io
import os
import re
import zipfile
from typing import Any

# SillyTavern DEFAULT_EXPRESSIONS (public/scripts/extensions/expressions/index.js)
DEFAULT_EXPRESSIONS = [
    "admiration",
    "amusement",
    "anger",
    "annoyance",
    "approval",
    "caring",
    "confusion",
    "curiosity",
    "desire",
    "disappointment",
    "disapproval",
    "disgust",
    "embarrassment",
    "excitement",
    "fear",
    "gratitude",
    "grief",
    "joy",
    "love",
    "nervousness",
    "optimism",
    "pride",
    "realization",
    "relief",
    "remorse",
    "sadness",
    "surprise",
    "neutral",
]

DEFAULT_FALLBACK_EXPRESSION = "joy"

# Legacy Luna 8-emote names -> ST labels (backward compat for cards/prompts)
LEGACY_ALIASES = {
    "happy": "joy",
    "sad": "sadness",
    "excited": "excitement",
    "angry": "anger",
    "surprised": "surprise",
    "tired": "neutral",
    "confused": "confusion",
    "flirty": "desire",
    "smile": "joy",
    "shy": "embarrassment",
    "confident": "pride",
    "calm": "neutral",
    "playful": "amusement",
    "blush": "embarrassment",
}

SPRITE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".mp4", ".webm"}
ANIMATED_EXTENSIONS = {".gif", ".webp", ".mp4", ".webm"}

_CLASSIFIER = None
_CLASSIFY_CACHE: dict[str, str] = {}

EMOTE_TAG_RE = re.compile(r"\[emote:\s*([\w-]+)\s*\]", re.IGNORECASE)
# ST multi-sprite naming: joy.png, joy-1.png, joy.extra.png
SPRITE_NAME_RE = re.compile(
    r"^([a-z][a-z0-9_-]*?)(?:[-.]([a-z0-9_.-]+))?$", re.IGNORECASE
)


def normalize_expression(name: str) -> str:
    """Map legacy/custom names to a canonical ST label when possible."""
    if not name:
        return DEFAULT_FALLBACK_EXPRESSION
    key = name.strip().lower().replace(" ", "_")
    if key in LEGACY_ALIASES:
        return LEGACY_ALIASES[key]
    if key in DEFAULT_EXPRESSIONS:
        return key
    return key  # custom expression (ST allows user-defined labels)


def is_default_expression(name: str) -> bool:
    return normalize_expression(name) in DEFAULT_EXPRESSIONS


def parse_sprite_filename(filename: str) -> str | None:
    """Return expression label from ST-style flat sprite filename."""
    base, ext = os.path.splitext(filename)
    if ext.lower() not in SPRITE_EXTENSIONS:
        return None
    match = SPRITE_NAME_RE.match(base)
    if not match:
        return None
    label = match.group(1).lower()
    if label in DEFAULT_EXPRESSIONS or label in LEGACY_ALIASES:
        return normalize_expression(label)
    return label  # custom


def get_characters_dir(app_root: str) -> str:
    return os.path.join(app_root, "data", "characters")


def get_sprite_folder(app_root: str, character: str) -> str:
    safe = re.sub(r"[^\w\- ]", "", character).strip() or "Luna"
    return os.path.join(get_characters_dir(app_root), safe)


def sprite_url(character: str, filename: str) -> str:
    from urllib.parse import quote

    char = quote(character)
    file = quote(filename)
    return f"/sprites/{char}/{file}"


def list_character_sprites(app_root: str, character: str) -> dict[str, list[dict[str, str]]]:
    """Scan flat sprite folder; group by expression label (ST convention)."""
    folder = get_sprite_folder(app_root, character)
    grouped: dict[str, list[dict[str, str]]] = {}
    if not os.path.isdir(folder):
        return grouped
    for filename in sorted(os.listdir(folder)):
        label = parse_sprite_filename(filename)
        if not label:
            continue
        path = os.path.join(folder, filename)
        if not os.path.isfile(path):
            continue
        ext = os.path.splitext(filename)[1].lower()
        entry = {
            "fileName": filename,
            "imageSrc": sprite_url(character, filename),
            "animated": ext in ANIMATED_EXTENSIONS,
        }
        grouped.setdefault(label, []).append(entry)
    return grouped


def choose_sprite(
    sprites: dict[str, list[dict[str, str]]], expression: str
) -> dict[str, str] | None:
    """Pick first sprite for expression; ST randomizes among multiples — we take first."""
    files = sprites.get(expression) or sprites.get(normalize_expression(expression))
    if not files:
        return None
    return files[0]


def default_expression_url(label: str) -> str:
    """ST bundled emoji-style fallback sprites."""
    return f"/static/img/default-expressions/{label}.png"


def resolve_expression_images(
    app_root: str,
    character: str,
    expression: str,
    emote_registry: dict[str, Any] | None = None,
) -> dict[str, str]:
    """
    Resolve resting/speaking image URLs for an expression.
    Priority: emotes.json custom > character sprite folder > ST default emoji.
    """
    label = normalize_expression(expression)
    images: dict[str, str] = {}

    if emote_registry:
        for entry in emote_registry.get("custom", []):
            if (entry.get("name") or "").lower() == label:
                images = dict(entry.get("images") or {})
                break
            # legacy name match
            if normalize_expression(entry.get("name", "")) == label:
                images = dict(entry.get("images") or {})
                break

    if not images:
        sprites = list_character_sprites(app_root, character)
        sprite = choose_sprite(sprites, label)
        if sprite:
            src = sprite["imageSrc"]
            images = {"closed": src, "open": src}
            if sprite.get("animated"):
                images["gif"] = src

    if not images.get("closed"):
        fallback = default_expression_url(label if label in DEFAULT_EXPRESSIONS else "neutral")
        images.setdefault("closed", fallback)
        images.setdefault("open", fallback)

    return images


def _load_classifier():
    global _CLASSIFIER
    if _CLASSIFIER is not None:
        return _CLASSIFIER
    try:
        from transformers import pipeline

        _CLASSIFIER = pipeline(
            "text-classification",
            model="joeddav/distilbert-base-uncased-go-emotions-student",
            top_k=1,
        )
    except Exception as exc:
        print(f"[expressions] Classifier unavailable: {exc}")
        _CLASSIFIER = False
    return _CLASSIFIER


def classify_text(text: str) -> str:
    """
    ST local classify: pick top Go-Emotion label from reply text.
    Same 28 labels as Cohee/distilbert-base-uncased-go-emotions-onnx.
    """
    cleaned = (text or "").strip()
    if not cleaned:
        return DEFAULT_FALLBACK_EXPRESSION
    if cleaned in _CLASSIFY_CACHE:
        return _CLASSIFY_CACHE[cleaned]

    pipe = _load_classifier()
    if pipe:
        try:
            result = pipe(cleaned[:512])
            if result and result[0]:
                top = result[0][0] if isinstance(result[0], list) else result[0]
                label = normalize_expression(top.get("label", DEFAULT_FALLBACK_EXPRESSION))
                _CLASSIFY_CACHE[cleaned] = label
                return label
        except Exception as exc:
            print(f"[expressions] Classify failed: {exc}")

    label = _keyword_classify(cleaned)
    _CLASSIFY_CACHE[cleaned] = label
    return label


def _keyword_classify(text: str) -> str:
    """Keyword fallback mapped to ST labels when ONNX/transformers unavailable."""
    lower = text.lower()
    rules = [
        (["shower", "wet hair", "bath"], "shower"),
        (["orgasm", "squirting", "climax"], "orgasm"),
        (["undress", "strip", "take off"], "desire"),
        (["bed", "lying down", "on the bed"], "bed"),
        (["scene", "pose", "picture"], "scene"),
        (["love", "adore", "cherish"], "love"),
        (["flirt", "sexy", "seduc", "desire", "want you"], "desire"),
        (["happy", "glad", "joy", "smile", "great", "awesome"], "joy"),
        (["excited", "thrilled", "pumped", "yay", "wow"], "excitement"),
        (["sad", "sorry", "hurt", "cry", "grief", "lonely"], "sadness"),
        (["angry", "mad", "furious", "rage", "annoyed"], "anger"),
        (["surprise", "shocked", "amazed"], "surprise"),
        (["confus", "puzzled", "uncertain", "huh"], "confusion"),
        (["scared", "afraid", "fear", "terrified"], "fear"),
        (["thank", "grateful", "appreciate"], "gratitude"),
        (["proud", "confident", "nailed"], "pride"),
        (["nervous", "anxious", "worried"], "nervousness"),
        (["blush", "embarrass", "shy"], "embarrassment"),
        (["curious", "wonder", "interesting"], "curiosity"),
        (["care", "comfort", "here for you"], "caring"),
    ]
    for words, label in rules:
        if any(w in lower for w in words):
            return label
    return "neutral"


def determine_expression(
    user_message: str,
    response: str,
    emote_registry: dict[str, Any],
    *,
    use_classifier: bool = True,
    extra_labels: set[str] | None = None,
) -> str:
    """
    Resolve expression for a reply.
    Priority: [emote: tag] > custom keywords > ST classifier > keyword fallback.
    """
    response_text = response or ""
    tag_match = EMOTE_TAG_RE.search(response_text)
    if tag_match:
        raw = tag_match.group(1)
        label = normalize_expression(raw)
        known = {e["name"].lower() for e in emote_registry.get("custom", [])}
        known.update(DEFAULT_EXPRESSIONS)
        known.update(LEGACY_ALIASES.keys())
        if extra_labels:
            known.update(extra_labels)
        if label in known or raw.lower() in known:
            return label
        return DEFAULT_FALLBACK_EXPRESSION

    combined = f"{user_message or ''} {response_text}".lower()
    for entry in emote_registry.get("custom", []):
        keywords = entry.get("keywords") or []
        if any(str(k).lower() in combined for k in keywords):
            return normalize_expression(entry["name"])

    classify_source = response_text.strip() or user_message or ""
    if use_classifier and classify_source:
        return classify_text(classify_source)

    return _keyword_classify(combined)


def import_sprite_zip(app_root: str, character: str, zip_bytes: bytes) -> dict[str, Any]:
    """
    ST sprite pack import — flat ZIP, filenames must match expression labels.
    Returns {imported: [...], skipped: [...]}.
    """
    folder = get_sprite_folder(app_root, character)
    os.makedirs(folder, exist_ok=True)
    imported: list[str] = []
    skipped: list[str] = []

    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        for info in zf.infolist():
            if info.is_dir():
                skipped.append(f"{info.filename} (folder not allowed)")
                continue
            # flat structure only — reject any nested path (ST ZIP import rule)
            archive_name = info.filename.replace("\\", "/").lstrip("/")
            if "/" in archive_name:
                skipped.append(f"{info.filename} (nested path)")
                continue
            name = archive_name
            if not parse_sprite_filename(name):
                skipped.append(name or info.filename)
                continue
            dest = os.path.join(folder, name)
            with zf.open(info) as src, open(dest, "wb") as out:
                out.write(src.read())
            imported.append(name)

    return {"imported": imported, "skipped": skipped, "character": character}


def emote_api_payload(
    app_root: str, character: str, emote_registry: dict[str, Any]
) -> dict[str, Any]:
    """Combined payload for /api/emotes — registry + ST metadata + sprites."""
    from characters import list_all_character_sprites, scan_character_assets

    catalog = scan_character_assets(app_root, character)
    sprites = list_all_character_sprites(app_root, character)
    custom_labels = sorted(
        set(catalog.get("custom_expressions") or [])
        | set(sprites.keys())
        - set(DEFAULT_EXPRESSIONS)
    )
    return {
        **emote_registry,
        "expressions": {
            "labels": DEFAULT_EXPRESSIONS,
            "custom_labels": custom_labels,
            "fallback": DEFAULT_FALLBACK_EXPRESSION,
            "character": character,
            "sprites": sprites,
            "gallery": catalog.get("gallery") or [],
            "videos": catalog.get("videos") or [],
            "legacy_aliases": LEGACY_ALIASES,
            "classifier": "joeddav/distilbert-base-uncased-go-emotions-student",
        },
    }