# Emote Creation UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a user-facing UI for creating custom emotes with name, keywords, images, and optional color.

**Architecture:** Frontend modal for emote management, backend API for image upload and emote storage, updated emotion classification to support custom emotes.

**Tech Stack:** Flask (backend), vanilla JavaScript (frontend), localStorage for config persistence

---

## Task 1: Backend - Create Emote Storage Structure

**Files:**
- Create: `data/emotes.json`

**Step 1: Create empty emotes JSON file**

```json
{
  "custom": []
}
```

**Step 2: Commit**

```bash
git add data/emotes.json
git commit -m "feat: initialize emote storage"
```

---

## Task 2: Backend - Add Emote API Endpoints

**Files:**
- Modify: `app.py:1-50` (imports)
- Modify: `app.py` (add new endpoints after `/tts`)

**Step 1: Add required imports**

Add to top of file:
```python
import json
from werkzeug.utils import secure_filename
```

**Step 2: Add emote storage helper functions**

```python
EMOTES_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'emotes.json')
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static', 'images', 'custom')

def load_emotes():
    """Load emotes from JSON file."""
    if not os.path.exists(EMOTES_FILE):
        return {"custom": []}
    with open(EMOTES_FILE, 'r') as f:
        return json.load(f)

def save_emotes(emotes):
    """Save emotes to JSON file."""
    os.makedirs(os.path.dirname(EMOTES_FILE), exist_ok=True)
    with open(EMOTES_FILE, 'w') as f:
        json.dump(emotes, f, indent=2)

def get_custom_emotes():
    """Get list of custom emote names."""
    emotes = load_emotes()
    return [e['name'] for e in emotes.get('custom', [])]
```

**Step 3: Add GET /api/emotes endpoint**

```python
@app.route('/api/emotes', methods=['GET'])
def get_emotes():
    """Get all custom emotes."""
    emotes = load_emotes()
    return jsonify(emotes)
```

**Step 4: Add POST /api/emotes endpoint**

```python
@app.route('/api/emotes', methods=['POST'])
def create_emote():
    """Create a new custom emote."""
    data = request.get_json()
    name = data.get('name', '').strip()
    keywords = data.get('keywords', [])
    color = data.get('color', '#00FFFF')
    
    if not name:
        return jsonify({'error': 'Emote name is required'}), 400
    
    emotes = load_emotes()
    
    # Check for duplicate names
    built_in = ['neutral', 'happy', 'sad']
    if name in built_in or any(e['name'] == name for e in emotes.get('custom', [])):
        return jsonify({'error': 'Emote name already exists'}), 400
    
    new_emote = {
        'name': name,
        'keywords': keywords,
        'color': color,
        'images': {
            'closed': f'/static/images/custom/{name}-mouth-closed.png',
            'open': f'/static/images/custom/{name}-mouth-open.png'
        }
    }
    
    if 'custom' not in emotes:
        emotes['custom'] = []
    emotes['custom'].append(new_emote)
    save_emotes(emotes)
    
    return jsonify(new_emote), 201
```

**Step 5: Add DELETE /api/emotes/<name> endpoint**

```python
@app.route('/api/emotes/<name>', methods=['DELETE'])
def delete_emote(name):
    """Delete a custom emote."""
    emotes = load_emotes()
    
    if not any(e['name'] == name for e in emotes.get('custom', [])):
        return jsonify({'error': 'Emote not found'}), 404
    
    emotes['custom'] = [e for e in emotes.get('custom', []) if e['name'] != name]
    save_emotes(emotes)
    
    # Delete images if they exist
    closed_path = os.path.join(UPLOAD_FOLDER, f'{name}-mouth-closed.png')
    open_path = os.path.join(UPLOAD_FOLDER, f'{name}-mouth-open.png')
    if os.path.exists(closed_path):
        os.remove(closed_path)
    if os.path.exists(open_path):
        os.remove(open_path)
    
    return jsonify({'message': 'Emote deleted'}), 200
```

**Step 6: Add POST /api/emotes/upload endpoint**

```python
@app.route('/api/emotes/upload', methods=['POST'])
def upload_emote_images():
    """Upload images for a custom emote."""
    if 'closed' not in request.files or 'open' not in request.files:
        return jsonify({'error': 'Both closed and open mouth images are required'}), 400
    
    name = request.form.get('name', '').strip()
    if not name:
        return jsonify({'error': 'Emote name is required'}), 400
    
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    
    closed_file = request.files['closed']
    open_file = request.files['open']
    
    closed_filename = secure_filename(f'{name}-mouth-closed.png')
    open_filename = secure_filename(f'{name}-mouth-open.png')
    
    closed_file.save(os.path.join(UPLOAD_FOLDER, closed_filename))
    open_file.save(os.path.join(UPLOAD_FOLDER, open_filename))
    
    return jsonify({'message': 'Images uploaded successfully'}), 200
```

**Step 7: Commit**

```bash
git add app.py
git commit -m "feat: add emote API endpoints"
```

---

## Task 3: Backend - Update Emotion Classification

**Files:**
- Modify: `app.py:80-100` (determine_emotion function)

**Step 1: Update determine_emotion() to check custom emotes**

Replace existing `determine_emotion()` function:

```python
def determine_emotion(message: str, response: str) -> str:
    message_lower = message.lower()
    response_lower = response.lower()
    
    # Check custom emotes first
    emotes = load_emotes()
    for custom_emote in emotes.get('custom', []):
        keywords = custom_emote.get('keywords', [])
        if any(word in message_lower or word in response_lower for word in keywords):
            return custom_emote['name']
    
    # Fall back to built-in emotes
    # Happy/cheerful/warm
    if any(word in message_lower or word in response_lower for word in ['love', 'happy', 'excited', 'joy', 'wonderful', 'great', 'awesome', 'flirt', 'smile']):
        return 'happy'
    # Sad/lonely/concerned
    if any(word in message_lower or word in response_lower for word in ['sad', 'lonely', 'grief', 'pain', 'difficult', 'hurt', 'hard', 'sorry', 'cry']):
        return 'sad'
    # Default neutral
    return 'neutral'
```

**Step 2: Commit**

```bash
git add app.py
git commit -m "feat: update emotion classification for custom emotes"
```

---

## Task 4: Frontend - Add Emote Manager HTML

**Files:**
- Modify: `templates/index.html` (add button and modal)

**Step 1: Add emotes button next to settings button**

Find the settings button and add emotes button before it:

```html
<button id="emotes-button" class="icon-button" title="Emotes">
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
    </svg>
</button>
```

**Step 2: Add emote manager modal HTML**

Add before closing `</body>` tag:

```html
<!-- Emote Manager Modal -->
<div id="emote-modal" class="modal">
    <div class="modal-content">
        <div class="modal-header">
            <h2>Emotes</h2>
            <button id="close-emote-modal" class="close-button">&times;</button>
        </div>
        <div class="modal-body">
            <div id="emote-list"></div>
            <button id="add-emote-button" class="add-button">+ Add Custom Emote</button>
            
            <!-- Add/Edit Form (hidden by default) -->
            <div id="emote-form" class="emote-form" style="display: none;">
                <h3 id="form-title">Add Custom Emote</h3>
                <div class="form-group">
                    <label for="emote-name">Emote Name</label>
                    <input type="text" id="emote-name" placeholder="e.g., excited">
                </div>
                <div class="form-group">
                    <label for="emote-keywords">Keywords (comma-separated)</label>
                    <input type="text" id="emote-keywords" placeholder="e.g., excited, wow, amazing">
                </div>
                <div class="form-group">
                    <label>Mouth Closed Image</label>
                    <input type="file" id="emote-closed-image" accept="image/*">
                    <img id="emote-closed-preview" class="image-preview" style="display: none;">
                </div>
                <div class="form-group">
                    <label>Mouth Open Image</label>
                    <input type="file" id="emote-open-image" accept="image/*">
                    <img id="emote-open-preview" class="image-preview" style="display: none;">
                </div>
                <div class="form-group">
                    <label for="emote-color">LED Color (optional)</label>
                    <input type="color" id="emote-color" value="#00FFFF">
                </div>
                <div class="form-actions">
                    <button id="save-emote" class="save-button">Save</button>
                    <button id="cancel-emote" class="cancel-button">Cancel</button>
                </div>
            </div>
        </div>
    </div>
</div>
```

**Step 3: Commit**

```bash
git add templates/index.html
git commit -m "feat: add emote manager HTML"
```

---

## Task 5: Frontend - Add Emote Manager CSS

**Files:**
- Modify: `static/style.css` (add styles)

**Step 1: Add emote manager styles**

```css
/* Emote Manager Modal */
#emote-modal {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    z-index: 1000;
    justify-content: center;
    align-items: center;
}

#emote-modal.open {
    display: flex;
}

#emote-modal .modal-content {
    background: #1a1a2e;
    border-radius: 12px;
    width: 90%;
    max-width: 500px;
    max-height: 80vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

#emote-modal .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid #333;
}

#emote-modal .modal-header h2 {
    margin: 0;
    color: #fff;
    font-size: 1.2rem;
}

#emote-modal .close-button {
    background: none;
    border: none;
    color: #888;
    font-size: 1.5rem;
    cursor: pointer;
}

#emote-modal .modal-body {
    padding: 20px;
    overflow-y: auto;
}

/* Emote List */
#emote-list {
    margin-bottom: 16px;
}

.emote-item {
    display: flex;
    align-items: center;
    padding: 10px;
    border-radius: 8px;
    margin-bottom: 8px;
    background: #16213e;
}

.emote-item img {
    width: 40px;
    height: 40px;
    margin-right: 12px;
    border-radius: 4px;
}

.emote-item .emote-info {
    flex: 1;
}

.emote-item .emote-name {
    color: #fff;
    font-weight: 500;
}

.emote-item .emote-keywords {
    display: flex;
    gap: 6px;
    margin-top: 4px;
    flex-wrap: wrap;
}

.emote-item .keyword-pill {
    background: #0f3460;
    color: #888;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 0.75rem;
}

.emote-item .lock-icon {
    color: #666;
    font-size: 1.2rem;
}

.emote-item .delete-button {
    background: none;
    border: none;
    color: #ff4757;
    cursor: pointer;
    font-size: 1.2rem;
    padding: 4px 8px;
}

/* Add Button */
#add-emote-button {
    width: 100%;
    padding: 12px;
    background: #0f3460;
    color: #fff;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 1rem;
    margin-bottom: 16px;
}

#add-emote-button:hover {
    background: #1a4a7a;
}

/* Emote Form */
.emote-form {
    background: #16213e;
    padding: 16px;
    border-radius: 8px;
}

.emote-form h3 {
    margin: 0 0 16px 0;
    color: #fff;
    font-size: 1rem;
}

.form-group {
    margin-bottom: 16px;
}

.form-group label {
    display: block;
    color: #888;
    margin-bottom: 6px;
    font-size: 0.9rem;
}

.form-group input[type="text"],
.form-group input[type="color"] {
    width: 100%;
    padding: 10px;
    background: #1a1a2e;
    border: 1px solid #333;
    border-radius: 6px;
    color: #fff;
    box-sizing: border-box;
}

.form-group input[type="file"] {
    width: 100%;
    padding: 8px;
    background: #1a1a2e;
    border: 1px solid #333;
    border-radius: 6px;
    color: #fff;
}

.image-preview {
    width: 80px;
    height: 80px;
    margin-top: 8px;
    border-radius: 4px;
    object-fit: contain;
    background: #000;
}

.form-actions {
    display: flex;
    gap: 12px;
}

.form-actions button {
    flex: 1;
    padding: 10px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
}

.save-button {
    background: #00ff7f;
    color: #000;
}

.cancel-button {
    background: #333;
    color: #fff;
}

/* Emotes Button */
#emotes-button {
    background: none;
    border: none;
    color: #fff;
    cursor: pointer;
    padding: 8px;
    border-radius: 8px;
}

#emotes-button:hover {
    background: rgba(255, 255, 255, 0.1);
}
```

**Step 2: Commit**

```bash
git add static/style.css
git commit -m "feat: add emote manager CSS"
```

---

## Task 6: Frontend - Add Emote Manager JavaScript

**Files:**
- Modify: `static/app.js:1-50` (add emote manager logic)

**Step 1: Add emote manager variables and functions**

Add after the existing variables (around line 50):

```javascript
// Emote Manager
const emotesButton = document.getElementById('emotes-button');
const emoteModal = document.getElementById('emote-modal');
const closeEmoteModal = document.getElementById('close-emote-modal');
const emoteList = document.getElementById('emote-list');
const addEmoteButton = document.getElementById('add-emote-button');
const emoteForm = document.getElementById('emote-form');
const formTitle = document.getElementById('form-title');
const emoteNameInput = document.getElementById('emote-name');
const emoteKeywordsInput = document.getElementById('emote-keywords');
const emoteClosedImage = document.getElementById('emote-closed-image');
const emoteOpenImage = document.getElementById('emote-open-image');
const emoteClosedPreview = document.getElementById('emote-closed-preview');
const emoteOpenPreview = document.getElementById('emote-open-preview');
const emoteColorInput = document.getElementById('emote-color');
const saveEmoteButton = document.getElementById('save-emote');
const cancelEmoteButton = document.getElementById('cancel-emote');

let customEmotes = [];

// Load custom emotes from localStorage
const loadCustomEmotes = () => {
    const stored = localStorage.getItem('custom_emotes');
    customEmotes = stored ? JSON.parse(stored) : [];
};

// Save custom emotes to localStorage
const saveCustomEmotesToStorage = () => {
    localStorage.setItem('custom_emotes', JSON.stringify(customEmotes));
};

// Fetch emotes from backend
const fetchEmotes = async () => {
    try {
        const resp = await fetch('/api/emotes');
        if (resp.ok) {
            const data = await resp.json();
            customEmotes = data.custom || [];
            saveCustomEmotesToStorage();
        }
    } catch (err) {
        console.error('Failed to fetch emotes:', err);
    }
};

// Render emote list
const renderEmoteList = () => {
    emoteList.innerHTML = '';
    
    // Built-in emotes
    const builtIn = ['neutral', 'happy', 'sad'];
    builtIn.forEach(name => {
        const item = document.createElement('div');
        item.className = 'emote-item';
        item.innerHTML = `
            <img src="/static/images/char-${name}-mouth-closed.png" alt="${name}">
            <div class="emote-info">
                <div class="emote-name">${name}</div>
            </div>
            <span class="lock-icon" title="Built-in emote">🔒</span>
        `;
        emoteList.appendChild(item);
    });
    
    // Custom emotes
    customEmotes.forEach(emote => {
        const item = document.createElement('div');
        item.className = 'emote-item';
        item.innerHTML = `
            <img src="${emote.images.closed}" alt="${emote.name}">
            <div class="emote-info">
                <div class="emote-name">${emote.name}</div>
                <div class="emote-keywords">
                    ${emote.keywords.map(k => `<span class="keyword-pill">${k}</span>`).join('')}
                </div>
            </div>
            <button class="delete-button" data-name="${emote.name}" title="Delete emote">🗑️</button>
        `;
        emoteList.appendChild(item);
    });
    
    // Add delete listeners
    document.querySelectorAll('.delete-button').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const name = e.target.dataset.name;
            if (confirm(`Delete emote "${name}"?`)) {
                await deleteEmote(name);
            }
        });
    });
};

// Delete emote
const deleteEmote = async (name) => {
    try {
        const resp = await fetch(`/api/emotes/${name}`, { method: 'DELETE' });
        if (resp.ok) {
            customEmotes = customEmotes.filter(e => e.name !== name);
            saveCustomEmotesToStorage();
            renderEmoteList();
        }
    } catch (err) {
        console.error('Failed to delete emote:', err);
    }
};

// Show/hide form
const showForm = (editEmote = null) => {
    emoteForm.style.display = 'block';
    addEmoteButton.style.display = 'none';
    
    if (editEmote) {
        formTitle.textContent = 'Edit Custom Emote';
        emoteNameInput.value = editEmote.name;
        emoteKeywordsInput.value = editEmote.keywords.join(', ');
        emoteColorInput.value = editEmote.color || '#00FFFF';
        emoteClosedPreview.src = editEmote.images.closed;
        emoteClosedPreview.style.display = 'block';
        emoteOpenPreview.src = editEmote.images.open;
        emoteOpenPreview.style.display = 'block';
    } else {
        formTitle.textContent = 'Add Custom Emote';
        emoteNameInput.value = '';
        emoteKeywordsInput.value = '';
        emoteColorInput.value = '#00FFFF';
        emoteClosedPreview.style.display = 'none';
        emoteOpenPreview.style.display = 'none';
    }
};

const hideForm = () => {
    emoteForm.style.display = 'none';
    addEmoteButton.style.display = 'block';
    emoteNameInput.value = '';
    emoteKeywordsInput.value = '';
    emoteClosedImage.value = '';
    emoteOpenImage.value = '';
    emoteClosedPreview.style.display = 'none';
    emoteOpenPreview.style.display = 'none';
};

// Image preview handlers
emoteClosedImage.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            emoteClosedPreview.src = ev.target.result;
            emoteClosedPreview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
});

emoteOpenImage.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            emoteOpenPreview.src = ev.target.result;
            emoteOpenPreview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
});

// Save emote
saveEmoteButton.addEventListener('click', async () => {
    const name = emoteNameInput.value.trim();
    const keywords = emoteKeywordsInput.value.split(',').map(k => k.trim()).filter(k => k);
    const color = emoteColorInput.value;
    
    if (!name) {
        alert('Emote name is required');
        return;
    }
    
    if (!emoteClosedImage.files[0] || !emoteOpenImage.files[0]) {
        alert('Both mouth images are required');
        return;
    }
    
    try {
        // Upload images
        const formData = new FormData();
        formData.append('name', name);
        formData.append('closed', emoteClosedImage.files[0]);
        formData.append('open', emoteOpenImage.files[0]);
        
        const uploadResp = await fetch('/api/emotes/upload', {
            method: 'POST',
            body: formData
        });
        
        if (!uploadResp.ok) {
            throw new Error('Failed to upload images');
        }
        
        // Create emote
        const createResp = await fetch('/api/emotes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, keywords, color })
        });
        
        if (!createResp.ok) {
            const err = await createResp.json();
            throw new Error(err.error || 'Failed to create emote');
        }
        
        const newEmote = await createResp.json();
        customEmotes.push(newEmote);
        saveCustomEmotesToStorage();
        renderEmoteList();
        hideForm();
    } catch (err) {
        alert(err.message);
    }
});

// Cancel form
cancelEmoteButton.addEventListener('click', hideForm);

// Add emote button
addEmoteButton.addEventListener('click', () => showForm());

// Modal controls
emotesButton.addEventListener('click', () => {
    renderEmoteList();
    emoteModal.classList.add('open');
});

closeEmoteModal.addEventListener('click', () => {
    emoteModal.classList.remove('open');
});

window.addEventListener('click', (e) => {
    if (e.target === emoteModal) {
        emoteModal.classList.remove('open');
    }
});
```

**Step 2: Update preloading to include custom emotes**

Find the existing preloading code and replace:

```javascript
// Preload all emotes (built-in + custom)
const preloadEmotes = () => {
    ['neutral', 'happy', 'sad'].forEach(emote => {
        const imgOpen = new Image();
        imgOpen.src = getImagePath(emote, true);
        const imgClosed = new Image();
        imgClosed.src = getImagePath(emote, false);
    });
    
    customEmotes.forEach(emote => {
        const imgOpen = new Image();
        imgOpen.src = emote.images.open;
        const imgClosed = new Image();
        imgClosed.src = emote.images.closed;
    });
};
```

**Step 3: Update getImagePath to support custom emotes**

Replace existing `getImagePath` function:

```javascript
function getImagePath(emote, isOpen) {
    const suffix = isOpen ? 'open' : 'closed';
    
    // Check custom emotes first
    const customEmote = customEmotes.find(e => e.name === emote);
    if (customEmote) {
        return isOpen ? customEmote.images.open : customEmote.images.closed;
    }
    
    // Fall back to built-in emotes
    return `/static/images/char-mouth-${suffix}.png?v=${sessionId}`;
}
```

**Step 4: Initialize emotes on page load**

Add after `loadCustomEmotes()` call:

```javascript
// Initialize emotes
loadCustomEmotes();
fetchEmotes().then(() => {
    preloadEmotes();
    characterImage.src = getImagePath('neutral', false);
});
```

**Step 5: Commit**

```bash
git add static/app.js
git commit -m "feat: add emote manager JavaScript"
```

---

## Task 7: Test the Implementation

**Step 1: Start the Flask server**

```bash
cd companion-python
python app.py
```

**Step 2: Open browser and test**

1. Navigate to `http://localhost:5000`
2. Click the Emotes button (next to Settings)
3. Verify built-in emotes appear with lock icons
4. Click "+ Add Custom Emote"
5. Fill in name, keywords, upload both images
6. Click Save
7. Verify new emote appears in list
8. Test deletion of custom emote

**Step 3: Test backend classification**

1. Create an emote with keyword "test"
2. Send a message containing "test"
3. Verify the custom emote is used in the response

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete emote creation UI"
```
