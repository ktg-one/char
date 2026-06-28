import os
import tempfile
import shutil

from familiarity import (
    grant_familiarity_xp,
    level_from_xp,
    clamp_expression_to_unlocked,
    global_familiarity_level,
    load_familiarity,
)
from characters import create_character, sanitize_character_id


def test_level_from_xp():
    assert level_from_xp(0) == 1
    assert level_from_xp(25) >= 2
    assert level_from_xp(200) >= 4


def test_grant_familiarity_xp_levels_up():
    root = tempfile.mkdtemp()
    try:
        result = grant_familiarity_xp(root, "Luna", user_message=True, assistant_reply=True)
        assert result["xp_gained"] == 20
        assert result["after_level"] >= 1
        state = load_familiarity(root)
        assert state["characters"]["Luna"]["xp"] == 20
    finally:
        shutil.rmtree(root)


def test_clamp_locked_expression():
    unlocks = {"expressions": {"desire": 3, "shower": 4}}
    assert clamp_expression_to_unlocked(unlocks, "desire", 1) != "desire"
    assert clamp_expression_to_unlocked(unlocks, "desire", 3) == "desire"


def test_sanitize_character_id():
    assert sanitize_character_id("  miku  ") == "Miku"
    assert sanitize_character_id("") == ""


def test_create_character_local():
    root = tempfile.mkdtemp()
    try:
        os.makedirs(os.path.join(root, "data"), exist_ok=True)
        result = create_character(root, {
            "id": "TestChar",
            "display_name": "Test Character",
            "description": "A test",
            "personality": "Friendly",
            "scenario": "Lab",
            "unlock_level": 2,
        })
        assert result["id"] == "TestChar"
        card_path = os.path.join(root, "testchar-character.json")
        assert os.path.exists(card_path)
        grant_familiarity_xp(root, "Luna", user_message=True, assistant_reply=True)
        assert global_familiarity_level(root) >= 1
    finally:
        shutil.rmtree(root)