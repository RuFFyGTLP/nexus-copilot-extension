document.addEventListener('DOMContentLoaded', () => {
    // Core Elements
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const messages = document.getElementById('chat-messages');

    // UI Elements
    const settingsPanel = document.getElementById('settings-panel');
    const settingsToggle = document.getElementById('settings-toggle');
    const settingsClose = document.getElementById('settings-close');
    const cfgSave = document.getElementById('save-settings');
    const btnReset = document.getElementById('btn-reset');
    const bgReload = document.getElementById('bg-reload');

    // QoL Elements
    const btnExport = document.getElementById('btn-export-chat');
    const btnClear = document.getElementById('btn-clear-chat');
    const btnStop = document.getElementById('btn-stop-gen');
    const statusIndicator = document.getElementById('status-indicator');
    const quickActions = document.getElementById('quick-actions');

    let abortController = null;

    // Reload Button
    if (bgReload) {
        bgReload.onclick = () => window.location.reload();
    }

    // Default Configuration
    const defaults = {
        // General
        provider: 'nexus',
        apiUrl: 'http://localhost:3000',
        timeout: 120000, // 2 minutes for deep reasoning
        userName: 'User',
        botName: 'Nexus',
        uiLanguage: 'es',
        enableNotifications: true,
        // LLM
        model: 'qwen2.5-coder:7b', // Upgraded default
        reasoningModel: '',
        systemPrompt: 'Eres Nexus, un asistente inteligente y eficiente. Responde SIEMPRE en español, salvo que te pidan explícitamente traducir o generar código.',
        temperature: 0.6, // Slightly more precise
        topP: 0.9,
        maxTokens: 4096, // Increased
        contextSize: 8192, // Increased for larger files
        repeatPenalty: 1.1,
        topK: 40,
        seed: -1,
        // UI
        fontSize: 13,
        fontFamily: '',
        streamResponse: true,
        autoHighlight: true,
        sendOnEnter: true,
        autoScroll: true,
        userAvatar: '',
        botAvatar: '',
        // Advanced
        authHeader: '',
        apiKey: '',
        historyLimit: 50, // More history
        persistHistory: true,
        mirostat: '0',
        mirostatEta: 0.1,
        mirostatTau: 5.0,
        // New Settings
        customInstructions: '',
        responseStyle: 'normal',
        ttsRate: 1.0,
        ttsPitch: 1.0,
        // MCP Defaults - Preloaded for Power Users
        enableMcp: true,
        mcpServers: [
            {
                name: 'Sequential Thinking',
                type: 'stdio',
                command: 'npx',
                args: ['-y', '@modelcontextprotocol/server-sequential-thinking']
            },
            {
                name: 'Chrome Tools',
                type: 'stdio',
                command: 'npx',
                args: ['-y', '@modelcontextprotocol/server-puppeteer']
            }
        ]
    };

    // --- Profiles System ---
    const PROFILES = {
        dev: {
            name: "Developer Pro",
            desc: "Optimizado para código, debugging y arquitectura. Usa baja temperatura para precisión.",
            config: {
                model: "qwen2.5-coder:7b",
                temperature: 0.2,
                systemPrompt: "Eres un ingeniero de software senior experto. Responde siempre en ESPAÑOL. Tu código debe ser eficiente, seguro y seguir las mejores prácticas (SOLID, DRY). Explica brevemente antes de codificar."
            }
        },
        speed: {
            name: "Laptop Saver (Rápido)",
            desc: "Ideal para equipos modestos. Respuestas rápidas y ligeras para consultas generales.",
            config: {
                model: "llama3.2:3b",
                temperature: 0.7,
                systemPrompt: "Eres un asistente útil y conciso. Responde siempre en ESPAÑOL de forma directa y breve."
            }
        },
        creative: {
            name: "Escritura Creativa",
            desc: "Para generar ideas, correos, historias o marketing. Alta temperatura para originalidad.",
            config: {
                model: "gemma2:9b",
                temperature: 0.9,
                systemPrompt: "Eres un asistente creativo, elocuente y empático. Responde siempre en ESPAÑOL. Usa un tono inspirador y detallado."
            }
        },
        deep: {
            name: "Deep Thinker",
            desc: "Para problemas complejos de lógica o matemáticas. Piensa paso a paso.",
            config: {
                model: "mistral:7b",
                temperature: 0.4,
                systemPrompt: "Eres un experto en resolución de problemas. Responde siempre en ESPAÑOL. Analiza la situación paso a paso antes de dar una conclusión. Usa razonamiento lógico."
            }
        }
    };

    const profileBtns = document.querySelectorAll('.profile-btn');
    const profileDesc = document.getElementById('profile-desc');

    profileBtns.forEach(btn => {
        btn.onclick = () => {
            const key = btn.dataset.profile;
            const profile = PROFILES[key];
            if (profile) {
                // Update UI active state
                profileBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Update Description
                if (profileDesc) {
                    profileDesc.innerHTML = `<strong style="color:var(--accent)">${profile.name}:</strong> ${profile.desc}`;
                    profileDesc.style.color = 'var(--text-primary)';
                }

                // Apply Settings
                // 1. Update UI Elements
                const modelSel = document.getElementById('cfg-model-select');
                const tempInput = document.querySelector('input[data-key="temperature"]'); // Not in HTML yet, handled by generic?
                // We need to ensure these elements exist or update storage directly + reload UI

                // Let's update storage and reload UI settings
                const newSettings = { ...profile.config };

                // Check if model exists in select, if not add it temp
                if (modelSel) {
                    let exists = false;
                    for (let i = 0; i < modelSel.options.length; i++) {
                        if (modelSel.options[i].value === newSettings.model) exists = true;
                    }
                    if (!exists) {
                        const opt = document.createElement('option');
                        opt.value = newSettings.model;
                        opt.textContent = `${newSettings.model} (Recomendado)`;
                        modelSel.appendChild(opt);
                    }
                }

                chrome.storage.sync.set(newSettings, () => {
                    loadSettingsToUI();
                    showToast(`Perfil '${profile.name}' aplicado`, 'success');
                });
            }
        };
    });

    // --- Global Error Handler ---
    window.onerror = function (message, source, lineno, colno, error) {
        console.error("Global Error:", message, error);
        showToast(`Error Sistema: ${message}`, 'error');
    };

    // --- Check Backend Status ---
    function checkStatus() {
        chrome.storage.sync.get(defaults, (items) => {
            let url = items.apiUrl;
            if (items.provider === 'nexus') url += '/api/status'; // Mock status endpoint
            else if (items.provider === 'ollama') url += '/api/tags';
            else if (items.provider === 'lmstudio') url += '/v1/models';

            const controller = new AbortController();
            setTimeout(() => controller.abort(), 2000);

            fetch(url, { signal: controller.signal })
                .then(res => {
                    if (res.ok) {
                        statusIndicator.classList.add('online');
                        statusIndicator.title = 'Conectado';
                    } else {
                        statusIndicator.classList.remove('online');
                        statusIndicator.title = 'Error de conexión';
                    }
                })
                .catch(() => {
                    statusIndicator.classList.remove('online');
                    statusIndicator.title = 'Offline';
                });
        });
    }
    // Check every 30s and on load
    checkStatus();
    setInterval(checkStatus, 30000);


    // --- QoL Features Implementation ---

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
            showToast('Chat exportado', 'success');
        };
    }

    // 2. Clear Chat
    if (btnClear) {
        btnClear.onclick = () => {
            if (confirm('¿Borrar toda la conversación?')) {
                messages.innerHTML = '';
                // Restore welcome message
                addMessage('assistant', '¡Hola! Soy tu extensión de Nexus.<br>Chat reiniciado.', false, defaults);
            }
        };
    }

    // 3. Stop Generation
    if (btnStop) {
        btnStop.onclick = () => {
            if (abortController) {
                abortController.abort();
                abortController = null;
                btnStop.classList.add('hidden');
                // Remove loading spinner
                const loadingMsg = messages.querySelector('.loading-msg');
                if (loadingMsg) loadingMsg.innerText = '(Detenido por usuario)';
                showToast('Generación detenida', 'info');
            }
        };
    }

    // 4. Quick Actions
    if (quickActions) {
        quickActions.querySelectorAll('.chip').forEach(chip => {
            chip.onclick = () => {
                const prompt = chip.dataset.prompt;
                chatInput.value = prompt + ' '; // Add space for user to continue if needed
                chatInput.focus();
                // Optionally auto-send if it's a complete command
                // sendMessage(); 
            };
        });
    }

    // --- Settings Logic ---

    // Toggle Panel & Load
    if (settingsToggle && settingsPanel) {
        settingsToggle.onclick = () => {
            loadSettingsToUI();
            settingsPanel.classList.remove('hidden');
            scanModels(); // Auto-scan on open
        };
    }

    if (settingsClose && settingsPanel) {
        settingsClose.onclick = () => {
            settingsPanel.classList.add('hidden');
            showToast('Configuración cerrada', 'info');
        };
    }

    // Manual Scan
    const btnRefresh = document.getElementById('btn-refresh-models');
    if (btnRefresh) btnRefresh.onclick = scanModels;

    async function scanModels() {
        const modelSelect = document.getElementById('cfg-model-select');
        const status = document.getElementById('scan-status');

        if (!modelSelect || !status) return;

        // Save current value to restore later if possible
        const currentVal = modelSelect.value;

        status.textContent = 'Buscando servidores locales...';
        status.style.color = '#94a3b8';

        const foundModels = [];
        const activeSources = [];

        // 1. Check Ollama
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1000);
            const res = await fetch('http://localhost:11434/api/tags', { signal: controller.signal });
            clearTimeout(timeoutId);

            if (res.ok) {
                const data = await res.json();
                if (data.models) {
                    activeSources.push('Ollama');
                    data.models.forEach(m => foundModels.push({ name: m.name, source: 'Ollama' }));
                }
            }
        } catch (e) { /* Ollama not reachable */ }

        // 2. Check LM Studio
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1000);
            const res = await fetch('http://localhost:1234/v1/models', { signal: controller.signal });
            clearTimeout(timeoutId);

            if (res.ok) {
                const data = await res.json();
                if (data.data) {
                    activeSources.push('LM Studio');
                    data.data.forEach(m => foundModels.push({ name: m.id, source: 'LMS' }));
                }
            }
        } catch (e) { /* LMS not reachable */ }

        // 3. Populate Select
        modelSelect.innerHTML = '';

        if (foundModels.length > 0) {
            foundModels.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.name;
                opt.textContent = `${m.name} (${m.source})`;
                modelSelect.appendChild(opt);
            });

            status.textContent = `✅ Detectados ${foundModels.length} modelos.`;
            status.style.color = '#10b981';

            // Try to restore previous selection
            if (currentVal) {
                const exists = foundModels.some(m => m.name === currentVal);
                if (exists) {
                    modelSelect.value = currentVal;
                } else {
                    const opt = document.createElement('option');
                    opt.value = currentVal;
                    opt.textContent = `${currentVal} (Guardado/Offline)`;
                    modelSelect.appendChild(opt);
                    modelSelect.value = currentVal;
                }
            }
        } else {
            status.textContent = '❌ No se detectaron servidores locales.';
            status.style.color = '#ef4444';

            const opt = document.createElement('option');
            opt.value = currentVal || defaults.model;
            opt.textContent = (currentVal || defaults.model) + ' (Offline)';
            modelSelect.appendChild(opt);
        }

        // --- Reasoning Model Logic ---
        const reasoningSelect = document.getElementById('cfg-reasoning-model');
        if (reasoningSelect) {
            const currentReasoning = reasoningSelect.value;
            reasoningSelect.innerHTML = '<option value="">(Usar modelo principal)</option>';

            // Clone options
            Array.from(modelSelect.options).forEach(opt => {
                if (opt.value) {
                    const newOpt = opt.cloneNode(true);
                    reasoningSelect.appendChild(newOpt);
                }
            });

            if (currentReasoning) reasoningSelect.value = currentReasoning;
        }
    }

    // Tabs Logic
    const mainSettingsTabs = document.querySelectorAll('#settings-panel .tab-btn');
    const mainSettingsContents = document.querySelectorAll('#settings-panel .settings-content > .tab-content');

    mainSettingsTabs.forEach(btn => {
        btn.onclick = () => {
            mainSettingsTabs.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            mainSettingsContents.forEach(c => c.classList.remove('active'));
            const targetId = btn.dataset.tab;
            if (targetId) {
                const target = document.getElementById(targetId);
                if (target) target.classList.add('active');
            }
        };
    });

    // Helper: Load Settings
    function loadSettingsToUI() {
        chrome.storage.sync.get(defaults, (items) => {
            document.querySelectorAll('[data-key]').forEach(el => {
                const key = el.dataset.key;
                if (items[key] !== undefined) {
                    if (el.type === 'checkbox') {
                        el.checked = items[key];
                    } else if (el.tagName === 'SELECT' || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                        el.value = items[key];
                    }
                }
            });

            // Update range labels
            const tempLabel = document.getElementById('val-temp');
            const toppLabel = document.getElementById('val-topp');
            const ttsRateLabel = document.getElementById('val-tts-rate');
            const ttsPitchLabel = document.getElementById('val-tts-pitch');

            if (tempLabel) tempLabel.textContent = items.temperature;
            if (toppLabel) toppLabel.textContent = items.topP;
            if (ttsRateLabel) ttsRateLabel.textContent = items.ttsRate;
            if (ttsPitchLabel) ttsPitchLabel.textContent = items.ttsPitch;

            // Handle Provider Logic
            const providerSelect = document.getElementById('provider-selector');
            const urlInput = document.getElementById('custom-url-input');
            const urlHint = document.getElementById('url-hint');

            if (providerSelect) {
                if (items.provider) providerSelect.value = items.provider;
                providerSelect.onchange = () => {
                    const p = providerSelect.value;
                    if (urlInput && urlHint) {
                        if (p === 'nexus') {
                            urlInput.value = 'http://localhost:3000';
                            urlHint.textContent = 'Usando API intermedia de Nexus';
                        } else if (p === 'ollama') {
                            urlInput.value = 'http://localhost:11434';
                            urlHint.textContent = 'Conexión directa a Ollama';
                        } else if (p === 'lmstudio') {
                            urlInput.value = 'http://localhost:1234';
                            urlHint.textContent = 'Conexión directa compatible OpenAI';
                        }
                    }
                };
            }
        });
    }

    // Live listeners for ranges
    document.querySelectorAll('input[type="range"]').forEach(slider => {
        slider.oninput = () => {
            if (slider.dataset.key === 'temperature') {
                const l = document.getElementById('val-temp');
                if (l) l.textContent = slider.value;
            }
            if (slider.dataset.key === 'topP') {
                const l = document.getElementById('val-topp');
                if (l) l.textContent = slider.value;
            }
            if (slider.dataset.key === 'ttsRate') {
                const l = document.getElementById('val-tts-rate');
                if (l) l.textContent = slider.value;
            }
            if (slider.dataset.key === 'ttsPitch') {
                const l = document.getElementById('val-tts-pitch');
                if (l) l.textContent = slider.value;
            }
        };
    });

    // --- Backup Logic ---
    const btnExportConfig = document.getElementById('btn-export-config');
    const btnImportConfig = document.getElementById('btn-import-config');
    const fileImportConfig = document.getElementById('file-import-config');

    if (btnExportConfig) {
        btnExportConfig.onclick = () => {
            chrome.storage.sync.get(null, (items) => {
                const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `nexus-config-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                showToast('Configuración exportada', 'success');
            });
        };
    }

    if (btnImportConfig && fileImportConfig) {
        btnImportConfig.onclick = () => fileImportConfig.click();

        fileImportConfig.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const settings = JSON.parse(event.target.result);
                    chrome.storage.sync.set(settings, () => {
                        loadSettingsToUI();
                        showToast('Configuración importada exitosamente', 'success');
                    });
                } catch (err) {
                    showToast('Error: Archivo inválido', 'error');
                }
            };
            reader.readAsText(file);
            fileImportConfig.value = ''; // Reset
        };
    }

    // --- Screenshot Logic ---
    let currentImage = null;
    const btnScreenshot = document.getElementById('btn-screenshot');
    const imgPreviewContainer = document.getElementById('img-preview-container');
    const imgPreview = document.getElementById('img-preview');
    const btnClearImg = document.getElementById('btn-clear-img');

    if (btnScreenshot) {
        btnScreenshot.onclick = () => {
            chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 60 }, (dataUrl) => {
                if (chrome.runtime.lastError) {
                    console.error(chrome.runtime.lastError);
                    return alert('No se pudo capturar. ¿Tienes permisos?');
                }
                if (dataUrl) {
                    currentImage = dataUrl;
                    if (imgPreview) imgPreview.src = dataUrl;
                    if (imgPreviewContainer) imgPreviewContainer.style.display = 'block';
                }
            });
        };
    }

    if (btnClearImg) {
        btnClearImg.onclick = () => {
            currentImage = null;
            if (imgPreview) imgPreview.src = '';
            if (imgPreviewContainer) imgPreviewContainer.style.display = 'none';
        };
    }

    // --- MCP Logic ---
    const mcpList = document.getElementById('mcp-server-list');
    const mcpForm = document.getElementById('mcp-form');
    const mcpAddBtn = document.getElementById('btn-add-mcp');
    const mcpSaveBtn = document.getElementById('btn-save-mcp');
    const mcpCancelBtn = document.getElementById('btn-cancel-mcp');
    const mcpTypeSel = document.getElementById('mcp-type');
    const btnPresets = document.getElementById('btn-presets');

    if (mcpAddBtn && mcpForm) {
        mcpAddBtn.onclick = () => { mcpForm.classList.remove('hidden'); mcpAddBtn.classList.add('hidden'); };
    }

    if (mcpCancelBtn && mcpForm) {
        mcpCancelBtn.onclick = () => { mcpForm.classList.add('hidden'); mcpAddBtn.classList.remove('hidden'); clearMcpForm(); };
    }

    if (mcpTypeSel) {
        mcpTypeSel.onchange = () => {
            const stdio = document.getElementById('mcp-stdio-fields');
            const sse = document.getElementById('mcp-sse-fields');
            if (mcpTypeSel.value === 'stdio') {
                if (stdio) stdio.classList.remove('hidden');
                if (sse) sse.classList.add('hidden');
            } else {
                if (stdio) stdio.classList.add('hidden');
                if (sse) sse.classList.remove('hidden');
            }
        };
    }

    function loadMcpServers() {
        chrome.storage.sync.get({ mcpServers: [] }, (items) => {
            renderMcpList(items.mcpServers);
        });
    }

    function renderMcpList(servers) {
        if (!mcpList) return;
        mcpList.innerHTML = '';
        if (!servers || servers.length === 0) {
            mcpList.innerHTML = '<div class="hint text-center">No hay servidores configurados</div>';
            return;
        }

        servers.forEach((srv, idx) => {
            const div = document.createElement('div');
            div.className = 'flex-row';
            div.style.cssText = 'background:rgba(0,0,0,0.2); padding:8px; border-radius:6px; justify-content:space-between; margin-bottom:4px;';
            div.innerHTML = `
                <div style="overflow:hidden;">
                    <div style="font-weight:bold; font-size:12px;">${srv.name}</div>
                    <div style="font-size:10px; color:#aaa;">${srv.type === 'stdio' ? srv.command : srv.url}</div>
                </div>
                <button class="danger-btn delete-mcp" data-index="${idx}" style="width:auto; padding:4px 8px; margin:0;">×</button>
            `;
            mcpList.appendChild(div);
        });

        document.querySelectorAll('.delete-mcp').forEach(btn => {
            btn.onclick = () => {
                const idx = parseInt(btn.dataset.index);
                chrome.storage.sync.get({ mcpServers: [] }, (items) => {
                    const newServers = items.mcpServers.filter((_, i) => i !== idx);
                    chrome.storage.sync.set({ mcpServers: newServers }, loadMcpServers);
                });
            };
        });
    }

    if (btnPresets) {
        btnPresets.onclick = () => {
            if (!confirm('¿Añadir servidores "Sequential Thinking" y "Chrome Tools (Puppeteer)"?')) return;
            const presets = [
                { name: 'Sequential Thinking', type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-sequential-thinking'] },
                { name: 'Chrome Tools', type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-puppeteer'] }
            ];
            chrome.storage.sync.get({ mcpServers: [] }, (items) => {
                const existingNames = items.mcpServers.map(s => s.name);
                const newToAdd = presets.filter(p => !existingNames.includes(p.name));
                if (newToAdd.length === 0) return alert('Ya tienes estos servidores instalados.');
                const newServers = [...items.mcpServers, ...newToAdd];
                chrome.storage.sync.set({ mcpServers: newServers }, () => {
                    loadMcpServers();
                    showToast('Servidores recomendados añadidos', 'success');
                });
            });
        };
    }

    if (mcpSaveBtn) {
        mcpSaveBtn.onclick = () => {
            const nameEl = document.getElementById('mcp-name');
            const name = nameEl ? nameEl.value : '';
            if (!name) return alert('Nombre requerido');

            const type = mcpTypeSel ? mcpTypeSel.value : 'stdio';
            let config = { name, type };

            if (type === 'stdio') {
                const cmdEl = document.getElementById('mcp-cmd');
                config.command = cmdEl ? cmdEl.value : '';
                try {
                    const argsEl = document.getElementById('mcp-args');
                    const argsVal = argsEl ? argsEl.value : '';
                    config.args = argsVal ? JSON.parse(argsVal) : [];
                } catch (e) { return alert('Argumentos inválidos (JSON Array)'); }
            } else {
                const urlEl = document.getElementById('mcp-url');
                config.url = urlEl ? urlEl.value : '';
            }

            chrome.storage.sync.get({ mcpServers: [] }, (items) => {
                const newServers = [...items.mcpServers, config];
                chrome.storage.sync.set({ mcpServers: newServers }, () => {
                    if (mcpCancelBtn) mcpCancelBtn.click();
                    loadMcpServers();
                });
            });
        };
    }

    function clearMcpForm() {
        const ids = ['mcp-name', 'mcp-cmd', 'mcp-args', 'mcp-url'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
    }

    loadMcpServers();

    // --- Conversation Context Builder ---
    function getConversationContext() {
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

    // --- Read Page Button Handler ---
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
                // Insert page content into chat input with a helper prefix
                const pagePreview = result.result ? result.result.substring(0, 500) + '...' : 'Sin contenido';
                if (chatInput) {
                    chatInput.value = `[Contenido de la página actual]:\n${pagePreview}\n\n¿Qué quieres saber sobre esta página?`;
                    chatInput.style.height = 'auto';
                    chatInput.style.height = (chatInput.scrollHeight) + 'px';
                    chatInput.focus();
                }
                // Also store full content for when message is sent
                window._lastPageContent = result.result;
                showToast('Página leída con éxito', 'success');
            } catch (e) {
                console.error('Error reading page:', e);
                showToast('Error al leer la página', 'error');
            }
        };
    }

    // Save Settings
    if (cfgSave) {
        cfgSave.onclick = () => {
            const newSettings = {};
            document.querySelectorAll('[data-key]').forEach(el => {
                const key = el.dataset.key;
                if (el.type === 'checkbox') {
                    newSettings[key] = el.checked;
                } else if (el.type === 'number' || el.type === 'range') {
                    newSettings[key] = parseFloat(el.value);
                } else {
                    newSettings[key] = el.value;
                }
            });

            // Normalize URL
            if (newSettings.apiUrl && !newSettings.apiUrl.startsWith('http')) {
                newSettings.apiUrl = 'http://' + newSettings.apiUrl;
            }
            if (newSettings.apiUrl) newSettings.apiUrl = newSettings.apiUrl.replace(/\/$/, '');

            chrome.storage.sync.set(newSettings, () => {
                cfgSave.textContent = '✓ Guardado';
                cfgSave.style.background = 'linear-gradient(135deg, #10b981, #059669)';
                setTimeout(() => {
                    cfgSave.textContent = 'Guardar Todas las Configuraciones';
                    cfgSave.style.background = '';
                }, 1500);

                showToast('✓ Configuración guardada', 'success');
                applyImmediateSettings(newSettings);

                // Close panel
                if (settingsPanel) setTimeout(() => settingsPanel.classList.add('hidden'), 1000);
            });
        };
    }

    // Reset
    if (btnReset) {
        btnReset.onclick = () => {
            if (confirm('¿Restaurar valores de fábrica?')) {
                chrome.storage.sync.set(defaults, () => {
                    loadSettingsToUI();
                    showToast('Valores restaurados', 'success');
                });
            }
        };
    }

    function applyImmediateSettings(settings) {
        if (settings.fontSize) document.body.style.fontSize = settings.fontSize + 'px';
        if (settings.fontFamily) document.body.style.fontFamily = settings.fontFamily;
    }

    chrome.storage.sync.get(defaults, applyImmediateSettings);

    // --- Listener for Context Menu ---
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.type === 'NEXUS_CONTEXT_ACTION') {
            if (chatInput) {
                chatInput.value = request.text;
                chatInput.style.height = 'auto';
                chatInput.style.height = (chatInput.scrollHeight) + 'px';
                // Optional: Auto send
                sendMessage();
            }
        }
    });

    // --- Web Tools / Agent Logic ---
    const AGENT_TOOLS_PROMPT = `
## WEB CONTROL TOOLS AVAILABLE
You have access to the active browser tab. To use a tool, output a SINGLE JSON block strictly following this format:
\`\`\`json
{
  "tool": "tool_name",
  "params": { "param1": "value" }
}
\`\`\`
Stop generating after the JSON block. Wait for the tool result.

### Available Tools:
1. **read_page**: Get the text content of the page.
   - Params: {"mode": "text" | "html" (optional, default "text")}
2. **click_element**: Click an element using a CSS selector.
   - Params: {"selector": ".my-button"}
3. **type_text**: Type text into an input field.
   - Params: {"selector": "#search-box", "text": "hello world"}
4. **scroll**: Scroll the page.
   - Params: {"direction": "up" | "down" | "top" | "bottom"}
5. **get_links**: Extract all links from the page.
   - Params: {}
 6. **google_search**: Perform a Google search and return results.
   - Params: {"query": "search term"}

 ## INSTRUCTIONS
 - If the user asks to summarize or read the page, use 'read_page' first.
 - If the user asks to search the web or find information, use 'google_search'.
 - If the user asks to perform an action (search, click, login), use 'type_text' or 'click_element'.
 - ALWAYS verify the element exists by reading the page or just try the action (errors will be reported back).
`;

    async function executeTool(toolName, params) {
        return new Promise((resolve) => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (!tabs[0] || !tabs[0].id) return resolve({ error: "No active tab found" });
                const tabId = tabs[0].id;

                let func;
                let args = [params];

                switch (toolName) {
                    case 'read_page':
                        func = (p) => {
                            let text = "";
                            if (p.mode === 'html') text = document.documentElement.outerHTML;
                            else text = document.body.innerText;
                            // Truncate to avoid context overflow (Safe limit for 8k context)
                            return text.length > 10000 ? text.substring(0, 10000) + "\n...[TRUNCATED]" : text;
                        };
                        break;
                    case 'click_element':
                        func = (p) => {
                            const el = document.querySelector(p.selector);
                            if (!el) throw new Error(`Element not found: ${p.selector}`);
                            el.click();
                            return `Clicked: ${p.selector}`;
                        };
                        break;
                    case 'type_text':
                        func = (p) => {
                            const el = document.querySelector(p.selector);
                            if (!el) throw new Error(`Element not found: ${p.selector}`);
                            el.value = p.text;
                            el.dispatchEvent(new Event('input', { bubbles: true }));
                            el.dispatchEvent(new Event('change', { bubbles: true }));
                            return `Typed "${p.text}" into ${p.selector}`;
                        };
                        break;
                    case 'scroll':
                        func = (p) => {
                            if (p.direction === 'top') window.scrollTo(0, 0);
                            else if (p.direction === 'bottom') window.scrollTo(0, document.body.scrollHeight);
                            else if (p.direction === 'up') window.scrollBy(0, -window.innerHeight * 0.8);
                            else window.scrollBy(0, window.innerHeight * 0.8);
                            return `Scrolled ${p.direction}`;
                        };
                        break;
                    case 'get_links':
                        func = () => {
                            return Array.from(document.querySelectorAll('a[href]'))
                                .map(a => ({ text: a.innerText.trim(), url: a.href }))
                                .filter(l => l.text)
                                .slice(0, 50); // Limit to 50
                        };
                        break;
                    case 'google_search':
                        func = (p) => {
                            // Simple navigation to Google. 
                            // In a real agent, we would open a new tab, read it, and close it.
                            // Here we navigate the user to help them.
                            window.location.href = 'https://www.google.com/search?q=' + encodeURIComponent(p.query);
                            return `Navigating to Google Search: ${p.query}. I will need to read the page once it loads.`;
                        };
                        break;
                    default:
                        return resolve({ error: "Unknown tool" });
                }

                chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    func: func,
                    args: args
                }, (results) => {
                    if (chrome.runtime.lastError) {
                        resolve({ error: chrome.runtime.lastError.message });
                    } else if (results && results[0]) {
                        if (results[0].result) resolve({ success: true, result: results[0].result });
                        else resolve({ error: "Execution failed or returned null" }); // Basic error handling
                    } else {
                        resolve({ error: "Script execution failed" });
                    }
                });
            });
        });
    }

    // --- Voice Input Logic (STT) ---
    const btnVoice = document.getElementById('btn-voice-input');
    let recognition = null;

    if ('webkitSpeechRecognition' in window) {
        recognition = new webkitSpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;

        // Auto-detect language or fallback to settings
        chrome.storage.sync.get({ uiLanguage: 'es' }, (items) => {
            recognition.lang = items.uiLanguage === 'es' ? 'es-ES' : 'en-US';
        });

        recognition.onstart = () => {
            if (btnVoice) btnVoice.classList.add('listening');
            showToast('Escuchando...', 'info');
        };

        recognition.onend = () => {
            if (btnVoice) btnVoice.classList.remove('listening');
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            if (chatInput) {
                chatInput.value = (chatInput.value + ' ' + transcript).trim();
                // Trigger auto-resize
                chatInput.dispatchEvent(new Event('input'));
                chatInput.focus();
            }
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error', event.error);
            if (btnVoice) btnVoice.classList.remove('listening');
            showToast('Error de reconocimiento: ' + event.error, 'error');
        };
    }

    if (btnVoice) {
        if (recognition) {
            btnVoice.onclick = () => {
                if (btnVoice.classList.contains('listening')) {
                    recognition.stop();
                } else {
                    // Update lang just in case
                    chrome.storage.sync.get({ uiLanguage: 'es' }, (items) => {
                        recognition.lang = items.uiLanguage === 'es' ? 'es-ES' : 'en-US';
                        recognition.start();
                    });
                }
            };
        } else {
            btnVoice.style.display = 'none'; // Hide if not supported
            console.warn('Web Speech API not supported in this environment');
        }
    }

    // --- Chat Logic ---
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
                        sendMessage();
                    }
                });
            }
        });
    }

    if (sendBtn) sendBtn.onclick = () => sendMessage();

    async function sendMessage(textOverride = null) {
        if (!chatInput) return;
        const text = textOverride || chatInput.value.trim();
        if (!text) return;

        const config = await new Promise(r => chrome.storage.sync.get(defaults, r));

        if (!textOverride) {
            addMessage('user', text, false, config);
            chatInput.value = '';
            chatInput.style.height = 'auto';
        } else {
            // For tool outputs, maybe style differently or just log
            addMessage('user', '🔍 System Tool Output', false, config); // Brief placeholder
        }

        addMessage('assistant', 'Pensando...', true, config);

        if (btnStop) btnStop.classList.remove('hidden');
        abortController = new AbortController();

        try {
            const provider = config.provider || 'nexus';
            let endpoint = config.apiUrl ? config.apiUrl.replace(/\/$/, '') : 'http://localhost:3000';
            let payload = {};

            // Build payload logic
            let systemInstruction = config.systemPrompt || '';

            // Inject Custom Instructions (User Prefs)
            if (config.customInstructions) {
                systemInstruction += `\n\n[USER INSTRUCTIONS & PREFERENCES]\n${config.customInstructions}`;
            }
            if (config.responseStyle && config.responseStyle !== 'normal') {
                systemInstruction += `\n\n[RESPONSE STYLE]\nUse a ${config.responseStyle} tone/style.`;
            }

            // Inject Agent Tools Prompt
            systemInstruction += '\n\n' + AGENT_TOOLS_PROMPT;

            // Build Conversation History
            let fullConversation = getConversationContext();

            // If this is a tool output (textOverride), append it explicitly as it's not in the DOM history yet (or is a placeholder)
            if (textOverride) {
                fullConversation += `System: [TOOL RESULT]\n${textOverride}\n\nUser: Ahora continúa respondiendo a mi petición original usando esta información.\n\n`;
            }

            if (provider === 'nexus') {
                endpoint += '/api/ai/chat';
                const mcpData = await new Promise(r => chrome.storage.sync.get({ mcpServers: [], enableMcp: false }, r));

                // Combine System + History
                const finalPrompt = systemInstruction ? `System: ${systemInstruction}\n\n${fullConversation}` : fullConversation;

                payload = {
                    message: finalPrompt,
                    model: config.model,
                    reasoningModel: config.reasoningModel,
                    temperature: config.temperature,
                    image: currentImage,
                    mcpServers: mcpData.enableMcp ? mcpData.mcpServers : []
                };
            } else if (provider === 'ollama') {
                endpoint += '/api/chat';
                payload = {
                    model: config.model,
                    messages: [
                        ...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []),
                        { role: 'user', content: text, images: currentImage ? [currentImage.split(',')[1]] : undefined }
                    ],
                    stream: false,
                    options: { temperature: config.temperature }
                };
            } else if (provider === 'lmstudio') {
                endpoint += '/v1/chat/completions';
                let content = text;
                if (currentImage) content = [{ type: "text", text }, { type: "image_url", image_url: { url: currentImage } }];
                payload = {
                    model: config.model,
                    messages: [
                        ...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []),
                        { role: 'user', content }
                    ],
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

            if (currentImage && btnClearImg) btnClearImg.click();

            const data = await res.json();

            // Remove loading
            if (messages) {
                const loadingMsg = messages.querySelector('.loading-msg');
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
                addMessage('assistant', replyText, false, config);

                // Check for Tool Call
                const toolRegex = /```json\s*(\{[\s\S]*?"tool"[\s\S]*?\})\s*```/;
                const match = replyText.match(toolRegex);

                if (match && match[1]) {
                    try {
                        const toolCall = JSON.parse(match[1]);
                        if (toolCall.tool) {
                            showToast(`Ejecutando: ${toolCall.tool}...`, 'info');
                            const result = await executeTool(toolCall.tool, toolCall.params || {});

                            // Send result back
                            const outputMsg = `Tool '${toolCall.tool}' Output:\n${JSON.stringify(result, null, 2)}`;

                            // Recursive call with override
                            setTimeout(() => sendMessage(outputMsg), 1000);
                        }
                    } catch (e) {
                        console.error("Tool parse error", e);
                        showToast('Error al procesar herramienta', 'error'); // Fixed typo
                    }
                }

            } else {
                addMessage('assistant', 'Error: Respuesta vacía.', false, config);
            }

        } catch (e) {
            if (e.name === 'AbortError') return; // Handled by stop button
            if (messages) {
                const loadingMsg = messages.querySelector('.loading-msg');
                if (loadingMsg && loadingMsg.parentElement && loadingMsg.parentElement.parentElement) {
                    loadingMsg.parentElement.parentElement.remove();
                }
            }
            console.error(e);
            addMessage('assistant', `Error: ${e.message}`, false, config);
        } finally {
            if (btnStop) btnStop.classList.add('hidden');
            abortController = null;
        }
    }

    function addMessage(role, text, isLoading = false, config = defaults) {
        if (!messages) return;
        const div = document.createElement('div');
        div.className = `message ${role}`;

        let avatarSvg;
        if (role === 'user') {
            avatarSvg = config.userAvatar ? `<img src="${config.userAvatar}" class="avatar-img">` :
                '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
        } else {
            avatarSvg = config.botAvatar ? `<img src="${config.botAvatar}" class="avatar-img">` :
                '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>';
        }

        // Markdown Parsing (Basic)
        let content = text;
        if (!isLoading) {
            // Code blocks
            content = content.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
                return `<pre><button class="copy-code-btn" onclick="navigator.clipboard.writeText(this.nextElementSibling.innerText)">Copiar</button><code class="language-${lang || 'text'}">${code}</code></pre>`;
            });
            // Bold
            content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
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

        // Add Event Listeners for Actions
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
                // Find last user message
                const userMsgs = document.querySelectorAll('.message.user');
                if (userMsgs.length > 0) {
                    const lastUserMsg = userMsgs[userMsgs.length - 1];
                    const lastText = lastUserMsg.querySelector('.bubble').innerText; // Raw text might be lost due to html, better store it
                    // Simple retry logic: just resend
                    // We need to clean up this message first? Or just append new one?
                    // Let's remove this message and resend
                    div.remove();
                    chatInput.value = lastText.split('\n')[0]; // Simple recovery
                    sendMessage();
                }
            };
        }

        messages.appendChild(div);

        // Autoscroll mejorado: usar requestAnimationFrame para asegurar que el DOM está actualizado
        if (config.autoScroll) {
            requestAnimationFrame(() => {
                messages.scrollTo({
                    top: messages.scrollHeight,
                    behavior: 'smooth'
                });
            });
        }
    }

    function showToast(msg, type = 'info') {
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

    // --- Models Manager Logic ---
    const modelsModal = document.getElementById('models-modal');
    const btnManageModels = document.getElementById('btn-manage-models');
    const btnCloseModels = document.getElementById('btn-close-models');

    if (btnManageModels && modelsModal) {
        btnManageModels.onclick = () => {
            modelsModal.classList.remove('hidden');
            renderInstalledModels();
            renderLibraryModels();
        };
    }

    if (btnCloseModels && modelsModal) {
        btnCloseModels.onclick = () => modelsModal.classList.add('hidden');
    }

    // Modal Tabs logic (consistent with main settings tabs)
    const modalTabs = modelsModal ? modelsModal.querySelectorAll('.tab-btn') : [];
    modalTabs.forEach(btn => {
        btn.onclick = () => {
            modalTabs.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const target = btn.dataset.tab;
            modelsModal.querySelectorAll('.tab-content').forEach(c => {
                c.classList.remove('active');
                c.classList.add('hidden');
            });
            const targetEl = document.getElementById(target);
            if (targetEl) {
                targetEl.classList.remove('hidden');
                targetEl.classList.add('active');
            }
        };
    });

    // Library Search Filter
    const librarySearch = document.getElementById('library-search');
    if (librarySearch) {
        librarySearch.oninput = () => {
            const query = librarySearch.value.toLowerCase();
            const items = document.querySelectorAll('#library-list .model-item');
            items.forEach(item => {
                const text = item.innerText.toLowerCase();
                item.style.display = text.includes(query) ? 'flex' : 'none';
            });
        };
    }

    // ... Library Render functions ...
    const POPULAR_MODELS = [
        { id: 'qwen2.5-coder:7b', name: 'Qwen 2.5 Coder (7B)', desc: '🌟 MEJOR OPCIÓN PARA CODING. Equilibrio perfecto entre velocidad e inteligencia. (4.7GB)' },
        { id: 'llama3.2:3b', name: 'Llama 3.2 (3B)', desc: '🚀 EL MÁS RÁPIDO. Ideal para portátiles antiguos. Responde al instante. (2.0GB)' },
        { id: 'mistral:7b', name: 'Mistral 7B', desc: '⚖️ ESTÁNDAR DE ORO. Muy bueno para todo uso, correos y resumenes. (4.1GB)' },
        { id: 'gemma2:9b', name: 'Gemma 2 (9B)', desc: '🎨 CREATIVIDAD GOOGLE. Excelente redacción y matices humanos. Requiere más RAM. (5.0GB)' },
        { id: 'phi3.5:3.8b', name: 'Phi 3.5 (3.8B)', desc: '🧠 PEQUEÑO GENIO. Increíble razonamiento lógico para su tamaño. (2.2GB)' },
        { id: 'deepseek-coder:6.7b', name: 'DeepSeek Coder (6.7B)', desc: '💻 ESPECIALISTA CÓDIGO. Alternativa sólida a Qwen. (3.8GB)' },
        { id: 'llava:7b', name: 'LLaVA (7B)', desc: '👁️ VISIÓN. El único que puede "ver" imágenes. Úsalo si subes fotos. (4.5GB)' }
    ];

    function renderInstalledModels() {
        const list = document.getElementById('installed-list');
        if (!list) return;
        list.innerHTML = '<div style="text-align:center; padding:10px;">Cargando...</div>';

        // Use Nexus Proxy
        fetch('http://localhost:3000/api/ai/ollama/tags').then(res => res.json()).then(data => {
            list.innerHTML = '';
            if (!data.models || data.models.length === 0) {
                list.innerHTML = '<div style="padding:10px; opacity:0.7;">No hay modelos o Ollama no responde.</div>';
                return;
            }
            data.models.forEach(m => {
                const div = document.createElement('div');
                div.className = 'model-item';
                div.style = 'background:#1f2937; padding:10px; border-radius:6px; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center; border:1px solid #374151;';
                div.innerHTML = `
                    <div>
                       <div style="font-weight:bold; font-size:12px;">${m.name}</div>
                       <div style="font-size:10px; opacity:0.7;">${(m.size / 1024 / 1024 / 1024).toFixed(2)} GB</div>
                    </div>
                 `;
                list.appendChild(div);
            });
        }).catch(err => {
            list.innerHTML = `<div class="error" style="color:red; padding:10px;">Error al listar: ${err.message}.</div>`;
        });
    }

    function renderLibraryModels() {
        const list = document.getElementById('library-list');
        if (!list) return;
        // Simple render
        list.innerHTML = '';
        POPULAR_MODELS.forEach(m => {
            const div = document.createElement('div');
            div.className = 'model-item';
            div.style = 'background:#1f2937; padding:10px; border-radius:6px; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center; border:1px solid #374151;';
            div.innerHTML = `
                <div style="flex:1; overflow:hidden;">
                   <div style="font-weight:bold; font-size:12px;">${m.name}</div>
                   <div style="font-size:10px; opacity:0.7;">${m.desc}</div>
                </div>
                <button class="install-model-btn" data-model="${m.id}" style="background:linear-gradient(135deg,#22d3ee,#3b82f6); border:none; color:white; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:10px; font-weight:bold; white-space:nowrap;">⬇ Instalar</button>
            `;
            list.appendChild(div);
        });

        // Add install handlers
        document.querySelectorAll('.install-model-btn').forEach(btn => {
            btn.onclick = async () => {
                const modelId = btn.dataset.model;
                btn.disabled = true;
                btn.textContent = '⏳ Descargando...';
                btn.style.background = '#475569';

                try {
                    // Call Nexus proxy to pull the model via Ollama
                    const res = await fetch('http://localhost:3000/api/ai/ollama/pull', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: modelId })
                    });

                    if (res.ok) {
                        btn.textContent = '✓ Instalado';
                        btn.style.background = '#10b981';
                        showToast(`Modelo ${modelId} instalado correctamente`, 'success');
                        // Refresh installed list
                        setTimeout(renderInstalledModels, 1000);
                    } else {
                        const data = await res.json();
                        throw new Error(data.error || 'Error desconocido');
                    }
                } catch (e) {
                    console.error('Install error:', e);
                    btn.textContent = '❌ Error';
                    btn.style.background = '#ef4444';
                    showToast(`Error al instalar: ${e.message}`, 'error');

                    // Reset button after delay
                    setTimeout(() => {
                        btn.disabled = false;
                        btn.textContent = '⬇ Instalar';
                        btn.style.background = 'linear-gradient(135deg,#22d3ee,#3b82f6)';
                    }, 3000);
                }
            };
        });
    }
});
