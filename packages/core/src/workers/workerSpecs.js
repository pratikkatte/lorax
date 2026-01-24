/**
 * Worker specification functions for lazy-loading workers.
 * These functions return Promises that resolve to Worker classes.
 *
 * NOTE: The dynamic import with ?worker&inline is Vite-specific.
 * In webpack environments, these will fail gracefully and return null.
 */

let localBackendWorkerPromise = null;
let renderDataWorkerPromise = null;

/**
 * Lazy loader for localBackendWorker.
 * Used by useLoraxConfig for interval computations and local data.
 */
export function getLocalBackendWorker() {
  if (localBackendWorkerPromise === null) {
    localBackendWorkerPromise = (async () => {
      try {
        // This import syntax only works in Vite
        // In webpack, this will fail and we'll return null
        const module = await import(/* webpackIgnore: true */ /* @vite-ignore */ './localBackendWorker.js?worker&inline');
        return module.default;
      } catch (e) {
        console.warn('[workerSpecs] localBackendWorker import failed (expected in non-Vite environments):', e.message);
        return null;
      }
    })();
  }
  return localBackendWorkerPromise;
}

/**
 * Lazy loader for renderDataWorker.
 * Used by useRenderData for computing typed arrays for deck.gl.
 */
export function getRenderDataWorker() {
  if (renderDataWorkerPromise === null) {
    renderDataWorkerPromise = (async () => {
      try {
        // This import syntax only works in Vite
        // In webpack, this will fail and we'll return null
        const module = await import(/* webpackIgnore: true */ /* @vite-ignore */ './renderDataWorker.js?worker&inline');
        return module.default;
      } catch (e) {
        console.warn('[workerSpecs] renderDataWorker import failed (expected in non-Vite environments):', e.message);
        return null;
      }
    })();
  }
  return renderDataWorkerPromise;
}
