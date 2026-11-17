// This runs once on page open, independently of directory loading or interaction.
(async () => {
  const box = document.querySelector('#visitor-counter');
  try {
    const key = 'fcit-visitor-session-v1';
    let sessionId = sessionStorage.getItem(key);
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      sessionStorage.setItem(key, sessionId);
    }
    const response = await fetch('/.netlify/functions/visitor-count', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({sessionId}),
      cache: 'no-store',
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error('Counter unavailable');
    const {total} = await response.json();
    if (!Number.isSafeInteger(total) || total < 108) throw new Error('Invalid total');
    document.querySelector('#visitor-total').textContent = String(total);
    box.hidden = false;
  } catch {
    // Storage, network and backend failures must never affect the directory.
    box.hidden = true;
  }
})();
