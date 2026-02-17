/**
 * Nexus Co-Pilot - Background Service Worker
 * Handles context menus, keyboard shortcuts, and side panel management.
 * @version 2.0
 */

// ─── Side Panel Behavior ────────────────────────────────────────────────────

// Enable opening the side panel by clicking the extension action button
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error('[Nexus BG] sidePanel behavior error:', error));

// ─── Context Menus ──────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
    // Root menu
    chrome.contextMenus.create({
        id: "nexus-root",
        title: "🧠 Nexus Co-Pilot",
        contexts: ["selection"]
    });

    // Child actions
    chrome.contextMenus.create({
        parentId: "nexus-root",
        id: "nexus-explain",
        title: "🕵️‍♀️ Explicar esto",
        contexts: ["selection"]
    });

    chrome.contextMenus.create({
        parentId: "nexus-root",
        id: "nexus-summarize",
        title: "📝 Resumir esto",
        contexts: ["selection"]
    });

    chrome.contextMenus.create({
        parentId: "nexus-root",
        id: "nexus-translate",
        title: "🌐 Traducir al Español",
        contexts: ["selection"]
    });

    chrome.contextMenus.create({
        parentId: "nexus-root",
        id: "nexus-improve",
        title: "✨ Mejorar redacción",
        contexts: ["selection"]
    });

    chrome.contextMenus.create({
        parentId: "nexus-root",
        id: "nexus-analyze-code",
        title: "💻 Analizar código",
        contexts: ["selection"]
    });

    console.log("[Nexus BG] Context menus created ✅");
});

// ─── Context Menu Handler ───────────────────────────────────────────────────

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (!info.menuItemId.startsWith("nexus-") || info.menuItemId === "nexus-root") return;

    const text = info.selectionText;
    if (!text) return;

    let action = "";
    switch (info.menuItemId) {
        case "nexus-explain":
            action = "Explica este texto en detalle: ";
            break;
        case "nexus-summarize":
            action = "Resume este texto de forma concisa: ";
            break;
        case "nexus-translate":
            action = "Traduce este texto al español: ";
            break;
        case "nexus-improve":
            action = "Mejora la redacción de este texto manteniendo el significado: ";
            break;
        case "nexus-analyze-code":
            action = "Analiza este código, explica qué hace y sugiere mejoras: ";
            break;
        default:
            return;
    }

    const fullPrompt = `${action}"${text}"`;

    // Open Side Panel (Chrome 114+)
    chrome.sidePanel.open({ tabId: tab.id }).catch(() => {
        console.log("[Nexus BG] Side panel open not supported in this context.");
    });

    // Send message to Sidebar with small delay for panel to load
    setTimeout(() => {
        chrome.runtime.sendMessage({
            type: "NEXUS_CONTEXT_ACTION",
            text: fullPrompt
        }).catch(() => {
            // Sidebar might not be ready yet, retry once
            setTimeout(() => {
                chrome.runtime.sendMessage({
                    type: "NEXUS_CONTEXT_ACTION",
                    text: fullPrompt
                }).catch(e => console.warn("[Nexus BG] Could not reach sidebar:", e));
            }, 1000);
        });
    }, 500);
});

// ─── Keyboard Shortcut Handler ──────────────────────────────────────────────
// The _execute_action command (Ctrl+Shift+K) automatically triggers the 
// action button click, which opens the side panel thanks to 
// setPanelBehavior({ openPanelOnActionClick: true }).
// No additional handler needed for _execute_action.
// This listener handles any CUSTOM commands we might add in the future.

chrome.commands.onCommand.addListener((command) => {
    console.log(`[Nexus BG] Command received: ${command}`);
    // Future custom commands can go here
});

// ─── Log Boot ───────────────────────────────────────────────────────────────
console.log("[Nexus BG] Background service worker v2.0 loaded ✅");
