# 🎭 Luna Emoting & Expression Guide

Luna is now equipped with a dynamic facial expression system (emotes). The system classifies the emotional tone of Luna's response and dynamically changes her facial expression and lip-syncing frames.

---

## 🛠️ How it Works

The emote system integrates backend classification with dynamic frontend asset loading:

1. **Backend Classification (`app.py`)**:
   - The helper function `determine_emotion(message, response)` scans both the user's message and Luna's response for emotional keywords.
   - It outputs one of the following emote strings: `'neutral'`, `'happy'`, or `'sad'`.
   - The `/chat` endpoint returns this emotion string in the JSON payload under the key `"emote"`.

2. **Frontend Loading (`app.js`)**:
   - The frontend extracts the `"emote"` attribute.
   - While Luna is speaking, the lip-syncing animation alternates between the closed and open mouth states of the specific emote:
     - **Happy**: `char-happy-mouth-closed.png` & `char-happy-mouth-open.png`
     - **Sad**: `char-sad-mouth-closed.png` & `char-sad-mouth-open.png`
   - **Fallback**: If an emote name is unknown or if the specific files are not provided, it falls back to the default `char-mouth-closed.png` and `char-mouth-open.png` assets seamlessly.

---

## 🎨 Adding Expression Asset Files

To add the expressions to the interface, place your custom png files in the `static/images/` directory:

| Emote | Mouth Closed File Path | Mouth Open File Path | Description |
|---|---|---|---|
| **Neutral** (Default) | `static/images/char-mouth-closed.png` | `static/images/char-mouth-open.png` | Regular expression |
| **Happy** | `static/images/char-happy-mouth-closed.png` | `static/images/char-happy-mouth-open.png` | Smiling / cheerful eyes and mouth |
| **Sad** | `static/images/char-sad-mouth-closed.png` | `static/images/char-sad-mouth-open.png` | Soft, sympathetic, or downcast expression |

> [!TIP]
> Ensure the new asset files have exact transparent backgrounds and matching aspect ratios (600x600 px is the default design sizing) so the transition between expressions remains perfectly smooth.

---

## 🚀 Adding More Emotes

If you want to add a new emote, e.g., `excited`:

1. **Define keywords in `app.py`**:
   Update `determine_emotion()` to return `'excited'`:
   ```python
   if any(w in message_lower or w in response_lower for w in ['excited', 'wow', 'amazing', 'hype']):
       return 'excited'
   ```
2. **Add asset filenames**:
   Drop `char-excited-mouth-closed.png` and `char-excited-mouth-open.png` into `static/images/`.
3. **Update preload in `app.js`**:
   Add `'excited'` to the preloading array on line 16:
   ```javascript
   ['neutral', 'happy', 'sad', 'excited'].forEach(emote => { ... });
   ```
