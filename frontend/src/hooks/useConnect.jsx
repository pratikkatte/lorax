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
      setStatusMessage({ message: "Connected" });
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
  const getTreeData = useCallback((global_index, precision) => {
    return new Promise((resolve) => {
      workerRef.current?.postMessage({
        type: "gettree",
        global_index,
        precision,
      });

      onGetTreeDataReceipt = (receivedData) => {
        resolve(receivedData.data);
      };
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

  const queryLocalBins = useCallback(
    (start, end, globalBpPerUnit, nTrees, new_globalBp, regionWidth = null) => {

      return new Promise((resolve) => {
        workerRef.current?.postMessage({
          type: "local-bins",
          data: { start, end, globalBpPerUnit, nTrees, new_globalBp, regionWidth },
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
      getTreeData,
      search
    }),
    [
      connect,
      statusMessage,
      queryNodes,
      queryDetails,
      isConnected,
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
