/**
 * Nexus Co-Pilot - Agent Tools Module
 * Handles web page interaction tools and SECURITY validation layer.
 * @module tools
 */

// ─── Security Configuration ────────────────────────────────────────────────

/** Domains where automated write actions (click, type) are BLOCKED by default */
const BLOCKED_DOMAINS = [
    // Banking & Finance
    'bank', 'banking', 'paypal', 'stripe', 'chase', 'wellsfargo', 'citi',
    'bbva', 'santander', 'coinbase', 'binance', 'revolut', 'wise',
    // Authentication
    'login', 'signin', 'signup', 'oauth', 'auth', 'sso', 'accounts.google',
    'id.apple', 'login.microsoftonline',
    // Admin & Sensitive
    'admin', 'dashboard', 'console.cloud', 'portal.azure',
    // Government
    'gov', 'gob', 'hacienda', 'agenciatributaria'
];

/** CSS selectors that should NEVER be targeted by type_text */
const SENSITIVE_SELECTORS = [
    'input[type="password"]',
    'input[name*="card"]',
    'input[name*="tarjeta"]',
    'input[name*="cvv"]',
    'input[name*="cvc"]',
    'input[name*="ssn"]',
    'input[name*="social"]',
    'input[name*="pin"]',
    'input[name*="otp"]',
    'input[name*="token"]',
    'input[name*="secret"]',
    'input[autocomplete="cc-number"]',
    'input[autocomplete="cc-csc"]',
    'input[autocomplete="cc-exp"]',
    'input[autocomplete="new-password"]',
    'input[autocomplete="current-password"]'
];

/** Rate limiter: max tool executions per time window */
const RATE_LIMIT = {
    maxExecutions: 15,
    windowMs: 60000 // 1 minute
};

/** Execution log for rate limiting and audit */
const executionLog = [];

// ─── Agent Tools System Prompt ──────────────────────────────────────────────

export const AGENT_TOOLS_PROMPT = `
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
   - ⚠️ BLOCKED on sensitive sites (banking, login, admin).
3. **type_text**: Type text into an input field.
   - Params: {"selector": "#search-box", "text": "hello world"}
   - ⚠️ BLOCKED on password fields and sensitive sites.
4. **scroll**: Scroll the page.
   - Params: {"direction": "up" | "down" | "top" | "bottom"}
5. **get_links**: Extract all links from the page.
   - Params: {}
6. **google_search**: Perform a Google search and return results.
   - Params: {"query": "search term"}

## SECURITY RULES
- NEVER interact with password fields, payment forms, or banking sites.
- If the user asks to do something on a sensitive site, EXPLAIN what they should do manually instead.
- Always verify the element exists by reading the page first.

## INSTRUCTIONS
- If the user asks to summarize or read the page, use 'read_page' first.
- If the user asks to search the web or find information, use 'google_search'.
- If the user asks to perform an action (search, click, login), use 'type_text' or 'click_element'.
- ALWAYS verify the element exists by reading the page or just try the action (errors will be reported back).
`;

// ─── Security Validation ────────────────────────────────────────────────────

/**
 * Validates whether a tool action is safe to execute.
 * @param {string} toolName - The tool being called
 * @param {Object} params - Tool parameters
 * @param {string} tabUrl - Current tab URL
 * @returns {{ allowed: boolean, reason?: string, requiresConfirmation?: boolean }} 
 */
export function validateToolAction(toolName, params, tabUrl) {
    // Read-only tools are always allowed
    if (['read_page', 'get_links', 'scroll'].includes(toolName)) {
        return { allowed: true };
    }

    // Rate limiting check
    const now = Date.now();
    // Remove old entries outside the window
    while (executionLog.length > 0 && (now - executionLog[0]) > RATE_LIMIT.windowMs) {
        executionLog.shift();
    }
    if (executionLog.length >= RATE_LIMIT.maxExecutions) {
        return {
            allowed: false,
            reason: `⛔ Límite de ejecución alcanzado (${RATE_LIMIT.maxExecutions} acciones/minuto). Espera un momento.`
        };
    }

    // Domain blocking for write operations
    if (['click_element', 'type_text'].includes(toolName)) {
        try {
            const url = new URL(tabUrl);
            const hostname = url.hostname.toLowerCase();
            const fullUrl = tabUrl.toLowerCase();

            for (const blocked of BLOCKED_DOMAINS) {
                if (hostname.includes(blocked) || fullUrl.includes(blocked)) {
                    return {
                        allowed: false,
                        reason: `🔒 Acción bloqueada: El sitio "${hostname}" está clasificado como sensible (${blocked}). ` +
                            `Por seguridad, las acciones automáticas no están permitidas en este tipo de sitios. ` +
                            `Realiza esta acción manualmente.`
                    };
                }
            }
        } catch (e) {
            // If URL parsing fails, block by precaution
            return { allowed: false, reason: '🔒 No se pudo verificar la seguridad de la URL actual.' };
        }
    }

    // Sensitive selector check for type_text
    if (toolName === 'type_text' && params.selector) {
        const selectorLower = params.selector.toLowerCase();
        for (const sensitive of SENSITIVE_SELECTORS) {
            // Extract key parts from the sensitive selector for matching
            const keyPart = sensitive.replace(/input\[/g, '').replace(/\]/g, '').replace(/"/g, '').toLowerCase();
            if (selectorLower.includes(keyPart)) {
                return {
                    allowed: false,
                    reason: `🔒 Acción bloqueada: El selector "${params.selector}" apunta a un campo sensible (${keyPart}). ` +
                        `No se permite escribir en campos de contraseñas, tarjetas o datos personales.`
                };
            }
        }
    }

    // google_search is generally safe but log it
    if (toolName === 'google_search') {
        return { allowed: true };
    }

    return { allowed: true };
}

/**
 * Logs a tool execution for rate limiting and audit purposes.
 * @param {string} toolName 
 * @param {Object} params 
 * @param {boolean} success 
 */
function logExecution(toolName, params, success) {
    executionLog.push(Date.now());
    console.log(`[Nexus Tools] ${success ? '✅' : '❌'} ${toolName}`, params);
}

// ─── Tool Execution Engine ──────────────────────────────────────────────────

/**
 * Executes a web interaction tool on the active tab with security validation.
 * @param {string} toolName - Name of the tool to execute
 * @param {Object} params - Tool parameters
 * @param {Function} [onSecurityBlock] - Callback when action is blocked (receives reason string)
 * @returns {Promise<{success?: boolean, result?: any, error?: string, blocked?: boolean}>}
 */
export async function executeTool(toolName, params, onSecurityBlock) {
    return new Promise((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs[0] || !tabs[0].id) {
                return resolve({ error: "No se encontró pestaña activa" });
            }

            const tabId = tabs[0].id;
            const tabUrl = tabs[0].url || '';

            // ── Security Gate ──
            const validation = validateToolAction(toolName, params, tabUrl);
            if (!validation.allowed) {
                if (onSecurityBlock) onSecurityBlock(validation.reason);
                return resolve({
                    error: validation.reason,
                    blocked: true
                });
            }

            let func;
            let args = [params];

            switch (toolName) {
                case 'read_page':
                    func = (p) => {
                        let text = "";
                        if (p.mode === 'html') text = document.documentElement.outerHTML;
                        else text = document.body.innerText;
                        // Truncate to avoid context overflow (Safe limit for 8k context)
                        return text.length > 10000 ? text.substring(0, 10000) + "\n...[TRUNCADO]" : text;
                    };
                    break;

                case 'click_element':
                    func = (p) => {
                        const el = document.querySelector(p.selector);
                        if (!el) throw new Error(`Elemento no encontrado: ${p.selector}`);
                        el.click();
                        return `Click en: ${p.selector}`;
                    };
                    break;

                case 'type_text':
                    func = (p) => {
                        const el = document.querySelector(p.selector);
                        if (!el) throw new Error(`Elemento no encontrado: ${p.selector}`);

                        // Double-check: refuse password fields at runtime
                        if (el.type === 'password') {
                            throw new Error('🔒 Campo de contraseña detectado. Acción cancelada por seguridad.');
                        }

                        el.focus();
                        el.value = p.text;
                        el.dispatchEvent(new Event('input', { bubbles: true }));
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                        return `Escrito "${p.text}" en ${p.selector}`;
                    };
                    break;

                case 'scroll':
                    func = (p) => {
                        if (p.direction === 'top') window.scrollTo(0, 0);
                        else if (p.direction === 'bottom') window.scrollTo(0, document.body.scrollHeight);
                        else if (p.direction === 'up') window.scrollBy(0, -window.innerHeight * 0.8);
                        else window.scrollBy(0, window.innerHeight * 0.8);
                        return `Scroll ${p.direction}`;
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
                        window.location.href = 'https://www.google.com/search?q=' + encodeURIComponent(p.query);
                        return `Navegando a Google Search: ${p.query}. Leeré la página una vez cargue.`;
                    };
                    break;

                default:
                    return resolve({ error: `Herramienta desconocida: ${toolName}` });
            }

            chrome.scripting.executeScript({
                target: { tabId: tabId },
                func: func,
                args: args
            }, (results) => {
                if (chrome.runtime.lastError) {
                    logExecution(toolName, params, false);
                    resolve({ error: chrome.runtime.lastError.message });
                } else if (results && results[0]) {
                    if (results[0].result) {
                        logExecution(toolName, params, true);
                        resolve({ success: true, result: results[0].result });
                    } else {
                        logExecution(toolName, params, false);
                        resolve({ error: "Ejecución fallida o resultado nulo" });
                    }
                } else {
                    logExecution(toolName, params, false);
                    resolve({ error: "Ejecución del script fallida" });
                }
            });
        });
    });
}

/**
 * Returns the current execution log for debugging/audit.
 * @returns {number[]} Array of timestamps
 */
export function getExecutionLog() {
    return [...executionLog];
}
