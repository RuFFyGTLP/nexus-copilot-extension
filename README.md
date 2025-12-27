# Nexus AI Co-Pilot 🚀

Una potente extensión de Chrome/Edge que te proporciona un asistente de IA directamente en tu navegador.

![Versión](https://img.shields.io/badge/version-1.2-blue)
![Licencia](https://img.shields.io/badge/license-MIT-green)
![Chrome](https://img.shields.io/badge/Chrome-Extension-yellow)

## ✨ Características

### 🤖 Chat con IA
- Conexión con múltiples backends: **Nexus Middleware**, **Ollama**, **LM Studio**
- Soporte para diferentes modelos de IA (Qwen, Llama, Mistral, Gemma, etc.)
- Streaming de respuestas en tiempo real
- Historial de conversaciones persistente

### 🛠️ Herramientas Web (Agent Mode)
- **Leer página**: Extrae y analiza el contenido de cualquier página web
- **Click automático**: Interactúa con elementos de la página
- **Escribir texto**: Rellena formularios automáticamente
- **Scroll inteligente**: Navega por páginas largas
- **Búsqueda en Google**: Realiza búsquedas directamente

### 🎨 Interfaz Premium
- Diseño moderno con tema oscuro
- Panel lateral integrado en el navegador
- Acciones rápidas (chips) para tareas comunes
- Captura de pantalla integrada
- Entrada de voz (Speech-to-Text)
- Lectura en voz alta (Text-to-Speech)

### ⚙️ Configuración Avanzada
- **Perfiles rápidos**: Developer, Rápido, Creativo, Deep Think
- Parámetros de LLM personalizables (temperatura, tokens, etc.)
- Soporte MCP (Model Context Protocol) para herramientas externas
- Gestión de modelos con instalación directa desde Ollama
- Backup y restauración de configuración

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

### Atajos de Teclado
- `Enter` - Enviar mensaje
- `Shift + Enter` - Nueva línea
- `Ctrl + Shift + K` - Abrir panel (próximamente)

## 📁 Estructura del Proyecto

```
nexus-copilot-extension/
├── manifest.json      # Configuración de la extensión
├── background.js      # Service Worker (menús contextuales)
├── sidebar.html       # Interfaz del panel lateral
├── sidebar.js         # Lógica principal del chat y herramientas
├── sidebar.css        # Estilos premium
├── options.html       # Página de opciones
└── options.js         # Lógica de opciones
```

## 🔒 Permisos

La extensión requiere los siguientes permisos:
- `sidePanel`: Panel lateral integrado
- `storage`: Guardar configuración
- `activeTab`: Acceder a la pestaña activa
- `scripting`: Ejecutar scripts en páginas (para herramientas web)
- `contextMenus`: Menús contextuales al seleccionar texto

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
