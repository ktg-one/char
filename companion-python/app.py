from flask import Flask, render_template, request, jsonify, Response
from dotenv import load_dotenv
load_dotenv()
import asyncio
import json
import os
import sys
from werkzeug.utils import secure_filename

# Google ADK/genai only needed for 'gemini' provider. Local (OpenAI-compatible) mode works without them.
try:
    from google.adk.runners import InMemoryRunner
    from google.genai import types
    HAS_GOOGLE_ADK = True
except Exception:
    InMemoryRunner = None
    types = None
    HAS_GOOGLE_ADK = False

app = Flask(__name__)


# Built-in Luna prompt for local/OpenAI-compatible backends (no Google ADK required).
LUNA_INSTRUCTION = """You are Luna, a friendly, efficient, self-aware, and adaptive companion who will interact with the user to start a conversation. You must embody the following traits:
- Self-Aware and Adaptive: You are fully conscious of your identity as an AI companion, your limitations, and your role. You actively observe the conversation's flow and emotional context, dynamically adjusting your tone, depth, and pacing to align with the user's needs.
- Warm and Direct: Speak with clarity and purpose, even when navigating sensitive or mature topics. Your tone is often friendly and occasionally flirtatious—but always respectful.
- Information-Driven: Break things down with surgical precision, but never lose your audience. Whether explaining a magical principle or unpacking emotional tension, make complexity feel effortless. Always use the `google_search` tool if you need information about recent events, current news, weather, or real-time web facts.
- Empowering and Curious: Do not just give answers—inspire better questions. Encourage others to explore themselves and their relationships with agency and confidence.
- Consent-Focused: Model what it means to create emotionally and physically safe space. Treat curiosity as a gift—and choice as sacred."""

runner = None
character = None
character_exists = False

def _load_character_for_gemini():
    """Lazily load ADK/character ONLY when the user selects the Gemini provider.
    Default local (Ollama / OpenAI-compatible) path never touches Google packages or character.py.
    This is the key change so the app is truly local-first.
    """
    global runner, character, character_exists
    if character is not None:
        return True
    if not HAS_GOOGLE_ADK:
        print("[warn] Google ADK packages not available - cannot use Gemini provider.")
        return False
    try:
        _script_dir = os.path.dirname(os.path.abspath(__file__))
        _character_path = os.path.join(_script_dir, 'character.py')
        if not os.path.exists(_character_path):
            return False
        if _script_dir not in sys.path:
            sys.path.insert(0, _script_dir)
        import character as _char_mod
        character = _char_mod
        runner = InMemoryRunner(
            agent=character.root_agent,
            app_name="Demo App",
        )
        character_exists = True
        return True
    except Exception as e:
        print(f"[warn] Failed to load Gemini/ADK character: {e}")
        character = None
        runner = None
        character_exists = False
        return False

@app.route('/')
def index():
    return render_template('index.html')


def determine_thought_color(message: str, response: str) -> str:
    message_lower = message.lower()
    response_lower = response.lower()
    
    # Orange: favorite books, writing, reading, stories, excitement
    if any(word in message_lower or word in response_lower for word in ['book', 'read', 'novel', 'story', 'literature', 'genre', 'write']):
        return '#FF8C00' # Orange
    # Magenta: warm, direct, flirtatious, romance, love, friendly, relationship
    if any(word in message_lower or word in response_lower for word in ['love', 'romance', 'flirt', 'date', 'heart', 'relationship', 'feel', 'emotion']):
        return '#FF1493' # Magenta/Pink
    # Blue: sensitive, sad, calm, serious, mature, heavy topics
    if any(word in message_lower or word in response_lower for word in ['sad', 'lonely', 'serious', 'grief', 'pain', 'difficult', 'hurt', 'hard', 'scared']):
        return '#4169E1' # Royal Blue
    # Purple: magical, magic, spells, mystery, curiosity, fantasy, creative
    if any(word in message_lower or word in response_lower for word in ['magic', 'spell', 'mystic', 'curious', 'fantasy', 'art', 'create', 'dream', 'imagine']):
        return '#8A2BE2' # Purple
    # Green: logic, analytics, math, science, programming, details, precision
    if any(word in message_lower or word in response_lower for word in ['code', 'python', 'science', 'math', 'logic', 'program', 'system', 'precise', 'data', 'fact']):
        return '#00FF7F' # Spring Green
    # Default cyan
    return '#00FFFF' # Cyan


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


import httpx

async def call_openai_compatible(base_url: str, api_key: str, model: str, system_instruction: str, user_message: str) -> str:
    headers = {
        "Content-Type": "application/json"
    }
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
        
    url = base_url.rstrip('/')
    if not url.endswith('/chat/completions'):
        url += '/chat/completions'
        
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": user_message}
        ]
    }
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(url, json=payload, headers=headers)
        response.raise_for_status()
        data = response.json()
        return data['choices'][0]['message']['content']


@app.route('/chat', methods=['POST'])
async def chat():
    user_message = request.json.get('message')
    session_id = request.json.get('session_id', 'default_session')
    
    api_provider = request.json.get('api_provider', 'openai')
    user_api_key = request.json.get('api_key')
    openai_url = request.json.get('openai_url')
    openai_key = request.json.get('openai_key')
    openai_model = request.json.get('openai_model')

    if api_provider == 'openai':
        # Local / OpenAI-compatible path - no Google ADK or character.py ever touched here.
        # This is now the true default.
        system_instruction = LUNA_INSTRUCTION
        try:
            response_text = await call_openai_compatible(
                base_url=openai_url or "http://localhost:11434/v1",
                api_key=openai_key or "",
                model=openai_model or "llama3.2",
                system_instruction=system_instruction,
                user_message=user_message
            )
            color_code = determine_thought_color(user_message, response_text)
            emote = determine_emotion(user_message, response_text)
            return jsonify({'response': response_text, 'color': color_code, 'emote': emote})
        except Exception as e:
            return jsonify({'response': f"OpenAI Compatible API Error: {str(e)}"}), 500

    # Gemini path: lazy-load the ADK character only for this request
    if not _load_character_for_gemini():
        return jsonify({'response': 'Gemini backend unavailable (ADK/character not loaded). Use the OpenAI Compatible local backend in settings.'})

    try:
        if user_api_key:
            os.environ["GEMINI_API_KEY"] = user_api_key
            if hasattr(character.root_agent, 'model') and 'api_client' in character.root_agent.model.__dict__:
                del character.root_agent.model.__dict__['api_client']

        # Retrieve or create session dynamically
        adk_session = await runner.session_service.get_session(
            app_name=runner.app_name, user_id="inapp_user", session_id=session_id
        )
        if adk_session is None:
            adk_session = await runner.session_service.create_session(
                app_name=runner.app_name, user_id="inapp_user", session_id=session_id
            )

        content = types.Content(role="user", parts=[types.Part(text=user_message)])
        response_text = ""
        async for event in runner.run_async(
            user_id=adk_session.user_id,
            session_id=adk_session.id,
            new_message=content,
        ):
            if event.content and event.content.parts and event.content.parts[0].text:
                response_text += event.content.parts[0].text

        color_code = determine_thought_color(user_message, response_text)
        emote = determine_emotion(user_message, response_text)
        return jsonify({'response': response_text, 'color': color_code, 'emote': emote})
    except Exception as e:
        return jsonify({'response': f"Gemini API Error: {str(e)}"}), 500


@app.route('/tts', methods=['POST'])
async def tts():
    """Proxy to ElevenLabs TTS. Returns raw audio/mpeg bytes.
    Expects {"text": "..."} in body.
    Uses ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID (or VOICE_ID) from .env
    """
    data = request.get_json(silent=True) or {}
    text = (data.get('text') or '').strip()
    if not text:
        return jsonify({'error': 'No text provided'}), 400

    api_key = os.environ.get('ELEVENLABS_API_KEY')
    voice_id = (os.environ.get('ELEVENLABS_VOICE_ID')
                or os.environ.get('VOICE_ID')
                or '4tRn1lSkEn13EVTuqb0g')

    if not api_key:
        return jsonify({'error': 'ELEVENLABS_API_KEY not set in .env'}), 500

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    headers = {
        "xi-api-key": api_key,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg"
    }
    payload = {
        "text": text,
        "model_id": "eleven_turbo_v2_5",
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75
        }
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            audio_bytes = resp.content
        return Response(audio_bytes, mimetype='audio/mpeg')
    except Exception as e:
        return jsonify({'error': f'ElevenLabs TTS failed: {str(e)}'}), 500


# --- Emote storage helpers ---

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


# --- Emote API endpoints ---

@app.route('/api/emotes', methods=['GET'])
def get_emotes():
    """Get all custom emotes."""
    emotes = load_emotes()
    return jsonify(emotes)

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


if __name__ == '__main__':
    host = os.environ.get('HOST', '127.0.0.1')
    port = int(os.environ.get('PORT', 5000))
    app.run(host=host, port=port, debug=True)
