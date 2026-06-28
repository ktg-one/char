document.addEventListener('DOMContentLoaded', () => {
    const sessionId = Math.random().toString(36).substring(2, 15);

    // Clean any legacy voice localStorage keys.
    // LocalSoundsAPI (sibling folder at project root) is the attached local voice provider.
    // No browser/Microsoft voices are used or selectable.
    ['voice', 'selectedVoice', 'voiceSelect', 'browserVoice', 'tts_voice', 'speech_voice'].forEach(key => {
        try { localStorage.removeItem(key); } catch (e) {}
    });

    // Simple chat history for context (SillyTavern-style best practice).
    // Keeps the local model consistent and able to reference past information.
    // We only send the last few turns to the backend.
    let chatHistory = []; // [{role: 'user'|'assistant', content: string}]
    const textInput = document.getElementById('text-input');
    const sendButton = document.getElementById('send-button');
    const characterImage = document.getElementById('character-image');
    const characterVideo = document.getElementById('character-video');
    const chatLog = document.getElementById('chat-log');
    const ledRing = document.getElementById('led-ring');
    const micButton = document.getElementById('mic-button');

    // Voice is provided exclusively by the attached LocalSoundsAPI (top-level folder).
    // TTS always goes through server /tts → LocalSoundsAPI (Kokoro) primary.
    // ElevenLabs only if LOCAL_SOUNDS_URL fails and ELEVENLABS_API_KEY is set.
    // Zero browser or Microsoft voice code paths remain.

    // Seed initial message in the new scrollable chat log
    if (chatLog) {
        const initial = appendMessage('assistant', '');
        if (initial) initial.textContent = 'Ask me something!';
    }

    // Small indicator element we can use for transient text if needed (no auto DOM insertion to avoid breaking layout)
    let statusIndicator = document.createElement('div');
    statusIndicator.id = 'status-indicator';
    statusIndicator.style.cssText = 'text-align:center; font-size:0.8rem; opacity:0.6; padding:2px 0;';

    // Persistent badge in the header so the user can always see if a custom system prompt is active on the *server*.
    // This directly addresses "I edited the prompt in Settings but the model behavior didn't change" and "the system didn't affect the backend".
    const headerTitle = document.querySelector('.chat-header h1');
    if (headerTitle) {
        fetch('/api/system_prompt').then(r => r.json()).then(data => {
            // Remove any stale badge first (safety on reloads or multiple calls)
            const old = headerTitle.querySelector('span[style*="8A2BE2"]');
            if (old) old.remove();
            const charName = (characterTitle?.textContent || activeCharacter || '').toLowerCase();
            if (data.is_custom && charName === 'luna' && headerTitle) {
                const badge = document.createElement('span');
                badge.style.cssText = 'font-size:0.55rem; background:#8A2BE2; color:white; padding:1px 5px; border-radius:3px; margin-left:6px; vertical-align:middle; white-space:nowrap;';
                badge.textContent = 'Luna custom prompt';
                headerTitle.appendChild(badge);
            }
        }).catch(() => {});
    }

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
    let editingEmote = null;
    let activeCharacter = localStorage.getItem('active_character') || 'Luna';
    let forcedSpriteSrc = null;
    const characterSelect = document.getElementById('character-select');
    const characterTitle = document.getElementById('character-title');
    const expressionBadge = document.getElementById('expression-badge');
    const galleryList = document.getElementById('gallery-list');
    const videoList = document.getElementById('video-list');
    const assignAssetGrid = document.getElementById('assign-asset-grid');
    const assignExpressionSelect = document.getElementById('assign-expression-select');
    const clearAssignButton = document.getElementById('clear-assign-button');

    let expressionMeta = {
        labels: [],
        sprites: {},
        gallery: [],
        videos: [],
        custom_labels: [],
        fallback: 'joy',
        legacy_aliases: {},
        character: activeCharacter,
    };

    let familiarityState = { level: 1, xp: 0, progress: 0, global_level: 1 };
    let contentUnlocks = { expressions: {}, gallery: 1, videos: 1 };
    let characterCatalog = [];
    let spriteMap = {};
    let allAssets = [];
    let expressionGuide = { scene_tags: [], emotion_groups: [] };

    const familiarityLevelEl = document.getElementById('familiarity-level');
    const familiarityFillEl = document.getElementById('familiarity-fill');
    const createCharacterBtn = document.getElementById('create-character-button');
    const createCharacterModal = document.getElementById('create-character-modal');
    const closeCreateCharacter = document.getElementById('close-create-character');
    const saveCharacterButton = document.getElementById('save-character-button');
    const newCharSpriteSource = document.getElementById('new-char-sprite-source');
    const newCharSpritePath = document.getElementById('new-char-sprite-path');
    const newCharSpritePathLabel = document.getElementById('new-char-sprite-path-label');

    const updateFamiliarityBar = (fam) => {
        if (!fam) return;
        familiarityState = { ...familiarityState, ...fam };
        if (familiarityLevelEl) {
            familiarityLevelEl.textContent = `Lv ${fam.level || 1}`;
        }
        if (familiarityFillEl) {
            const pct = Math.round((fam.progress || 0) * 100);
            familiarityFillEl.style.width = `${pct}%`;
        }
        const bar = document.getElementById('familiarity-bar');
        if (bar) {
            bar.title = `Familiarity Lv ${fam.level || 1} · ${fam.xp || 0} XP`;
        }
    };

    const showLevelToast = (text) => {
        const toast = document.createElement('div');
        toast.className = 'level-toast';
        toast.textContent = text;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 4200);
    };

    const isExpressionUnlocked = (name) => {
        const req = contentUnlocks.expressions?.[name] ?? 1;
        return (familiarityState.level || 1) >= req;
    };

    const tabUnlocked = (tab) => {
        if (tab === 'gallery') return (familiarityState.level || 1) >= (contentUnlocks.gallery || 1);
        if (tab === 'videos') return (familiarityState.level || 1) >= (contentUnlocks.videos || 1);
        return true;
    };

    const normalizeEmote = (name) => {
        const key = (name || '').toLowerCase();
        const aliases = expressionMeta.legacy_aliases || {};
        return aliases[key] || key;
    };

    // Load custom emotes from localStorage
    const loadCustomEmotes = () => {
        const stored = localStorage.getItem('custom_emotes');
        customEmotes = stored ? JSON.parse(stored) : [];
    };

    // Save custom emotes to localStorage
    const saveCustomEmotesToStorage = () => {
        localStorage.setItem('custom_emotes', JSON.stringify(customEmotes));
    };

    const updateExpressionBadge = (label) => {
        if (expressionBadge) expressionBadge.textContent = label || 'neutral';
    };

    const fetchCharacters = async () => {
        try {
            const resp = await fetch('/api/characters');
            if (!resp.ok) return;
            const data = await resp.json();
            characterCatalog = data.characters || [];
            familiarityState.global_level = data.global_level || 1;
            if (characterSelect && data.characters?.length) {
                characterSelect.innerHTML = '';
                data.characters.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c.id;
                    const lock = c.locked ? ` 🔒 L${c.unlock_level}` : '';
                    const fam = c.familiarity ? ` · Lv${c.familiarity.level}` : '';
                    opt.textContent = `${c.display_name} (${c.sprite_count || 0})${fam}${lock}`;
                    opt.disabled = Boolean(c.locked);
                    characterSelect.appendChild(opt);
                });
            }
            if (data.active) {
                activeCharacter = data.active;
                localStorage.setItem('active_character', activeCharacter);
            }
            const activeMeta = characterCatalog.find(c => c.id === activeCharacter);
            if (activeMeta?.familiarity) updateFamiliarityBar(activeMeta.familiarity);
            if (characterSelect) characterSelect.value = activeCharacter;
            if (characterTitle) {
                const dn = activeMeta?.display_name || activeCharacter;
                characterTitle.textContent = dn;
            }
        } catch (err) {
            console.error('Failed to fetch characters:', err);
        }
    };

    const switchCharacter = async (name) => {
        const meta = characterCatalog.find(c => c.id === name);
        if (meta?.locked) {
            showLevelToast(`Reach global level ${meta.unlock_level} to unlock ${meta.display_name}`);
            if (characterSelect) characterSelect.value = activeCharacter;
            return;
        }
        activeCharacter = name;
        forcedSpriteSrc = null;
        localStorage.setItem('active_character', name);
        if (characterTitle) characterTitle.textContent = meta?.display_name || name;
        try {
            const resp = await fetch('/api/characters/active', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ character: name }),
            });
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                showLevelToast(err.error || 'Cannot switch character');
                if (characterSelect) characterSelect.value = activeCharacter;
                return;
            }
        } catch (_) {}
        if (meta?.familiarity) updateFamiliarityBar(meta.familiarity);
        await fetchEmotes();
        renderEmoteList();
        renderGalleryList();
        renderVideoList();
        setCharacterVisual('neutral', 'resting');
    };

    // Fetch emotes from backend
    const fetchEmotes = async () => {
        try {
            const resp = await fetch(`/api/emotes?character=${encodeURIComponent(activeCharacter)}`);
            if (resp.ok) {
                const data = await resp.json();
                customEmotes = data.custom || [];
                if (data.expressions) {
                    expressionMeta = { ...expressionMeta, ...data.expressions, character: activeCharacter };
                }
                if (data.familiarity) updateFamiliarityBar(data.familiarity);
                if (data.content_unlocks) contentUnlocks = data.content_unlocks;
                if (data.sprite_map) spriteMap = data.sprite_map;
                if (data.all_assets) allAssets = data.all_assets;
                if (data.expression_guide) expressionGuide = data.expression_guide;
                saveCustomEmotesToStorage();
                populateAssignExpressionSelect();
                renderAssignGrid();
            }
        } catch (err) {
            console.error('Failed to fetch emotes:', err);
        }
    };

    const renderGalleryList = () => {
        if (!galleryList) return;
        galleryList.innerHTML = '';
        (expressionMeta.gallery || []).forEach(item => {
            const el = document.createElement('div');
            el.className = 'emote-item';
            el.innerHTML = `
                <img src="${item.preview}" alt="${item.label}">
                <div class="emote-info"><div class="emote-name">scene</div></div>`;
            el.addEventListener('click', () => {
                forcedSpriteSrc = item.preview;
                setCharacterVisual('scene', 'resting', item.preview);
            });
            galleryList.appendChild(el);
        });
    };

    const renderVideoList = () => {
        if (!videoList) return;
        videoList.innerHTML = '';
        (expressionMeta.videos || []).forEach(v => {
            const el = document.createElement('div');
            el.className = 'emote-item';
            const label = v.expression || v.fileName;
            el.innerHTML = `
                <div class="emote-name" style="font-size:0.7rem;margin-bottom:0.25rem;">▶ ${v.fileName}</div>
                <div class="emote-keywords" style="font-size:0.65rem;opacity:0.6;">${label}</div>`;
            el.addEventListener('click', () => {
                forcedSpriteSrc = v.videoSrc || v.imageSrc;
                setCharacterVisual(label, 'resting', forcedSpriteSrc);
            });
            videoList.appendChild(el);
        });
    };

    const populateAssignExpressionSelect = () => {
        if (!assignExpressionSelect) return;
        const sceneSet = new Set((expressionGuide.scene_tags || []).map(s => s.toLowerCase()));
        const emotions = expressionMeta.labels?.length
            ? [...expressionMeta.labels]
            : ['neutral', 'joy', 'sadness', 'excitement', 'anger', 'surprise', 'confusion', 'desire'];
        (expressionMeta.custom_labels || []).forEach(l => {
            if (!emotions.includes(l) && !sceneSet.has(l.toLowerCase())) emotions.push(l);
        });
        const emotionOnly = emotions.filter(l => !sceneSet.has(l.toLowerCase()));
        const uniqScenes = [...sceneSet].sort();
        const prev = assignExpressionSelect.value;
        assignExpressionSelect.innerHTML =
            `<optgroup label="Emotions (face)">${
                emotionOnly.map(l => `<option value="${l}">${l}</option>`).join('')
            }</optgroup>` +
            (uniqScenes.length
                ? `<optgroup label="Scenes (on screen)">${
                    uniqScenes.map(l => `<option value="${l}">${l}</option>`).join('')
                }</optgroup>`
                : '');
        if (prev && [...assignExpressionSelect.options].some(o => o.value === prev)) {
            assignExpressionSelect.value = prev;
        }
    };

    const assignSpriteToExpression = async (expression, fileName) => {
        try {
            const resp = await fetch('/api/sprites/assign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    character: activeCharacter,
                    expression,
                    filename: fileName,
                }),
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || 'Assign failed');
            spriteMap = data.sprite_map || spriteMap;
            renderAssignGrid();
            renderEmoteList();
            setCharacterVisual(expression, 'resting');
            forcedSpriteSrc = getMappedSpriteSrc(expression);
            showLevelToast(`Assigned ${fileName} → ${expression}`);
        } catch (err) {
            alert(err.message);
        }
    };

    const renderAssignGrid = () => {
        if (!assignAssetGrid) return;
        assignAssetGrid.innerHTML = '';
        if (!allAssets.length) {
            assignAssetGrid.innerHTML = '<p class="emote-hint">No images in this character folder yet. Upload a ZIP or set an external sprite path.</p>';
            return;
        }
        allAssets.forEach(asset => {
            const assigned = getAssignmentForFile(asset.fileName);
            const el = document.createElement('div');
            el.className = `emote-item${assigned ? ' assigned' : ''}`;
            el.style.cursor = 'pointer';
            const isVideo = /\.(mp4|webm)$/i.test(asset.fileName);
            el.innerHTML = isVideo
                ? `<div class="emote-name" style="font-size:0.65rem;">▶ ${asset.fileName}</div>
                   <div class="assign-badge">${assigned ? `→ ${assigned}` : `guess: ${asset.guessed_expression || '?'}`}</div>`
                : `<img src="${asset.imageSrc}" alt="${asset.fileName}">
                   <div class="emote-info">
                     <div class="emote-name" style="font-size:0.62rem;word-break:break-all;">${asset.fileName}</div>
                     <div class="assign-badge">${assigned ? `→ ${assigned}` : `guess: ${asset.guessed_expression || '?'}`}</div>
                   </div>`;
            el.addEventListener('click', async () => {
                const expr = assignExpressionSelect?.value || 'neutral';
                await assignSpriteToExpression(expr, asset.fileName);
            });
            assignAssetGrid.appendChild(el);
        });
    };

    // Render emote list (SillyTavern 28 Go-Emotions grid + customs)
    const renderEmoteList = () => {
        emoteList.innerHTML = '';

        const stLabels = expressionMeta.labels?.length
            ? expressionMeta.labels
            : ['neutral', 'joy', 'sadness', 'excitement', 'anger', 'surprise', 'confusion', 'desire'];

        stLabels.forEach(name => {
            const hasSprite = Boolean(expressionMeta.sprites?.[name]?.length);
            const hasCustom = Boolean(getCustomEmote(name));
            const unlocked = isExpressionUnlocked(name);
            const req = contentUnlocks.expressions?.[name] ?? 1;
            const item = document.createElement('div');
            item.className = `emote-item${unlocked ? '' : ' locked'}`;
            item.style.cursor = unlocked ? 'pointer' : 'not-allowed';
            item.title = unlocked
                ? `SillyTavern expression: ${name}. Click to preview.`
                : `Unlocks at familiarity Lv ${req}`;
            item.innerHTML = `
                <img src="${getImagePath(name, false)}" alt="${name}">
                <div class="emote-info">
                    <div class="emote-name">${name}</div>
                    <div class="emote-keywords" style="font-size:0.65rem;opacity:0.65;">
                        ${spriteMap[name] ? `📷 ${spriteMap[name]}` : hasCustom ? '<span style="color:#7dffb3">✓ custom pic</span>' : unlocked ? '<span style="color:#ffb347">no pic set</span>' : `<span class="lock-req">🔒 Lv ${req}</span>`}
                    </div>
                </div>
                <span class="lock-icon" title="SillyTavern Go-Emotions label">ST</span>
            `;
            item.addEventListener('click', (e) => {
                if (e.target.tagName === 'BUTTON') return;
                if (!unlocked) {
                    showLevelToast(`${name} unlocks at familiarity Lv ${req}`);
                    return;
                }
                const mainImg = document.getElementById('character-image');
                if (mainImg) setCharacterVisual(name, 'resting');
            });
            // Add explicit "upload pictures to override" button for built-ins
            const setPicBtn = document.createElement('button');
            setPicBtn.type = 'button';
            setPicBtn.className = 'emote-upload-btn';
            setPicBtn.textContent = spriteMap[name] ? '📷 Change pic' : '📷 Set pic';
            setPicBtn.title = `Choose which image shows when LLM uses [emote: ${name}]`;
            setPicBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openAssignTab(name);
            });
            item.appendChild(setPicBtn);
            const overrideBtn = document.createElement('button');
            overrideBtn.type = 'button';
            overrideBtn.className = 'emote-upload-btn';
            overrideBtn.textContent = hasCustom ? 'Upload pair' : 'Upload pair';
            overrideBtn.title = `Upload closed + open mouth pair for "${name}" (Luna-style)`;
            overrideBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const existing = getCustomEmote(name);
                showForm(existing || name);
            });
            item.appendChild(overrideBtn);
            emoteList.appendChild(item);
        });
        
        // Custom expressions with sprites (shower, bed, scene, …)
        const stSet = new Set(stLabels.map(l => l.toLowerCase()));
        (expressionMeta.custom_labels || []).forEach(name => {
            if (stSet.has(name)) return;
            if (!expressionMeta.sprites?.[name]?.length) return;
            const item = document.createElement('div');
            item.className = 'emote-item';
            item.style.cursor = 'pointer';
            item.innerHTML = `
                <img src="${getImagePath(name, false)}" alt="${name}">
                <div class="emote-info"><div class="emote-name">${name}</div></div>`;
            item.addEventListener('click', () => setCharacterVisual(name, 'resting'));
            emoteList.appendChild(item);
            stSet.add(name);
        });

        customEmotes.forEach(emote => {
            const normalized = normalizeEmote(emote.name);
            if (stSet.has((emote.name || '').toLowerCase()) || stSet.has(normalized)) return;
            const item = document.createElement('div');
            item.className = 'emote-item';
            item.style.cursor = 'pointer';
            item.title = `Click to preview ${emote.name} emote (your custom images) on the character`;
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
            item.addEventListener('click', () => {
                const mainImg = document.getElementById('character-image');
                if (mainImg) {
                    setCharacterVisual(emote.name, 'resting');
                }
            });
            emoteList.appendChild(item);
        });
        
        // Add delete listeners
        document.querySelectorAll('.delete-button').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation(); // prevent triggering the emote preview click
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
                await fetchEmotes();
                renderEmoteList();
            }
        } catch (err) {
            console.error('Failed to delete emote:', err);
        }
    };

    const openExpressionsTab = () => {
        document.querySelectorAll('.emote-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.emote-tab-panel').forEach(p => { p.style.display = 'none'; });
        const tab = document.querySelector('.emote-tab[data-tab="expressions"]');
        const panel = document.getElementById('emote-tab-expressions');
        if (tab) tab.classList.add('active');
        if (panel) panel.style.display = 'block';
    };

    const openAssignTab = (expression = null) => {
        document.querySelectorAll('.emote-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.emote-tab-panel').forEach(p => { p.style.display = 'none'; });
        const tab = document.querySelector('.emote-tab[data-tab="assign"]');
        const panel = document.getElementById('emote-tab-assign');
        if (tab) tab.classList.add('active');
        if (panel) panel.style.display = 'block';
        if (expression && assignExpressionSelect) {
            assignExpressionSelect.value = expression;
        }
        renderAssignGrid();
    };

    // Show/hide form
    const showForm = (options = null) => {
        openExpressionsTab();
        emoteForm.style.display = 'block';
        addEmoteButton.style.display = 'none';
        const presetName = typeof options === 'string' ? options : options?.name;
        const editEmote = options && typeof options === 'object' ? options : null;
        editingEmote = editEmote;

        if (editEmote) {
            formTitle.textContent = 'Edit Custom Emote';
            emoteNameInput.value = editEmote.name;
            emoteKeywordsInput.value = (editEmote.keywords || []).join(', ');
            emoteColorInput.value = editEmote.color || '#00FFFF';
            emoteClosedPreview.src = editEmote.images.closed;
            emoteClosedPreview.style.display = 'block';
            emoteOpenPreview.src = editEmote.images.open;
            emoteOpenPreview.style.display = 'block';
            emoteNameInput.readOnly = true;
        } else if (presetName) {
            formTitle.textContent = `Upload pictures for "${presetName}"`;
            emoteNameInput.value = presetName;
            emoteKeywordsInput.value = '';
            emoteColorInput.value = '#00FFFF';
            emoteClosedPreview.style.display = 'none';
            emoteOpenPreview.style.display = 'none';
            emoteNameInput.readOnly = true;
        } else {
            formTitle.textContent = 'Add Custom Emote';
            emoteNameInput.value = '';
            emoteKeywordsInput.value = '';
            emoteColorInput.value = '#00FFFF';
            emoteClosedPreview.style.display = 'none';
            emoteOpenPreview.style.display = 'none';
            emoteNameInput.readOnly = false;
        }
        emoteForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };

    const hideForm = () => {
        emoteForm.style.display = 'none';
        addEmoteButton.style.display = 'block';
        editingEmote = null;
        emoteNameInput.value = '';
        emoteKeywordsInput.value = '';
        emoteClosedImage.value = '';
        emoteOpenImage.value = '';
        emoteClosedPreview.style.display = 'none';
        emoteOpenPreview.style.display = 'none';
        emoteNameInput.readOnly = false;
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
        const closedFile = emoteClosedImage.files[0];
        const openFile = emoteOpenImage.files[0];
        const existingImages = editingEmote?.images || null;

        if (!name) {
            alert('Emote name is required');
            return;
        }

        let images = null;
        if (closedFile || openFile) {
            if (!closedFile || !openFile) {
                alert('When uploading new images, select both closed and open mouth images.');
                return;
            }
        } else if (existingImages?.closed && existingImages?.open) {
            images = {
                closed: existingImages.closed,
                open: existingImages.open,
            };
        } else {
            alert('Both mouth images are required — pick closed and open files.');
            return;
        }

        saveEmoteButton.disabled = true;
        const prevLabel = saveEmoteButton.textContent;
        saveEmoteButton.textContent = 'Saving…';

        try {
            if (!images) {
                const formData = new FormData();
                formData.append('name', name);
                formData.append('closed', closedFile);
                formData.append('open', openFile);

                const uploadResp = await fetch('/api/emotes/upload', {
                    method: 'POST',
                    body: formData,
                });
                const uploadData = await uploadResp.json().catch(() => ({}));

                if (!uploadResp.ok) {
                    throw new Error(uploadData.error || 'Failed to upload images');
                }
                images = uploadData.images;
            }

            const createResp = await fetch('/api/emotes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    keywords,
                    color,
                    images,
                }),
            });

            if (!createResp.ok) {
                const err = await createResp.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to save emote');
            }
            
            const newEmote = await createResp.json();
            await fetchEmotes(); // re-fetch from server to ensure consistency
            renderEmoteList();
            hideForm();

            // Helpful feedback for overrides
            const stNames = (expressionMeta.labels || []).map(l => l.toLowerCase());
            if (stNames.includes(normalizeEmote(name))) {
                const msg = `Override created for SillyTavern expression "${normalizeEmote(name)}". Your images will be used for [emote: ${normalizeEmote(name)}].`;
                if (statusIndicator) {
                    statusIndicator.textContent = msg;
                    setTimeout(() => { if (statusIndicator && statusIndicator.textContent === msg) statusIndicator.textContent = ''; }, 4000);
                } else {
                    alert(msg);
                }
            } else {
                if (statusIndicator) {
                    statusIndicator.textContent = `Custom emote "${name}" added with your pictures.`;
                    setTimeout(() => { if (statusIndicator && statusIndicator.textContent.includes('added')) statusIndicator.textContent = ''; }, 2500);
                }
            }
        } catch (err) {
            alert(err.message || 'Failed to save emote');
        } finally {
            saveEmoteButton.disabled = false;
            saveEmoteButton.textContent = prevLabel;
        }
    });

    // Cancel form
    cancelEmoteButton.addEventListener('click', hideForm);

    // SillyTavern sprite pack ZIP import
    const spriteZipInput = document.getElementById('sprite-zip-input');
    if (spriteZipInput) {
        spriteZipInput.addEventListener('change', async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const formData = new FormData();
            formData.append('file', file);
            try {
                const resp = await fetch('/api/expressions/import-zip', {
                    method: 'POST',
                    body: formData,
                });
                const data = await resp.json();
                if (!resp.ok) throw new Error(data.error || 'ZIP import failed');
                await fetchEmotes();
                renderEmoteList();
                alert(`Imported ${data.imported?.length || 0} sprites for ${data.character || 'Luna'}.`);
            } catch (err) {
                alert(err.message);
            } finally {
                spriteZipInput.value = '';
            }
        });
    }

    // Add emote button
    addEmoteButton.addEventListener('click', () => showForm());

    // Modal controls
    document.querySelectorAll('.emote-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const name = tab.dataset.tab;
            if (!tabUnlocked(name)) {
                const req = name === 'gallery' ? contentUnlocks.gallery : contentUnlocks.videos;
                showLevelToast(`${name} unlocks at familiarity Lv ${req}`);
                return;
            }
            document.querySelectorAll('.emote-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.emote-tab-panel').forEach(p => {
                p.style.display = 'none';
            });
            const panel = document.getElementById(`emote-tab-${name}`);
            if (panel) panel.style.display = 'block';
            if (name === 'assign') renderAssignGrid();
            if (name === 'gallery') renderGalleryList();
            if (name === 'videos') renderVideoList();
        });
    });

    if (clearAssignButton) {
        clearAssignButton.addEventListener('click', async () => {
            const expr = assignExpressionSelect?.value;
            if (!expr) return;
            try {
                const resp = await fetch('/api/sprites/assign', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ character: activeCharacter, expression: expr }),
                });
                const data = await resp.json();
                if (!resp.ok) throw new Error(data.error || 'Clear failed');
                spriteMap = data.sprite_map || {};
                renderAssignGrid();
                renderEmoteList();
            } catch (err) {
                alert(err.message);
            }
        });
    }

    if (characterSelect) {
        characterSelect.addEventListener('change', () => switchCharacter(characterSelect.value));
    }

    emotesButton.addEventListener('click', () => {
        renderEmoteList();
        renderAssignGrid();
        renderGalleryList();
        renderVideoList();
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

    const getCustomEmote = (emote) => {
        const emoteLower = (emote || '').toLowerCase();
        const normalized = normalizeEmote(emoteLower);
        return customEmotes.find(e => {
            const n = (e.name || '').toLowerCase();
            return n === emoteLower || n === normalized || normalizeEmote(n) === normalized;
        });
    };

    const resolveVideoSrc = (images, speaking) => {
        if (!images) return null;
        if (speaking) {
            return images.speakVideo || images.speakWebm || images.speakMp4
                || images.video || images.webm || images.mp4 || null;
        }
        return images.video || images.webm || images.mp4 || null;
    };

    const resolveGifSrc = (images, speaking) => {
        if (!images) return null;
        if (speaking) {
            return images.speakGif || images.gif || null;
        }
        return images.gif || null;
    };

    const getMappedSpriteSrc = (emote) => {
        const label = normalizeEmote(emote);
        const mappedFile = spriteMap[label];
        if (!mappedFile) return null;
        const asset = allAssets.find(a => a.fileName === mappedFile);
        if (asset) return asset.imageSrc;
        const pool = expressionMeta.sprites?.[label] || [];
        const hit = pool.find(s => s.fileName === mappedFile);
        return hit?.imageSrc || `/sprites/${encodeURIComponent(activeCharacter)}/${encodeURIComponent(mappedFile)}`;
    };

    const getAssignmentForFile = (fileName) => {
        for (const [expr, file] of Object.entries(spriteMap)) {
            if (file === fileName) return expr;
        }
        return null;
    };

    const pickCatalogSprite = (emote) => {
        // Only user-assigned pics — never auto-guess from Civitai filenames
        return getMappedSpriteSrc(emote);
    };

    /** resting | speaking — returns png | gif | video */
    const setCharacterVisual = (emote, state = 'resting', overrideSrc = null) => {
        const speaking = state === 'speaking';
        updateExpressionBadge(normalizeEmote(emote));
        const customEmote = getCustomEmote(emote);
        const images = customEmote?.images;

        let videoSrc = resolveVideoSrc(images, speaking);
        if (!videoSrc) {
            const catalogSrc = overrideSrc || forcedSpriteSrc || pickCatalogSprite(emote);
            if (catalogSrc && /\.(mp4|webm)$/i.test(catalogSrc)) {
                videoSrc = catalogSrc;
            }
        }
        if (videoSrc) {
            characterImage.style.display = 'none';
            characterVideo.style.display = 'block';
            if (characterVideo.getAttribute('src') !== videoSrc) {
                characterVideo.src = videoSrc;
                characterVideo.load();
            }
            characterVideo.loop = true;
            characterVideo.muted = true;
            characterVideo.play().catch(() => {});
            return 'video';
        }

        const gifSrc = resolveGifSrc(images, speaking);
        if (gifSrc) {
            characterVideo.pause();
            characterVideo.style.display = 'none';
            characterImage.style.display = 'block';
            characterImage.src = gifSrc;
            return 'gif';
        }

        characterVideo.pause();
        characterVideo.style.display = 'none';
        characterImage.style.display = 'block';
        const catalogStill = overrideSrc || forcedSpriteSrc || pickCatalogSprite(emote);
        characterImage.src = catalogStill || getImagePath(emote, speaking);
        return 'png';
    };

    function getImagePath(emote, isOpen) {
        const label = normalizeEmote(emote);
        const customEmote = getCustomEmote(label) || getCustomEmote(emote);
        if (customEmote?.images) {
            return isOpen
                ? (customEmote.images.open || customEmote.images.closed)
                : customEmote.images.closed;
        }
        const mapped = getMappedSpriteSrc(label);
        if (mapped) return mapped;
        const fallback = expressionMeta.fallback || 'joy';
        const defaultLabel = expressionMeta.labels?.includes(label) ? label : fallback;
        return `/static/img/default-expressions/${defaultLabel}.png`;
    }

    // Preload all emotes (built-in + custom)
    const preloadEmotes = () => {
        const builtInForPreload = expressionMeta.labels?.length
            ? expressionMeta.labels
            : ['neutral', 'joy', 'sadness', 'excitement', 'anger', 'surprise', 'confusion', 'desire'];
        builtInForPreload.forEach(emote => {
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

    let lipSyncInterval;

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

    function appendMessage(role, text) {
        if (!chatLog) return null;
        const msg = document.createElement('div');
        msg.className = `message ${role}`;
        const content = document.createElement('div');
        content.className = 'message-content';
        msg.appendChild(content);
        chatLog.appendChild(msg);
        chatLog.scrollTop = chatLog.scrollHeight;
        return content;
    }

    const speak = async (text, emote = 'neutral') => {
        // Stop any previous TTS (browser or elevenlabs)
        if (currentAudio) {
            currentAudio.pause();
            currentAudio = null;
        }
        clearInterval(lipSyncInterval);

        // Check if TTS is enabled in settings
        const ttsEnabled = localStorage.getItem('tts_enabled') !== 'false';
        if (!ttsEnabled || !text) {
            return;
        }

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
                const mediaMode = setCharacterVisual(emote, 'speaking');
                if (mediaMode === 'png') {
                    const openMouthImg = getImagePath(emote, true);
                    const closedMouthImg = getImagePath(emote, false);
                    let mouthOpen = true;
                    lipSyncInterval = setInterval(() => {
                        characterImage.src = mouthOpen ? openMouthImg : closedMouthImg;
                        mouthOpen = !mouthOpen;
                    }, 150);
                }
            };

            audio.onended = () => {
                clearInterval(lipSyncInterval);
                setCharacterVisual(emote, 'resting');
                URL.revokeObjectURL(audioUrl);
                currentAudio = null;
            };

            audio.onerror = () => {
                clearInterval(lipSyncInterval);
                setCharacterVisual(emote, 'resting');
                URL.revokeObjectURL(audioUrl);
                currentAudio = null;
            };

            await audio.play();
        } catch (err) {
            console.error('Server TTS failed. LocalSoundsAPI (top folder) is the attached provider. ElevenLabs fallback only if key set and local unavailable. Error:', err);
            // No TTS if server path fails. Pure local voice (no browser/Microsoft).
        }
    };

    const handleSendMessage = async () => {
        const message = textInput.value.trim();
        if (!message) return;

        textInput.value = '';
        textInput.style.height = '50px';

        if (statusIndicator) statusIndicator.textContent = "Thinking...";
        
        // Start the color-cycling animation and reset face to neutral closed mouth
        ledRing.classList.add('thinking');
        ledRing.style.borderColor = '';
        ledRing.style.boxShadow = '';
        setCharacterVisual('neutral', 'resting');

        // Push user turn to local history (SillyTavern best practice for context)
        chatHistory.push({ role: 'user', content: message });

        // Append user message to the scrollable chat log
        const userContent = appendMessage('user', message);
        if (userContent) userContent.textContent = message;
        if (chatLog) chatLog.scrollTop = chatLog.scrollHeight;

        try {
            const apiProvider = localStorage.getItem('api_provider') || 'openai';
            const savedApiKey = localStorage.getItem('api_key') || '';
            // Respect whatever the user saved in Settings (LM Studio 1234, Ollama 11434, etc.)
            // SillyTavern-style: user controls the exact base URL + model name for their local backend.
            const openaiUrl = localStorage.getItem('openai_url') || 'http://localhost:11434/v1';
            const openaiKey = localStorage.getItem('openai_key') || '';
            const openaiModel = localStorage.getItem('openai_model') || 'skyhigh:latest';

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
                    openai_model: openaiModel,
                    history: chatHistory,
                    character: activeCharacter,
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

            if (data.familiarity) {
                updateFamiliarityBar(data.familiarity);
                if (data.familiarity.leveled_up) {
                    showLevelToast(`${activeCharacter} familiarity → Lv ${data.familiarity.level}! New content may unlock.`);
                    await fetchCharacters();
                    await fetchEmotes();
                }
            }
            if (data.raw_emote && data.emote && data.raw_emote !== data.emote) {
                showLevelToast(`Expression "${data.raw_emote}" locked — showing ${data.emote} until Lv up.`);
            }

            // Backend returns ST-normalized expression in data.emote (tag stripped from response text).
            if (data.emote) {
                data.emote = normalizeEmote(data.emote);
                forcedSpriteSrc = null;
            }
            
            // Stop thinking animation and settle on the color determined by thought process
            ledRing.classList.remove('thinking');
            if (data.color) {
                ledRing.style.borderColor = data.color;
                ledRing.style.boxShadow = `0 0 30px ${data.color}`;
            }
            
            setCharacterVisual(data.emote, 'resting');
            
            // Append assistant message to chat log (scrollable box)
            const assistantContent = appendMessage('assistant', '');
            if (assistantContent) {
                typewriter(data.response, assistantContent);
            }
            if (chatLog) chatLog.scrollTop = chatLog.scrollHeight;

            // Visible confirmation that your frontend-edited prompt was actually sent and used by the backend.
            // This helps debug "I edited the prompt but the model behavior didn't change".
            if (data.system_prompt_source === 'custom' && assistantContent && assistantContent.parentElement) {
                const note = document.createElement('div');
                note.style.cssText = 'font-size:0.65rem; opacity:0.55; margin-bottom:4px; font-style:italic;';
                note.textContent = '↳ using custom system prompt saved to the server (via Settings)';
                assistantContent.parentElement.insertBefore(note, assistantContent);
            }

            // Guard: only speak actual character output. Never dictate 404/API errors through TTS.
            // (Learned from real use + SillyTavern error isolation best practice)
            const isApiError = typeof data.response === 'string' && (data.response.includes('API Error') || data.response.includes('404 Not Found') || data.response.toLowerCase().includes('error'));
            if (!isApiError) {
                speak(data.response, data.emote || 'neutral');
            }

            // Style API errors in the chat log so they're obvious
            if (data.response && (data.response.includes('API Error') || data.response.includes('404 Not Found'))) {
                const lastMsg = chatLog ? chatLog.lastElementChild : null;
                if (lastMsg) lastMsg.style.borderColor = '#ff5555';
            }

            // Store assistant turn for future context (keep history reasonable length)
            if (data.response && !isApiError) {
                chatHistory.push({ role: 'assistant', content: data.response });
                // Trim to last ~12 turns client-side
                if (chatHistory.length > 12) chatHistory = chatHistory.slice(-12);
            }

            if (statusIndicator) statusIndicator.textContent = '';
        } catch (error) {
            console.error('Error:', error);
            
            // Stop thinking animation and settle on an error color
            ledRing.classList.remove('thinking');
            ledRing.style.borderColor = '#FF0055';
            ledRing.style.boxShadow = '0 0 30px #FF0055';
            
            const errorMessage = 'Sorry, something went wrong. Please try again.';
            const errContent = appendMessage('assistant', errorMessage);
            if (errContent) {
                errContent.textContent = errorMessage;
                // Make API errors stand out
                const parentMsg = errContent.parentElement;
                if (parentMsg) parentMsg.style.borderColor = '#ff5555';
            }
            if (chatLog) chatLog.scrollTop = chatLog.scrollHeight;

            // Do not TTS generic errors — user doesn't want the companion "scared" by reading 404s out loud.
            // Only visual + status in the log. Real replies go through the guarded speak above.
            if (statusIndicator) statusIndicator.textContent = '';
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
            if (statusIndicator) statusIndicator.textContent = "Listening...";
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            textInput.value = transcript;
            textInput.style.height = 'auto';
            textInput.style.height = `${textInput.scrollHeight}px`;
            if (statusIndicator) statusIndicator.textContent = "Press Send or Enter to chat.";
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            isRecording = false;
            micButton.classList.remove('recording');
            if (statusIndicator) statusIndicator.textContent = "Sorry, couldn't hear that. Try again.";
        };

        recognition.onend = () => {
            isRecording = false;
            micButton.classList.remove('recording');
            if (statusIndicator && statusIndicator.textContent === "Listening...") {
                statusIndicator.textContent = "";
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

    // Editable system prompt (character instructions)
    const systemPromptInput = document.getElementById('system-prompt-input');
    const resetPromptButton = document.getElementById('reset-prompt-button');

    const ollamaModelList = document.getElementById('ollama-model-list');
    const localModelsHint = document.getElementById('local-models-hint');

    const migrateLocalLlmSettings = (localData) => {
        if (!localData?.available) return;
        const localUrl = localData.base_url || 'http://localhost:11434/v1';
        const savedUrl = localStorage.getItem('openai_url') || '';
        // Stale LM Studio / OpenRouter URLs in localStorage break chat when Ollama is the real backend.
        if (!savedUrl || savedUrl.includes('1234') || savedUrl.includes('openrouter')) {
            localStorage.setItem('openai_url', localUrl);
            localStorage.setItem('openai_key', '');
        }
        const savedModel = localStorage.getItem('openai_model');
        const staleModels = new Set(['llama3.2', 'openrouter/free', '']);
        if (!savedModel || staleModels.has(savedModel) || !localData.models.includes(savedModel)) {
            localStorage.setItem('openai_model', localData.suggested_model || 'skyhigh:latest');
        }
    };

    const refreshLocalModelPicker = async () => {
        try {
            const resp = await fetch('/api/local_models');
            if (!resp.ok) return;
            const data = await resp.json();
            migrateLocalLlmSettings(data);
            if (ollamaModelList && data.models?.length) {
                ollamaModelList.innerHTML = '';
                data.models.forEach(name => {
                    const opt = document.createElement('option');
                    opt.value = name;
                    ollamaModelList.appendChild(opt);
                });
            }
            if (localModelsHint && data.available && data.rp_models?.length) {
                localModelsHint.innerHTML = `<strong>Ollama detected (${data.models.length} models).</strong> RP picks on this PC: <code>${data.rp_models.join('</code>, <code>')}</code>. Use exact tag in Model Name. No API key for local. Keep model loaded — no drain/unload needed between chats.`;
            }
            return data;
        } catch (_) {
            return null;
        }
    };

    // Load saved settings
    const loadSettings = async () => {
        // Auto-migrate anyone who still has the old 'gemini' default (or no setting) to local
        let provider = localStorage.getItem('api_provider');
        if (!provider || provider === 'gemini') {
            provider = 'openai';
            localStorage.setItem('api_provider', 'openai');
        }
        apiProviderSelect.value = provider;
        toggleProviderPanels(provider);

        const localData = await refreshLocalModelPicker();
        const suggested = localData?.suggested_model || 'skyhigh:latest';
        const localUrl = localData?.base_url || 'http://localhost:11434/v1';

        // One-time migration: stale default model names that aren't on this Ollama install
        const savedModel = localStorage.getItem('openai_model');
        const staleDefaults = new Set(['llama3.2', 'openrouter/free', '']);
        if (localData?.available && (!savedModel || staleDefaults.has(savedModel) || !localData.models.includes(savedModel))) {
            localStorage.setItem('openai_model', suggested);
            if (!localStorage.getItem('openai_url') || localStorage.getItem('openai_url').includes('openrouter')) {
                localStorage.setItem('openai_url', localUrl);
            }
        }

        const savedOpenaiUrl = localStorage.getItem('openai_url') || localUrl;
        apiKeyInput.value = localStorage.getItem('api_key') || '';
        openaiUrlInput.value = savedOpenaiUrl;
        openaiKeyInput.value = localStorage.getItem('openai_key') || '';
        openaiModelInput.value = localStorage.getItem('openai_model') || suggested;

        // The prompt textarea is populated in the settingsButton click handler (fetches live default)

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

    loadSettings().catch(() => {});

    // Settings listeners
    ttsRate.addEventListener('input', () => {
        rateValue.textContent = ttsRate.value + 'x';
    });

    ttsPitch.addEventListener('input', () => {
        pitchValue.textContent = ttsPitch.value;
    });

    let defaultSystemPrompt = '';

    settingsButton.addEventListener('click', async () => {
        await loadSettings();

        // Load the active prompt from server (custom if saved in the system, else the built-in default).
        // This makes the edit affect the backend for everyone.
        try {
            const resp = await fetch('/api/system_prompt');
            if (resp.ok) {
                const data = await resp.json();
                defaultSystemPrompt = data.prompt || '';
                // If it's a custom one saved on the server, we can note it
            }
        } catch (e) {
            console.warn('Could not fetch system prompt', e);
        }

        // Prefill with whatever the server says is active (custom or default)
        if (systemPromptInput) {
            systemPromptInput.value = defaultSystemPrompt;
        }

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
        
        // Save the prompt to the SERVER so it affects the backend for all chats (not just this browser).
        // This is what makes the edit "in the system".
        if (systemPromptInput) {
            const promptText = systemPromptInput.value.trim();
            fetch('/api/system_prompt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: promptText })
            }).then(async () => {
                // Re-fetch live from server so badge + in-memory reflect the just-saved state immediately.
                // Prevents "it reverted on refresh / after finish" feeling.
                try {
                    const fresh = await fetch('/api/system_prompt');
                    const fdata = await fresh.json();
                    defaultSystemPrompt = fdata.prompt || '';

                    // Live-update (or add/remove) the header badge without page reload
                    const h = document.querySelector('.chat-header h1');
                    if (h) {
                        const oldBadge = h.querySelector('span[style*="8A2BE2"]');
                        if (oldBadge) oldBadge.remove();
                        if (fdata.is_custom) {
                            const badge = document.createElement('span');
                            badge.style.cssText = 'font-size:0.55rem; background:#8A2BE2; color:white; padding:1px 5px; border-radius:3px; margin-left:6px; vertical-align:middle; white-space:nowrap;';
                            badge.textContent = 'custom prompt active (server)';
                            h.appendChild(badge);
                        }
                    }
                } catch (e) {}
            }).catch(() => {});
        }

        // Show status indicating settings saved — be specific about the prompt
        let msg = "Settings saved successfully!";
        if (systemPromptInput && systemPromptInput.value.trim()) {
            msg = "Settings saved. Custom system prompt saved to server — it will be used for the next chats.";
        }
        if (statusIndicator) statusIndicator.textContent = msg;
        setTimeout(() => {
            if (statusIndicator && statusIndicator.textContent === msg) {
                statusIndicator.textContent = "";
            }
        }, 2500);
    });

    // Reset prompt editor to the server default (fetched when modal was opened)
    if (resetPromptButton && systemPromptInput) {
        resetPromptButton.addEventListener('click', () => {
            systemPromptInput.value = defaultSystemPrompt || '';
            // Reset on the SERVER so the backend goes back to built-in for everyone.
            fetch('/api/system_prompt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: '' })
            }).catch(() => {});
        });
    }

    if (createCharacterBtn && createCharacterModal) {
        createCharacterBtn.addEventListener('click', () => createCharacterModal.classList.add('open'));
        closeCreateCharacter?.addEventListener('click', () => createCharacterModal.classList.remove('open'));
        window.addEventListener('click', (e) => {
            if (e.target === createCharacterModal) createCharacterModal.classList.remove('open');
        });
    }

    if (newCharSpriteSource) {
        newCharSpriteSource.addEventListener('change', () => {
            const external = newCharSpriteSource.value === 'external';
            if (newCharSpritePath) newCharSpritePath.style.display = external ? 'block' : 'none';
            if (newCharSpritePathLabel) newCharSpritePathLabel.style.display = external ? 'block' : 'none';
        });
    }

    if (saveCharacterButton) {
        saveCharacterButton.addEventListener('click', async () => {
            const id = document.getElementById('new-char-id')?.value?.trim();
            const display_name = document.getElementById('new-char-display')?.value?.trim() || id;
            if (!id) {
                alert('Character ID is required');
                return;
            }
            const payload = {
                id,
                display_name,
                description: document.getElementById('new-char-description')?.value?.trim() || '',
                personality: document.getElementById('new-char-personality')?.value?.trim() || '',
                scenario: document.getElementById('new-char-scenario')?.value?.trim() || '',
                first_mes: document.getElementById('new-char-first-mes')?.value?.trim() || '',
                sprite_source: newCharSpriteSource?.value || 'local',
                sprite_path: newCharSpritePath?.value?.trim() || '',
                unlock_level: parseInt(document.getElementById('new-char-unlock-level')?.value || '0', 10),
            };
            saveCharacterButton.disabled = true;
            saveCharacterButton.textContent = 'Creating…';
            try {
                const resp = await fetch('/api/characters', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                const data = await resp.json();
                if (!resp.ok) throw new Error(data.error || 'Create failed');
                createCharacterModal.classList.remove('open');
                showLevelToast(`Created ${display_name}! Upload sprites via Expressions → ZIP.`);
                await fetchCharacters();
                if (data.id) await switchCharacter(data.id);
            } catch (err) {
                alert(err.message);
            } finally {
                saveCharacterButton.disabled = false;
                saveCharacterButton.textContent = 'Create Companion';
            }
        });
    }

    // Initialize emotes + migrate stale LLM settings before first chat
    loadCustomEmotes();
    refreshLocalModelPicker()
        .then(() => fetchCharacters())
        .then(() => fetchEmotes())
        .then(() => {
            preloadEmotes();
            setCharacterVisual('neutral', 'resting');
        });
});
