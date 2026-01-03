import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { io } from "socket.io-client";
import websocketEvents from "../webworkers/websocketEvents";
import useLoraxConfig from "../globalconfig.js";
import workerSpec from "../webworkers/localBackendWorker.js?worker&inline";
import { initSession } from "../services/api.js";

// Keep old handlers for worker communication
let onQueryReceipt = (receivedData) => { };
let onStatusReceipt = (receivedData) => console.log("STATUS:", receivedData.data);
let onConfigReceipt = (receivedData) => { };
let onLocalBinsReceipt = (receivedData) => { };
let onGetTreeDataReceipt = (receivedData) => { };
let onDetailsReceipt = (receivedData) => { };
let onValueChangedReceipt = (receivedData) => { };
let onSearchResultReceipt = (receivedData) => { };

function useConnect({ setGettingDetails, settings, statusMessage: providedStatusMessage, setStatusMessage: providedSetStatusMessage }) {
  const workerRef = useRef(null);
  const socketRef = useRef(null);
  const sidRef = useRef(null);
  const initSessionPromiseRef = useRef(null);

  const [localStatusMessage, setLocalStatusMessage] = useState({ message: null });

  const statusMessage = providedStatusMessage || localStatusMessage;
  const setStatusMessage = providedSetStatusMessage || setLocalStatusMessage;

  const [isConnected, setIsConnected] = useState(false);

  const { API_BASE, IS_PROD } = useLoraxConfig();

  const searchRequests = useRef(new Map());

  /** 🔑 Initialize session */
  const initializeSession = useCallback(() => {
    if (initSessionPromiseRef.current) {
      return initSessionPromiseRef.current;
    }

    initSessionPromiseRef.current = (async () => {
      try {
        // Check localStorage for existing session
        const storedSid = localStorage.getItem('lorax_sid');
        if (storedSid) {
          sidRef.current = storedSid;
          console.log("Session restored from localStorage:", storedSid);
        }

        const sid = await initSession(API_BASE);
        if (sid) {
          sidRef.current = sid;
          localStorage.setItem('lorax_sid', sid);  // Persist session
          console.log("Session initialized:", sid);
          connect(sid); // connect socket.io after session init
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
  }, [API_BASE]);

  useEffect(() => {
    onStatusReceipt = (receivedData) => {
      const msg = receivedData?.data ?? receivedData;
      if (msg) {
        setStatusMessage(msg);
      }
    };

    return () => {
      onStatusReceipt = (receivedData) => console.log("STATUS:", receivedData?.data);
    };
  }, [setStatusMessage]);

  /** 🔌 Connect to Socket.IO */
  const connect = useCallback(() => {
    if (socketRef.current) {
      console.log("Socket already connected");
      return;
    }


    const url = new URL(API_BASE);

    const host = `${url.protocol}//${url.hostname}:${url.port}`;

    const path = `${url.pathname}/socket.io/`;

    // console.log(`Connecting Socket.IO to host: ${host} with path: ${path}`);
    const socket = io(host, {
      transports: ["websocket"],
      withCredentials: true,
      // query: { sid },
      path: IS_PROD ? path : "/socket.io/",
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 3000,
      timeout: 60000,
      pingTimeout: 60000,   // ⏱ match server
      pingInterval: 25000,  // ⏱ match server
    });

    socketRef.current = socket;

    // ✅ On connect
    socket.on("connect", () => {
      console.log("Socket.IO connected");
      setIsConnected(true);
      // setStatusMessage({ message: "Connected" });
    });

    // 🔌 On disconnect
    socket.on("disconnect", (reason) => {
      console.log("⚠️ Socket.IO disconnected:", reason);
      setIsConnected(false);
      // socketRef.current = null;
    });

    // 📦 Handle incoming events
    socket.on("status", (msg) => {
      console.log("status", msg);
      setStatusMessage(msg);
      websocketEvents.emit("status", msg); // used websocketevents.js to emit events
    });

    // Handle session errors from backend
    socket.on("error", (data) => {
      console.error("Socket error:", data);
      if (data.code === "SESSION_NOT_FOUND" || data.code === "MISSING_SESSION") {
        // Clear stale session and reinitialize
        localStorage.removeItem('lorax_sid');
        sidRef.current = null;
        setStatusMessage({ type: 'error', message: data.message || 'Session expired. Reconnecting...' });
        // Attempt to reinitialize session
        initSessionPromiseRef.current = null;
        initializeSession();
      } else if (data.code === "NO_FILE_LOADED") {
        setStatusMessage({ type: 'warning', message: data.message || 'No file loaded.' });
      } else {
        setStatusMessage({ type: 'error', message: data.message || 'An error occurred.' });
      }
      websocketEvents.emit("error", data);
    });

    // Handle session restoration (file was already loaded in previous session)
    socket.on("session-restored", (data) => {
      console.log("Session restored:", data);
      setStatusMessage({ message: `Session restored. File: ${data.file_path?.split('/').pop() || 'unknown'}` });
      websocketEvents.emit("session-restored", data);
    });


    socket.on("query-result", (message) => {

      // console.log("query-result", message);
      workerRef.current?.postMessage({
        type: "query",
        data: message.data,
      });
    });

    socket.on("details-result", (message) => {
      websocketEvents.emit("viz", { role: "details-result", data: message.data });
      setGettingDetails(false);
    });

    socket.on("pong", (msg) => {
      // console.log("pong", msg);
    });

    return () => {
      socket.disconnect();
    };
  }, [API_BASE, settings, setGettingDetails, initializeSession]);

  /** 🔄 Worker setup when connected */
  useEffect(() => {
    let worker = null;
    if (isConnected) {
      worker = new workerSpec();
      workerRef.current = worker;

      worker.onmessage = (event) => {
        if (event.data.type === "status") onStatusReceipt(event.data);
        if (event.data.type === "query") onQueryReceipt(event.data.data);
        if (event.data.type === "config") onConfigReceipt(event.data);
        if (event.data.type === "details") onDetailsReceipt(event.data.data);
        if (event.data.type === "local-bins")
          onLocalBinsReceipt(event.data);
        if (event.data.type === "gettree") onGetTreeDataReceipt(event.data);
        if (event.data.type === "value-changed")
          onValueChangedReceipt(event.data);
        if (event.data.type === "search-result" || event.data.type === "search-nodes-result") {
          const { id, data } = event.data;
          const resolve = searchRequests.current.get(id);
          if (resolve) {
            resolve(data);
            searchRequests.current.delete(id);
          } else if (!id) {
            // Fallback for calls without ID (if any)
            onSearchResultReceipt(event.data);
          }
        }
      };
    }

    return () => {
      worker?.terminate();
      workerRef.current = null;
    };
  }, [isConnected]);

  /** 🔑 Initialize once and cleanup properly */
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

  /** Keep-alive ping (optional) */
  useEffect(() => {
    if (!isConnected || !socketRef.current) return;
    const interval = setInterval(() => {
      socketRef.current.emit("ping", { time: Date.now() });
    }, 5000);
    return () => clearInterval(interval);
  }, [isConnected]);

  // ───────────────────────────────
  // Query and worker-bound methods
  // ───────────────────────────────
  /**
   * Get tree data with adaptive sparsification options.
   * @param {number} global_index - Global tree index
   * @param {Object} options - Sparsification options
   * @param {number} options.precision - Precision level (fallback)
   * @param {boolean} options.showingAllTrees - Whether all trees are being shown (skip sparsification)
   */
  const getTreeData = useCallback((global_index, options = {}) => {
    // Support legacy call signature: getTreeData(global_index, precision)
    if (typeof options === 'number') {
      options = { precision: options };
    }

    const { precision, showingAllTrees } = options;

    return new Promise((resolve) => {
      workerRef.current?.postMessage({
        type: "gettree",
        global_index,
        precision,
        showingAllTrees,
      });

      onGetTreeDataReceipt = (receivedData) => {
        resolve(receivedData.data);
      };
    });
  }, []);

  /**
   * Get tree from cached edges - builds tree if not already processed.
   * @param {number} global_index - Global tree index
   * @param {Object} options - Options for tree building
   * @param {number} options.precision - Precision level
   * @param {boolean} options.showingAllTrees - Whether all trees are being shown
   */
  const getTreeFromEdges = useCallback((global_index, options = {}) => {
    const { precision, showingAllTrees } = options;

    return new Promise((resolve) => {
      const handler = (event) => {
        if (event.data.type === "get-tree-from-edges" && event.data.global_index === global_index) {
          workerRef.current?.removeEventListener('message', handler);
          resolve(event.data.data);
        }
      };
      workerRef.current?.addEventListener('message', handler);

      workerRef.current?.postMessage({
        type: "get-tree-from-edges",
        global_index,
        precision,
        showingAllTrees,
      });
    });
  }, []);

  const search = useCallback((term, terms = [], options = {}) => {
    return new Promise((resolve) => {
      const id = Math.random().toString(36).substring(7);
      searchRequests.current.set(id, resolve);
      workerRef.current?.postMessage({
        type: "search",
        term,
        terms,
        id,
        options
      });
    });
  }, []);

  const queryConfig = useCallback((configData, globalBpPerUnit = null) => {
    return new Promise((resolve) => {
      workerRef.current?.postMessage({
        type: "config",
        data: configData,
        globalBpPerUnit: globalBpPerUnit,
      });
      // onConfigReceipt = (receivedData) => resolve(receivedData);
    });
  }, []);

  const valueChanged = useCallback((value, setResult) => {
    workerRef.current?.postMessage({
      type: "value-changed",
      data: value,
    });

    onValueChangedReceipt = (receivedData) => {
      setResult([receivedData.data.i0, receivedData.data.i1]);
    };
  }, []);

  /**
   * Query local bins with display options
   * @param {number} start - Start genomic position
   * @param {number} end - End genomic position
   * @param {number} globalBpPerUnit - Base pairs per unit
   * @param {number} nTrees - Number of trees (legacy, unused)
   * @param {number} new_globalBp - Zoom-adjusted bp per unit
   * @param {number|null} regionWidth - Optional region width
   * @param {Object} displayOptions - Display configuration
   * @param {string} displayOptions.selectionStrategy - 'largestSpan' | 'centerWeighted' | 'spanWeightedRandom' | 'first'
   */
  const queryLocalBins = useCallback(
    (start, end, globalBpPerUnit, nTrees, new_globalBp, regionWidth = null, displayOptions = {}) => {
      return new Promise((resolve) => {
        workerRef.current?.postMessage({
          type: "local-bins",
          data: {
            start,
            end,
            globalBpPerUnit,
            nTrees,
            new_globalBp,
            regionWidth,
            displayOptions
          },
        });

        onLocalBinsReceipt = (receivedData) => {
          resolve(receivedData.data);
        };
      });
    },
    []
  );

  const queryNodes = useCallback(
    (value, localTrees) => {


      return new Promise((resolve) => {
        socketRef.current?.emit("query", { value, localTrees, lorax_sid: sidRef.current });

        onQueryReceipt = (receivedData) => {
          // console.log("query", receivedData);
          resolve(receivedData);
        }
      });
    }, []);

  /**
   * Fetch edges for a genomic interval from the backend and cache them in the worker.
   * Resolves once the worker has stored the edges; no data is returned.
   * @param {number} start - Start genomic position (bp)
   * @param {number} end - End genomic position (bp)
   */
  const queryEdges = useCallback((start, end) => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current) {
        reject(new Error("Socket not available"));
        return;
      }

      const waitForStore = () => {
        return new Promise((res) => {
          const handler = (event) => {
            if (event.data?.type === "store-edges-done") {
              workerRef.current?.removeEventListener("message", handler);
              res();
            }
          };

          workerRef.current?.addEventListener("message", handler);
          setTimeout(() => {
            workerRef.current?.removeEventListener("message", handler);
            res();
          }, 50);
        });
      };

      const handleResult = (message) => {
        socketRef.current.off("edges-result", handleResult);
        if (message.error) {
          reject(new Error(message.error));
          return;
        }

        const data = message.data;
        if (data?.edges) {
          workerRef.current?.postMessage({
            type: "store-edges",
            data: {
              edges: data.edges,
              start: data.start,
              end: data.end
            }
          });
          waitForStore().then(() => resolve(data)).catch(() => resolve(data));
        } else {
          resolve(data);
        }
      };

      socketRef.current.once("edges-result", handleResult);
      socketRef.current.emit("query_edges", { start, end, lorax_sid: sidRef.current });
    });
  }, []);



  const queryFile = useCallback((payload) => {
    return new Promise((resolve, reject) => {
      const execute = () => {
        if (!socketRef.current) {
          reject(new Error("Socket not available"));
          return;
        }
        const handleResult = (message) => {
          // console.log("📦 Received load-file-result:", message);
          socketRef.current.off("load-file-result", handleResult); // cleanup listener
          resolve(message);
        };

        socketRef.current.once("load-file-result", handleResult);

        // console.log("payload", payload, sidRef.current);

        // console.log("payload", payload, sidRef.current);
        socketRef.current.emit("load_file", { ...payload, lorax_sid: sidRef.current, share_sid: payload.share_sid });
      };

      if (!socketRef.current) {
        initializeSession().then(() => {
          console.log("session initialized");
          execute();
        }).catch((err) => {
          reject(new Error("Failed to initialize session: " + err.message));
        });
      } else {
        execute();
      }
    });
  }, [initializeSession]);

  const queryDetails = useCallback(
    (clickedObject) => {
      setGettingDetails(true);
      // console.log("queryDetails", clickedObject, sidRef.current);
      const payload = { lorax_sid: sidRef.current, ...clickedObject };
      socketRef.current?.emit("details", payload);
    },
    [setGettingDetails]
  );

  const checkConnection = useCallback(() => {
    return !!socketRef.current?.connected;
  }, []);

  return useMemo(
    () => ({
      statusMessage,
      setStatusMessage,
      socketRef,
      workerRef,
      queryConfig,
      queryNodes,
      queryEdges,
      queryDetails,
      isConnected,
      checkConnection,
      queryLocalBins,
      valueChanged,
      connect,
      queryFile,
      getTreeData,
      getTreeFromEdges,
      search
    }),
    [
      connect,
      statusMessage,
      queryNodes,
      queryEdges,
      queryDetails,
      isConnected,
      checkConnection,
      queryConfig,
      queryLocalBins,
      valueChanged,
      queryFile,
      getTreeData,
      getTreeFromEdges,
      search
    ]
  );
}

export default useConnect;
