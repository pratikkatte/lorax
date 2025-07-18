import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import websocketEvents from '../webworkers/websocketEvents';
import useLoraxConfig from "../globalconfig.js";
import workerSpec from "../webworkers/localBackendWorker.js?worker&inline";
const worker = new workerSpec();

console.log("useConnect worker")

let onQueryReceipt = (receivedData) => {};
let onStatusReceipt = (receivedData) => {
  console.log("STATUS:", receivedData.data);
};

let onConfigReceipt = (receivedData) => {};
let onDetailsReceipt = (receivedData) => {};
// let onListReceipt = (receivedData) => {};


worker.onmessage = (event) => {
  console.log(
    "got message from worker");
    
  if (event.data.type === "status") {
    
    onStatusReceipt(event.data);
  }
  if (event.data.type === "query") {
    onQueryReceipt(event.data.data);
  }

  // if (event.data.type === "search") {
  //   // console.log("SEARCHRES", event.data.data);
  //   searchSetters[event.data.data.key](event.data.data);
  // }
  if (event.data.type === "config") {
    onConfigReceipt(event.data.data);
  }
  if (event.data.type === "details") {
    onDetailsReceipt(event.data.data);
  }
  // if (event.data.type === "list") {
  //   onListReceipt(event.data.data);
  // }
  // if (event.data.type === "nextstrain") {
  //   onNextStrainReceipt(event.data.data);
  // }
};



function useConnect({setGettingDetails, API_BASE}) {
  const socketRef = useRef(null);
  const [statusMessage, setStatusMessage] = useState({ message: null });
  const [isConnected, setIsConnected] = useState(false);

  const {WEBSOCKET_BASE} = useLoraxConfig();
  
  console.log("WEBSOCKET_BASE", WEBSOCKET_BASE);
  useEffect(() => {
    const timeout = setTimeout(() => {
      const ws = new WebSocket(WEBSOCKET_BASE);
      socketRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket connection established");
        setIsConnected(true);
      };

      ws.onmessage = ((event) => {
        const message = JSON.parse(event.data);
        console.log("message", message)
        websocketEvents.emit(message.type, message);
        
        if (message.type === "viz" && message.role === "query-result") {
          worker.postMessage({
            type: "query",
            data: message.data,
          });
        }
      });

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setIsConnected(false);
      };

      ws.onclose = () => {
        console.log("WebSocket connection closed");
        setIsConnected(false);
      };
    }, 500);

    return () => {
      clearTimeout(timeout);
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    const pingInterval = setInterval(() => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: "ping" }));
      }
    }, 3000);

    return () => clearInterval(pingInterval);
  }, []);

  const queryNodes = useCallback(
    async (boundsForQueries, setResult, value) => {
      console.log("queryNodes", boundsForQueries, value);

      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: "viz",
        role: "query",
        bounds: boundsForQueries,
        value: value,
      }))
    } else {
      console.log("socket not open")
    }

      onQueryReceipt = (receivedData) => {
        console.log(
          "got query result" //, receivedData
        );
        setResult(receivedData);
      };
    },
    []
  );

  const queryDetails = useCallback(
    async (clickedObject) => {
      console.log("details", clickedObject)
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          type: "viz",
          role: "details",
          object: clickedObject,
        }))
        setGettingDetails(true);
    }
    
    onDetailsReceipt = (receivedData) => {
      console.log("got details result", receivedData)
    };
  }, []);

  return useMemo(() => {
    return {
      statusMessage,
      setStatusMessage,
      socketRef,
      queryNodes,
      isConnected,
      queryDetails,
    };
  }, [statusMessage,
    setStatusMessage,
    socketRef,
    queryNodes,
    isConnected,
    queryDetails
  ]);

  // return socketRef;
}

export default useConnect;
