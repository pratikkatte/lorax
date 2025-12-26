import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { io } from "socket.io-client";
import websocketEvents from "../webworkers/websocketEvents";
import useLoraxConfig from "../globalconfig.js";
import workerSpec from "../webworkers/localBackendWorker.js?worker&inline";
import { initSession } from "../services/api.js";

function useConnect({ setGettingDetails, settings, statusMessage: providedStatusMessage, setStatusMessage: providedSetStatusMessage }) {
  const workerRef = useRef(null);
  const socketRef = useRef(null);
  const sidRef = useRef(null);
  const initSessionPromiseRef = useRef(null);
  
  // Move handlers inside hook using refs to avoid memory leaks
  // Each instance gets its own handlers that can be properly cleaned up
  const handlersRef = useRef({
    onQueryReceipt: () => {},
    onStatusReceipt: (data) => console.log("STATUS:", data.data),
    onConfigReceipt: () => {},
    onLocalBinsReceipt: () => {},
    onGetTreeDataReceipt: () => {},
    onDetailsReceipt: () => {},
    onValueChangedReceipt: () => {},
    onSearchResultReceipt: () => {}
  });

  const [localStatusMessage, setLocalStatusMessage] = useState({ message: null });

  const statusMessage = providedStatusMessage || localStatusMessage;
  const setStatusMessage = providedSetStatusMessage || setLocalStatusMessage;

  const [isConnected, setIsConnected] = useState(false);

  const { API_BASE, IS_PROD } = useLoraxConfig();

  const searchRequests = useRef(new Map());
  
  // Track if component is mounted for cleanup
  const isMountedRef = useRef(true);

  /** 🔑 Initialize session */
  const initializeSession = useCallback(() => {
    if (initSessionPromiseRef.current) {
      return initSessionPromiseRef.current;
    }

    initSessionPromiseRef.current = (async () => {
      try {
        const sid = await initSession(API_BASE);
        if (sid) {
          sidRef.current = sid;
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
  }, [API_BASE, settings, setGettingDetails]);

  /** 🔄 Worker setup when connected */
  useEffect(() => {
    let worker = null;
    if (isConnected) {
      worker = new workerSpec();
      workerRef.current = worker;

      worker.onmessage = (event) => {
        // Use handlers from ref to avoid stale closures
        const handlers = handlersRef.current;
        
        if (event.data.type === "status") handlers.onStatusReceipt(event.data);
        if (event.data.type === "query") handlers.onQueryReceipt(event.data.data);
        if (event.data.type === "config") handlers.onConfigReceipt(event.data);
        if (event.data.type === "details") handlers.onDetailsReceipt(event.data.data);
        if (event.data.type === "local-bins") handlers.onLocalBinsReceipt(event.data);
        if (event.data.type === "gettree") handlers.onGetTreeDataReceipt(event.data);
        if (event.data.type === "value-changed") handlers.onValueChangedReceipt(event.data);
        if (event.data.type === "search-result" || event.data.type === "search-nodes-result") {
          const { id, data } = event.data;
          const resolve = searchRequests.current.get(id);
          if (resolve) {
            resolve(data);
            searchRequests.current.delete(id);
          } else if (!id) {
            // Fallback for calls without ID (if any)
            handlers.onSearchResultReceipt(event.data);
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
    isMountedRef.current = true;
    initializeSession();

    return () => {
      isMountedRef.current = false;
      
      // Cleanup socket
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setIsConnected(false);
      
      // Cleanup pending search requests to prevent memory leaks
      // Reject any pending promises so they don't hold references
      searchRequests.current.forEach((resolve, id) => {
        // Resolve with null to indicate cancellation
        resolve(null);
      });
      searchRequests.current.clear();
      
      // Reset handlers to no-ops
      handlersRef.current = {
        onQueryReceipt: () => {},
        onStatusReceipt: () => {},
        onConfigReceipt: () => {},
        onLocalBinsReceipt: () => {},
        onGetTreeDataReceipt: () => {},
        onDetailsReceipt: () => {},
        onValueChangedReceipt: () => {},
        onSearchResultReceipt: () => {}
      };
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
  const getTreeData = useCallback((global_index, precision) => {
    return new Promise((resolve) => {
      if (!isMountedRef.current) {
        resolve(null);
        return;
      }
      
      workerRef.current?.postMessage({
        type: "gettree",
        global_index,
        precision,
      });

      handlersRef.current.onGetTreeDataReceipt = (receivedData) => {
        if (isMountedRef.current) {
          resolve(receivedData.data);
        }
      };
    });
  }, []);

  const search = useCallback((term, terms = [], options = {}) => {
    return new Promise((resolve) => {
      if (!isMountedRef.current) {
        resolve(null);
        return;
      }
      
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
      if (!isMountedRef.current) {
        resolve(null);
        return;
      }
      
      workerRef.current?.postMessage({
        type: "config",
        data: configData,
        globalBpPerUnit: globalBpPerUnit,
      });
      // Config doesn't need a response handler
      resolve();
    });
  }, []);

  const valueChanged = useCallback((value, setResult) => {
    if (!isMountedRef.current) return;
    
    workerRef.current?.postMessage({
      type: "value-changed",
      data: value,
    });

    handlersRef.current.onValueChangedReceipt = (receivedData) => {
      if (isMountedRef.current) {
        setResult([receivedData.data.i0, receivedData.data.i1]);
      }
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
   * @param {number} displayOptions.maxVisibleTrees - Maximum visible trees
   * @param {number|null} displayOptions.fixedVisualWidth - Fixed width for all trees
   */
  const queryLocalBins = useCallback(
    (start, end, globalBpPerUnit, nTrees, new_globalBp, regionWidth = null, displayOptions = {}) => {
      return new Promise((resolve) => {
        if (!isMountedRef.current) {
          resolve({ local_bins: new Map(), lower_bound: 0, upper_bound: 0, displayArray: [] });
          return;
        }
        
        workerRef.current?.postMessage({
          type: "local-bins",
          data: { 
            start, 
            end, 
            globalBpPerUnit, 
            nTrees, 
            new_globalBp, 
            regionWidth,
            // Include display options in the message
            selectionStrategy: displayOptions.selectionStrategy || 'largestSpan',
            maxVisibleTrees: displayOptions.maxVisibleTrees || 50,
            fixedVisualWidth: displayOptions.fixedVisualWidth || null
          },
        });

        handlersRef.current.onLocalBinsReceipt = (receivedData) => {
          if (isMountedRef.current) {
            resolve(receivedData.data);
          }
        };
      });
    },
    []
  );

  const queryNodes = useCallback(
    (value, localTrees) => {
      return new Promise((resolve) => {
        if (!isMountedRef.current) {
          resolve(null);
          return;
        }
        
        socketRef.current?.emit("query", { value, localTrees, lorax_sid: sidRef.current });

        handlersRef.current.onQueryReceipt = (receivedData) => {
          if (isMountedRef.current) {
            resolve(receivedData);
          }
        };
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

  // Memoize return object - only include values that actually change
  // Note: callbacks are stable (empty deps), refs don't need to be tracked
  return useMemo(
    () => ({
      statusMessage,
      setStatusMessage,
      socketRef,
      queryConfig,
      queryNodes,
      queryDetails,
      isConnected,
      checkConnection,
      queryLocalBins,
      valueChanged,
      connect,
      queryFile,
      getTreeData,
      search
    }),
    [
      statusMessage,
      isConnected,
      // All callbacks below have empty deps, so they're stable
      // but including them is fine for completeness
      connect,
      queryNodes,
      queryDetails,
      checkConnection,
      queryConfig,
      queryLocalBins,
      valueChanged,
      queryFile,
      getTreeData,
      search
    ]
  );
}

export default useConnect;
