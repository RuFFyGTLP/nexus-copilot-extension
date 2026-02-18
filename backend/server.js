/**
 * Nexus Co-Pilot — Middleware API Server
 * Bridges the Chrome extension with Ollama and provides:
 *   - /api/status           → Health check
 *   - /api/ai/chat          → Chat completions (proxied to Ollama)
 *   - /api/ai/ollama/tags   → List installed models
 *   - /api/ai/ollama/pull   → Pull/install new models
 *   - /api/ai/models        → Unified model listing
 * 
 * Environment Variables:
 *   PORT          — Server port (default: 3000)
 *   OLLAMA_URL    — Ollama base URL (default: http://localhost:11434)
 *   DEFAULT_MODEL — Fallback model (default: qwen2.5-coder:3b)
 *   CORS_ORIGIN   — Allowed origins (default: *)
 */

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const OLLAMA_URL = (process.env.OLLAMA_URL || 'http://localhost:11434').replace(/\/$/, '');
const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'qwen2.5-coder:3b';

// ─── Middleware ──────────────────────────────────────────────────────────────

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '50mb' })); // Large limit for images

// Request logging
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        const status = res.statusCode;
        const color = status < 400 ? '\x1b[32m' : '\x1b[31m';
        console.log(`${color}${req.method}\x1b[0m ${req.path} → ${status} (${duration}ms)`);
    });
    next();
});

// ─── Health Check ───────────────────────────────────────────────────────────

app.get('/api/status', async (req, res) => {
    try {
        const ollamaRes = await fetch(`${OLLAMA_URL}/api/tags`);
        const data = await ollamaRes.json();
        const models = data.models ? data.models.map(m => m.name) : [];

        res.json({
            status: 'online',
            version: '2.0.0',
            ollama: {
                connected: true,
                url: OLLAMA_URL,
                models: models,
                modelCount: models.length
            },
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
        });
    } catch (e) {
        res.json({
            status: 'degraded',
            version: '2.0.0',
            ollama: {
                connected: false,
                url: OLLAMA_URL,
                error: e.message
            },
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
        });
    }
});

// ─── Chat Endpoint ──────────────────────────────────────────────────────────

app.post('/api/ai/chat', async (req, res) => {
    try {
        const {
            message,
            model = DEFAULT_MODEL,
            temperature = 0.7,
            image,
            mcpServers = []
        } = req.body;

        if (!message) {
            return res.status(400).json({ success: false, error: 'Message is required' });
        }

        console.log(`\n🤖 Chat Request → Model: ${model} | Temp: ${temperature}`);
        console.log(`   Message length: ${message.length} chars`);
        if (image) console.log(`   📸 Image attached`);
        if (mcpServers.length > 0) console.log(`   🔌 MCP Servers: ${mcpServers.length}`);

        // Build Ollama request
        const ollamaPayload = {
            model: model,
            messages: [
                { role: 'user', content: message }
            ],
            stream: false,
            options: {
                temperature: temperature
            }
        };

        // Attach image if present (base64)
        if (image) {
            const base64Data = image.includes(',') ? image.split(',')[1] : image;
            ollamaPayload.messages[0].images = [base64Data];
        }

        const startTime = Date.now();

        const ollamaRes = await fetch(`${OLLAMA_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ollamaPayload)
        });

        if (!ollamaRes.ok) {
            const errorText = await ollamaRes.text();
            console.error(`   ❌ Ollama error: ${ollamaRes.status} - ${errorText}`);
            return res.status(502).json({
                success: false,
                error: `Ollama respondió con error ${ollamaRes.status}: ${errorText}`
            });
        }

        const data = await ollamaRes.json();
        const duration = Date.now() - startTime;
        const response = data.message?.content || '';

        console.log(`   ✅ Response: ${response.length} chars in ${duration}ms`);

        res.json({
            success: true,
            response: response,
            model: data.model || model,
            metadata: {
                duration_ms: duration,
                eval_count: data.eval_count,
                eval_duration: data.eval_duration,
                total_duration: data.total_duration,
                prompt_eval_count: data.prompt_eval_count
            }
        });

    } catch (e) {
        console.error('   ❌ Chat error:', e.message);
        res.status(500).json({
            success: false,
            error: e.message,
            hint: `¿Está Ollama corriendo en ${OLLAMA_URL}?`
        });
    }
});

// ─── Streaming Chat Endpoint ────────────────────────────────────────────────

app.post('/api/ai/chat/stream', async (req, res) => {
    try {
        const { message, model = DEFAULT_MODEL, temperature = 0.7, image } = req.body;

        if (!message) {
            return res.status(400).json({ success: false, error: 'Message is required' });
        }

        const ollamaPayload = {
            model: model,
            messages: [{ role: 'user', content: message }],
            stream: true,
            options: { temperature }
        };

        if (image) {
            const base64Data = image.includes(',') ? image.split(',')[1] : image;
            ollamaPayload.messages[0].images = [base64Data];
        }

        const ollamaRes = await fetch(`${OLLAMA_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ollamaPayload)
        });

        if (!ollamaRes.ok) {
            return res.status(502).json({ success: false, error: `Ollama error: ${ollamaRes.status}` });
        }

        // Stream to client
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const reader = ollamaRes.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(l => l.trim());

            for (const line of lines) {
                try {
                    const parsed = JSON.parse(line);
                    if (parsed.message?.content) {
                        res.write(`data: ${JSON.stringify({ token: parsed.message.content })}\n\n`);
                    }
                    if (parsed.done) {
                        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
                    }
                } catch (e) { /* skip unparseable chunks */ }
            }
        }

        res.end();
    } catch (e) {
        console.error('Stream error:', e.message);
        if (!res.headersSent) {
            res.status(500).json({ success: false, error: e.message });
        }
    }
});

// ─── Model Management ───────────────────────────────────────────────────────

// List installed models (Ollama proxy)
app.get('/api/ai/ollama/tags', async (req, res) => {
    try {
        const ollamaRes = await fetch(`${OLLAMA_URL}/api/tags`);
        const data = await ollamaRes.json();
        res.json(data);
    } catch (e) {
        res.status(502).json({ error: `Cannot reach Ollama: ${e.message}` });
    }
});

// Pull/install a model
app.post('/api/ai/ollama/pull', async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Model name required' });

    console.log(`\n📦 Pulling model: ${name}...`);

    try {
        const ollamaRes = await fetch(`${OLLAMA_URL}/api/pull`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, stream: false })
        });

        if (ollamaRes.ok) {
            console.log(`   ✅ Model ${name} pulled successfully`);
            res.json({ success: true, model: name });
        } else {
            const err = await ollamaRes.text();
            console.error(`   ❌ Pull failed: ${err}`);
            res.status(502).json({ error: err });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Delete a model
app.delete('/api/ai/ollama/delete', async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Model name required' });

    try {
        const ollamaRes = await fetch(`${OLLAMA_URL}/api/delete`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });

        if (ollamaRes.ok) {
            res.json({ success: true, deleted: name });
        } else {
            const err = await ollamaRes.text();
            res.status(502).json({ error: err });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Unified model listing
app.get('/api/ai/models', async (req, res) => {
    try {
        const ollamaRes = await fetch(`${OLLAMA_URL}/api/tags`);
        const data = await ollamaRes.json();

        const models = (data.models || []).map(m => ({
            id: m.name,
            name: m.name,
            size: m.size,
            modified: m.modified_at,
            family: m.details?.family || 'unknown',
            parameters: m.details?.parameter_size || 'unknown',
            quantization: m.details?.quantization_level || 'unknown'
        }));

        res.json({ models, count: models.length, source: 'ollama' });
    } catch (e) {
        res.json({ models: [], count: 0, error: e.message });
    }
});

// ─── Catch-all ──────────────────────────────────────────────────────────────

app.get('/', (req, res) => {
    res.json({
        name: 'Nexus Co-Pilot API',
        version: '2.0.0',
        endpoints: [
            'GET  /api/status',
            'POST /api/ai/chat',
            'POST /api/ai/chat/stream',
            'GET  /api/ai/models',
            'GET  /api/ai/ollama/tags',
            'POST /api/ai/ollama/pull',
            'DELETE /api/ai/ollama/delete'
        ],
        docs: 'Connect the Nexus Co-Pilot Chrome extension to http://localhost:3000'
    });
});

// ─── Start Server ───────────────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║        🚀 Nexus Co-Pilot API v2.0               ║');
    console.log('╠══════════════════════════════════════════════════╣');
    console.log(`║  Server:  http://0.0.0.0:${PORT}                  ║`);
    console.log(`║  Ollama:  ${OLLAMA_URL.padEnd(35)}   ║`);
    console.log(`║  Model:   ${DEFAULT_MODEL.padEnd(35)}   ║`);
    console.log('╠══════════════════════════════════════════════════╣');
    console.log('║  Configure the extension:                       ║');
    console.log('║  Provider → Nexus Middleware                     ║');
    console.log(`║  URL      → http://localhost:${PORT}                  ║`);
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('');
});
