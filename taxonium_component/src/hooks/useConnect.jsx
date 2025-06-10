import { useEffect, useRef, useState } from "react";
import websocketEvents from '../webworkers/websocketEvents';

function useConnect() {
  const socketRef = useRef(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const ws = new WebSocket("ws://localhost:8000/ws");
      socketRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket connection established");
      };

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        console.log("message", message);
        websocketEvents.emit(message.type, message);
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      ws.onclose = () => {
        console.log("WebSocket connection closed");
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
    }, 30000);

    return () => clearInterval(pingInterval);
  }, []);

  return socketRef;
}

export default useConnect;
