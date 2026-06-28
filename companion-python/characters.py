"""
Character registry and asset catalog for multi-character companions.

Supports:
- Built-in characters (Luna) with local sprite folders
- External asset folders (Asuka on F:\\ART\\...) with Civitai-style filenames
- Filename keyword → SillyTavern expression mapping
"""

from __future__ import annotations

import json
import os
import re
from typing import Any

from expressions import (
    ANIMATED_EXTENSIONS,
    DEFAULT_EXPRESSIONS,
    DEFAULT_FALLBACK_EXPRESSION,
    get_sprite_folder,
    list_character_sprites,
    normalize_expression,
    parse_sprite_filename,
    sprite_url,
)

CHARACTERS_FILE = "characters.json"

# Safe character id: alphanumeric, first char upper (Luna, Miku, …)
_ID_RE = re.compile(r"[^\w\s-]")

# Civitai / prompt fragment → ST expression (longer rules first)
FILENAME_EXPRESSION_RULES: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"nsfw-orgasm|squirting|orgasm", re.I), "excitement"),
    (re.compile(r"nsfw-undress|undress|stripteas", re.I), "desire"),
    (re.compile(r"nsfw-shower|shower", re.I), "shower"),
    (re.compile(r"nsfw-bed|\bbed\b", re.I), "bed"),
    (re.compile(r"nsfw-sitting|\bsitting\b", re.I), "neutral"),
    (re.compile(r"screaming", re.I), "fear"),
    (re.compile(r"mouth\s*open", re.I), "surprise"),
    (re.compile(r"eyes\s*closed", re.I), "nervousness"),
    (re.compile(r"suggestive|rating_explicit", re.I), "desire"),
    (re.compile(r"wet\s*panties|pussy_focus|ground_view", re.I), "desire"),
    (re.compile(r"full-body|dynamic\s*depth", re.I), "neutral"),
    (re.compile(r"asuka[-_]scene", re.I), "scene"),
]

ASUKA_SCENE_TAGS = ["scene", "shower", "bed", "undress", "orgasm"]
ASUKA_CUSTOM_EXPRESSIONS = ASUKA_SCENE_TAGS  # scenes, not face emotions


def characters_config_path(app_root: str) -> str:
    return os.path.join(app_root, "data", CHARACTERS_FILE)


def sanitize_character_id(raw: str) -> str:
    s = _ID_RE.sub("", (raw or "").strip())
    s = re.sub(r"\s+", "", s)
    if not s:
        return ""
    return s[0].upper() + s[1:] if len(s) > 1 else s.upper()


def default_characters_config() -> dict[str, Any]:
    return {
        "active": "Asuka",
        "characters": {
            "Luna": {
                "display_name": "Luna",
                "card": "luna-character.json",
                "sprite_source": "local",
                "sprite_path": None,
                "unlock_level": 0,
                "content_unlocks": {},
            },
            "Asuka": {
                "display_name": "Asuka Langley",
                "card": "asuka-character.json",
                "sprite_source": "external",
                "sprite_path": r"F:\ART\.KTG\200WildcardsNSFWAnd_v20\Asuka",
                "unlock_level": 1,
                "content_unlocks": {
                    "gallery": 2,
                    "videos": 3,
                    "expressions": {
                        "desire": 2,
                        "excitement": 2,
                        "scene": 2,
                        "shower": 3,
                        "bed": 4,
                        "undress": 4,
                        "orgasm": 5,
                    },
                },
            },
        },
    }


def load_characters_config(app_root: str) -> dict[str, Any]:
    path = characters_config_path(app_root)
    if not os.path.exists(path):
        example = os.path.join(app_root, "data", "characters.example.json")
        if os.path.exists(example):
            with open(example, "r", encoding="utf-8") as f:
                cfg = json.load(f)
        else:
            cfg = default_characters_config()
        save_characters_config(app_root, cfg)
        return cfg
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_characters_config(app_root: str, config: dict[str, Any]) -> None:
    path = characters_config_path(app_root)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)


def get_character_entry(app_root: str, name: str) -> dict[str, Any]:
    cfg = load_characters_config(app_root)
    return cfg.get("characters", {}).get(name, {})


def resolve_sprite_directory(app_root: str, character: str) -> str | None:
    entry = get_character_entry(app_root, character)
    if entry.get("sprite_source") == "external":
        path = entry.get("sprite_path") or ""
        return path if path and os.path.isdir(path) else None
    folder = get_sprite_folder(app_root, character)
    return folder if os.path.isdir(folder) else None


def infer_expression_from_filename(filename: str) -> str:
    """Map Civitai-style filenames to ST/custom expression labels."""
    st_label = parse_sprite_filename(filename)
    if st_label and st_label in DEFAULT_EXPRESSIONS:
        return st_label

    base = os.path.splitext(filename)[0]
    for pattern, label in FILENAME_EXPRESSION_RULES:
        if pattern.search(base) or pattern.search(filename):
            return label
    return "neutral"


def scan_character_assets(app_root: str, character: str) -> dict[str, Any]:
    """Build expression catalog from flat asset folder."""
    folder = resolve_sprite_directory(app_root, character)
    sprites: dict[str, list[dict[str, Any]]] = {}
    gallery: list[dict[str, Any]] = []
    videos: list[dict[str, Any]] = []

    if not folder:
        return {"sprites": sprites, "gallery": gallery, "videos": videos, "folder": None}

    for filename in sorted(os.listdir(folder)):
        full = os.path.join(folder, filename)
        if not os.path.isfile(full):
            continue
        ext = os.path.splitext(filename)[1].lower()
        if ext not in {".png", ".jpg", ".jpeg", ".gif", ".webp", ".mp4", ".webm"}:
            continue

        label = infer_expression_from_filename(filename)
        entry = {
            "fileName": filename,
            "imageSrc": sprite_url(character, filename),
            "animated": ext in ANIMATED_EXTENSIONS,
            "expression": label,
        }

        if ext in {".mp4", ".webm"}:
            videos.append({**entry, "videoSrc": entry["imageSrc"]})
            sprites.setdefault(label, []).append(entry)
            continue

        if label == "scene" or re.search(r"asuka[-_]scene", filename, re.I):
            gallery.append(
                {
                    "id": filename,
                    "label": filename,
                    "preview": entry["imageSrc"],
                    "expression": "scene",
                }
            )

        sprites.setdefault(label, []).append(entry)

    return {
        "sprites": sprites,
        "gallery": gallery,
        "videos": videos,
        "folder": folder,
        "custom_expressions": ASUKA_CUSTOM_EXPRESSIONS if character == "Asuka" else [],
    }


def legacy_custom_images_dir(app_root: str) -> str:
    """Pre–sprite_map Luna art lives here (paired with data/emotes.json)."""
    return os.path.join(app_root, "static", "images", "custom")


_CUSTOM_IMAGE_EXTS = (".jpeg", ".jpg", ".png", ".webp", ".gif")


def resolve_custom_image_url(app_root: str, url_or_filename: str) -> str:
    """
    Map emotes.json paths to files on disk.
    Tolerates .jpeg/.jpg renames and dropped luna- prefixes.
    """
    folder = legacy_custom_images_dir(app_root)
    if not url_or_filename:
        return url_or_filename
    basename = os.path.basename(
        url_or_filename.split("/static/images/custom/")[-1]
    )
    stem, _ext = os.path.splitext(basename)
    stems = [stem]
    if stem.startswith("luna-"):
        stems.append(stem[5:])
    else:
        stems.append(f"luna-{stem}")
    for s in dict.fromkeys(stems):
        for ext in _CUSTOM_IMAGE_EXTS:
            candidate = f"{s}{ext}"
            if os.path.isfile(os.path.join(folder, candidate)):
                return f"/static/images/custom/{candidate}"
    return (
        f"/static/images/custom/{basename}"
        if basename
        else url_or_filename
    )


def normalize_emote_registry(app_root: str, registry: dict[str, Any]) -> dict[str, Any]:
    """Resolve custom emote image URLs to whatever extension exists on disk."""
    custom = registry.get("custom")
    if not isinstance(custom, list):
        return registry
    for entry in custom:
        images = entry.get("images")
        if not isinstance(images, dict):
            continue
        for slot in ("closed", "open", "gif", "video", "webm", "mp4"):
            raw = images.get(slot)
            if isinstance(raw, str) and raw.strip():
                images[slot] = resolve_custom_image_url(app_root, raw.strip())
    return registry


def _iter_asset_files(folder: str) -> list[tuple[str, str]]:
    """Return (filename, absolute path) for supported media in folder."""
    if not folder or not os.path.isdir(folder):
        return []
    out: list[tuple[str, str]] = []
    for filename in sorted(os.listdir(folder)):
        full = os.path.join(folder, filename)
        if not os.path.isfile(full):
            continue
        ext = os.path.splitext(filename)[1].lower()
        if ext not in {".png", ".jpg", ".jpeg", ".gif", ".webp", ".mp4", ".webm"}:
            continue
        out.append((filename, full))
    return out


def list_all_folder_assets(app_root: str, character: str) -> list[dict[str, Any]]:
    """Flat list of every image/video for Pick pics: ST folder + legacy Luna custom."""
    assets: list[dict[str, Any]] = []
    seen: set[str] = set()

    folder = resolve_sprite_directory(app_root, character)
    for filename, _full in _iter_asset_files(folder or ""):
        guessed = infer_expression_from_filename(filename)
        assets.append({
            "fileName": filename,
            "imageSrc": sprite_url(character, filename),
            "animated": os.path.splitext(filename)[1].lower() in ANIMATED_EXTENSIONS,
            "guessed_expression": guessed,
            "source": "sprites",
        })
        seen.add(filename.lower())

    # Luna (and other local companions) — legacy uploads in static/images/custom
    entry = get_character_entry(app_root, character)
    if entry.get("sprite_source") != "external":
        legacy = legacy_custom_images_dir(app_root)
        for filename, _full in _iter_asset_files(legacy):
            key = filename.lower()
            if key in seen:
                continue
            guessed = infer_expression_from_filename(filename)
            assets.append({
                "fileName": filename,
                "imageSrc": f"/static/images/custom/{filename}",
                "animated": os.path.splitext(filename)[1].lower() in ANIMATED_EXTENSIONS,
                "guessed_expression": guessed,
                "source": "legacy_custom",
            })
            seen.add(key)

    return assets


def resolve_sprite_for_expression(
    app_root: str,
    character: str,
    expression: str,
    sprite_map: dict[str, str] | None = None,
) -> dict[str, Any] | None:
    """Pick sprite: user map first, then catalog pool."""
    from sprite_maps import get_character_sprite_map

    mapping = sprite_map if sprite_map is not None else get_character_sprite_map(app_root, character)
    if expression in mapping:
        filename = mapping[expression]
        folder = resolve_sprite_directory(app_root, character)
        if folder:
            path = os.path.join(folder, os.path.basename(filename))
            if os.path.isfile(path):
                ext = os.path.splitext(filename)[1].lower()
                return {
                    "fileName": filename,
                    "imageSrc": sprite_url(character, filename),
                    "animated": ext in ANIMATED_EXTENSIONS,
                    "expression": expression,
                    "source": "user_map",
                }
    catalog = scan_character_assets(app_root, character)
    pool = catalog.get("sprites", {}).get(expression) or []
    if pool:
        return {**pool[0], "source": "auto"}
    return None


def list_all_character_sprites(app_root: str, character: str) -> dict[str, list[dict[str, str]]]:
    """Merged sprites: ST-named local files + scanned external/catalog assets."""
    catalog = scan_character_assets(app_root, character)
    if catalog["sprites"]:
        return catalog["sprites"]
    return list_character_sprites(app_root, character)


def load_character_card(app_root: str, character: str) -> dict[str, Any] | None:
    entry = get_character_entry(app_root, character)
    card_name = entry.get("card")
    if not card_name:
        return None
    card_path = os.path.join(app_root, card_name)
    if not os.path.exists(card_path):
        return None
    with open(card_path, "r", encoding="utf-8") as f:
        return json.load(f)


def create_character(app_root: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Register a new companion: Tavern card JSON + characters.json entry + sprite folder."""
    char_id = sanitize_character_id(payload.get("id") or payload.get("name") or "")
    if not char_id:
        raise ValueError("Character id/name is required")

    cfg = load_characters_config(app_root)
    if char_id in cfg.get("characters", {}):
        raise ValueError(f"Character '{char_id}' already exists")

    display_name = (payload.get("display_name") or char_id).strip()
    sprite_source = (payload.get("sprite_source") or "local").strip().lower()
    if sprite_source not in ("local", "external"):
        raise ValueError("sprite_source must be 'local' or 'external'")

    sprite_path = (payload.get("sprite_path") or "").strip() or None
    if sprite_source == "external" and not sprite_path:
        raise ValueError("sprite_path is required for external sprite_source")

    card_slug = f"{char_id.lower()}-character.json"
    card = {
        "spec": "chara_card_v3",
        "spec_version": "3.0",
        "name": display_name,
        "description": (payload.get("description") or "").strip(),
        "personality": (payload.get("personality") or "").strip(),
        "scenario": (payload.get("scenario") or "").strip(),
        "first_mes": (payload.get("first_mes") or "").strip(),
        "mes_example": (payload.get("mes_example") or "").strip(),
        "creator_notes": (payload.get("creator_notes") or "Created in companion UI.").strip(),
        "tags": payload.get("tags") or ["companion", "custom"],
        "creator": payload.get("creator") or "user",
        "extensions": {"talkativeness": "0.8"},
    }
    card_path = os.path.join(app_root, card_slug)
    with open(card_path, "w", encoding="utf-8") as f:
        json.dump(card, f, indent=2)

    if sprite_source == "local":
        os.makedirs(get_sprite_folder(app_root, char_id), exist_ok=True)

    unlock_level = max(0, int(payload.get("unlock_level", 0)))
    content_unlocks = payload.get("content_unlocks") or {}

    entry = {
        "display_name": display_name,
        "card": card_slug,
        "sprite_source": sprite_source,
        "sprite_path": sprite_path if sprite_source == "external" else None,
        "unlock_level": unlock_level,
        "content_unlocks": content_unlocks,
    }
    cfg.setdefault("characters", {})[char_id] = entry
    save_characters_config(app_root, cfg)

    return {"id": char_id, "entry": entry, "card": card_slug}


def get_content_unlocks(app_root: str, character: str) -> dict[str, Any]:
    entry = get_character_entry(app_root, character)
    return entry.get("content_unlocks") or {}


def build_character_system_prompt(
    app_root: str,
    character: str,
    base_instruction: str,
    *,
    familiarity_level: int | None = None,
) -> str:
    """SillyTavern-style card → system prompt with few-shot examples and sprite rules."""
    from familiarity import familiarity_tone_for_level, is_expression_unlocked

    card = load_character_card(app_root, character)
    catalog = scan_character_assets(app_root, character)
    content_unlocks = get_content_unlocks(app_root, character)
    fam_level = familiarity_level if familiarity_level is not None else 5

    if card:
        parts = [
            f"You are {card.get('name', character)}. Stay fully in character — never break the fourth wall, never mention being an AI or a model.",
            f"Description: {card.get('description', '')}",
            f"Personality: {card.get('personality', '')}",
            f"Scenario: {card.get('scenario', '')}",
        ]
        mes_example = (card.get("mes_example") or "").strip()
        if mes_example:
            cleaned = mes_example.replace("<START>", "").strip()
            parts.append(f"Example exchanges (match voice and format — respond to the user, do not copy these lines):\n{cleaned}")
    else:
        parts = [base_instruction]

    from expression_guide import (
        emotion_labels_only,
        get_scene_descriptions,
        is_scene_tag,
        scene_labels_only,
    )

    entry = get_character_entry(app_root, character)
    scene_desc = get_scene_descriptions(entry.get("scene_tags") or {})

    parts.append(
        "### Visual avatar (critical)\n"
        "The user sees a portrait in a glowing LED ring beside the chat. It swaps when you end with [emote: tag].\n"
        "- **Emotion tags** = face/mood (joy, nervousness, pride…).\n"
        "- **Scene tags** = what is literally happening in the image (shower, bed, undress…). "
        "For scene tags, describe the action/setting in your *actions* so it matches what they see — "
        "these are NOT subtle facial differences."
    )

    parts.append(
        "### Familiarity (relationship depth)\n"
        f"Current familiarity level with this user: {fam_level}. "
        f"{familiarity_tone_for_level(fam_level)}"
    )

    parts.append(
        "### Reply rules\n"
        "- Write immersive roleplay: 1–4 sentences, dialogue + brief *action* beats in asterisks.\n"
        "- Match the character's voice — not generic assistant tone, not meta commentary.\n"
        "- End EVERY reply on its own last line with exactly one tag: [emote: label]. Nothing after the tag.\n"
        "- Use only unlocked expression labels listed below — do not tag locked intimate visuals yet."
    )

    available = set(DEFAULT_EXPRESSIONS)
    available.update(catalog.get("custom_expressions") or [])
    for label in catalog.get("sprites", {}):
        available.add(label)

    unlocked = sorted(
        label for label in available
        if is_expression_unlocked(content_unlocks, label, fam_level)
    )
    locked = sorted(
        label for label in available
        if not is_expression_unlocked(content_unlocks, label, fam_level)
    )

    unlocked_emotions = emotion_labels_only(unlocked)
    unlocked_scenes = scene_labels_only(unlocked, catalog.get("custom_expressions"))
    locked_emotions = emotion_labels_only(locked)
    locked_scenes = scene_labels_only(locked, catalog.get("custom_expressions"))

    parts.append(
        "### Emotion tags (face/mood)\n"
        f"Unlocked: {', '.join(unlocked_emotions) or 'neutral, joy'}."
    )
    if locked_emotions:
        parts.append(f"Locked emotions: {', '.join(locked_emotions)}.")

    if unlocked_scenes or locked_scenes:
        scene_lines = ["### Scene tags (what the portrait shows)"]
        for tag in unlocked_scenes:
            desc = scene_desc.get(tag, "Situational visual — describe what is happening on screen.")
            scene_lines.append(f"- [emote: {tag}] → {desc}")
        if locked_scenes:
            scene_lines.append(f"Locked scenes (do NOT use yet): {', '.join(locked_scenes)}.")
        parts.append("\n".join(scene_lines))

    from familiarity import required_level_for_gallery, required_level_for_videos

    if catalog.get("videos") and fam_level >= required_level_for_videos(content_unlocks):
        video_names = [v["fileName"] for v in catalog["videos"]]
        parts.append(
            f"Animated video loops (tag when the scene matches): {', '.join(video_names)}. "
            "Use shower, bed, desire, excitement, scene when appropriate."
        )

    if catalog.get("gallery") and fam_level >= required_level_for_gallery(content_unlocks):
        parts.append(
            f"Scene stills available ({len(catalog['gallery'])} images) — use [emote: scene] for narrative beats."
        )

    return "\n\n".join(parts)


def expression_prompt_suffix(app_root: str, character: str) -> str:
    catalog = scan_character_assets(app_root, character)
    labels = sorted(set(DEFAULT_EXPRESSIONS) | set(catalog.get("sprites", {})))
    custom = catalog.get("custom_expressions") or []
    suffix = f"\n\nSillyTavern expression labels: {', '.join(labels)}."
    if custom:
        suffix += f"\nCustom expressions: {', '.join(custom)}."
    return suffix