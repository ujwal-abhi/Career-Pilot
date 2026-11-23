// Recovers from one specific problem that code splitting introduces.
//
// Every deploy gives the page files new names (pages-3f9a1c.js). A browser tab that was opened
// BEFORE a deploy still asks for the old names, the server no longer has them, and the next
// page the person opens fails to load: a blank screen. Vite reports this as a
// "vite:preloadError" event; reloading fetches the new index.html with the new names.
//
// Reload at most once per RELOAD_COOLDOWN_MS: if the reload does not fix it, show the error
// instead of reloading forever.

const RELOAD_KEY = "careerpilot:stale-chunk-reload-at";
export const RELOAD_COOLDOWN_MS = 10_000;

export function shouldReload(now: number, lastReloadAt: number | null): boolean {
  return lastReloadAt === null || now - lastReloadAt > RELOAD_COOLDOWN_MS;
}

// `reload` can be replaced in tests, because jsdom cannot reload a page.
export function installStaleChunkReload(reload: () => void = () => window.location.reload()): () => void {
  const onError = (event: Event) => {
    try {
      const stored = sessionStorage.getItem(RELOAD_KEY);
      const lastReloadAt = stored === null ? null : Number(stored);
      if (!shouldReload(Date.now(), lastReloadAt)) return; // already tried: let the error show
      sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    } catch {
      return; // storage is blocked, so we cannot guard against a reload loop: do not reload
    }
    event.preventDefault(); // we are handling it
    reload();
  };
  window.addEventListener("vite:preloadError", onError);
  return () => window.removeEventListener("vite:preloadError", onError);
}