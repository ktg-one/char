import pytest
import json
import os
import tempfile
from app import app, load_emotes, save_emotes

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

@pytest.fixture
def sample_emote():
    return {
        'name': 'test-emote',
        'keywords': ['test', 'example'],
        'color': '#FF0000'
    }

def test_get_emotes_empty(client):
    """Test getting emotes when none exist"""
    # Reset emotes.json
    save_emotes({'custom': []})
    
    resp = client.get('/api/emotes')
    assert resp.status_code == 200
    data = resp.get_json()
    assert 'custom' in data
    assert len(data['custom']) == 0

def test_create_emote(client, sample_emote):
    """Test creating a custom emote"""
    # Reset
    save_emotes({'custom': []})
    
    resp = client.post('/api/emotes',
                       data=json.dumps(sample_emote),
                       content_type='application/json')
    assert resp.status_code == 201
    data = resp.get_json()
    assert data['name'] == 'test-emote'
    assert data['keywords'] == ['test', 'example']
    assert data['color'] == '#FF0000'

def test_create_emote_duplicate(client, sample_emote):
    """Test creating duplicate emote fails"""
    save_emotes({'custom': []})
    
    # Create first
    resp1 = client.post('/api/emotes',
                        data=json.dumps(sample_emote),
                        content_type='application/json')
    assert resp1.status_code == 201
    
    # Try duplicate
    resp2 = client.post('/api/emotes',
                        data=json.dumps(sample_emote),
                        content_type='application/json')
    assert resp2.status_code == 400

def test_create_emote_conflicts_builtin(client):
    """Test creating emote with name conflicting with built-in"""
    save_emotes({'custom': []})
    
    resp = client.post('/api/emotes',
                       data=json.dumps({'name': 'happy', 'keywords': ['test']}),
                       content_type='application/json')
    assert resp.status_code == 400

def test_delete_emote(client, sample_emote):
    """Test deleting a custom emote"""
    save_emotes({'custom': []})
    
    # Create
    resp1 = client.post('/api/emotes',
                        data=json.dumps(sample_emote),
                        content_type='application/json')
    assert resp1.status_code == 201
    
    # Delete
    resp2 = client.delete('/api/emotes/test-emote')
    assert resp2.status_code == 200
    
    # Verify deleted
    resp3 = client.get('/api/emotes')
    data = resp3.get_json()
    assert len(data['custom']) == 0

def test_delete_builtin_emote(client):
    """Test deleting built-in emote fails"""
    resp = client.delete('/api/emotes/neutral')
    assert resp.status_code == 400

def test_get_emotes(client, sample_emote):
    """Test getting list of emotes"""
    save_emotes({'custom': []})
    
    # Create
    client.post('/api/emotes',
                data=json.dumps(sample_emote),
                content_type='application/json')
    
    # Get
    resp = client.get('/api/emotes')
    data = resp.get_json()
    assert len(data['custom']) == 1
    assert data['custom'][0]['name'] == 'test-emote'