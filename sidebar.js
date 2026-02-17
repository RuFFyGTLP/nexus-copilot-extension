/**
 * Nexus Co-Pilot - Main Entry Point
 * Orchestrates all modules: config, chat, tools, and settings.
 * 
 * Architecture:
 *   sidebar.js (this file) → Entry point & event wiring
 *   js/config.js            → Constants, defaults, profiles
 *   js/tools.js             → Agent tool execution + security layer
 *   js/chat.js              → Chat logic, messages, voice input
 *   js/settings.js          → Settings UI, MCP, models, backup
 * 
 * @version 2.0
 */

import { DEFAULTS } from './js/config.js';
import { executeTool } from './js/tools.js';
import {
    showToast,
    addMessage,
    initChat,
    setupVoiceInput
} from './js/chat.js';
import {
    checkStatus,
    setupProfiles,
    loadSettingsToUI,
    saveSettings,
    setupReset,
    applyImmediateSettings,
    setupRangeSliders,
    scanModels,
    setupSettingsTabs,
    setupBackup,
    setupScreenshot,
    setupMcp,
    setupModelsManager
} from './js/settings.js';

// ─── Application Bootstrap ─────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

    // ── Core DOM Elements ──
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const messagesEl = document.getElementById('chat-messages');
    const btnExport = document.getElementById('btn-export-chat');
    const btnClear = document.getElementById('btn-clear-chat');
    const btnStop = document.getElementById('btn-stop-gen');
    const settingsToggle = document.getElementById('settings-toggle');
    const settingsClose = document.getElementById('settings-close');
    const settingsPanel = document.getElementById('settings-panel');
    const bgReload = document.getElementById('bg-reload');
    const statusIndicator = document.getElementById('status-indicator');
    const quickActions = document.getElementById('quick-actions');

    // ── Reload Button (if exists) ──
    if (bgReload) {
        bgReload.onclick = () => location.reload();
    }

    // ─── Global Error Handler ───────────────────────────────────────────────
    window.onerror = function (message, source, lineno, colno, error) {
        console.error("Global Error:", message, error);
        showToast(`Error Sistema: ${message}`, 'error');
    };

    // ─── Initialize Chat Module ─────────────────────────────────────────────
    const chat = initChat({
        chatInput,
        messagesEl,
        btnStop
    });

    // ─── Backend Status Check ───────────────────────────────────────────────
    checkStatus(statusIndicator);
    setInterval(() => checkStatus(statusIndicator), 30000);

    // ─── QoL Features ───────────────────────────────────────────────────────

    // 1. Export Chat
    if (btnExport) {
        btnExport.onclick = () => {
            const msgs = Array.from(document.querySelectorAll('.message')).map(m => {
                const role = m.classList.contains('user') ? 'User' : 'Assistant';
                const text = m.querySelector('.bubble').innerText;
                return `${role}: ${text}\n`;
            }).join('\n-------------------\n\n');

            const blob = new Blob([msgs], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `nexus-chat-${new Date().toISOString().slice(0, 10)}.txt`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('Chat exportado', 'success');
        };
    }

    // 2. Clear Chat
    if (btnClear) {
        btnClear.onclick = () => {
            if (confirm('¿Borrar toda la conversación?')) {
                messagesEl.innerHTML = '';
                addMessage(messagesEl, 'assistant', '¡Hola! Soy tu extensión de Nexus.<br>Chat reiniciado.', false, DEFAULTS);
            }
        };
    }

    // 3. Stop Generation
    if (btnStop) {
        btnStop.onclick = () => {
            chat.cancelGeneration();
            btnStop.classList.add('hidden');
            const loadingMsg = messagesEl.querySelector('.loading-msg');
            if (loadingMsg) loadingMsg.innerText = '(Detenido por usuario)';
            showToast('Generación detenida', 'info');
        };
    }

    // 4. Quick Actions
    if (quickActions) {
        quickActions.querySelectorAll('.chip').forEach(chip => {
            chip.onclick = () => {
                const prompt = chip.dataset.prompt;
                chatInput.value = prompt + ' ';
                chatInput.focus();
            };
        });
    }

    // ─── Settings Panel ─────────────────────────────────────────────────────

    if (settingsToggle && settingsPanel) {
        settingsToggle.onclick = () => {
            loadSettingsToUI();
            settingsPanel.classList.remove('hidden');
            scanModels();
        };
    }

    if (settingsClose && settingsPanel) {
        settingsClose.onclick = () => {
            settingsPanel.classList.add('hidden');
            showToast('Configuración cerrada', 'info');
        };
    }

    // Manual model refresh
    const btnRefresh = document.getElementById('btn-refresh-models');
    if (btnRefresh) btnRefresh.onclick = scanModels;

    // ─── Initialize All Settings Modules ────────────────────────────────────
    setupSettingsTabs();
    setupProfiles(loadSettingsToUI);
    saveSettings(settingsPanel);
    setupReset();
    setupRangeSliders();
    setupBackup();
    setupScreenshot(chat);
    setupMcp();
    setupModelsManager();

    // Apply saved visual settings on load
    chrome.storage.sync.get(DEFAULTS, applyImmediateSettings);

    // ─── Read Page Button ───────────────────────────────────────────────────
    const readPageBtn = document.getElementById('read-page-btn');
    if (readPageBtn) {
        readPageBtn.onclick = async () => {
            try {
                showToast('Leyendo página...', 'info');
                const result = await executeTool('read_page', { mode: 'text' });
                if (result.error) {
                    showToast('Error: ' + result.error, 'error');
                    return;
                }
                const pagePreview = result.result ? result.result.substring(0, 500) + '...' : 'Sin contenido';
                if (chatInput) {
                    chatInput.value = `[Contenido de la página actual]:\n${pagePreview}\n\n¿Qué quieres saber sobre esta página?`;
                    chatInput.style.height = 'auto';
                    chatInput.style.height = (chatInput.scrollHeight) + 'px';
                    chatInput.focus();
                }
                window._lastPageContent = result.result;
                showToast('Página leída con éxito', 'success');
            } catch (e) {
                console.error('Error reading page:', e);
                showToast('Error al leer la página', 'error');
            }
        };
    }

    // ─── Chat Input Listeners ───────────────────────────────────────────────
    if (chatInput) {
        chatInput.addEventListener('input', function () {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
        });

        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                chrome.storage.sync.get({ sendOnEnter: true }, (i) => {
                    if (i.sendOnEnter) {
                        e.preventDefault();
                        chat.sendMessage();
                    }
                });
            }
        });
    }

    if (sendBtn) sendBtn.onclick = () => chat.sendMessage();

    // ─── Voice Input ────────────────────────────────────────────────────────
    const btnVoice = document.getElementById('btn-voice-input');
    setupVoiceInput(chatInput, btnVoice);

    // ─── Context Menu Message Receiver ──────────────────────────────────────
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.type === 'NEXUS_CONTEXT_ACTION') {
            if (chatInput) {
                chatInput.value = request.text;
                chatInput.style.height = 'auto';
                chatInput.style.height = (chatInput.scrollHeight) + 'px';
                chat.sendMessage();
            }
        }
    });

    // ─── Keyboard Shortcut Handler ──────────────────────────────────────────
    // Handles Ctrl+Shift+K to focus chat input when panel is already open
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'K') {
            e.preventDefault();
            if (chatInput) {
                chatInput.focus();
                showToast('Chat activado (Ctrl+Shift+K)', 'info');
            }
        }
    });

    // ─── Log Boot ───────────────────────────────────────────────────────────
    console.log('[Nexus Co-Pilot] v2.0 - Modular Architecture loaded ✅');
    console.log('[Nexus Co-Pilot] Modules: config, tools (security), chat, settings');
});
