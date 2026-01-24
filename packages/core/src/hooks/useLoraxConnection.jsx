import { useEffect, useRef, useMemo, useCallback } from "react";
import * as arrow from "apache-arrow";
import websocketEvents from "../utils/websocketEvents.js";
import { getProjects as getProjectsApi, uploadFileToBackend as uploadFileApi } from "../services/api.js";
import { useSession } from "./useSession.jsx";
import { useSocket } from "./useSocket.jsx";

export function useLoraxConnection({ apiBase, isProd = false }) {
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

  // Set up Lorax-specific event listeners
  useEffect(() => {
    if (!isConnected) return;

    const handleMetadataKeyResult = (message) => {
      websocketEvents.emit("viz", { role: "metadata-key-result", ...message });
    };

    const handleSearchResult = (message) => {
      websocketEvents.emit("viz", { role: "search-result", ...message });
    };

    const handleMetadataArrayResult = (message) => {
      websocketEvents.emit("viz", { role: "metadata-array-result", ...message });
    };

    on("metadata-key-result", handleMetadataKeyResult);
    on("search-result", handleSearchResult);
    on("metadata-array-result", handleMetadataArrayResult);

    return () => {
      off("metadata-key-result", handleMetadataKeyResult);
      off("search-result", handleSearchResult);
      off("metadata-array-result", handleMetadataArrayResult);
    };
  }, [isConnected, on, off]);

  // Keep-alive ping
  useEffect(() => {
    if (!isConnected) return;
    const interval = setInterval(() => {
      emit("ping", { time: Date.now() });
    }, 5000);
    return () => clearInterval(interval);
  }, [isConnected, emit]);

  // Query file loading
  const queryFile = useCallback((payload) => {
    return new Promise((resolve, reject) => {
      const execute = () => {
        if (!socketRef.current) {
          reject(new Error("Socket not available"));
          return;
        }
        const handleResult = (message) => {
          off("load-file-result", handleResult);
          console.log('[LoraxConnection] File loaded config:', message.config);
          resolve(message);
        };

        once("load-file-result", handleResult);
        emit("load_file", { ...payload, lorax_sid: sidRef.current, share_sid: payload.share_sid });
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
  }, [initializeSession, emit, once, off, socketRef, sidRef]);

  /**
   * Query tree layout from backend via socket.
   * Returns raw socket response - parsing done by caller.
   * Uses Socket.IO acknowledgement callbacks for request-response correlation.
   * @param {number[]} displayArray - Tree indices to fetch
   * @param {boolean} sparsification - Enable tip-only sparsification (default false)
   * @returns {Promise<{buffer, global_min_time, global_max_time, tree_indices}>}
   */
  const queryTreeLayout = useCallback((displayArray, sparsification = false) => {
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
      searchMutations,
      loraxSid,
      getProjects,
      uploadFileToBackend
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
      searchMutations,
      loraxSid,
      getProjects,
      uploadFileToBackend
    ]
  );
}
