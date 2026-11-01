// Si un archivo falla o no casa con los demás, el juego se quedaría en la pantalla de carga: borra la caché y recarga una vez.
addEventListener('error', async (e) => {
  if (e.target !== window && e.target.tagName !== 'SCRIPT') return;
  if (!document.querySelector('.screen.boot') || !navigator.onLine) return;
  try {
    if (sessionStorage.getItem('duskforge.healed')) return;
    sessionStorage.setItem('duskforge.healed', '1');
    await Promise.all((await caches.keys()).map((k) => caches.delete(k)));
  } catch { return; } // sin almacenamiento no se puede garantizar una sola recarga
  location.reload();
}, true);
