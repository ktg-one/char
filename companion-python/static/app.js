document.addEventListener('DOMContentLoaded', () => {
    const sessionId = Math.random().toString(36).substring(2, 15);
    const textInput = document.getElementById('text-input');
    const sendButton = document.getElementById('send-button');
    const characterImage = document.getElementById('character-image');
    const voiceSelect = document.getElementById('voice-select');
    const status = document.getElementById('status');
    const ledRing = document.getElementById('led-ring');
    const micButton = document.getElementById('mic-button');

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

    let voices = [];
    let lipSyncInterval;

    function populateVoiceList() {
        const allVoices = speechSynthesis.getVoices();
        voices = allVoices.filter(voice => voice.name.includes('Google'));
        voiceSelect.innerHTML = '';

        let usVoiceIndex = -1;

        voices.forEach((voice, i) => {
            const option = document.createElement('option');
            option.textContent = `${voice.name} (${voice.lang})`;
            option.setAttribute('data-lang', voice.lang);
            option.setAttribute('data-name', voice.name);
            voiceSelect.appendChild(option);

            if (voice.lang === 'en-US') {
                if (usVoiceIndex === -1) { // Find the first US voice
                    usVoiceIndex = i;
                }
            }
        });

        if (usVoiceIndex !== -1) {
            voiceSelect.selectedIndex = usVoiceIndex;
        }
    }

    populateVoiceList();
    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = populateVoiceList;
    }

    let typewriterTimeout;
    let currentAudio = null;

    const typewriter = (text, element, speed = 50) => {
        if (typewriterTimeout) {
            clearTimeout(typewriterTimeout);
        }
        
        let i = 0;
        element.innerHTML = "";

        // Use Intl.Segmenter to handle grapheme clusters correctly
        if (window.Intl && Intl.Segmenter) {
            const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
            const segments = Array.from(segmenter.segment(text)).map(s => s.segment);
            
            function type() {
                if (i < segments.length) {
                    element.innerHTML += segments[i];
                    i++;
                    typewriterTimeout = setTimeout(type, speed);
                }
            }
            type();
        } else {
            // Fallback for older browsers
            function type() {
                if (i < text.length) {
                    element.innerHTML += text.charAt(i);
                    i++;
                    typewriterTimeout = setTimeout(type, speed);
                }
            }
            type();
        }
    };

    const speak = async (text, emote = 'neutral') => {
        // Stop any previous TTS (browser or elevenlabs)
        if (currentAudio) {
            currentAudio.pause();
            currentAudio = null;
        }
        if (speechSynthesis.speaking) {
            speechSynthesis.cancel();
        }
        clearInterval(lipSyncInterval);

        // Check if TTS is enabled in settings
        const ttsEnabled = localStorage.getItem('tts_enabled') !== 'false';
        if (!ttsEnabled || !text) {
            return;
        }

        const openMouthImg = getImagePath(emote, true);
        const closedMouthImg = getImagePath(emote, false);

        try {
            const resp = await fetch('/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });
            if (!resp.ok) {
                throw new Error('TTS request failed');
            }
            const blob = await resp.blob();
            const audioUrl = URL.createObjectURL(blob);
            const audio = new Audio(audioUrl);
            currentAudio = audio;

            audio.onplay = () => {
                let mouthOpen = true;
                characterImage.src = openMouthImg;
                lipSyncInterval = setInterval(() => {
                    characterImage.src = mouthOpen ? openMouthImg : closedMouthImg;
                    mouthOpen = !mouthOpen;
                }, 150);
            };

            audio.onended = () => {
                clearInterval(lipSyncInterval);
                characterImage.src = closedMouthImg;
                URL.revokeObjectURL(audioUrl);
                currentAudio = null;
            };

            audio.onerror = () => {
                clearInterval(lipSyncInterval);
                characterImage.src = closedMouthImg;
                URL.revokeObjectURL(audioUrl);
                currentAudio = null;
            };

            await audio.play();
        } catch (err) {
            console.error('ElevenLabs TTS error, falling back to browser speech:', err);
            // Fallback to old browser TTS so it doesn't go silent
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = parseFloat(localStorage.getItem('tts_rate') || '1.0');
            utterance.pitch = parseFloat(localStorage.getItem('tts_pitch') || '1.0');

            utterance.onstart = () => {
                let mouthOpen = true;
                characterImage.src = openMouthImg;
                lipSyncInterval = setInterval(() => {
                    characterImage.src = mouthOpen ? openMouthImg : closedMouthImg;
                    mouthOpen = !mouthOpen;
                }, 150);
            };
            utterance.onend = () => {
                clearInterval(lipSyncInterval);
                characterImage.src = closedMouthImg;
            };
            utterance.onerror = () => {
                clearInterval(lipSyncInterval);
                characterImage.src = closedMouthImg;
            };
            speechSynthesis.speak(utterance);
        }
    };

    const handleSendMessage = async () => {
        const message = textInput.value.trim();
        if (!message) return;

        textInput.value = '';
        textInput.style.height = '50px';
        status.textContent = "Thinking...";
        
        // Start the color-cycling animation and reset face to neutral closed mouth
        ledRing.classList.add('thinking');
        ledRing.style.borderColor = '';
        ledRing.style.boxShadow = '';
        characterImage.src = getImagePath('neutral', false);

        try {
            const apiProvider = localStorage.getItem('api_provider') || 'openai';
            const savedApiKey = localStorage.getItem('api_key') || '';
            let openaiUrl = localStorage.getItem('openai_url') || 'http://localhost:11434/v1';
            if (!openaiUrl.includes('11434/v1')) {
                openaiUrl = 'http://localhost:11434/v1';
            }
            const openaiKey = localStorage.getItem('openai_key') || '';
            const openaiModel = localStorage.getItem('openai_model') || 'llama3.2';

            const response = await fetch('/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    message: message, 
                    session_id: sessionId,
                    api_provider: apiProvider,
                    api_key: savedApiKey,
                    openai_url: openaiUrl,
                    openai_key: openaiKey,
                    openai_model: openaiModel
                }),
            });

            let data;
            if (response.ok) {
                data = await response.json();
            } else {
                try {
                    const errData = await response.json();
                    data = { response: errData.response || 'Sorry, something went wrong.' };
                } catch {
                    throw new Error('Network response was not ok');
                }
            }
            
            // Stop thinking animation and settle on the color determined by thought process
            ledRing.classList.remove('thinking');
            if (data.color) {
                ledRing.style.borderColor = data.color;
                ledRing.style.boxShadow = `0 0 30px ${data.color}`;
            }
            
            // Set resting face to the returned emote state
            characterImage.src = getImagePath(data.emote, false);
            
            typewriter(data.response, status);
            speak(data.response, data.emote);
        } catch (error) {
            console.error('Error:', error);
            
            // Stop thinking animation and settle on an error color
            ledRing.classList.remove('thinking');
            ledRing.style.borderColor = '#FF0055';
            ledRing.style.boxShadow = '0 0 30px #FF0055';
            
            const errorMessage = 'Sorry, something went wrong. Please try again.';
            typewriter(errorMessage, status);
            speak(errorMessage, 'sad');
        }
    };

    sendButton.addEventListener('click', handleSendMessage);

    textInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });

    textInput.addEventListener('input', () => {
        textInput.style.height = 'auto';
        textInput.style.height = `${textInput.scrollHeight}px`;
    });

    // Speech Recognition (Speech-to-Text / STT)
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition;
    let isRecording = false;

    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            isRecording = true;
            micButton.classList.add('recording');
            status.textContent = "Listening...";
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            textInput.value = transcript;
            textInput.style.height = 'auto';
            textInput.style.height = `${textInput.scrollHeight}px`;
            status.textContent = "Press Send or Enter to chat.";
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            isRecording = false;
            micButton.classList.remove('recording');
            status.textContent = "Sorry, couldn't hear that. Try again.";
        };

        recognition.onend = () => {
            isRecording = false;
            micButton.classList.remove('recording');
            if (status.textContent === "Listening...") {
                status.textContent = "Ask me something!";
            }
        };

        micButton.addEventListener('click', () => {
            if (isRecording) {
                recognition.stop();
            } else {
                if (currentAudio) {
                    currentAudio.pause();
                    currentAudio = null;
                }
                if (speechSynthesis.speaking) {
                    speechSynthesis.cancel();
                }
                recognition.start();
            }
        });
    } else {
        micButton.style.display = 'none';
        console.warn("Speech recognition (STT) is not supported in this browser.");
    }

    // Settings Modal DOM Elements
    const settingsButton = document.getElementById('settings-button');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettings = document.getElementById('close-settings');
    const apiProviderSelect = document.getElementById('api-provider');
    const geminiSettingsPanel = document.getElementById('gemini-settings');
    const openaiSettingsPanel = document.getElementById('openai-settings');
    const apiKeyInput = document.getElementById('api-key-input');
    const openaiUrlInput = document.getElementById('openai-url-input');
    const openaiKeyInput = document.getElementById('openai-key-input');
    const openaiModelInput = document.getElementById('openai-model-input');
    const ttsEnable = document.getElementById('tts-enable');
    const ttsRate = document.getElementById('tts-rate');
    const ttsPitch = document.getElementById('tts-pitch');
    const rateValue = document.getElementById('rate-value');
    const pitchValue = document.getElementById('pitch-value');
    const saveSettingsButton = document.getElementById('save-settings-button');

    // Load saved settings
    const loadSettings = () => {
        // Auto-migrate anyone who still has the old 'gemini' default (or no setting) to local
        let provider = localStorage.getItem('api_provider');
        if (!provider || provider === 'gemini') {
            provider = 'openai';
            localStorage.setItem('api_provider', 'openai');
            if (!localStorage.getItem('openai_model')) {
                localStorage.setItem('openai_model', 'llama3.2');
            }
        }
        apiProviderSelect.value = provider;
        toggleProviderPanels(provider);

        // Always force a correct Ollama /v1 base URL for local to avoid 404s
        // (many people have bad values in old localStorage)
        let ollamaUrl = localStorage.getItem('openai_url') || '';
        if (!ollamaUrl.includes('11434/v1')) {
            ollamaUrl = 'http://localhost:11434/v1';
            localStorage.setItem('openai_url', ollamaUrl);
        }
        apiKeyInput.value = localStorage.getItem('api_key') || '';
        openaiUrlInput.value = ollamaUrl;
        openaiKeyInput.value = localStorage.getItem('openai_key') || '';
        openaiModelInput.value = localStorage.getItem('openai_model') || 'llama3.2';

        ttsEnable.checked = localStorage.getItem('tts_enabled') !== 'false';
        ttsRate.value = localStorage.getItem('tts_rate') || '1.0';
        ttsPitch.value = localStorage.getItem('tts_pitch') || '1.0';
        
        rateValue.textContent = ttsRate.value + 'x';
        pitchValue.textContent = ttsPitch.value;
    };

    const toggleProviderPanels = (provider) => {
        if (provider === 'openai') {
            geminiSettingsPanel.style.display = 'none';
            openaiSettingsPanel.style.display = 'block';
        } else {
            geminiSettingsPanel.style.display = 'block';
            openaiSettingsPanel.style.display = 'none';
        }
    };

    apiProviderSelect.addEventListener('change', () => {
        toggleProviderPanels(apiProviderSelect.value);
    });

    loadSettings();

    // Settings listeners
    ttsRate.addEventListener('input', () => {
        rateValue.textContent = ttsRate.value + 'x';
    });

    ttsPitch.addEventListener('input', () => {
        pitchValue.textContent = ttsPitch.value;
    });

    settingsButton.addEventListener('click', () => {
        loadSettings();
        settingsModal.classList.add('open');
    });

    const closeModal = () => {
        settingsModal.classList.remove('open');
    };

    closeSettings.addEventListener('click', closeModal);
    window.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            closeModal();
        }
    });

    saveSettingsButton.addEventListener('click', () => {
        localStorage.setItem('api_provider', apiProviderSelect.value);
        localStorage.setItem('api_key', apiKeyInput.value.trim());
        localStorage.setItem('openai_url', openaiUrlInput.value.trim());
        localStorage.setItem('openai_key', openaiKeyInput.value.trim());
        localStorage.setItem('openai_model', openaiModelInput.value.trim());
        localStorage.setItem('tts_enabled', ttsEnable.checked);
        localStorage.setItem('tts_rate', ttsRate.value);
        localStorage.setItem('tts_pitch', ttsPitch.value);
        closeModal();
        
        // Show status indicating settings saved
        status.textContent = "Settings saved successfully!";
        setTimeout(() => {
            if (status.textContent === "Settings saved successfully!") {
                status.textContent = "Ask me something!";
            }
        }, 2000);
    });

    // Initialize emotes
    loadCustomEmotes();
    fetchEmotes().then(() => {
        preloadEmotes();
        characterImage.src = getImagePath('neutral', false);
    });
});
