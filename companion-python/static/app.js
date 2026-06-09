document.addEventListener('DOMContentLoaded', () => {
    const sessionId = Math.random().toString(36).substring(2, 15);
    const textInput = document.getElementById('text-input');
    const sendButton = document.getElementById('send-button');
    const characterImage = document.getElementById('character-image');
    const voiceSelect = document.getElementById('voice-select');
    const status = document.getElementById('status');
    const ledRing = document.getElementById('led-ring');
    const micButton = document.getElementById('mic-button');

    function getImagePath(emote, isOpen) {
        const suffix = isOpen ? 'open' : 'closed';
        if (emote === 'neutral' || !['happy', 'sad'].includes(emote)) {
            return `/static/images/char-mouth-${suffix}.png?v=${sessionId}`;
        }
        return `/static/images/char-${emote}-mouth-${suffix}.png?v=${sessionId}`;
    }

    // Apply cache-busted source immediately and preload images
    characterImage.src = getImagePath('neutral', false);
    ['neutral', 'happy', 'sad'].forEach(emote => {
        const imgOpen = new Image();
        imgOpen.src = getImagePath(emote, true);
        const imgClosed = new Image();
        imgClosed.src = getImagePath(emote, false);
    });

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

    const speak = (text, emote = 'neutral') => {
        if (speechSynthesis.speaking) {
            speechSynthesis.cancel();
        }
        clearInterval(lipSyncInterval);

        // Check if TTS is enabled in settings
        const ttsEnabled = localStorage.getItem('tts_enabled') !== 'false';
        if (!ttsEnabled) {
            return;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        const selectedOption = voiceSelect.selectedOptions && voiceSelect.selectedOptions[0]
            ? voiceSelect.selectedOptions[0].getAttribute('data-name')
            : null;
        const selectedVoice = selectedOption ? voices.find(voice => voice.name === selectedOption) : null;
        if (selectedVoice) {
            utterance.voice = selectedVoice;
        }

        // Apply saved rate and pitch
        utterance.rate = parseFloat(localStorage.getItem('tts_rate') || '1.0');
        utterance.pitch = parseFloat(localStorage.getItem('tts_pitch') || '1.0');

        const openMouthImg = getImagePath(emote, true);
        const closedMouthImg = getImagePath(emote, false);

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
            const apiProvider = localStorage.getItem('api_provider') || 'gemini';
            const savedApiKey = localStorage.getItem('api_key') || '';
            const openaiUrl = localStorage.getItem('openai_url') || '';
            const openaiKey = localStorage.getItem('openai_key') || '';
            const openaiModel = localStorage.getItem('openai_model') || '';

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

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const data = await response.json();
            
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
        const provider = localStorage.getItem('api_provider') || 'gemini';
        apiProviderSelect.value = provider;
        toggleProviderPanels(provider);

        apiKeyInput.value = localStorage.getItem('api_key') || '';
        openaiUrlInput.value = localStorage.getItem('openai_url') || '';
        openaiKeyInput.value = localStorage.getItem('openai_key') || '';
        openaiModelInput.value = localStorage.getItem('openai_model') || '';

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
});
