/**
 * Adapter that exposes a `{ isReady, request(type, data) }` interface backed by
 * a JBrowse-style RPC manager. Used by `LoraxProvider` to transparently route
 * worker-style calls (`config`, `intervals`, `local-data`, `compute-render-data`,
 * `apply-transform`, `clear-buffers`) through the plugin's RPC methods instead
 * of spawning inline web workers.
 */

/**
 * JBrowse BaseRpcDriver.filterArgs walks objects via Object.entries. Maps have
 * no enumerable entries there, so nodeIdToIdx would become {} and tip metadata
 * colors break. Typed index arrays are normalized to plain Arrays for the same
 * path consistency as useRenderData's RPC payload notes.
 *
 * @param {Record<string, unknown>|null|undefined} metadataArrays
 * @returns {Record<string, unknown>|null|undefined}
 */
export function serializeMetadataArraysForRpc(metadataArrays) {
  if (!metadataArrays || typeof metadataArrays !== 'object') {
    return metadataArrays;
  }
  const out = {};
  for (const [key, val] of Object.entries(metadataArrays)) {
    if (!val || typeof val !== 'object') {
      out[key] = val;
      continue;
    }
    const { uniqueValues, indices, nodeIdToIdx, ...rest } = val;
    let plainIdx = nodeIdToIdx;
    if (nodeIdToIdx instanceof Map) {
      plainIdx = Object.fromEntries(nodeIdToIdx);
    }
    const indicesOut = ArrayBuffer.isView(indices) ? Array.from(indices) : indices;
    out[key] = {
      ...rest,
      uniqueValues,
      indices: indicesOut,
      nodeIdToIdx: plainIdx,
    };
  }
  return out;
}

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
      let payload = data;
      if (
        type === 'compute-render-data'
        && data
        && typeof data === 'object'
        && data.metadataArrays
      ) {
        payload = {
          ...data,
          metadataArrays: serializeMetadataArraysForRpc(data.metadataArrays),
        };
      }
      return rpcManager.call(sessionId, methodName, {
        sessionId,
        data: payload,
        rpcDriverName,
      });
    },
  };
}
