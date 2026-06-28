import os

import pytest

from characters import (
    infer_expression_from_filename,
    list_all_folder_assets,
    load_characters_config,
    resolve_sprite_directory,
    scan_character_assets,
)


def test_asuka_catalog_has_assets():
    root = os.path.dirname(os.path.abspath(__file__))
    if not resolve_sprite_directory(root, "Asuka"):
        pytest.skip("Asuka external sprite folder not available on this machine")
    catalog = scan_character_assets(root, "Asuka")
    assert catalog["folder"]
    assert catalog["sprites"]["desire"]
    assert len(catalog["gallery"]) >= 10
    assert len(catalog["videos"]) == 6


def test_filename_inference():
    assert infer_expression_from_filename("nsfw-shower.mp4") == "shower"
    assert infer_expression_from_filename("0050002-undressing, stripteasing.png") == "desire"
    assert infer_expression_from_filename("Asuka-scene-1-05 (1).png") == "scene"


def test_luna_pick_pics_includes_legacy_custom_folder():
    root = os.path.dirname(os.path.abspath(__file__))
    assets = list_all_folder_assets(root, "Luna")
    names = {a["fileName"] for a in assets}
    assert "happy.jpeg" in names or "neutral-mouth-closed.jpeg" in names
    legacy = [a for a in assets if a.get("source") == "legacy_custom"]
    assert len(legacy) >= 10
    assert any(a["imageSrc"].startswith("/static/images/custom/") for a in legacy)


def test_resolve_custom_image_url_finds_jpeg_or_jpg():
    root = os.path.dirname(os.path.abspath(__file__))
    from characters import resolve_custom_image_url

    url = resolve_custom_image_url(root, "/static/images/custom/happy.jpeg")
    assert url.endswith(("happy.jpeg", "happy.jpg"))
    legacy = resolve_custom_image_url(root, "/static/images/custom/luna-flirty.jpeg")
    assert "flirt" in legacy.lower()


def test_characters_config_loads():
    root = os.path.dirname(os.path.abspath(__file__))
    cfg = load_characters_config(root)
    assert cfg.get("active")
    assert cfg.get("characters")
    assert "Luna" in cfg["characters"]