import { useEffect, useRef, useMemo, useCallback, useState } from "react";
import * as arrow from "apache-arrow";
import { getProjects as getProjectsApi, uploadFileToBackend as uploadFileApi } from "../services/api.js";
import { resolveDiagnosticPingConfig } from "../utils/socketDiagnostics.js";
import { useSession } from "./useSession.jsx";
import { useSocket } from "./useSocket.jsx";

export function useLoraxConnection({
  apiBase,
  isProd = false,
  diagnosticPingEnabled,
  diagnosticPingIntervalMs
}) {
  // Use extracted session hook
  const {
    loraxSid,
    sidRef,
    initializeSession,
    clearSession
  } = useSession({ apiBase });

  // Ref to hold reconnect function (avoids circular dependency)
  const reconnectRef = useRef(null);

  // Request ID counter for correlating requests with responses
  const requestIdRef = useRef(0);

  // Session error handler uses ref to access connect function
  const handleSessionError = useCallback(() => {
    clearSession();
    initializeSession().then(() => {
      reconnectRef.current?.();
    });
  }, [clearSession, initializeSession]);

  const diagnosticPingConfig = useMemo(
    () =>
      resolveDiagnosticPingConfig({
        enabledOverride: diagnosticPingEnabled,
        intervalOverrideMs: diagnosticPingIntervalMs,
        env: import.meta.env
      }),
    [diagnosticPingEnabled, diagnosticPingIntervalMs]
  );

  // Use extracted socket hook with session error handling
  const {
    socketRef,
    isConnected,
    connect,
    disconnect,
    emit,
    on,
    off,
    once,
    checkConnection,
    statusMessage,
    setStatusMessage
  } = useSocket({
    apiBase,
    isProd,
    diagnosticPingEnabled: diagnosticPingConfig.enabled,
    onSessionError: handleSessionError
  });

  // Update reconnect ref when connect changes
  useEffect(() => {
    reconnectRef.current = connect;
  }, [connect]);

  // Initialize session on mount, then connect socket
  useEffect(() => {
    initializeSession().then(() => connect());
    return () => {
      disconnect();
    };
  }, [initializeSession, connect, disconnect]);

  // Optional diagnostics ping (disabled by default)
  useEffect(() => {
    if (!diagnosticPingConfig.enabled || !isConnected) return;
    const interval = setInterval(() => {
      emit("ping", { time: Date.now(), source: "diagnostic" });
    }, diagnosticPingConfig.intervalMs);
    return () => clearInterval(interval);
  }, [diagnosticPingConfig.enabled, diagnosticPingConfig.intervalMs, isConnected, emit]);

  // Compare-trees-result: fire-and-forget responses from compare_trees_event
  const [compareTreesResult, setCompareTreesResult] = useState(null);
  useEffect(() => {
    if (!isConnected || !socketRef.current) return;
    const handler = (msg) => {
      console.log('compareTreesResult', msg);
      setCompareTreesResult(msg);
    };
    on("compare-trees-result", handler);
    return () => off("compare-trees-result", handler);
  }, [isConnected, on, off]);

  // Query file loading
  const queryFile = useCallback((payload) => {
    return new Promise((resolve, reject) => {
      const LOAD_FILE_ACK_TIMEOUT_MS = 30000;
      const LOAD_FILE_TOTAL_TIMEOUT_MS = 120000;
      const SESSION_ERROR_CODES = new Set(["SESSION_NOT_FOUND", "MISSING_SESSION"]);

      const execute = () => {
        if (!socketRef.current) {
          reject(new Error("Socket not available"));
          return;
        }

        const requestId = `load-${Date.now()}-${++requestIdRef.current}`;
        let settled = false;
        let timeoutId = null;

        const cleanup = () => {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          off("load-file-result", handleResult);
          off("disconnect", handleDisconnect);
        };

        const settleResolve = (value) => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve(value);
        };

        const settleReject = (error) => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(error);
        };

        const makeResultError = (result) => {
          const error = new Error(result?.message || "Failed to load file.");
          error.code = result?.code;
          error.recoverable = result?.recoverable;
          return error;
        };

        const normalizeResult = (message) => {
          if (!message || typeof message !== "object") {
            return null;
          }
          if (typeof message.ok === "boolean") {
            return message;
          }
          if (message.config && message.filename) {
            return {
              ok: true,
              request_id: message.request_id ?? requestId,
              ...message,
              code: message.code || "FILE_LOADED",
            };
          }
          if (message.error) {
            return {
              ok: false,
              request_id: message.request_id ?? requestId,
              code: message.code || "LOAD_FILE_FAILED",
              message: message.error,
              recoverable: true,
            };
          }
          return null;
        };

        const handleTerminalResult = (message, source) => {
          if (source === "ack" && (message === undefined || message === null)) {
            // Older backends may not ack; keep waiting for legacy event fallback.
            return;
          }

          const result = normalizeResult(message);
          if (!result) {
            const sourceLabel = source === "ack" ? "acknowledgement" : "event";
            settleReject(new Error(`Malformed load_file ${sourceLabel} payload.`));
            return;
          }

          if (result.request_id && result.request_id !== requestId) {
            return;
          }

          if (result.ok) {
            settleResolve(result);
            return;
          }

          if (SESSION_ERROR_CODES.has(result.code)) {
            handleSessionError();
          }
          settleReject(makeResultError(result));
        };

        const handleResult = (message) => {
          handleTerminalResult(message, "event");
        };

        const handleDisconnect = () => {
          settleReject(new Error("Socket disconnected during file load."));
        };

        timeoutId = setTimeout(() => {
          settleReject(new Error("Timed out waiting for load_file result."));
        }, LOAD_FILE_TOTAL_TIMEOUT_MS);

        on("load-file-result", handleResult);
        on("disconnect", handleDisconnect);

        const requestPayload = {
          ...payload,
          lorax_sid: sidRef.current,
          share_sid: payload.share_sid,
          request_id: requestId,
        };

        if (typeof socketRef.current.timeout === "function") {
          socketRef.current
            .timeout(LOAD_FILE_ACK_TIMEOUT_MS)
            .emit("load_file", requestPayload, (err, response) => {
              if (settled) return;
              if (err) {
                // Ack timeout can happen during rollout; keep waiting for event fallback.
                return;
              }
              handleTerminalResult(response, "ack");
            });
        } else {
          emit("load_file", requestPayload);
        }
      };

      if (!socketRef.current) {
        initializeSession().then(() => {
          execute();
        }).catch((err) => {
          reject(new Error("Failed to initialize session: " + err.message));
        });
      } else {
        execute();
      }
    });
  }, [initializeSession, emit, on, off, socketRef, sidRef, handleSessionError]);

  /**
   * Query tree layout from backend via socket.
   * Returns raw socket response - parsing done by caller.
   * Uses Socket.IO acknowledgement callbacks for request-response correlation.
   * @param {number[]} displayArray - Tree indices to fetch
   * @param {boolean} sparsification - Enable sparsification (default false). Uses edge-midpoint grid deduplication.
   * @param {number[]} actualDisplayArray - All visible tree indices for backend cache eviction (defaults to displayArray)
   * @returns {Promise<{buffer, global_min_time, global_max_time, tree_indices}>}
   */
  const queryTreeLayout = useCallback((displayArray, sparsification = false, actualDisplayArray = null) => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current) {
        reject(new Error("Socket not available"));
        return;
      }

      // Generate unique request ID for this request
      const requestId = ++requestIdRef.current;

      
      // Use callback-based emit - Socket.IO handles correlation
      // This guarantees the callback receives the response for this specific request
      socketRef.current.emit(
        "process_postorder_layout",
        {
          displayArray,
          actualDisplayArray: actualDisplayArray || displayArray,  // All visible trees for backend cache eviction
          sparsification: sparsification,
          lorax_sid: sidRef.current,
          request_id: requestId
        },
        (response) => {
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response);
          }
        }
      );
    });
  }, [socketRef, sidRef]);

  /**
   * Query tree/node/individual details from backend via socket.
   * Emits `details` and resolves with `details-result.data`.
   *
   * @param {Object} detailsPayload - { treeIndex?, node?, comprehensive? }
   * @returns {Promise<Object>} details result object (e.g. { tree, node, individual, ... })
   */
  const queryDetails = useCallback((detailsPayload = {}) => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current) {
        reject(new Error("Socket not available"));
        return;
      }

      const handleResult = (message) => {
        off("details-result", handleResult);

        if (message?.error) {
          reject(new Error(message.error));
          return;
        }

        resolve(message?.data);
      };

      once("details-result", handleResult);
      emit("details", { ...detailsPayload, lorax_sid: sidRef.current });
    });
  }, [emit, once, off, socketRef, sidRef]);

  /**
   * Query mutations in a genomic window.
   * Returns mutations with position, mutation string, node_id, etc.
   * @param {number} start - Start genomic position (bp)
   * @param {number} end - End genomic position (bp)
   * @param {number} offset - Pagination offset (default 0)
   * @param {number} limit - Maximum mutations to return (default 1000)
   * @returns {Promise<{mutations, total_count, has_more, start, end, offset, limit}>}
   */
  const queryMutationsWindow = useCallback((start, end, offset = 0, limit = 1000) => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current) {
        reject(new Error("Socket not available"));
        return;
      }

      const handleResult = (message) => {
        off("mutations-window-result", handleResult);
        if (message.error) {
          reject(new Error(message.error));
          return;
        }

        try {
          // Parse PyArrow buffer
          const buffer = new Uint8Array(message.buffer);
          const table = arrow.tableFromIPC(buffer);

          const numRows = table.numRows;
          let mutations = [];

          if (numRows > 0) {
            const positionCol = table.getChild('position');
            const mutationCol = table.getChild('mutation');
            const nodeIdCol = table.getChild('node_id');
            const siteIdCol = table.getChild('site_id');
            const ancestralStateCol = table.getChild('ancestral_state');
            const derivedStateCol = table.getChild('derived_state');

            for (let i = 0; i < numRows; i++) {
              mutations.push({
                position: Number(positionCol.get(i)),
                mutation: mutationCol.get(i),
                node_id: nodeIdCol.get(i),
                site_id: siteIdCol.get(i),
                ancestral_state: ancestralStateCol.get(i),
                derived_state: derivedStateCol.get(i),
              });
            }
          }

          resolve({
            mutations,
            total_count: message.total_count,
            has_more: message.has_more,
            start: message.start,
            end: message.end,
            offset: message.offset,
            limit: message.limit
          });
        } catch (parseError) {
          console.error("Error parsing mutations PyArrow buffer:", parseError);
          reject(parseError);
        }
      };

      once("mutations-window-result", handleResult);
      emit("query_mutations_window", {
        start,
        end,
        offset,
        limit,
        lorax_sid: sidRef.current
      });
    });
  }, [emit, once, off, socketRef, sidRef]);

  /**
   * Query highlight positions for all tip nodes matching a metadata value.
   * Returns positions for ALL matching nodes, ignoring sparsification.
   * Used for highlighting nodes that may not be currently rendered.
   * @param {string} metadataKey - Metadata key to filter by
   * @param {string} metadataValue - Metadata value to match
   * @param {number[]} treeIndices - Tree indices to compute positions for
   * @returns {Promise<{positions: [{node_id, tree_idx, x, y}]}>}
   */
  const queryHighlightPositions = useCallback((metadataKey, metadataValue, treeIndices) => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current) {
        reject(new Error("Socket not available"));
        return;
      }

      if (!metadataKey || metadataValue === null || metadataValue === undefined) {
        resolve({ positions: [] });
        return;
      }

      if (!treeIndices || treeIndices.length === 0) {
        resolve({ positions: [] });
        return;
      }

      const handleResult = (message) => {
        off("highlight-positions-result", handleResult);

        if (message.error) {
          reject(new Error(message.error));
          return;
        }

        resolve({ positions: message.positions || [] });
      };

      once("highlight-positions-result", handleResult);

      emit("get_highlight_positions_event", {
        lorax_sid: sidRef.current,
        metadata_key: metadataKey,
        metadata_value: String(metadataValue),
        tree_indices: treeIndices
      });
    });
  }, [emit, once, off, socketRef, sidRef]);

  /**
   * Query multi-value metadata search for highlight positions.
   * Returns positions grouped by value for per-value coloring with OR logic.
   * @param {string} metadataKey - Metadata key to filter by
   * @param {string[]} metadataValues - Array of metadata values to match (OR logic)
   * @param {number[]} treeIndices - Tree indices to compute positions for
   * @param {boolean} showLineages - Whether to compute lineage paths (default false)
   * @returns {Promise<{positions_by_value: Object, lineages: Object, total_count: number}>}
   */
  const queryMultiValueSearch = useCallback((metadataKey, metadataValues, treeIndices, showLineages = false) => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current) {
        reject(new Error("Socket not available"));
        return;
      }

      if (!metadataKey) {
        resolve({ positions_by_value: {}, lineages: {}, total_count: 0 });
        return;
      }

      if (!metadataValues || metadataValues.length === 0) {
        resolve({ positions_by_value: {}, lineages: {}, total_count: 0 });
        return;
      }

      if (!treeIndices || treeIndices.length === 0) {
        resolve({ positions_by_value: {}, lineages: {}, total_count: 0 });
        return;
      }

      const handleResult = (message) => {
        off("search-metadata-multi-result", handleResult);

        if (message.error) {
          reject(new Error(message.error));
          return;
        }

        resolve({
          positions_by_value: message.positions_by_value || {},
          lineages: message.lineages || {},
          total_count: message.total_count || 0
        });
      };

      once("search-metadata-multi-result", handleResult);

      emit("search_metadata_multi_event", {
        lorax_sid: sidRef.current,
        metadata_key: metadataKey,
        metadata_values: metadataValues.map(String),
        tree_indices: treeIndices,
        show_lineages: showLineages
      });
    });
  }, [emit, once, off, socketRef, sidRef]);

  /**
   * Emit visible tree indices to backend when compare mode is enabled.
   * Fire-and-forget; no response handler.
   * @param {number[]} treeIndices - Tree indices to send
   */
  const emitCompareTrees = useCallback((treeIndices) => {
    console.log('emitCompareTrees', treeIndices);
    if (!socketRef.current) return;
    emit("compare_trees_event", {
      lorax_sid: sidRef.current,
      tree_indices: Array.isArray(treeIndices) ? treeIndices : []
    });
  }, [emit, socketRef, sidRef]);

  /**
   * Search mutations by position with configurable range.
   * Returns mutations sorted by distance from the searched position.
   * @param {number} position - Center position to search around (bp)
   * @param {number} rangeBp - Total range to search (default 5000)
   * @param {number} offset - Pagination offset (default 0)
   * @param {number} limit - Maximum mutations to return (default 1000)
   * @returns {Promise<{mutations, total_count, has_more, search_start, search_end, position, range_bp, offset, limit}>}
   */
  const searchMutations = useCallback((position, rangeBp = 5000, offset = 0, limit = 1000) => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current) {
        reject(new Error("Socket not available"));
        return;
      }

      const handleResult = (message) => {
        off("mutations-search-result", handleResult);
        if (message.error) {
          reject(new Error(message.error));
          return;
        }

        try {
          // Parse PyArrow buffer
          const buffer = new Uint8Array(message.buffer);
          const table = arrow.tableFromIPC(buffer);

          const numRows = table.numRows;
          let mutations = [];

          if (numRows > 0) {
            const positionCol = table.getChild('position');
            const mutationCol = table.getChild('mutation');
            const nodeIdCol = table.getChild('node_id');
            const siteIdCol = table.getChild('site_id');
            const ancestralStateCol = table.getChild('ancestral_state');
            const derivedStateCol = table.getChild('derived_state');
            const distanceCol = table.getChild('distance');

            for (let i = 0; i < numRows; i++) {
              mutations.push({
                position: Number(positionCol.get(i)),
                mutation: mutationCol.get(i),
                node_id: nodeIdCol.get(i),
                site_id: siteIdCol.get(i),
                ancestral_state: ancestralStateCol.get(i),
                derived_state: derivedStateCol.get(i),
                distance: Number(distanceCol.get(i)),
              });
            }
          }

          resolve({
            mutations,
            total_count: message.total_count,
            has_more: message.has_more,
            search_start: message.search_start,
            search_end: message.search_end,
            position: message.position,
            range_bp: message.range_bp,
            offset: message.offset,
            limit: message.limit
          });
        } catch (parseError) {
          console.error("Error parsing mutations search PyArrow buffer:", parseError);
          reject(parseError);
        }
      };

      once("mutations-search-result", handleResult);
      emit("search_mutations", {
        position,
        range_bp: rangeBp,
        offset,
        limit,
        lorax_sid: sidRef.current
      });
    });
  }, [emit, once, off, socketRef, sidRef]);

  /**
   * Query metadata for a specific key (JSON format).
   * Returns sample-to-value mapping for the requested metadata key.
   * @param {string} key - Metadata key to fetch
   * @returns {Promise<{key: string, data: Object}>} key and sample->value mapping
   */
  const queryMetadataForKey = useCallback((key) => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current) {
        reject(new Error("Socket not available"));
        return;
      }

      const handleResult = (message) => {
        off("metadata-key-result", handleResult);
        if (message.error) {
          reject(new Error(message.error));
          return;
        }
        resolve({ key: message.key, data: message.data || {} });
      };

      once("metadata-key-result", handleResult);
      emit("fetch_metadata_for_key", { lorax_sid: sidRef.current, key });
    });
  }, [emit, once, off, socketRef, sidRef]);

  /**
   * Query metadata as PyArrow array format (efficient for large tree sequences).
   * Returns unique values, indices array, and sample node IDs.
   * @param {string} key - Metadata key to fetch
   * @returns {Promise<{key: string, uniqueValues: Array, indices: Uint16Array, nodeIdToIdx: Map}>}
   */
  const queryMetadataArray = useCallback((key) => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current) {
        reject(new Error("Socket not available"));
        return;
      }

      const handleResult = (message) => {
        off("metadata-array-result", handleResult);

        if (message.error) {
          reject(new Error(message.error));
          return;
        }

        const { key: resultKey, unique_values, sample_node_ids, buffer } = message;

        if (!buffer || !unique_values || !sample_node_ids) {
          reject(new Error("Invalid metadata array result - missing data"));
          return;
        }

        try {
          // Parse Arrow buffer to get indices array
          const arrayBuffer = buffer instanceof ArrayBuffer ? buffer : buffer.buffer || new Uint8Array(buffer).buffer;
          const table = arrow.tableFromIPC(arrayBuffer);
          const indicesColumn = table.getChild('idx');

          if (!indicesColumn) {
            reject(new Error("Invalid Arrow table - missing 'idx' column"));
            return;
          }

          const indices = indicesColumn.toArray(); // Uint16Array

          // Build nodeId -> array index mapping for O(1) lookup
          const nodeIdToIdx = new Map();
          sample_node_ids.forEach((nodeId, i) => {
            nodeIdToIdx.set(nodeId, i);
          });

          resolve({
            key: resultKey,
            uniqueValues: unique_values,
            indices,
            nodeIdToIdx,
            sampleNodeIds: sample_node_ids
          });
        } catch (err) {
          reject(new Error("Error parsing Arrow buffer: " + err.message));
        }
      };

      once("metadata-array-result", handleResult);
      emit("fetch_metadata_array", { lorax_sid: sidRef.current, key });
    });
  }, [emit, once, off, socketRef, sidRef]);

  /**
   * Search for samples matching a metadata value.
   * Returns array of sample names that match the key-value pair.
   * @param {string} key - Metadata key to search
   * @param {string} value - Metadata value to match
   * @returns {Promise<string[]>} Array of matching sample names
   */
  const queryMetadataSearch = useCallback((key, value) => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current) {
        reject(new Error("Socket not available"));
        return;
      }

      if (!key || value === undefined || value === null) {
        resolve([]);
        return;
      }

      const handleResult = (message) => {
        off("search-result", handleResult);
        if (message.error) {
          reject(new Error(message.error));
          return;
        }
        resolve(message.samples || []);
      };

      once("search-result", handleResult);
      emit("search_metadata", {
        lorax_sid: sidRef.current,
        key,
        value
      });
    });
  }, [emit, once, off, socketRef, sidRef]);

  // Fetch projects - uses apiBase internally
  const getProjects = useCallback(() => {
    return getProjectsApi(apiBase);
  }, [apiBase]);

  // Upload file - uses apiBase internally
  const uploadFileToBackend = useCallback((file, onUploadProgress) => {
    return uploadFileApi(apiBase, file, onUploadProgress);
  }, [apiBase]);

  return useMemo(
    () => ({
      statusMessage,
      setStatusMessage,
      socketRef,
      isConnected,
      queryFile,
      queryTreeLayout,
      queryDetails,
      queryMutationsWindow,
      queryHighlightPositions,
      queryMultiValueSearch,
      searchMutations,
      queryMetadataForKey,
      queryMetadataArray,
      queryMetadataSearch,
      loraxSid,
      getProjects,
      uploadFileToBackend,
      emitCompareTrees,
      compareTreesResult
    }),
    [
      statusMessage,
      setStatusMessage,
      isConnected,
      queryFile,
      queryTreeLayout,
      queryDetails,
      queryMutationsWindow,
      queryHighlightPositions,
      queryMultiValueSearch,
      searchMutations,
      queryMetadataForKey,
      queryMetadataArray,
      queryMetadataSearch,
      loraxSid,
      getProjects,
      uploadFileToBackend,
      emitCompareTrees,
      compareTreesResult
    ]
  );
}
