# Nexus AI Co-Pilot 🚀

Una potente extensión de Chrome/Edge que te proporciona un asistente de IA directamente en tu navegador. Arquitectura modular con seguridad integrada.

![Versión](https://img.shields.io/badge/version-2.0-blue)
![Licencia](https://img.shields.io/badge/license-MIT-green)
![Chrome](https://img.shields.io/badge/Chrome-Extension-yellow)
![Manifest](https://img.shields.io/badge/Manifest-V3-orange)

## ✨ Características

### 🤖 Chat con IA
- Conexión con múltiples backends: **Nexus Middleware**, **Ollama**, **LM Studio**
- Soporte para diferentes modelos de IA (Qwen, Llama, Mistral, Gemma, etc.)
- Streaming de respuestas en tiempo real
- Historial de conversaciones persistente
- Perfiles rápidos (Developer, Rápido, Creativo, Deep Think)

### 🛠️ Herramientas Web (Agent Mode)
- **Leer página**: Extrae y analiza el contenido de cualquier página web
- **Click automático**: Interactúa con elementos de la página
- **Escribir texto**: Rellena formularios automáticamente
- **Scroll inteligente**: Navega por páginas largas
- **Búsqueda en Google**: Realiza búsquedas directamente
- **Extraer links**: Obtén todos los enlaces de una página

### 🛡️ Seguridad del Agente (Nuevo v2.0)
- **Bloqueo de sitios sensibles**: Banca, OAuth, admin, gobierno
- **Protección de campos**: Contraseñas, tarjetas, CVV, OTP bloqueados
- **Rate limiting**: Máximo 15 acciones automáticas por minuto
- **Doble verificación**: Validación pre-ejecución + runtime
- **Log de auditoría**: Cada acción del agente queda registrada

### 🔌 MCP (Model Context Protocol)
- Integración con servidores MCP externos
- **4 presets incluidos**: Sequential Thinking, Chrome Tools, Filesystem, Brave Search
- Soporte para transporte STDIO y SSE
- **Health check** integrado (ping para servidores SSE)
- CRUD completo de servidores con protección anti-duplicados

### 🎨 Interfaz Premium
- Diseño moderno con tema oscuro y glassmorphism
- Panel lateral integrado en el navegador
- Acciones rápidas (chips) para tareas comunes
- Captura de pantalla integrada
- Entrada de voz (Speech-to-Text)
- Lectura en voz alta (Text-to-Speech)

### ⚙️ Configuración Avanzada
- **Perfiles rápidos**: Developer, Rápido, Creativo, Deep Think
- Parámetros de LLM personalizables (temperatura, tokens, etc.)
- Gestión de modelos con instalación directa desde Ollama
- Backup y restauración de configuración en JSON
- Headers personalizados y API keys

## 📦 Instalación

### Desde código fuente:

1. Clona el repositorio:
```bash
git clone https://github.com/german-ux/nexus-copilot-extension.git
```

2. Abre Chrome/Edge y ve a `chrome://extensions/`

3. Activa el **Modo desarrollador** (esquina superior derecha)

4. Haz clic en **Cargar descomprimida**

5. Selecciona la carpeta del proyecto

6. ¡Listo! El icono de Nexus aparecerá en tu barra de extensiones

## 🔧 Configuración

### Conexión con Ollama (Local)
1. Instala [Ollama](https://ollama.ai/)
2. Ejecuta un modelo: `ollama run qwen2.5-coder:7b`
3. En la extensión, selecciona **Ollama (Directo)** como proveedor
4. URL: `http://localhost:11434`

### Conexión con LM Studio
1. Instala [LM Studio](https://lmstudio.ai/)
2. Carga un modelo y activa el servidor local
3. En la extensión, selecciona **LM Studio / OpenAI (Directo)**
4. URL: `http://localhost:1234`

### Conexión con Nexus Backend (Recomendado)
1. Configura tu servidor Nexus Control
2. Selecciona **Nexus Middleware (Recomendado)**
3. URL: `http://localhost:3000`

## 🎯 Uso

### Acciones Rápidas
- 📝 **Resumir Página**: Resume el contenido de la página actual
- 💻 **Explicar Código**: Explica código seleccionado paso a paso
- ✨ **Mejorar Texto**: Corrige gramática y mejora estilo
- 🌐 **Traducir**: Traduce texto al inglés

### Menú Contextual
Selecciona cualquier texto en una página web, haz clic derecho y elige:
- 🕵️ Explicar esto
- 📝 Resumir esto
- 🌐 Traducir al Español
- ✨ Mejorar redacción *(nuevo v2.0)*
- 💻 Analizar código *(nuevo v2.0)*

### Atajos de Teclado
- `Ctrl + Shift + K` - **Abrir/cerrar panel lateral** ✅
- `Enter` - Enviar mensaje
- `Shift + Enter` - Nueva línea

## 📁 Estructura del Proyecto

```
nexus-copilot-extension/
├── manifest.json          # Configuración de la extensión (v2.0)
├── background.js          # Service Worker (menús, atajos, panel)
├── sidebar.html           # Interfaz del panel lateral
├── sidebar.js             # Orquestador principal (entry point)
├── sidebar.css            # Estilos premium
├── options.html           # Página de opciones
├── options.js             # Lógica de opciones
└── js/                    # Módulos ES6
    ├── config.js          # Constantes, defaults, perfiles, catálogo
    ├── tools.js           # Motor de herramientas + capa de seguridad
    ├── chat.js            # Chat, mensajes, voz, contexto
    └── settings.js        # Configuración UI, MCP, modelos, backup
```

### Arquitectura Modular (v2.0)

```
sidebar.js (Entry Point - 219 líneas)
    ├── imports js/config.js   → Constantes y configuración
    ├── imports js/tools.js    → Ejecución segura de herramientas
    ├── imports js/chat.js     → Lógica de conversación
    └── imports js/settings.js → UI de configuración completa
```

> **Antes (v1.x):** 1 archivo monolítico de ~1450 líneas  
> **Ahora (v2.0):** 5 módulos especializados con responsabilidad única

## 🔒 Permisos

La extensión requiere los siguientes permisos:
- `sidePanel`: Panel lateral integrado
- `storage`: Guardar configuración
- `activeTab`: Acceder a la pestaña activa
- `scripting`: Ejecutar scripts en páginas (para herramientas web)
- `contextMenus`: Menús contextuales al seleccionar texto

## 🛡️ Seguridad

El motor de herramientas web incluye múltiples capas de protección:

| Capa | Protección |
|:---|:---|
| **Dominios bloqueados** | PayPal, bancos, OAuth, admin, gobierno |
| **Selectores protegidos** | Password, tarjeta, CVV, OTP, PIN |
| **Rate limiting** | 15 acciones/minuto máximo |
| **Verificación runtime** | Doble check en campos de contraseña |
| **Auditoría** | Log en consola de cada ejecución |

## 🤝 Contribuir

¡Las contribuciones son bienvenidas! Por favor:

1. Haz fork del repositorio
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add: AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📜 Licencia

Distribuido bajo la licencia MIT. Ver `LICENSE` para más información.

## 🙏 Agradecimientos

- [Ollama](https://ollama.ai/) - Backend de modelos locales
- [LM Studio](https://lmstudio.ai/) - Interfaz para modelos locales
- [Model Context Protocol](https://modelcontextprotocol.io/) - Estándar para herramientas de IA

---

**Desarrollado con ❤️ por [german-ux](https://github.com/german-ux)**
