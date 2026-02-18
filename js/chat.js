/**
 * Nexus Co-Pilot - Chat Module
 * Handles message sending, rendering, conversation context, voice input, and TTS.
 * @module chat
 */

import { DEFAULTS } from './config.js';
import { executeTool, AGENT_TOOLS_PROMPT } from './tools.js';

// ─── Shared Chat State ──────────────────────────────────────────────────────

/** @type {AbortController|null} */
let abortController = null;

/** @type {string|null} Base64 screenshot currently attached */
let currentImage = null;

/** @type {number} Current tool recursion depth to prevent infinite loops */
let toolDepth = 0;

/** Maximum allowed tool call recursions per user message */
const MAX_TOOL_DEPTH = 3;

// ─── Toast Notification ─────────────────────────────────────────────────────

/**
 * Shows a floating toast notification.
 * @param {string} msg - Message text
 * @param {'info'|'success'|'error'} type - Toast type
 */
export function showToast(msg, type = 'info') {
    const t = document.createElement('div');
    t.innerText = msg;

    let bg = '#1e293b';
    let col = 'white';
    if (type === 'success') { bg = '#065f46'; col = '#a7f3d0'; }
    if (type === 'error') { bg = '#7f1d1d'; col = '#fecaca'; }

    t.style.cssText = `
        position: fixed; bottom: 70px; left: 50%; transform: translateX(-50%);
        background: ${bg}; color: ${col};
        padding: 8px 16px; border-radius: 20px; font-size: 11px; z-index: 200;
        box-shadow: 0 4px 6px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1);
        animation: fadeIn 0.3s;
    `;
    document.body.appendChild(t);
    setTimeout(() => {
        t.style.opacity = '0';
        setTimeout(() => t.remove(), 300);
    }, 2000);
}

// ─── Conversation Context ───────────────────────────────────────────────────

/**
 * Builds the conversation context from rendered messages in the DOM.
 * @returns {string} Formatted conversation history as plain text
 */
export function getConversationContext() {
    const allMsgs = document.querySelectorAll('#chat-messages .message');
    let context = '';
    allMsgs.forEach(msg => {
        const isUser = msg.classList.contains('user');
        const isSystem = msg.classList.contains('system');
        const bubble = msg.querySelector('.bubble');
        if (bubble) {
            const text = bubble.innerText.replace('Generando...', '').trim();
            if (text && !text.includes('Pensando...')) {
                if (isSystem) {
                    context += `System: ${text}\n\n`;
                } else if (isUser) {
                    context += `User: ${text}\n\n`;
                } else {
                    context += `Assistant: ${text}\n\n`;
                }
            }
        }
    });
    return context;
}

/**
 * Builds structured message array from DOM messages for OpenAI-compatible APIs.
 * Used by Ollama and LM Studio providers that expect [{role, content}] format.
 * @param {number} [limit=20] - Max messages to include
 * @returns {Array<{role: string, content: string}>}
 */
function getStructuredMessages(limit = 20) {
    const allMsgs = document.querySelectorAll('#chat-messages .message');
    const messages = [];
    allMsgs.forEach(msg => {
        const bubble = msg.querySelector('.bubble');
        if (!bubble) return;
        const text = bubble.innerText.replace('Generando...', '').trim();
        if (!text || text.includes('Pensando...')) return;

        let role = 'user';
        if (msg.classList.contains('assistant')) role = 'assistant';
        else if (msg.classList.contains('system')) role = 'system';

        messages.push({ role, content: text });
    });
    // Return the latest N messages to stay within context window
    return messages.slice(-limit);
}

// ─── Message Rendering ──────────────────────────────────────────────────────

/**
 * Adds a message bubble to the chat area.
 * @param {HTMLElement} messagesEl - The chat messages container element
 * @param {string} role - 'user' | 'assistant' | 'system'
 * @param {string} text - Message text (supports markdown)
 * @param {boolean} isLoading - Whether this is a loading placeholder
 * @param {Object} config - Current configuration object
 */
export function addMessage(messagesEl, role, text, isLoading = false, config = DEFAULTS) {
    if (!messagesEl) return;
    const div = document.createElement('div');
    div.className = `message ${role}`;

    let avatarSvg;
    if (role === 'user') {
        avatarSvg = config.userAvatar ? `<img src="${config.userAvatar}" class="avatar-img">` :
            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
    } else if (role === 'system') {
        avatarSvg = '';
    } else {
        avatarSvg = config.botAvatar ? `<img src="${config.botAvatar}" class="avatar-img">` :
            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>';
    }

    // ── Markdown Parsing (Basic) ──
    let content = text;
    if (!isLoading) {
        // Code blocks
        content = content.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
            return `<pre><button class="copy-code-btn" onclick="navigator.clipboard.writeText(this.nextElementSibling.innerText)">Copiar</button><code class="language-${lang || 'text'}">${code}</code></pre>`;
        });
        // Bold
        content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Italic
        content = content.replace(/\*(.*?)\*/g, '<em>$1</em>');
        // Inline code
        content = content.replace(/`([^`]+)`/g, '<code style="background:rgba(0,0,0,0.3);padding:1px 4px;border-radius:3px;font-size:12px;">$1</code>');
        // Line breaks
        content = content.replace(/\n/g, '<br>');
    } else {
        content = '<span class="loading-msg">Generando...</span>';
    }

    div.innerHTML = `
        <div class="avatar">${avatarSvg}</div>
        <div class="bubble">
            ${content}
            ${!isLoading ? `
            <div class="msg-actions">
                <button class="action-btn btn-copy" title="Copiar">📋</button>
                <button class="action-btn btn-speak" title="Leer en voz alta">🔊</button>
                ${role === 'assistant' ? '<button class="action-btn btn-regen" title="Regenerar">🔄</button>' : ''}
            </div>` : ''}
        </div>
    `;

    // ── Action Event Listeners ──
    if (!isLoading) {
        const btnCopy = div.querySelector('.btn-copy');
        if (btnCopy) btnCopy.onclick = () => {
            navigator.clipboard.writeText(text);
            showToast('Copiado al portapapeles', 'success');
        };

        const btnSpeak = div.querySelector('.btn-speak');
        if (btnSpeak) btnSpeak.onclick = () => {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = config.uiLanguage === 'es' ? 'es-ES' : 'en-US';
            utterance.rate = config.ttsRate || 1.0;
            utterance.pitch = config.ttsPitch || 1.0;
            speechSynthesis.speak(utterance);
        };

        const btnRegen = div.querySelector('.btn-regen');
        if (btnRegen) btnRegen.onclick = () => {
            const userMsgs = document.querySelectorAll('.message.user');
            if (userMsgs.length > 0) {
                const lastUserMsg = userMsgs[userMsgs.length - 1];
                const lastText = lastUserMsg.querySelector('.bubble').innerText.split('\n')[0];
                div.remove();
                const chatInput = document.getElementById('chat-input');
                if (chatInput) {
                    chatInput.value = lastText;
                    sendMessageFromUI();
                }
            }
        };
    }

    messagesEl.appendChild(div);

    // Autoscroll
    if (config.autoScroll) {
        requestAnimationFrame(() => {
            messagesEl.scrollTo({
                top: messagesEl.scrollHeight,
                behavior: 'smooth'
            });
        });
    }
}

// ─── Core Send Message Logic ────────────────────────────────────────────────

/** Reference to the public sendMessage function bound in initChat() */
let sendMessageFromUI = () => { };

/**
 * Initializes the chat module by binding the sendMessage function.
 * Must be called during app initialization.
 * @param {Object} elements - DOM elements needed for chat
 * @param {HTMLElement} elements.chatInput - The textarea input
 * @param {HTMLElement} elements.messagesEl - The chat messages container
 * @param {HTMLElement} elements.btnStop - Stop generation button
 * @returns {{ sendMessage: Function, getAbortController: Function, setImage: Function, getImage: Function, clearImage: Function }}
 */
export function initChat({ chatInput, messagesEl, btnStop }) {

    /**
     * Sends a message to the configured AI provider.
     * @param {string|null} textOverride - If provided, used instead of input value (e.g., tool output)
     * @param {boolean} isToolFollowUp - Whether this call is a follow-up after a tool execution
     */
    async function sendMessage(textOverride = null, isToolFollowUp = false) {
        if (!chatInput) return;
        const text = textOverride || chatInput.value.trim();
        if (!text) return;

        // Reset tool depth on fresh user messages
        if (!textOverride) {
            toolDepth = 0;
        }

        let config = DEFAULTS;
        let endpoint = '';

        try {
            config = await new Promise(r => chrome.storage.sync.get(DEFAULTS, r));
        } catch (e) {
            console.warn('[Nexus] Could not load config, using defaults');
        }

        if (!textOverride) {
            addMessage(messagesEl, 'user', text, false, config);
            chatInput.value = '';
            chatInput.style.height = 'auto';
        } else {
            addMessage(messagesEl, 'system', '🔍 Procesando resultado de herramienta...', false, config);
        }

        addMessage(messagesEl, 'assistant', 'Pensando...', true, config);

        if (btnStop) btnStop.classList.remove('hidden');
        abortController = new AbortController();

        try {
            const provider = config.provider || 'nexus';
            endpoint = config.apiUrl ? config.apiUrl.replace(/\/$/, '') : 'http://localhost:3000';
            let payload = {};

            // Build system instruction
            let systemInstruction = config.systemPrompt || '';

            if (config.customInstructions) {
                systemInstruction += `\n\n[USER INSTRUCTIONS & PREFERENCES]\n${config.customInstructions}`;
            }
            if (config.responseStyle && config.responseStyle !== 'normal') {
                systemInstruction += `\n\n[RESPONSE STYLE]\nUse a ${config.responseStyle} tone/style.`;
            }

            // BUG FIX #4: Only inject Agent Tools Prompt when NOT in a tool follow-up
            // and when tool depth allows more calls
            const canUseTool = toolDepth < MAX_TOOL_DEPTH;
            if (canUseTool && !isToolFollowUp) {
                systemInstruction += '\n\n' + AGENT_TOOLS_PROMPT;
            } else if (isToolFollowUp) {
                systemInstruction += '\n\n[IMPORTANT] You have already used a tool and received the result below. DO NOT call any more tools. Use the tool result to answer the user\'s original question directly. Respond in a natural, helpful way.';
            }

            // Build Conversation History
            let fullConversation = getConversationContext();
            const historyMessages = getStructuredMessages(config.historyLimit || 20);

            if (textOverride) {
                fullConversation += `System: [TOOL RESULT]\n${textOverride}\n\nAssistant: `;
            }

            // ── Provider-specific payload ──
            if (provider === 'nexus') {
                endpoint += '/api/ai/chat';
                const mcpData = await new Promise(r => chrome.storage.sync.get({ mcpServers: [], enableMcp: false }, r));

                // Build messages array with system + history
                const nexusMessages = [
                    ...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []),
                    ...historyMessages
                ];

                // CRITICAL FIX: If this is a tool result, add it to the messages array
                // so the AI actually receives the page content / tool output
                if (textOverride) {
                    nexusMessages.push({ role: 'user', content: textOverride });
                }

                payload = {
                    message: text,
                    messages: nexusMessages,
                    model: config.model,
                    reasoningModel: config.reasoningModel,
                    temperature: config.temperature,
                    image: currentImage,
                    mcpServers: mcpData.enableMcp ? mcpData.mcpServers : []
                };
            } else if (provider === 'ollama') {
                // BUG FIX #2: Include full conversation history for Ollama
                endpoint += '/api/chat';
                const ollamaMessages = [
                    ...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []),
                    ...historyMessages
                ];

                // If this is a tool result, add it as context
                if (textOverride) {
                    ollamaMessages.push({ role: 'user', content: textOverride });
                }

                // Add image to the last user message if present
                if (currentImage) {
                    const lastUserMsg = [...ollamaMessages].reverse().find(m => m.role === 'user');
                    if (lastUserMsg) {
                        lastUserMsg.images = [currentImage.split(',')[1]];
                    }
                }

                payload = {
                    model: config.model,
                    messages: ollamaMessages,
                    stream: false,
                    options: { temperature: config.temperature }
                };
            } else if (provider === 'lmstudio') {
                // BUG FIX #2: Include full conversation history for LM Studio
                endpoint += '/v1/chat/completions';
                const lmMessages = [
                    ...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []),
                    ...historyMessages
                ];

                // If this is a tool result, add it as context
                if (textOverride) {
                    lmMessages.push({ role: 'user', content: textOverride });
                }

                // Handle image for the last user message (OpenAI vision format)
                if (currentImage) {
                    const lastUserMsg = [...lmMessages].reverse().find(m => m.role === 'user');
                    if (lastUserMsg) {
                        lastUserMsg.content = [
                            { type: 'text', text: lastUserMsg.content },
                            { type: 'image_url', image_url: { url: currentImage } }
                        ];
                    }
                }

                payload = {
                    model: config.model,
                    messages: lmMessages,
                    temperature: config.temperature,
                    stream: false
                };
            }

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {}),
                    ...(config.authHeader ? { 'X-Custom-Auth': config.authHeader } : {})
                },
                body: JSON.stringify(payload),
                signal: abortController.signal
            });

            // Clear image after sending
            if (currentImage) {
                currentImage = null;
                const btnClearImg = document.getElementById('btn-clear-img');
                if (btnClearImg) btnClearImg.click();
            }

            const data = await res.json();

            // Remove loading message
            if (messagesEl) {
                const loadingMsg = messagesEl.querySelector('.loading-msg');
                if (loadingMsg && loadingMsg.parentElement && loadingMsg.parentElement.parentElement) {
                    loadingMsg.parentElement.parentElement.remove();
                }
            }

            let replyText = '';
            if (provider === 'nexus') {
                if (data.success) replyText = data.response;
                else throw new Error(data.error || 'Nexus Error');
            } else if (provider === 'ollama') {
                if (data.message) replyText = data.message.content;
            } else if (provider === 'lmstudio') {
                if (data.choices && data.choices[0]) replyText = data.choices[0].message.content;
            }

            if (replyText) {
                addMessage(messagesEl, 'assistant', replyText, false, config);

                // ── Check for Tool Call in response ──
                // BUG FIX #1: Only attempt tool detection if we haven't exceeded depth limit
                if (toolDepth < MAX_TOOL_DEPTH) {
                    // Flexible regex: supports with or without markdown backticks
                    const toolRegex = /```json\s*(\{[\s\S]*?"tool"[\s\S]*?\})\s*```|(\{[\s\S]*?"tool"\s*:\s*"[\w_]+"[\s\S]*?\})/;
                    const match = replyText.match(toolRegex);
                    const jsonContent = match ? (match[1] || match[2]) : null;

                    if (jsonContent) {
                        try {
                            const toolCall = JSON.parse(jsonContent);
                            if (toolCall.tool) {
                                toolDepth++;
                                console.log(`[Nexus Tools] Depth: ${toolDepth}/${MAX_TOOL_DEPTH} — Executing: ${toolCall.tool}`);
                                showToast(`🛠️ Ejecutando: ${toolCall.tool}... (${toolDepth}/${MAX_TOOL_DEPTH})`, 'info');

                                const result = await executeTool(
                                    toolCall.tool,
                                    toolCall.params || {},
                                    (reason) => {
                                        addMessage(messagesEl, 'system', reason, false, config);
                                    }
                                );

                                if (result.blocked) {
                                    addMessage(messagesEl, 'system', `🔒 ${result.error}`, false, config);
                                } else {
                                    // Send the result back with explicit instruction to NOT call more tools
                                    const outputMsg = `[TOOL RESULT for '${toolCall.tool}']:\n${JSON.stringify(result.result || result, null, 2)}\n\n[INSTRUCTION] Now use this information to respond to the user's original request. Do NOT call any more tools.`;
                                    setTimeout(() => sendMessage(outputMsg, true), 800);
                                }
                            }
                        } catch (e) {
                            console.error("Tool parse error", e);
                            showToast('Error al procesar herramienta', 'error');
                        }
                    }
                } else if (toolDepth >= MAX_TOOL_DEPTH) {
                    console.warn(`[Nexus Tools] Max tool depth (${MAX_TOOL_DEPTH}) reached. Stopping tool execution.`);
                }

            } else {
                addMessage(messagesEl, 'assistant', 'Error: Respuesta vacía.', false, config);
            }

        } catch (e) {
            if (e.name === 'AbortError') return;
            if (messagesEl) {
                const loadingMsg = messagesEl.querySelector('.loading-msg');
                if (loadingMsg && loadingMsg.parentElement && loadingMsg.parentElement.parentElement) {
                    loadingMsg.parentElement.parentElement.remove();
                }
            }
            console.error('[Nexus Chat Error]', e);

            // Build helpful error message
            const provider = config?.provider || 'nexus';
            let errorMsg = `❌ **Error de conexión**\n\n`;
            errorMsg += `**Proveedor:** ${provider}\n`;
            errorMsg += `**Endpoint:** ${endpoint || 'desconocido'}\n`;
            errorMsg += `**Error:** ${e.message}\n\n`;

            if (e.message.includes('Failed to fetch') || e.message.includes('NetworkError')) {
                errorMsg += `**💡 Posibles soluciones:**\n`;
                if (provider === 'nexus') {
                    errorMsg += `• Verifica que el servidor Nexus esté corriendo en la URL configurada\n`;
                    errorMsg += `• Ejecuta: \`npm start\` en tu proyecto backend\n`;
                } else if (provider === 'ollama') {
                    errorMsg += `• Verifica que Ollama esté ejecutándose: \`ollama serve\`\n`;
                    errorMsg += `• URL por defecto: \`http://localhost:11434\`\n`;
                } else if (provider === 'lmstudio') {
                    errorMsg += `• Verifica que LM Studio tenga el servidor local activo\n`;
                    errorMsg += `• URL por defecto: \`http://localhost:1234\`\n`;
                }
                errorMsg += `• Abre ⚙️ Configuración y verifica la URL del proveedor\n`;
                errorMsg += `• Si usas Docker, asegúrate de que los puertos estén expuestos`;
            }

            addMessage(messagesEl, 'assistant', errorMsg, false, config || DEFAULTS);
        } finally {
            if (btnStop) btnStop.classList.add('hidden');
            abortController = null;
        }
    }

    // Bind for external use
    sendMessageFromUI = sendMessage;

    return {
        sendMessage,
        getAbortController: () => abortController,
        setAbortController: (ctrl) => { abortController = ctrl; },
        cancelGeneration: () => {
            if (abortController) {
                abortController.abort();
                abortController = null;
            }
        },
        setImage: (img) => { currentImage = img; },
        getImage: () => currentImage,
        clearImage: () => { currentImage = null; }
    };
}

// ─── Voice Input (STT) ─────────────────────────────────────────────────────

/**
 * Sets up speech-to-text input for the chat.
 * @param {HTMLElement} chatInput - The textarea input
 * @param {HTMLElement} btnVoice - The microphone button
 */
export function setupVoiceInput(chatInput, btnVoice) {
    if (!btnVoice) return;

    let recognition = null;

    if ('webkitSpeechRecognition' in window) {
        recognition = new webkitSpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;

        chrome.storage.sync.get({ uiLanguage: 'es' }, (items) => {
            recognition.lang = items.uiLanguage === 'es' ? 'es-ES' : 'en-US';
        });

        recognition.onstart = () => {
            btnVoice.classList.add('listening');
            showToast('Escuchando...', 'info');
        };

        recognition.onend = () => {
            btnVoice.classList.remove('listening');
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            if (chatInput) {
                chatInput.value = (chatInput.value + ' ' + transcript).trim();
                chatInput.dispatchEvent(new Event('input'));
                chatInput.focus();
            }
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error', event.error);
            btnVoice.classList.remove('listening');
            showToast('Error de reconocimiento: ' + event.error, 'error');
        };
    }

    if (recognition) {
        btnVoice.onclick = () => {
            if (btnVoice.classList.contains('listening')) {
                recognition.stop();
            } else {
                chrome.storage.sync.get({ uiLanguage: 'es' }, (items) => {
                    recognition.lang = items.uiLanguage === 'es' ? 'es-ES' : 'en-US';
                    recognition.start();
                });
            }
        };
    } else {
        btnVoice.style.display = 'none';
        console.warn('Web Speech API not supported in this environment');
    }
}
