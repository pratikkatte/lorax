import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { io } from "socket.io-client";
import * as arrow from "apache-arrow";
import websocketEvents from "../utils/websocketEvents.js";
import { initSession, getProjects as getProjectsApi, uploadFileToBackend as uploadFileApi } from "../services/api.js";

const SESSION_KEY = 'lorax_sid';

export function useLoraxConnection({ apiBase, isProd = false, setGettingDetails }) {
  const socketRef = useRef(null);
  const sidRef = useRef(null);
  const initSessionPromiseRef = useRef(null);

  const [statusMessage, setStatusMessage] = useState({ message: null });
  const [isConnected, setIsConnected] = useState(false);
  const [loraxSid, setLoraxSid] = useState(null);

  const searchRequests = useRef(new Map());

  /** Initialize session */
  const initializeSession = useCallback(() => {
    if (initSessionPromiseRef.current) {
      return initSessionPromiseRef.current;
    }

    initSessionPromiseRef.current = (async () => {
      try {
        // Check localStorage for existing session
        const storedSid = localStorage.getItem(SESSION_KEY);
        if (storedSid) {
          sidRef.current = storedSid;
          setLoraxSid(storedSid);
          console.log("Session restored from localStorage:", storedSid);
        }

        const sid = await initSession(apiBase);
        if (sid) {
          sidRef.current = sid;
          setLoraxSid(sid);
          localStorage.setItem(SESSION_KEY, sid);
          console.log("Session initialized:", sid);
          connect(); // connect socket.io after session init
        } else {
          console.warn("No SID received during session init");
        }
      } catch (error) {
        console.error("Error initializing session:", error);
        throw error;
      } finally {
        initSessionPromiseRef.current = null;
      }
    })();

    return initSessionPromiseRef.current;
  }, [apiBase]);

  /** Connect to Socket.IO */
  const connect = useCallback(() => {
    if (socketRef.current) {
      console.log("Socket already connected");
      return;
    }

    const url = new URL(apiBase);
    const host = `${url.protocol}//${url.hostname}:${url.port}`;
    const path = `${url.pathname}/socket.io/`;

    const socket = io(host, {
      transports: ["websocket"],
      withCredentials: true,
      path: isProd ? path : "/socket.io/",
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 3000,
      timeout: 60000,
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Socket.IO connected");
      setIsConnected(true);
    });

    socket.on("disconnect", (reason) => {
      console.log("Socket.IO disconnected:", reason);
      setIsConnected(false);
    });

    socket.on("status", (msg) => {
      console.log("status", msg);
      setStatusMessage(msg);
      websocketEvents.emit("status", msg);
    });

    socket.on("error", (data) => {
      console.error("Socket error:", data);
      if (data.code === "SESSION_NOT_FOUND" || data.code === "MISSING_SESSION") {
        localStorage.removeItem(SESSION_KEY);
        sidRef.current = null;
        setLoraxSid(null);
        setStatusMessage({ type: 'error', message: data.message || 'Session expired. Reconnecting...' });
        initSessionPromiseRef.current = null;
        initializeSession();
      } else if (data.code === "NO_FILE_LOADED") {
        setStatusMessage({ type: 'warning', message: data.message || 'No file loaded.' });
      } else {
        setStatusMessage({ type: 'error', message: data.message || 'An error occurred.' });
      }
      websocketEvents.emit("error", data);
    });

    socket.on("session-restored", (data) => {
      console.log("Session restored:", data);
      setStatusMessage({ message: `Session restored. File: ${data.file_path?.split('/').pop() || 'unknown'}` });
      websocketEvents.emit("session-restored", data);
    });

    socket.on("details-result", (message) => {
      websocketEvents.emit("viz", { role: "details-result", data: message.data });
      setGettingDetails?.(false);
    });

    socket.on("metadata-key-result", (message) => {
      websocketEvents.emit("viz", { role: "metadata-key-result", ...message });
    });

    socket.on("search-result", (message) => {
      websocketEvents.emit("viz", { role: "search-result", ...message });
    });

    socket.on("metadata-array-result", (message) => {
      websocketEvents.emit("viz", { role: "metadata-array-result", ...message });
    });

    socket.on("search-nodes-result", (message) => {
      websocketEvents.emit("viz", { role: "search-nodes-result", ...message });
    });

    socket.on("pong", () => {
      // Keep-alive response
    });

    return () => {
      socket.disconnect();
    };
  }, [apiBase, isProd, setGettingDetails, initializeSession]);

  /** Initialize once and cleanup */
  useEffect(() => {
    initializeSession();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setIsConnected(false);
    };
  }, [initializeSession]);

  /** Keep-alive ping */
  useEffect(() => {
    if (!isConnected || !socketRef.current) return;
    const interval = setInterval(() => {
      socketRef.current.emit("ping", { time: Date.now() });
    }, 5000);
    return () => clearInterval(interval);
  }, [isConnected]);

  /** Query file loading */
  const queryFile = useCallback((payload) => {
    return new Promise((resolve, reject) => {
      const execute = () => {
        if (!socketRef.current) {
          reject(new Error("Socket not available"));
          return;
        }
        const handleResult = (message) => {
          socketRef.current.off("load-file-result", handleResult);
          resolve(message);
        };

        socketRef.current.once("load-file-result", handleResult);
        socketRef.current.emit("load_file", { ...payload, lorax_sid: sidRef.current, share_sid: payload.share_sid });
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
  }, [initializeSession]);

  /** Query details */
  const queryDetails = useCallback(
    (clickedObject) => {
      setGettingDetails?.(true);
      const payload = { lorax_sid: sidRef.current, ...clickedObject };
      socketRef.current?.emit("details", payload);
    },
    [setGettingDetails]
  );

  /** Search nodes */
  const searchNodes = useCallback((sampleNames, treeIndices, options = {}) => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current) {
        reject(new Error("Socket not available"));
        return;
      }

      const { showLineages = false, sampleColors = {} } = options;

      const handleResult = (message) => {
        socketRef.current.off("search-nodes-result", handleResult);
        if (message.error) {
          reject(new Error(message.error));
          return;
        }
        resolve({
          highlights: message.highlights || {},
          lineage: message.lineage || {}
        });
      };

      socketRef.current.once("search-nodes-result", handleResult);
      socketRef.current.emit("search_nodes", {
        sample_names: sampleNames,
        tree_indices: treeIndices,
        show_lineages: showLineages,
        sample_colors: sampleColors,
        lorax_sid: sidRef.current
      });
    });
  }, []);

  /** Query postorder layout */
  const queryPostorderLayout = useCallback((displayArray, sparsityResolution = null, sparsityPrecision = null) => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current) {
        reject(new Error("Socket not available"));
        return;
      }

      const handleResult = (message) => {
        socketRef.current.off("postorder-layout-result", handleResult);
        if (message.error) {
          reject(new Error(message.error));
          return;
        }

        try {
          const buffer = new Uint8Array(message.buffer);
          const table = arrow.tableFromIPC(buffer);

          const numRows = table.numRows;
          let node_id, parent_id, time, is_tip, tree_idx, x, y;

          if (numRows === 0) {
            node_id = [];
            parent_id = [];
            time = [];
            is_tip = [];
            tree_idx = [];
            x = [];
            y = [];
          } else {
            const nodeIdCol = table.getChild('node_id');
            const parentIdCol = table.getChild('parent_id');
            const timeCol = table.getChild('time');
            const isTipCol = table.getChild('is_tip');
            const treeIdxCol = table.getChild('tree_idx');
            const xCol = table.getChild('x');
            const yCol = table.getChild('y');

            node_id = nodeIdCol ? Array.from(nodeIdCol.toArray()) : [];
            parent_id = parentIdCol ? Array.from(parentIdCol.toArray()) : [];
            time = timeCol ? Array.from(timeCol.toArray()) : [];
            is_tip = isTipCol ? Array.from(isTipCol.toArray()) : [];
            tree_idx = treeIdxCol ? Array.from(treeIdxCol.toArray()) : [];
            x = xCol ? Array.from(xCol.toArray()) : [];
            y = yCol ? Array.from(yCol.toArray()) : [];
          }

          resolve({
            node_id,
            parent_id,
            time,
            is_tip,
            tree_idx,
            x,
            y,
            global_min_time: message.global_min_time,
            global_max_time: message.global_max_time,
            tree_indices: message.tree_indices
          });
        } catch (parseError) {
          console.error("Error parsing PyArrow buffer:", parseError);
          reject(parseError);
        }
      };

      socketRef.current.once("postorder-layout-result", handleResult);
      socketRef.current.emit("process_postorder_layout", {
        displayArray,
        sparsity_resolution: sparsityResolution,
        sparsity_precision: sparsityPrecision,
        lorax_sid: sidRef.current
      });
    });
  }, []);

  /** Query mutations window */
  const queryMutationsWindow = useCallback((start, end, offset = 0, limit = 1000) => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current) {
        reject(new Error("Socket not available"));
        return;
      }

      const handleResult = (message) => {
        socketRef.current.off("mutations-window-result", handleResult);
        if (message.error) {
          reject(new Error(message.error));
          return;
        }

        try {
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

      socketRef.current.once("mutations-window-result", handleResult);
      socketRef.current.emit("query_mutations_window", {
        start,
        end,
        offset,
        limit,
        lorax_sid: sidRef.current
      });
    });
  }, []);

  /** Search mutations */
  const searchMutations = useCallback((position, rangeBp = 5000, offset = 0, limit = 1000) => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current) {
        reject(new Error("Socket not available"));
        return;
      }

      const handleResult = (message) => {
        socketRef.current.off("mutations-search-result", handleResult);
        if (message.error) {
          reject(new Error(message.error));
          return;
        }

        try {
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

      socketRef.current.once("mutations-search-result", handleResult);
      socketRef.current.emit("search_mutations", {
        position,
        range_bp: rangeBp,
        offset,
        limit,
        lorax_sid: sidRef.current
      });
    });
  }, []);

  const checkConnection = useCallback(() => {
    return !!socketRef.current?.connected;
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    sidRef.current = null;
    setLoraxSid(null);
    initSessionPromiseRef.current = null;
  }, []);

  /** Fetch projects - uses apiBase internally */
  const getProjects = useCallback(() => {
    return getProjectsApi(apiBase);
  }, [apiBase]);

  /** Upload file - uses apiBase internally */
  const uploadFileToBackend = useCallback((file, onUploadProgress) => {
    return uploadFileApi(apiBase, file, onUploadProgress);
  }, [apiBase]);

  return useMemo(
    () => ({
      statusMessage,
      setStatusMessage,
      socketRef,
      isConnected,
      checkConnection,
      connect,
      queryFile,
      queryDetails,
      queryPostorderLayout,
      queryMutationsWindow,
      searchMutations,
      searchNodes,
      loraxSid,
      clearSession,
      initializeSession,
      getProjects,
      uploadFileToBackend
    }),
    [
      statusMessage,
      isConnected,
      checkConnection,
      connect,
      queryFile,
      queryDetails,
      queryPostorderLayout,
      queryMutationsWindow,
      searchMutations,
      searchNodes,
      loraxSid,
      clearSession,
      initializeSession,
      getProjects,
      uploadFileToBackend
    ]
  );
}
