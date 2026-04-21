/**
 * Adapter that exposes a `{ isReady, request(type, data) }` interface backed by
 * a JBrowse-style RPC manager. Used by `LoraxProvider` to transparently route
 * worker-style calls (`config`, `intervals`, `local-data`, `compute-render-data`,
 * `apply-transform`, `clear-buffers`) through the plugin's RPC methods instead
 * of spawning inline web workers.
 */
const DEFAULT_RPC_METHODS = {
  config: 'LoraxConfig',
  intervals: 'LoraxIntervals',
  'local-data': 'LoraxLocalData',
  'compute-render-data': 'LoraxComputeRenderData',
  'apply-transform': 'LoraxApplyTransform',
  'clear-buffers': 'LoraxClearRenderBuffers',
};

export function createRpcWorker({
  rpcManager,
  sessionId,
  rpcDriverName,
  methodMap = {},
} = {}) {
  const resolvedMap = { ...DEFAULT_RPC_METHODS, ...methodMap };
  const isReady = Boolean(rpcManager && sessionId);

  return {
    isReady,
    request(type, data) {
      if (!rpcManager || !sessionId) {
        return Promise.reject(new Error('RPC worker not ready'));
      }
      const methodName = resolvedMap[type];
      if (!methodName) {
        return Promise.reject(new Error(`Unknown RPC worker type: ${type}`));
      }
      return rpcManager.call(sessionId, methodName, {
        sessionId,
        data,
        rpcDriverName,
      });
    },
  };
}
