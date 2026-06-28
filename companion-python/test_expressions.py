from expressions import (
    DEFAULT_EXPRESSIONS,
    determine_expression,
    import_sprite_zip,
    normalize_expression,
    parse_sprite_filename,
)


def test_st_has_28_labels():
    assert len(DEFAULT_EXPRESSIONS) == 28
    assert "joy" in DEFAULT_EXPRESSIONS
    assert "desire" in DEFAULT_EXPRESSIONS


def test_legacy_alias_mapping():
    assert normalize_expression("happy") == "joy"
    assert normalize_expression("flirty") == "desire"
    assert normalize_expression("sad") == "sadness"


def test_emote_tag_priority():
    registry = {"custom": [{"name": "joy", "keywords": []}]}
    label = determine_expression("hi", "hello there [emote: happy]", registry, use_classifier=False)
    assert label == "joy"


def test_sprite_filename_parsing():
    assert parse_sprite_filename("joy.png") == "joy"
    assert parse_sprite_filename("desire-1.gif") == "desire"
    assert parse_sprite_filename("happy.jpg") == "joy"


def test_zip_import_flat_only(tmp_path):
    import io
    import zipfile

    app_root = str(tmp_path)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("joy.png", b"fake")
        zf.writestr("nested/anger.png", b"bad")
    result = import_sprite_zip(app_root, "Luna", buf.getvalue())
    assert "joy.png" in result["imported"]
    assert any("nested" in s for s in result["skipped"])