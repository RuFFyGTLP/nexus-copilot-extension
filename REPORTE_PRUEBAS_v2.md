# 🧪 Reporte de Pruebas — Nexus Co-Pilot v2.0

## 📋 Resumen Ejecutivo

- **Estado Global:** ✅ FUNCIONAL (tras correcciones)
- **Bugs Encontrados:** 5 críticos
- **Bugs Corregidos:** 5/5

---

## 🔴 Bugs Críticos Encontrados y Corregidos

### Bug #1: Bucle Infinito de Herramientas (CRÍTICO)

- **Síntoma:** Al pedir "Resumir página", la IA llamaba `read_page` → recibía texto → volvía a llamar `read_page` infinitamente.
- **Causa Raíz:** No existía límite de recursión en las llamadas a herramientas. Además, el `AGENT_TOOLS_PROMPT` se inyectaba en CADA request, incluso en los follow-ups de herramientas, por lo que la IA siempre "veía" herramientas disponibles.
- **Corrección:**
  - Añadido `toolDepth` con máximo de 3 niveles de recursión.
  - En follow-ups de herramientas, se inyecta instrucción explícita `DO NOT call any more tools` en lugar del prompt de herramientas.
  - El parámetro `isToolFollowUp` distingue mensajes de usuario de resultados de herramientas.
- **Archivo:** `js/chat.js`

### Bug #2: Ollama/LM Studio Sin Historial de Conversación (CRÍTICO)

- **Síntoma:** Al usar Ollama directo o LM Studio, la IA no recordaba mensajes anteriores. Cada mensaje se enviaba aislado.
- **Causa Raíz:** Los proveedores `ollama` y `lmstudio` solo enviaban un array con UN mensaje de usuario. El historial completo de conversación (`fullConversation`) solo se usaba con el proveedor `nexus`.
- **Corrección:**
  - Nueva función `getStructuredMessages()` que construye un array `[{role, content}]` desde el DOM.
  - Los 3 proveedores ahora envían el historial completo de mensajes.
  - Imágenes se inyectan en el último mensaje de usuario del array.
- **Archivo:** `js/chat.js`

### Bug #3: Backend Pierde Estructura de Roles (ALTO)

- **Síntoma:** El backend recibía TODO el contexto en un solo campo `message`, aplastando los roles system/user/assistant en un string plano.
- **Causa Raíz:** El frontend concatenaba todo en un string `"System: ...\n\nUser: ...\n\nAssistant: ..."` y lo enviaba como un solo mensaje de usuario a Ollama.
- **Corrección:**
  - El frontend ahora envía un campo `messages` (array de `{role, content}`).
  - El backend usa `messages` si existen, con fallback a `message` para retrocompatibilidad.
  - Las imágenes se adjuntan al último mensaje de usuario del array.
- **Archivos:** `js/chat.js`, `backend/server.js`

### Bug #4: Tool Prompt Inyectado Siempre (MEDIO)

- **Síntoma:** Modelos pequeños (3B) se confundían con el prompt de herramientas y generaban JSON de herramientas donde no debían.
- **Causa Raíz:** `AGENT_TOOLS_PROMPT` se inyectaba incondicionalmente en TODAS las requests, desperdiciando contexto en modelos con ventana pequeña.
- **Corrección:**
  - Solo se inyecta cuando `toolDepth < MAX_TOOL_DEPTH` Y no es un follow-up de herramienta.
  - En follow-ups, se inyecta instrucción de "ya usaste la herramienta, ahora responde".
- **Archivo:** `js/chat.js`

### Bug #5: Regex de Herramientas Demasiado Permisivo

- **Síntoma:** El regex anterior (`[\s\S]*?`) capturaba texto que no era JSON válido.
- **Corrección:** Regex más estricto para nombres de herramientas: `[\w_]+` en vez de `[\s\S]*?`.
- **Archivo:** `js/chat.js`

---

## ✅ Compatibilidad Verificada

### Proveedores de IA

| Proveedor | Historial | Imágenes | Herramientas | Estado |
|:---|:---:|:---:|:---:|:---:|
| **Nexus Middleware** | ✅ | ✅ | ✅ | Totalmente compatible |
| **Ollama (Directo)** | ✅ | ✅ | ✅ | Totalmente compatible |
| **LM Studio / OpenAI** | ✅ | ✅ (Vision) | ✅ | Totalmente compatible |

### Modelos Probados

| Modelo | Compatible | Notas |
|:---|:---:|:---|
| `qwen2.5-coder:3b` | ✅ | Modelo por defecto, funciona bien con herramientas |
| `qwen3:4b` | ✅ | Excelente seguimiento de instrucciones |
| `llama3.2:3b` | ✅ | Rápido pero limitado en herramientas |
| Cualquier OpenAI-compatible | ✅ | Formato estándar `v1/chat/completions` |

### Docker

| Servicio | Estado | Puerto |
|:---|:---:|:---:|
| Ollama (contenedor) | ✅ | 11434 |
| Nexus API (contenedor) | ✅ | 3000 |
| Modelo auto-descargado | ✅ | `qwen2.5-coder:3b` |

---

## 🏗️ Arquitectura Post-Corrección

```
[Usuario] → [chat.js]
              ├─ toolDepth=0: Inyecta AGENT_TOOLS_PROMPT
              ├─ Construye messages[] con getStructuredMessages()
              ├─ Envía a proveedor seleccionado
              │
              ├─ [Nexus]: POST /api/ai/chat {messages, model, ...}
              │    └─ server.js → Ollama (Docker) → respuesta
              │
              ├─ [Ollama]: POST /api/chat {messages, model, ...}
              │    └─ Directo al servidor Ollama
              │
              └─ [LM Studio]: POST /v1/chat/completions {messages, model, ...}
                   └─ Formato OpenAI estándar
                   
[Respuesta IA] → Detector de herramientas
              ├─ Si toolDepth < 3: Ejecuta herramienta
              │    └─ Reenvía resultado con isToolFollowUp=true
              │    └─ NO inyecta AGENT_TOOLS_PROMPT (evita bucle)
              └─ Si toolDepth >= 3: Ignora herramientas
```
