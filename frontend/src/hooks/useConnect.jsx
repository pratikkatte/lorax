import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { io } from "socket.io-client";
import websocketEvents from "../webworkers/websocketEvents";
import useLoraxConfig from "../globalconfig.js";
import workerSpec from "../webworkers/localBackendWorker.js?worker&inline";
import axios from "axios";

// Keep old handlers for worker communication
let onQueryReceipt = (receivedData) => {};
let onStatusReceipt = (receivedData) => console.log("STATUS:", receivedData.data);
let onConfigReceipt = (receivedData) => {};
let onLocalBinsReceipt = (receivedData) => {};
let onDetailsReceipt = (receivedData) => {};
let onValueChangedReceipt = (receivedData) => {};

function useConnect({ setGettingDetails, settings }) {
  const workerRef = useRef(null);
  const socketRef = useRef(null);
  const sidRef = useRef(null);
  const [statusMessage, setStatusMessage] = useState({ message: null });
  const [isConnected, setIsConnected] = useState(false);

  const { API_BASE, IS_PROD } = useLoraxConfig();

  /** 🔑 Initialize session */
  const initSession = useCallback(async () => {
    try {
      const response = await axios.post(
        `${API_BASE}/init-session`,
        {},
        {
          withCredentials: true,
          headers: { "Content-Type": "application/json" },
        }
      );

      const sid = response?.data?.sid;
      if (sid) {
        sidRef.current = sid;
        console.log("Session initialized:", sid);
        connect(sid); // connect socket.io after session init
      } else {
        console.warn("No SID received during session init");
      }
    } catch (error) {
      console.error("Error initializing session:", error);
    }
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

    console.log(`Connecting Socket.IO to host: ${host} with path: ${path}`);
    const socket = io(host, {
      transports: ["websocket"],
      withCredentials: true,
      // query: { sid },
      path: IS_PROD ? path : "/socket.io/",
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
      console.log("query-result", message);
      workerRef.current?.postMessage({
        type: "query",
        data: message.data,
        vertical_mode: settings.vertical_mode,
      });
    });

    socket.on("details-result", (message) => {
      console.log("details-result", message);
      setGettingDetails(false);
    });

    socket.on("pong", (msg) => {
      console.log("pong", msg);
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
        if (event.data.type === "value-changed")
          onValueChangedReceipt(event.data);
      };
    }

    return () => {
      worker?.terminate();
      workerRef.current = null;
    };
  }, [isConnected]);

  /** 🔑 Initialize once and cleanup properly */
  useEffect(() => {
    initSession();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setIsConnected(false);
    };
  }, [initSession]);

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
    (start, end, globalBpPerUnit, nTrees, new_globalBp) => {
      return new Promise((resolve) => {
        workerRef.current?.postMessage({
          type: "local-bins",
          data: { start, end, globalBpPerUnit, nTrees, new_globalBp },
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
      console.log("queryNodes", value, localTrees);
      return new Promise((resolve) => {
        socketRef.current?.emit("query", { value, localTrees, lorax_sid: sidRef.current });

        onQueryReceipt = (receivedData) => {
          console.log("query", receivedData);
          resolve(receivedData);
        }
      });
    },[]);

    const queryFile = useCallback((payload) => {
      console.log("queryFile", payload);
      return new Promise((resolve, reject) => {
        if (!socketRef.current) {
          reject(new Error("Socket not connected"));
          return;
        }
    
        const handleResult = (message) => {
          console.log("📦 Received load-file-result:", message);
          socketRef.current.off("load-file-result", handleResult); // cleanup listener
          resolve(message);
        };
    
        socketRef.current.once("load-file-result", handleResult);
    
        socketRef.current.emit("load_file", { ...payload, lorax_sid: sidRef.current });
      });
    }, []);

  const queryDetails = useCallback(
    (clickedObject) => {
      setGettingDetails(true);
      socketRef.current?.emit("details", clickedObject);
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
      queryFile
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
      queryFile
    ]
  );
}

export default useConnect;
