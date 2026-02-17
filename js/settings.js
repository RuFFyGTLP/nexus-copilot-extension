/**
 * Nexus Co-Pilot - Settings Module
 * Manages all configuration UI: profiles, model scanning, MCP servers, 
 * backup/restore, models manager, and provider health checking.
 * @module settings
 */

import { DEFAULTS, PROFILES, POPULAR_MODELS, MCP_PRESETS } from './config.js';
import { showToast } from './chat.js';

// ─── Backend Status Check ───────────────────────────────────────────────────

/**
 * Checks backend connectivity and updates the status indicator.
 * @param {HTMLElement} statusIndicator - The status dot element
 */
export function checkStatus(statusIndicator) {
    if (!statusIndicator) return;

    chrome.storage.sync.get(DEFAULTS, (items) => {
        let url = items.apiUrl;
        if (items.provider === 'nexus') url += '/api/status';
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

// ─── Profiles System ────────────────────────────────────────────────────────

/**
 * Sets up profile quick-switch buttons.
 * @param {Function} loadSettingsCallback - Called after a profile is applied
 */
export function setupProfiles(loadSettingsCallback) {
    const profileBtns = document.querySelectorAll('.profile-btn');
    const profileDesc = document.getElementById('profile-desc');

    profileBtns.forEach(btn => {
        btn.onclick = () => {
            const profileKey = btn.dataset.profile;
            const profile = PROFILES[profileKey];
            if (!profile) return;

            // Visual state
            profileBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (profileDesc) {
                profileDesc.textContent = `${profile.name}: ${profile.desc}`;
            }

            const modelSel = document.getElementById('cfg-model-select');
            const newSettings = { ...profile.config };

            // Add model to select if not present
            if (modelSel && newSettings.model) {
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
                if (loadSettingsCallback) loadSettingsCallback();
                showToast(`Perfil '${profile.name}' aplicado`, 'success');
            });
        };
    });
}

// ─── Settings Load/Save ─────────────────────────────────────────────────────

/**
 * Loads current settings from chrome.storage into all [data-key] UI elements.
 */
export function loadSettingsToUI() {
    chrome.storage.sync.get(DEFAULTS, (items) => {
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
        const labels = {
            'val-temp': items.temperature,
            'val-topp': items.topP,
            'val-tts-rate': items.ttsRate,
            'val-tts-pitch': items.ttsPitch
        };
        Object.entries(labels).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el && value !== undefined) el.textContent = value;
        });

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

/**
 * Saves all [data-key] UI element values to chrome.storage.
 * @param {HTMLElement} settingsPanel - The settings panel to close after save
 */
export function saveSettings(settingsPanel) {
    const cfgSave = document.getElementById('save-settings');
    if (!cfgSave) return;

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

            if (settingsPanel) setTimeout(() => settingsPanel.classList.add('hidden'), 1000);
        });
    };
}

/**
 * Sets up the reset-to-defaults button.
 */
export function setupReset() {
    const btnReset = document.getElementById('btn-reset');
    if (!btnReset) return;

    btnReset.onclick = () => {
        if (confirm('¿Restaurar valores de fábrica?')) {
            chrome.storage.sync.set(DEFAULTS, () => {
                loadSettingsToUI();
                showToast('Valores restaurados', 'success');
            });
        }
    };
}

/**
 * Applies visual settings immediately (font size, family).
 * @param {Object} settings 
 */
export function applyImmediateSettings(settings) {
    if (settings.fontSize) document.body.style.fontSize = settings.fontSize + 'px';
    if (settings.fontFamily) document.body.style.fontFamily = settings.fontFamily;
}

// ─── Range Slider Live Update ──────────────────────────────────────────────

/**
 * Sets up live label updates for range sliders.
 */
export function setupRangeSliders() {
    const mapping = {
        temperature: 'val-temp',
        topP: 'val-topp',
        ttsRate: 'val-tts-rate',
        ttsPitch: 'val-tts-pitch'
    };

    document.querySelectorAll('input[type="range"]').forEach(slider => {
        slider.oninput = () => {
            const labelId = mapping[slider.dataset.key];
            if (labelId) {
                const label = document.getElementById(labelId);
                if (label) label.textContent = slider.value;
            }
        };
    });
}

// ─── Model Scanning ─────────────────────────────────────────────────────────

/**
 * Scans local AI servers (Ollama, LM Studio) for available models.
 */
export async function scanModels() {
    const modelSelect = document.getElementById('cfg-model-select');
    const status = document.getElementById('scan-status');

    if (!modelSelect || !status) return;

    const currentVal = modelSelect.value;
    status.textContent = 'Buscando servidores locales...';
    status.style.color = '#94a3b8';

    const foundModels = [];
    const activeSources = [];

    // 1. Check Ollama
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);
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
        const timeoutId = setTimeout(() => controller.abort(), 1500);
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

        status.textContent = `✅ Detectados ${foundModels.length} modelos de [${activeSources.join(', ')}].`;
        status.style.color = '#10b981';

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
        opt.value = currentVal || DEFAULTS.model;
        opt.textContent = (currentVal || DEFAULTS.model) + ' (Offline)';
        modelSelect.appendChild(opt);
    }

    // ── Reasoning Model Mirror ──
    const reasoningSelect = document.getElementById('cfg-reasoning-model');
    if (reasoningSelect) {
        const currentReasoning = reasoningSelect.value;
        reasoningSelect.innerHTML = '<option value="">(Usar modelo principal)</option>';

        Array.from(modelSelect.options).forEach(opt => {
            if (opt.value) {
                const newOpt = opt.cloneNode(true);
                reasoningSelect.appendChild(newOpt);
            }
        });

        if (currentReasoning) reasoningSelect.value = currentReasoning;
    }
}

// ─── Settings Tabs ──────────────────────────────────────────────────────────

/**
 * Sets up tab navigation within the settings panel.
 */
export function setupSettingsTabs() {
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
}

// ─── Backup / Restore ───────────────────────────────────────────────────────

/**
 * Sets up configuration backup and restore functionality.
 */
export function setupBackup() {
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
                URL.revokeObjectURL(url);
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
            fileImportConfig.value = '';
        };
    }
}

// ─── Screenshot Logic ───────────────────────────────────────────────────────

/**
 * Sets up screenshot capture functionality.
 * @param {Object} chatManager - Chat manager returned by initChat()
 */
export function setupScreenshot(chatManager) {
    const btnScreenshot = document.getElementById('btn-screenshot');
    const imgPreviewContainer = document.getElementById('img-preview-container');
    const imgPreview = document.getElementById('img-preview');
    const btnClearImg = document.getElementById('btn-clear-img');

    if (btnScreenshot) {
        btnScreenshot.onclick = () => {
            chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 60 }, (dataUrl) => {
                if (chrome.runtime.lastError) {
                    console.error(chrome.runtime.lastError);
                    return showToast('No se pudo capturar. ¿Tienes permisos?', 'error');
                }
                if (dataUrl) {
                    chatManager.setImage(dataUrl);
                    if (imgPreview) imgPreview.src = dataUrl;
                    if (imgPreviewContainer) imgPreviewContainer.style.display = 'block';
                }
            });
        };
    }

    if (btnClearImg) {
        btnClearImg.onclick = () => {
            chatManager.clearImage();
            if (imgPreview) imgPreview.src = '';
            if (imgPreviewContainer) imgPreviewContainer.style.display = 'none';
        };
    }
}

// ─── MCP Server Management ──────────────────────────────────────────────────

/**
 * Sets up the full MCP server configuration UI (CRUD + presets + health check).
 */
export function setupMcp() {
    const mcpList = document.getElementById('mcp-server-list');
    const mcpForm = document.getElementById('mcp-form');
    const mcpAddBtn = document.getElementById('btn-add-mcp');
    const mcpSaveBtn = document.getElementById('btn-save-mcp');
    const mcpCancelBtn = document.getElementById('btn-cancel-mcp');
    const mcpTypeSel = document.getElementById('mcp-type');
    const btnPresets = document.getElementById('btn-presets');

    // Show/hide form
    if (mcpAddBtn && mcpForm) {
        mcpAddBtn.onclick = () => { mcpForm.classList.remove('hidden'); mcpAddBtn.classList.add('hidden'); };
    }

    if (mcpCancelBtn && mcpForm) {
        mcpCancelBtn.onclick = () => { mcpForm.classList.add('hidden'); mcpAddBtn.classList.remove('hidden'); clearMcpForm(); };
    }

    // Transport type toggle
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

    // Presets (Enhanced - includes more servers)
    if (btnPresets) {
        btnPresets.onclick = () => {
            if (!confirm(`¿Añadir ${MCP_PRESETS.length} servidores recomendados?\n\n${MCP_PRESETS.map(p => '• ' + p.name).join('\n')}`)) return;

            chrome.storage.sync.get({ mcpServers: [] }, (items) => {
                const existingNames = items.mcpServers.map(s => s.name);
                const newToAdd = MCP_PRESETS.filter(p => !existingNames.includes(p.name));
                if (newToAdd.length === 0) return showToast('Ya tienes todos los servidores recomendados.', 'info');
                const newServers = [...items.mcpServers, ...newToAdd];
                chrome.storage.sync.set({ mcpServers: newServers }, () => {
                    loadMcpServers();
                    showToast(`${newToAdd.length} servidores añadidos`, 'success');
                });
            });
        };
    }

    // Save new server
    if (mcpSaveBtn) {
        mcpSaveBtn.onclick = () => {
            const nameEl = document.getElementById('mcp-name');
            const name = nameEl ? nameEl.value.trim() : '';
            if (!name) return showToast('Nombre requerido', 'error');

            const type = mcpTypeSel ? mcpTypeSel.value : 'stdio';
            let config = { name, type };

            if (type === 'stdio') {
                const cmdEl = document.getElementById('mcp-cmd');
                config.command = cmdEl ? cmdEl.value.trim() : '';
                if (!config.command) return showToast('Comando requerido', 'error');
                try {
                    const argsEl = document.getElementById('mcp-args');
                    const argsVal = argsEl ? argsEl.value : '';
                    config.args = argsVal ? JSON.parse(argsVal) : [];
                } catch (e) { return showToast('Argumentos inválidos (JSON Array)', 'error'); }
            } else {
                const urlEl = document.getElementById('mcp-url');
                config.url = urlEl ? urlEl.value.trim() : '';
                if (!config.url) return showToast('URL requerida', 'error');
            }

            chrome.storage.sync.get({ mcpServers: [] }, (items) => {
                // Check duplicate names
                if (items.mcpServers.some(s => s.name === name)) {
                    return showToast('Ya existe un servidor con ese nombre', 'error');
                }
                const newServers = [...items.mcpServers, config];
                chrome.storage.sync.set({ mcpServers: newServers }, () => {
                    if (mcpCancelBtn) mcpCancelBtn.click();
                    loadMcpServers();
                    showToast(`Servidor "${name}" añadido`, 'success');
                });
            });
        };
    }

    function clearMcpForm() {
        ['mcp-name', 'mcp-cmd', 'mcp-args', 'mcp-url'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
    }

    // ─── Render MCP Server List ──

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
            div.className = 'flex-row mcp-server-item';
            div.style.cssText = 'background:rgba(0,0,0,0.2); padding:8px; border-radius:6px; justify-content:space-between; margin-bottom:4px;';

            const statusDot = srv.type === 'sse' ? '<span class="mcp-health-dot" title="Verificando...">⏳</span> ' : '';

            div.innerHTML = `
                <div style="overflow:hidden; flex:1;">
                    <div style="font-weight:bold; font-size:12px;">${statusDot}${srv.name}</div>
                    <div style="font-size:10px; color:#aaa;">${srv.type === 'stdio' ? `${srv.command} ${(srv.args || []).join(' ')}` : srv.url}</div>
                    <div style="font-size:9px; color:#64748b; margin-top:2px;">Tipo: ${srv.type.toUpperCase()}</div>
                </div>
                <div style="display:flex; gap:4px; align-items:center;">
                    ${srv.type === 'sse' ? `<button class="icon-btn ping-mcp" data-url="${srv.url}" title="Ping">🏓</button>` : ''}
                    <button class="danger-btn delete-mcp" data-index="${idx}" style="width:auto; padding:4px 8px; margin:0;">×</button>
                </div>
            `;
            mcpList.appendChild(div);
        });

        // Delete handlers
        document.querySelectorAll('.delete-mcp').forEach(btn => {
            btn.onclick = () => {
                const idx = parseInt(btn.dataset.index);
                if (!confirm('¿Eliminar este servidor MCP?')) return;
                chrome.storage.sync.get({ mcpServers: [] }, (items) => {
                    const newServers = items.mcpServers.filter((_, i) => i !== idx);
                    chrome.storage.sync.set({ mcpServers: newServers }, () => {
                        loadMcpServers();
                        showToast('Servidor eliminado', 'info');
                    });
                });
            };
        });

        // Ping handlers (SSE health check)
        document.querySelectorAll('.ping-mcp').forEach(btn => {
            btn.onclick = async () => {
                const url = btn.dataset.url;
                btn.textContent = '⏳';
                try {
                    const controller = new AbortController();
                    setTimeout(() => controller.abort(), 3000);
                    const res = await fetch(url, { signal: controller.signal });
                    if (res.ok) {
                        btn.textContent = '✅';
                        showToast(`MCP Server respondió correctamente`, 'success');
                    } else {
                        btn.textContent = '❌';
                        showToast(`MCP Server respondió con error: ${res.status}`, 'error');
                    }
                } catch (e) {
                    btn.textContent = '❌';
                    showToast(`MCP Server no accesible`, 'error');
                }
                setTimeout(() => { btn.textContent = '🏓'; }, 3000);
            };
        });
    }

    // Initial load
    loadMcpServers();
}

// ─── Models Manager Modal ───────────────────────────────────────────────────

/**
 * Sets up the full models manager modal (installed + library + install).
 */
export function setupModelsManager() {
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

    // Modal Tabs
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
}

function renderInstalledModels() {
    const list = document.getElementById('installed-list');
    if (!list) return;
    list.innerHTML = '<div style="text-align:center; padding:10px;">Cargando...</div>';

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

    // Install handlers
    document.querySelectorAll('.install-model-btn').forEach(btn => {
        btn.onclick = async () => {
            const modelId = btn.dataset.model;
            btn.disabled = true;
            btn.textContent = '⏳ Descargando...';
            btn.style.background = '#475569';

            try {
                const res = await fetch('http://localhost:3000/api/ai/ollama/pull', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: modelId })
                });

                if (res.ok) {
                    btn.textContent = '✓ Instalado';
                    btn.style.background = '#10b981';
                    showToast(`Modelo ${modelId} instalado correctamente`, 'success');
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

                setTimeout(() => {
                    btn.disabled = false;
                    btn.textContent = '⬇ Instalar';
                    btn.style.background = 'linear-gradient(135deg,#22d3ee,#3b82f6)';
                }, 3000);
            }
        };
    });
}
