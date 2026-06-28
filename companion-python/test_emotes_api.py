import json

import pytest

from app import app, save_emotes


@pytest.fixture
def client(tmp_path, monkeypatch):
    """Isolate emotes.json so tests never wipe production sprites."""
    emotes_file = tmp_path / "emotes.json"
    monkeypatch.setattr("app.EMOTES_FILE", str(emotes_file))
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


@pytest.fixture
def sample_emote():
    return {"name": "test-emote", "keywords": ["test", "example"], "color": "#FF0000"}


def test_get_emotes_empty(client):
    save_emotes({"custom": []})

    resp = client.get("/api/emotes")
    assert resp.status_code == 200
    data = resp.get_json()
    assert "custom" in data
    assert len(data["custom"]) == 0
    assert "expressions" in data
    assert len(data["expressions"]["labels"]) == 28


def test_create_emote(client, sample_emote):
    save_emotes({"custom": []})

    resp = client.post(
        "/api/emotes", data=json.dumps(sample_emote), content_type="application/json"
    )
    assert resp.status_code == 201
    data = resp.get_json()
    assert data["name"] == "test-emote"


def test_create_emote_upsert(client, sample_emote):
    """Re-saving the same name updates in place (ST override / replace flow)."""
    save_emotes({"custom": []})

    resp1 = client.post(
        "/api/emotes", data=json.dumps(sample_emote), content_type="application/json"
    )
    assert resp1.status_code == 201

    updated = {**sample_emote, "color": "#00FF00", "keywords": ["updated"]}
    resp2 = client.post(
        "/api/emotes", data=json.dumps(updated), content_type="application/json"
    )
    assert resp2.status_code == 200
    data = resp2.get_json()
    assert data["color"] == "#00FF00"
    assert data["keywords"] == ["updated"]


def test_create_emote_overrides_builtin(client):
    """Legacy/ST names can be overridden with custom visuals."""
    save_emotes({"custom": []})

    resp = client.post(
        "/api/emotes",
        data=json.dumps({"name": "joy", "keywords": ["test"]}),
        content_type="application/json",
    )
    assert resp.status_code == 201
    assert resp.get_json()["name"] == "joy"


def test_delete_emote(client, sample_emote):
    save_emotes({"custom": []})

    client.post(
        "/api/emotes", data=json.dumps(sample_emote), content_type="application/json"
    )
    resp = client.delete("/api/emotes/test-emote")
    assert resp.status_code == 200

    data = client.get("/api/emotes").get_json()
    assert len(data["custom"]) == 0


def test_delete_builtin_emote(client):
    resp = client.delete("/api/emotes/neutral")
    assert resp.status_code == 400


def test_expression_labels(client):
    resp = client.get("/api/expressions/labels")
    assert resp.status_code == 200
    data = resp.get_json()
    assert "joy" in data["labels"]
    assert data["fallback"] == "joy"


def test_classify_expression(client):
    resp = client.post(
        "/api/expressions/classify",
        data=json.dumps({"text": "I am so happy and grateful today!"}),
        content_type="application/json",
    )
    assert resp.status_code == 200
    label = resp.get_json()["label"]
    assert label in {"joy", "gratitude", "excitement", "optimism", "love"}