import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import websocketEvents from "../webworkers/websocketEvents";
import useLoraxConfig from "../globalconfig.js";
import workerSpec from "../webworkers/localBackendWorker.js?worker&inline";

const worker = new workerSpec();

let onQueryReceipt = (receivedData) => {};
let onStatusReceipt = (receivedData) => console.log("STATUS:", receivedData.data);
let onConfigReceipt = (receivedData) => {};
let onLocalBinsReceipt = (receivedData) => {};
let onDetailsReceipt = (receivedData) => {};
let onValueChangedReceipt = (receivedData) => {};

worker.onmessage = (event) => {
  if (event.data.type === "status") onStatusReceipt(event.data);
  if (event.data.type === "query") onQueryReceipt(event.data.data);
  if (event.data.type === "config") onConfigReceipt(event.data);
  if (event.data.type === "details") onDetailsReceipt(event.data.data);
  if (event.data.type === "local-bins") onLocalBinsReceipt(event.data);
  if (event.data.type === "value-changed") onValueChangedReceipt(event.data);
};

function useConnect({ setGettingDetails, settings }) {
  const socketRef = useRef(null);
  const messageQueue = useRef([]); // <-- buffer for unsent messages
  const [statusMessage, setStatusMessage] = useState({ message: null });
  const [isConnected, setIsConnected] = useState(false);

  const { WEBSOCKET_BASE } = useLoraxConfig();

  /** 🔑 Function: actually connect */
  const connect = useCallback(() => {
    console.log("connecting to websocket")
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      console.log("WebSocket already connected");
      return;
    }

    console.log("Connecting WebSocket to", WEBSOCKET_BASE);
    const ws = new WebSocket(WEBSOCKET_BASE);
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
        worker.postMessage({
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
      console.log("⚠️ WebSocket closed, retrying in 2s...");
      setIsConnected(false);
      socketRef.current = null;
      setTimeout(() => connect(), 2000); // retry
    };
  }, [WEBSOCKET_BASE, settings]);

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
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(msg);
    } else {
      console.log("Socket not open, queueing message:", msgObj);
      messageQueue.current.push(msg);
    }
  }, []);

  /** Start connection once on mount */
  useEffect(() => {
    connect();
    return () => {
      if (socketRef.current) socketRef.current.close();
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
  }, []);
  
  const queryConfig = useCallback((configData, globalBpPerUnit=null) => {

    return new Promise ((resolve) => {
      worker.postMessage({
        type: "config",
        data: configData,
        globalBpPerUnit: globalBpPerUnit,
      });

      onConfigReceipt = (receivedData) => {
        console.log("got query config result", receivedData);
        resolve(receivedData);
      };
    })
  }, []);

  
  const valueChanged = useCallback((value, setResult) => {

    worker.postMessage({
      type: "value-changed",
      data: value,
    });

    onValueChangedReceipt = (receivedData) => {
      console.log("valueChanged result", receivedData);
      setResult([receivedData.data.i0, receivedData.data.i1]);
    };

  })

  const queryLocalBins = useCallback((value, setResult) => {
    
    worker.postMessage({
      type: "local-bins",
      data: value,
    });

    onLocalBinsReceipt = (receivedData) => {
      setResult(receivedData.data.local_bins);
      
    };    
  }, []);

const queryExperimental = useCallback((value) => {

  worker.postMessage({
    type: "experimental",
    data: value,
  });
  
});

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
      console.log("got query result", receivedData);
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

    console.log("queryDetails", clickedObject)
    onDetailsReceipt = (receivedData) => {
      console.log("got details result", receivedData);
      setGettingDetails(false);
    };
  }, [sendMessage, setGettingDetails]);

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
    queryExperimental
  }), [statusMessage, queryNodes, queryDetails, isConnected, checkConnection, queryConfig, queryLocalBins, valueChanged, queryExperimental]);
}

export default useConnect;
