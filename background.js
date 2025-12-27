// Background Service Worker for Nexus Co-Pilot

// 1. Setup Context Menus on Install
chrome.runtime.onInstalled.addListener(() => {
    // Enable opening side panel on icon click (Chrome 114+)
    if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
        chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
            .catch((error) => console.error("setPanelBehavior failed:", error));
    }

    chrome.contextMenus.create({
        id: "nexus-root",
        title: "Nexus AI",
        contexts: ["selection"]
    });

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
});

// 2. Handle Context Menu Clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId.startsWith("nexus-")) {
        const text = info.selectionText;
        let action = "";

        switch (info.menuItemId) {
            case "nexus-explain": action = "Explica este texto en detalle: "; break;
            case "nexus-summarize": action = "Resume este texto en 3 puntos clave: "; break;
            case "nexus-translate": action = "Traduce este texto al español con tono natural: "; break;
        }

        const fullPrompt = `${action}"${text}"`;

        // Open Side Panel (Chrome 114+)
        chrome.sidePanel.open({ tabId: tab.id }).catch(() => {
            // Fallback if sidePanel.open is not supported or fails
            console.log("Side panel open via API not supported/allowed in this context.");
        });

        // Send message to Sidebar
        // We need a small delay to ensure sidebar is open if we just opened it
        setTimeout(() => {
            chrome.runtime.sendMessage({
                type: "NEXUS_CONTEXT_ACTION",
                text: fullPrompt
            });
        }, 500);
    }
});


