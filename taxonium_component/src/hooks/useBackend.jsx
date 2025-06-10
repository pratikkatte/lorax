import { useEffect, useRef } from "react";
import useServerBackend from "./useServerBackend";
import useLocalBackend from "./useLocalBackend";

function useBackend(uploaded_data, setChangeInProcess, setFileUploaded, flag)  {
  const localBackend = useLocalBackend(uploaded_data, setChangeInProcess, setFileUploaded);

  if (uploaded_data) {
    return localBackend;
  } else {
    window.alert("TreeSeqBrowse did not receive the information it needed to launch.");
    return null;
  }

  const socketRef = useRef(null)


  useEffect(() => {
    if (flag) {
    socketRef.current = new WebSocket('ws://localhost:8000/ws')

    socketRef.current.onopen = () => {
      console.log('WebSocket connection established')
    }

    socketRef.current.onmessage = (event) => {
      const message = JSON.parse(event.data)
      setMessages((prev) => [...prev, message])
    }

    socketRef.current.onerror = (error) => {
      console.error('WebSocket error:', error)
    }

    socketRef.current.onclose = () => {
      console.log('WebSocket connection closed')
    }

    return () => {
      socketRef.current.close()
    }
    }
  }, [])

  useEffect(() => {
    if (flag) {
    const pingInterval = setInterval(() => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: "ping" }))
      }
    }, 30000) // send ping every 30 seconds
  
    return () => clearInterval(pingInterval)
  }
  }, [])

    useEffect(() => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: "ping" }))
      }
    }, 30000) // send ping every 30 seconds
  if(flag){
    return socketRef
  }
  
}
export default useBackend;
