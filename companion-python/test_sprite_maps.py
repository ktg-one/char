import os
import shutil
import tempfile

from sprite_maps import assign_sprite, get_character_sprite_map, set_character_sprite_map


def test_luna_sprite_map_bootstraps_from_emotes_json():
    root = tempfile.mkdtemp()
    try:
        os.makedirs(os.path.join(root, "data"), exist_ok=True)
        with open(os.path.join(root, "data", "emotes.json"), "w", encoding="utf-8") as f:
            f.write(
                '{"custom":[{"name":"joy","images":{"closed":"/static/images/custom/happy.jpeg","open":"/static/images/custom/happy-mouth-open.jpeg"}}]}'
            )
        os.makedirs(os.path.join(root, "static", "images", "custom"), exist_ok=True)
        open(os.path.join(root, "static", "images", "custom", "happy.jpeg"), "a").close()
        loaded = get_character_sprite_map(root, "Luna")
        assert loaded.get("joy") == "happy.jpeg"
    finally:
        shutil.rmtree(root)


def test_sprite_map_roundtrip():
    root = tempfile.mkdtemp()
    try:
        saved = set_character_sprite_map(root, "Asuka", {"joy": "happy.png", "desire": "tease.png"})
        assert saved["joy"] == "happy.png"
        loaded = get_character_sprite_map(root, "Asuka")
        assert loaded["desire"] == "tease.png"
        assign_sprite(root, "Asuka", "neutral", "sit.png")
        assert get_character_sprite_map(root, "Asuka")["neutral"] == "sit.png"
    finally:
        shutil.rmtree(root)