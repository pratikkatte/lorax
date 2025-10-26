import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import websocketEvents from "../webworkers/websocketEvents";
import useLoraxConfig from "../globalconfig.js";
import workerSpec from "../webworkers/localBackendWorker.js?worker&inline";
import axios from "axios";

// const worker = new workerSpec();

let onQueryReceipt = (receivedData) => {};
let onStatusReceipt = (receivedData) => console.log("STATUS:", receivedData.data);
let onConfigReceipt = (receivedData) => {};
let onLocalBinsReceipt = (receivedData) => {};
let onDetailsReceipt = (receivedData) => {};
let onValueChangedReceipt = (receivedData) => {};



/** Utility: extract lorax_sid cookie for same-session WS */
function getCookie(name) {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? match[2] : null;
}

function useConnect({ setGettingDetails, settings }) {

  const workerRef = useRef(null);
  const socketRef = useRef(null);
  const messageQueue = useRef([]); // <-- buffer for unsent messages
  const [statusMessage, setStatusMessage] = useState({ message: null });
  const [isConnected, setIsConnected] = useState(false);

  const { WEBSOCKET_BASE, API_BASE } = useLoraxConfig();

    /** Build the correct WebSocket URL (with sid if needed) */
    const getWebSocketURL = useCallback((sid) => {
      // const sid = getCookie("lorax_sid");
      // if backend & frontend share domain, cookie auto-sent — no need for sid
    

      const url = new URL(WEBSOCKET_BASE, window.location.origin);
      if (sid && !WEBSOCKET_BASE.includes("localhost")) {
        // same-origin deployment: just use WEBSOCKET_BASE
        return WEBSOCKET_BASE;
      }
      // otherwise append sid explicitly for cross-origin dev
      return `${WEBSOCKET_BASE}?sid=${sid ?? ""}`;
    }, [WEBSOCKET_BASE]);


  /** 🔑 Function: actually connect */
  const connect = useCallback((sid) => {
    if (
      socketRef.current &&
      (socketRef.current.readyState === WebSocket.OPEN ||
        socketRef.current.readyState === WebSocket.CONNECTING)
    ) {
      console.log("WebSocket already connected");
      return;
    }

    const wsURL = getWebSocketURL(sid);
    console.log("Connecting WebSocket to", wsURL);

    const ws = new WebSocket(wsURL);
    socketRef.current = ws;

    ws.onopen = () => {
      console.log("✅ WebSocket connected");
      setIsConnected(true);
      flushQueue(); // send any queued messages
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      websocketEvents.emit(message.type, message);

      if (message.type === "viz" && message.role === "query-result") {
        workerRef.current.postMessage({
          type: "query",
          data: message.data,
          vertical_mode: settings.vertical_mode,
        });
      }
    };

    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
      setIsConnected(false);
    };

    ws.onclose = () => {
      console.log("⚠️ WebSocket closed");
      setIsConnected(false);
      socketRef.current = null;

    // Try reconnecting after a short delay
    setTimeout(() => {
      if (!socketRef.current) {
        console.log("Attempting to reconnect WebSocket...");
        connect(); 
      }
    }, 2000);
    };
  }, [getWebSocketURL, settings]);

  /** 🔑 Flush queued messages once reconnected */
  const flushQueue = useCallback(() => {
    while (messageQueue.current.length > 0 && socketRef.current?.readyState === WebSocket.OPEN) {
      const msg = messageQueue.current.shift();
      console.log("Flushing queued message:", msg);
      socketRef.current.send(msg);
    }
  }, []);

  /** 🔑 Safe send with queue fallback */
  const sendMessage = useCallback((msgObj) => {
    const msg = JSON.stringify(msgObj);
    if (socketRef.current?.readyState == WebSocket.OPEN) {
      socketRef.current.send(msg);
    } else {
      console.log("Socket not open, queueing message:", msgObj);
      // messageQueue.current.push(msg);
    }
  }, []);



    const initSession = useCallback(() => {
      try {
        return axios.post(
          `${API_BASE}/init-session`,
          {}, 
          {
            withCredentials: true,
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
      } catch (error) {
        console.error("Error initializing session:", error);
        return null;
      }
    }, [API_BASE]);


    useEffect(() => {
      let isMounted = true; // avoid setting state if unmounted
    
      const initializeAndConnect = async () => {
        try {
          const response = await initSession();
    
          // Axios response structure: { data: { sid: "..." }, ... }
          const sid = response?.data?.sid;
    
          if (sid && isMounted) {
            console.log("Session initialized:", sid);
            connect(sid); // ✅ start websocket with sid
          } else {
            console.warn("No SID received during session init");
          }
        } catch (error) {
          console.error("Error initializing session:", error);
        }
      };
    
      initializeAndConnect();

    const worker = new workerSpec();
    workerRef.current = worker;

    worker.onmessage = (event) => {
      if (event.data.type === "status") onStatusReceipt(event.data);
      if (event.data.type === "query") onQueryReceipt(event.data.data);
      if (event.data.type === "config") onConfigReceipt(event.data);
      if (event.data.type === "details") onDetailsReceipt(event.data.data);
      if (event.data.type === "local-bins") onLocalBinsReceipt(event.data);
      if (event.data.type === "value-changed") onValueChangedReceipt(event.data);
    };

    return () => {
      isMounted = false;
      if (socketRef.current) {
        
        socketRef.current.close()
        console.log("worker terminating");
        worker.terminate();
        workerRef.current = null;
        socketRef.current = null;

        setIsConnected(false);
      };
    };
  }, [connect]);

  /** Keep-alive pings */
  useEffect(() => {
    const pingInterval = setInterval(() => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: "ping" }));
      }
    }, 3000);
    return () => clearInterval(pingInterval);
  }, [socketRef.current]);
  
  const queryConfig = useCallback((configData, globalBpPerUnit=null) => {

    return new Promise ((resolve) => {
      workerRef.current.postMessage({
        type: "config",
        data: configData,
        globalBpPerUnit: globalBpPerUnit,
      });

      // onConfigReceipt = (receivedData) => {
      //   console.log("got query config result", receivedData);
      //   resolve(receivedData);
      // };
    })
  }, []);

  
  const valueChanged = useCallback((value, setResult) => {

    workerRef.current.postMessage({
      type: "value-changed",
      data: value,
    });

    onValueChangedReceipt = (receivedData) => {
      console.log("valueChanged result", receivedData);
      setResult([receivedData.data.i0, receivedData.data.i1]);
    };

  })

  const queryLocalBins = useCallback((start, end, localBins, globalBpPerUnit, nTrees, new_globalBp) => {
    return new Promise((resolve) => {
    
    workerRef.current.postMessage({
      type: "local-bins",
      data: {start, end,localBins, globalBpPerUnit, nTrees, new_globalBp},
    });

    onLocalBinsReceipt = (receivedData) => {
      // console.log("got queryLocalBins result", receivedData);
      resolve(receivedData.data);
      
    };    
  });
  }, []);

const queryNodes = useCallback((value, localTrees) => {
  return new Promise((resolve) => {
    sendMessage({
      type: "viz",
      role: "query",
      bounds: null,
      localTrees,
      value
    });

    onQueryReceipt = (receivedData) => {
      // console.log("got query result", receivedData);
      resolve(receivedData);
    };
  });
}, [sendMessage]);

  const queryDetails = useCallback((clickedObject) => {
    sendMessage({
      type: "viz",
      role: "details",
      object: clickedObject,
    });
    setGettingDetails(true);

    // console.log("queryDetails", clickedObject)
    onDetailsReceipt = (receivedData) => {
      // console.log("got details result", receivedData);
      setGettingDetails(false);
    };
  }, [sendMessage]);

  const checkConnection = useCallback(() => {
    return socketRef.current?.readyState === WebSocket.OPEN;
  }, []);

  return useMemo(() => ({
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
  }), [connect, statusMessage, queryNodes, queryDetails, isConnected, checkConnection, queryConfig, queryLocalBins, valueChanged]);
}

export default useConnect;
