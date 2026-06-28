# Luna Expressions (SillyTavern-compatible)

Luna uses the same expression model as [SillyTavern Character Expressions](https://docs.sillytavern.app/extensions/expression-images/):

- **28 Go-Emotions labels** (`joy`, `desire`, `sadness`, `neutral`, …)
- **Flat sprite folders** per character: `data/characters/Luna/joy.png`
- **ZIP sprite pack import** (Emotes modal → Upload sprite pack)
- **Local text classification** when the model omits `[emote: tag]` (same labels as ST's distilbert go-emotions)
- **ST default emoji fallbacks** in `static/img/default-expressions/` when no custom art exists

Legacy tags still work: `[emote: happy]` → `joy`, `[emote: flirty]` → `desire`.

---

Luna also supports **lip-sync pairs** and **GIF/video** emotes on top of ST sprites.

Custom emotes (with your own closed-mouth + open-mouth PNGs) take full precedence for both the resting face and real-time lip-sync animation while TTS plays.

The model is instructed (in the system prompt + dynamic custom list) to always end every reply with exactly `[emote: yourname]` (last thing on its own line). The frontend parses the tag (or falls back to keyword matching) and switches the character image.

---

## 🖼️ Adding Custom Images for Emotes (Recommended Way)

**Use the in-app Emotes manager (no code edits needed):**

1. Click the **Emotes** icon (✓-like button) in the header next to "Luna".
2. In the modal, click **+ Add Custom Emote**.
3. Fill in:
   - **Emote Name** — this is what the model must output in the tag, e.g. `playful`, `smirk`, `blush`, or even override a built-in like `happy`.
   - **Keywords** (optional, comma-separated) — words that can auto-trigger this emote if the model doesn't use the exact tag (e.g. `playful, tease, wink`).
   - **Mouth Closed Image** — select your PNG (recommended ~600x600, transparent background).
   - **Mouth Open Image** — the version with mouth open for lip-sync.
   - **LED Color** (optional) — the ring glow color while this emote is active.
4. Click **Save**.

The two images are uploaded to `static/images/custom/{sanitized-name}-mouth-closed.png` (and open).

They immediately appear in the emote list and will be used for the character viewer whenever that emote is active.

You can create a custom with the **exact same name** as a built-in (happy, sad, excited, etc.) to give it completely different pictures while keeping the name the model already knows.

---

## 📁 Manual / Advanced Placement

If you prefer to manage files directly:

- Place your images in `companion-python/static/images/custom/`
- Name them exactly: `yourname-mouth-closed.png` and `yourname-mouth-open.png` (use the same sanitization as secure_filename would).
- Then use the Emotes modal → + Add Custom Emote (you can still fill the form; the upload step will be skipped if you pre-place the files, but the JSON entry is still required via the form for now).

The `data/emotes.json` will contain entries like:

```json
{
  "custom": [
    {
      "name": "playful",
      "keywords": ["playful", "tease"],
      "color": "#FF69B4",
      "images": {
        "closed": "/static/images/custom/playful-mouth-closed.png",
        "open": "/static/images/custom/playful-mouth-open.png",
        "gif": "/static/images/custom/playful.gif",
        "speakGif": "/static/images/custom/playful-speak.gif",
        "mp4": "/static/images/custom/playful.mp4",
        "speakMp4": "/static/images/custom/playful-speak.mp4"
      }
    }
  ]
}
```

Customs are loaded on app start and also injected into the Luna system prompt so the model knows the exact names it can use in `[emote: ...]`.

### Animated emotes (GIF / video)

Add optional fields under `images`:

| Field | When it plays |
|-------|----------------|
| `gif` | Resting loop (replaces static closed PNG) |
| `speakGif` | While TTS speaks (falls back to `gif`) |
| `mp4` / `webm` / `video` | Resting video loop |
| `speakMp4` / `speakWebm` / `speakVideo` | Speaking video (falls back to resting video) |

If a GIF or video is set, PNG lip-sync toggling is skipped — the clip carries the motion. Drop files in `static/images/custom/` and reference them in `data/emotes.json`.

---

## 🔄 How Images Are Chosen at Runtime

- Model reply ends with `[emote: playful]` → tag wins (highest priority).
- No tag but response/user message contains one of the keywords → custom emote wins.
- Falls back to generic mouth pair for built-ins.
- `getImagePath()` in `app.js` always checks custom list first (case-insensitive).

Lip-sync (mouth open/closed alternation) and the resting face both use the emote's pair while speaking.

---

## 💡 Tips for Good Custom Images

- Square (ideally 600x600 or same aspect as the default char-mouth-*.png).
- Transparent background.
- Consistent framing / eye position between closed and open so the switch doesn't jump.
- The LED ring color can help differentiate emotes visually.

The old manual "drop char-happy-*.png + edit Python/JS" method is obsolete — use the Emotes UI and custom entries instead.

---

## 🧪 Testing Your Custom Emote

Send something like:
- "Make a playful face" (if you set keywords)
- Or ask Luna directly: "What do you want to emote next?" or "Can you show me your playful expression?"

She should output the tag at the very end (per her instructions) and the image next to the chat will switch to your uploaded pair + animate the mouth during TTS (LocalSoundsAPI).
