chrome.commands.onCommand.addListener((command) => {
  if (command === "scan_text") {
    processSelectedText();
  }
});

chrome.action.onClicked.addListener((tab) => {
  processSelectedText();
});

// Fonction d'overlay injectée dans la page pour donner du feedback visuel
function showStatusOverlay(message, status) {
  let overlay = document.getElementById('planning-assistant-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'planning-assistant-overlay';
    overlay.style.position = 'fixed';
    overlay.style.bottom = '25px';
    overlay.style.right = '25px';
    overlay.style.padding = '16px 24px';
    overlay.style.borderRadius = '16px';
    overlay.style.backgroundColor = 'rgba(10, 15, 30, 0.95)';
    overlay.style.color = '#ffffff';
    overlay.style.fontSize = '14px';
    overlay.style.fontWeight = 'bold';
    overlay.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    overlay.style.zIndex = '9999999';
    overlay.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.gap = '12px';
    overlay.style.backdropFilter = 'blur(8px)';
    
    // Spinner
    const spinner = document.createElement('div');
    spinner.id = 'planning-assistant-spinner';
    spinner.style.width = '16px';
    spinner.style.height = '16px';
    spinner.style.border = '2px solid rgba(255,255,255,0.2)';
    spinner.style.borderTop = '2px solid #a855f7';
    spinner.style.borderRadius = '50%';
    spinner.style.animation = 'planning-spin 0.8s linear infinite';
    overlay.appendChild(spinner);

    const textSpan = document.createElement('span');
    textSpan.id = 'planning-assistant-text';
    overlay.appendChild(textSpan);

    // Style pour l'animation du spinner
    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes planning-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(overlay);
  }

  const textSpan = overlay.querySelector('#planning-assistant-text');
  const spinner = overlay.querySelector('#planning-assistant-spinner');
  textSpan.innerText = message;

  if (status === 'error') {
    overlay.style.border = '1px solid #ef4444';
    overlay.style.boxShadow = '0 0 20px rgba(239, 68, 68, 0.5)';
    if (spinner) spinner.style.display = 'none';
    setTimeout(() => {
      overlay.style.opacity = '0';
      overlay.style.transform = 'translateY(10px)';
      setTimeout(() => overlay.remove(), 300);
    }, 6000);
  } else if (status === 'success') {
    overlay.style.border = '1px solid #10b981';
    overlay.style.boxShadow = '0 0 20px rgba(16, 185, 129, 0.5)';
    if (spinner) {
      spinner.style.border = 'none';
      spinner.style.borderRadius = '0';
      spinner.style.animation = 'none';
      spinner.innerHTML = '🎉';
      spinner.style.width = 'auto';
      spinner.style.height = 'auto';
    }
    setTimeout(() => {
      overlay.style.opacity = '0';
      overlay.style.transform = 'translateY(10px)';
      setTimeout(() => overlay.remove(), 300);
    }, 4000);
  } else {
    // Info / Pending
    overlay.style.border = '1px solid #a855f7';
    overlay.style.boxShadow = '0 0 20px rgba(168, 85, 247, 0.5)';
    if (spinner) {
      spinner.style.display = 'block';
      spinner.style.border = '2px solid rgba(255,255,255,0.2)';
      spinner.style.borderTop = '2px solid #a855f7';
      spinner.style.borderRadius = '50%';
      spinner.style.animation = 'planning-spin 0.8s linear infinite';
      spinner.innerHTML = '';
    }
  }
}

async function updateOverlay(tabId, message, status) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: showStatusOverlay,
      args: [message, status]
    });
  } catch (e) {
    console.error("Impossible d'injecter l'overlay:", e);
  }
}

async function processSelectedText() {
  console.log("=== EYE ACTIVATED ===");
  let tab;
  try {
    let [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    tab = activeTab;
    console.log("Tab:", tab.url);

    // Skip internal Chrome pages
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('chrome-extension://')) {
      console.log("Internal page, cannot scan.");
      return;
    }

    // Afficher l'overlay initial
    await updateOverlay(tab.id, "Lecture de la page...", "info");

    let results = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: getSelectionText,
    });

    // Combines text from all frames (main + iframes)
    const selectedText = results
      .map(r => r.result)
      .filter(t => t && t.trim() !== '')
      .join("\n---\n");

    console.log("Combined text length from all frames:", selectedText.length);

    if (!selectedText || selectedText.trim() === '') {
      await updateOverlay(tab.id, "Aucun texte trouve sur la page.", "error");
      return;
    }

    await updateOverlay(tab.id, "Analyse IA en cours...", "info");

    // Limit text size (max 30000 chars)
    const textToSend = selectedText.length > 30000 ? selectedText.substring(0, 30000) : selectedText;

    console.log("Sending to backend...");
    const response = await fetch('http://localhost:3001/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        text: textToSend,
        currentDate: new Date().toISOString().split('T')[0],
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      })
    });

    const result = await response.json();
    console.log("Backend response:", JSON.stringify(result).substring(0, 500));

    if (result.success && result.data && result.data.events && result.data.events.length > 0) {
      let successCount = 0;

      for (const eventDetails of result.data.events) {
        // Save to local DB
        await fetch('http://localhost:3001/api/events/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(eventDetails)
        });

        // Try Google Calendar
        try {
          await fetch('http://localhost:3001/api/calendar/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(eventDetails)
          });
        } catch(e) {}

        successCount++;
      }
      
      await updateOverlay(tab.id, `Succes : ${successCount} evenement(s) extrait(s) !`, "success");
      
      // Ouvrir le dashboard après un court délai pour voir les résultats
      setTimeout(() => {
        chrome.tabs.create({ url: 'http://localhost:5173' });
      }, 1500);

    } else {
      await updateOverlay(tab.id, "L'IA n'a detecte aucun cours sur cette page.", "error");
    }
  } catch (error) {
    console.error("ERROR:", error);
    if (tab && tab.id) {
      await updateOverlay(tab.id, "Erreur de connexion avec le serveur local.", "error");
    }
  }
}

function getSelectionText() {
  let text = window.getSelection().toString();
  if (text && text.trim() !== '') {
    return text;
  }
  if (!document.body) return '';

  let result = document.body.innerText;

  // Extract titles and aria-labels which often contain untruncated course information
  const elements = document.querySelectorAll('[title], [aria-label]');
  const tooltips = [];
  elements.forEach(el => {
    const title = el.getAttribute('title');
    const aria = el.getAttribute('aria-label');
    if (title && title.trim()) tooltips.push(title.trim());
    if (aria && aria.trim()) tooltips.push(aria.trim());
  });

  // Remove duplicates from tooltips to keep prompt size small
  const uniqueTooltips = [...new Set(tooltips)];

  if (uniqueTooltips.length > 0) {
    result += "\n\n=== HIDDEN DETAILS ===\n" + uniqueTooltips.join("\n");
  }

  return result;
}
