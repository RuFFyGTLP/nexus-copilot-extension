/**
 * Nexus Co-Pilot - Configuration Module
 * Centralizes all constants, defaults, profiles, and model catalog.
 * @module config
 */

// ─── Default Settings ───────────────────────────────────────────────────────
export const DEFAULTS = {
    // General
    provider: 'nexus',
    apiUrl: 'http://localhost:3000',
    timeout: 120000, // 2 minutes for deep reasoning
    userName: 'User',
    botName: 'Nexus',
    uiLanguage: 'es',

    // LLM
    model: 'qwen2.5-coder:3b',
    reasoningModel: '',
    systemPrompt: 'Eres Nexus, un asistente IA avanzado. Responde siempre en ESPAÑOL. Usa markdown para formateo. Sé breve pero preciso.',
    temperature: 0.7,
    topP: 0.9,
    maxTokens: 4096,

    // UI Behavior
    streamResponse: true,
    autoHighlight: true,
    sendOnEnter: true,
    autoScroll: true,

    // Appearance
    fontSize: 13,
    fontFamily: '',
    userAvatar: '',
    botAvatar: '',

    // History
    historyLimit: 20,
    persistHistory: true,

    // System
    enableNotifications: true,
    authHeader: '',
    apiKey: '',

    // Mirostat
    mirostat: 0,
    mirostatEta: 0.1,
    mirostatTau: 5.0,

    // Personalization
    customInstructions: '',
    responseStyle: 'normal',
    ttsRate: 1.0,
    ttsPitch: 1.0,

    // MCP
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

// ─── AI Profiles ────────────────────────────────────────────────────────────
export const PROFILES = {
    dev: {
        name: "Developer Pro",
        desc: "Optimizado para código, debugging y arquitectura. Usa baja temperatura para precisión.",
        config: {
            model: "qwen2.5-coder:7b",
            temperature: 0.3,
            systemPrompt: "Eres un ingeniero de software experto. Responde siempre en ESPAÑOL. Usa código limpio, patrones de diseño y buenas prácticas. Si el usuario pega código, analízalo críticamente."
        }
    },
    speed: {
        name: "Rápido",
        desc: "Respuestas ultra-rápidas. Ideal para preguntas simples.",
        config: {
            model: "llama3.2:3b",
            temperature: 0.5,
            systemPrompt: "Responde siempre en ESPAÑOL. Sé EXTREMADAMENTE conciso. Máximo 2-3 frases. Sin introducciones ni despedidas."
        }
    },
    creative: {
        name: "Creativo",
        desc: "Para escritura, brainstorming y contenido. Alta temperatura.",
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

// ─── Popular Models Catalog ─────────────────────────────────────────────────
export const POPULAR_MODELS = [
    { id: 'qwen2.5-coder:7b', name: 'Qwen 2.5 Coder (7B)', desc: '🌟 MEJOR OPCIÓN PARA CODING. Equilibrio perfecto entre velocidad e inteligencia. (4.7GB)' },
    { id: 'llama3.2:3b', name: 'Llama 3.2 (3B)', desc: '🚀 EL MÁS RÁPIDO. Ideal para portátiles antiguos. Responde al instante. (2.0GB)' },
    { id: 'mistral:7b', name: 'Mistral 7B', desc: '⚖️ ESTÁNDAR DE ORO. Muy bueno para todo uso, correos y resumenes. (4.1GB)' },
    { id: 'gemma2:9b', name: 'Gemma 2 (9B)', desc: '🎨 CREATIVIDAD GOOGLE. Excelente redacción y matices humanos. Requiere más RAM. (5.0GB)' },
    { id: 'phi3.5:3.8b', name: 'Phi 3.5 (3.8B)', desc: '🧠 PEQUEÑO GENIO. Increíble razonamiento lógico para su tamaño. (2.2GB)' },
    { id: 'deepseek-coder:6.7b', name: 'DeepSeek Coder (6.7B)', desc: '💻 ESPECIALISTA CÓDIGO. Alternativa sólida a Qwen. (3.8GB)' },
    { id: 'llava:7b', name: 'LLaVA (7B)', desc: '👁️ VISIÓN. El único que puede "ver" imágenes. Úsalo si subes fotos. (4.5GB)' }
];

// ─── MCP Preset Servers ─────────────────────────────────────────────────────
export const MCP_PRESETS = [
    { name: 'Sequential Thinking', type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-sequential-thinking'] },
    { name: 'Chrome Tools', type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-puppeteer'] },
    { name: 'Filesystem', type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '.'] },
    { name: 'Brave Search', type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-brave-search'] }
];
