// Nexus Options Page Script
document.addEventListener('DOMContentLoaded', () => {
    const saveBtn = document.getElementById('save');
    const status = document.getElementById('status');

    // Load saved settings
    chrome.storage.sync.get({
        apiUrl: 'http://localhost:3000',
        uiLanguage: 'es',
        theme: 'dark'
    }, (items) => {
        document.getElementById('apiUrl').value = items.apiUrl;
        document.getElementById('uiLanguage').value = items.uiLanguage;
        document.getElementById('theme').value = items.theme;
    });

    // Save settings
    saveBtn.onclick = () => {
        const settings = {
            apiUrl: document.getElementById('apiUrl').value,
            uiLanguage: document.getElementById('uiLanguage').value,
            theme: document.getElementById('theme').value
        };

        chrome.storage.sync.set(settings, () => {
            // Show success feedback
            status.classList.add('show');
            saveBtn.textContent = '✓ Guardado';
            saveBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';

            setTimeout(() => {
                status.classList.remove('show');
                saveBtn.textContent = '💾 Guardar Configuración';
                saveBtn.style.background = '';
            }, 2000);
        });
    };

    // Quick save with Enter
    document.querySelectorAll('input').forEach(input => {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                saveBtn.click();
            }
        });
    });
});
