from flask import Flask, render_template, request, jsonify
from google.adk.runners import InMemoryRunner
from google.genai import types
import asyncio
import os

app = Flask(__name__)


runner = None
character_exists = os.path.exists('character.py')

if character_exists:
    import character
    runner = InMemoryRunner(
        agent=character.root_agent,
        app_name="Demo App",
    )

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
    
    api_provider = request.json.get('api_provider', 'gemini')
    user_api_key = request.json.get('api_key')
    openai_url = request.json.get('openai_url')
    openai_key = request.json.get('openai_key')
    openai_model = request.json.get('openai_model')

    if not character_exists:
        return jsonify({'response': user_message})

    if api_provider == 'openai':
        # Use OpenAI Compatible API
        system_instruction = character.root_agent.instruction if character_exists else ""
        try:
            response_text = await call_openai_compatible(
                base_url=openai_url or "http://localhost:11434/v1",
                api_key=openai_key or "",
                model=openai_model or "llama3",
                system_instruction=system_instruction,
                user_message=user_message
            )
            color_code = determine_thought_color(user_message, response_text)
            emote = determine_emotion(user_message, response_text)
            return jsonify({'response': response_text, 'color': color_code, 'emote': emote})
        except Exception as e:
            return jsonify({'response': f"OpenAI Compatible API Error: {str(e)}"}), 500

    # Fallback/Default: Gemini API
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


if __name__ == '__main__':
    host = os.environ.get('HOST', '127.0.0.1')
    port = int(os.environ.get('PORT', 5000))
    app.run(host=host, port=port, debug=True)
