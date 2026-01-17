import { useEffect, useRef, useMemo, useCallback } from "react";
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
   * @param {number[]} displayArray - Tree indices to fetch
   * @param {Object} sparsityOptions - { resolution, precision }
   * @returns {Promise<{buffer, global_min_time, global_max_time, tree_indices}>}
   */
  const queryTreeLayout = useCallback((displayArray, sparsityOptions = {}) => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current) {
        reject(new Error("Socket not available"));
        return;
      }

      const handleResult = (message) => {
        off("postorder-layout-result", handleResult);

        if (message.error) {
          reject(new Error(message.error));
          return;
        }

        // Return raw response - let caller parse the buffer
        resolve(message);
      };

      once("postorder-layout-result", handleResult);
      emit("process_postorder_layout", {
        displayArray,
        sparsity_resolution: sparsityOptions.resolution || null,
        sparsity_precision: sparsityOptions.precision || null,
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
      loraxSid,
      getProjects,
      uploadFileToBackend
    ]
  );
}
