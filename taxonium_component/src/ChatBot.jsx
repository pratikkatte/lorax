import React, { useState, useEffect, useRef, useCallback } from "react";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperclip, faSpinner } from '@fortawesome/free-solid-svg-icons';
import "./Chatbot.css"; 
import FileUploadInput from './components/FileUploadInput';
import websocketEvents from './webworkers/websocketEvents';


const API_BASE_URL = "http://localhost:8000";


function Chatbot(props) {

  const {backend, userName} = props;

  const {socketRef, isConnected} = backend;

  const [userInput, setUserInput] = useState("");
  const [conversation, setConversation] = useState([]);

  const chatContentRef = useRef(null);
  const lastAssistantMessageRef = useRef(null);

  const handleUserInput = (event) => {
    setUserInput(event.target.value);
  };
  
  const handleChat = useCallback((data) => {
    const assistantResponse = data.data;
    setConversation((prevConversation) => [
      ...prevConversation,
      { role: "assistant", content: assistantResponse, hidden: true },
    ]);
    lastAssistantMessageRef.current.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { 
    console.log("useEffect chat handle twice")
    websocketEvents.on("chat", handleChat);
    
    // Cleanup function to remove the event listener
    return () => {
      websocketEvents.off("chat", handleChat);
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const sentMessage = { role: "user", content: userInput, hidden: false };
    // sent text to the conversation immediately
    setConversation((prevConversation) => [...prevConversation, sentMessage]);
    // Clear the input field
    setUserInput("");
    
    if (isConnected) {
      socketRef.current.send(JSON.stringify({ type: "chat", message: userInput, role: "user"}));
    } else {
      console.log("WebSocket is not connected. Message not sent.");
      setConversation(prev => [...prev, {
        role: "assistant",
        content: "Unable to send message. Please check your connection.",
        hidden: false
      }]);
    }
  };

  const handleClearChat = async () => {
    try {
      await axios.post(`${API_BASE_URL}/api/clear_chat`);
      setConversation([
        {
          role: "assistant",
          content: `Hello ${props.userName}, how can I help you?`,
          hidden: true,
        },
      ]);
      // Force a re-render of the visualization component
      const visualizationContainer = document.querySelector('.visualization-container');
      if (visualizationContainer) {
        visualizationContainer.innerHTML = '';
      }
    } catch (error) {
      console.error("Error clearing chat:", error);
    }
  };

  const handleCloseChat = () => {
    // Call the onClose prop if it exists, otherwise just log
    props.setIsChatbotVisible(false);
    console.log("Close chat requested");
  };

  // Use useEffect to trigger the fade-in effect
  useEffect(() => {
    const messages = document.querySelectorAll(".chat-bubble");

    messages.forEach((message, index) => {
      // Use a timeout to stagger the animations
      setTimeout(() => {
        message.style.opacity = 1; // Set opacity to 1 to trigger the fade-in effect
      }, index * 100); 
    });
  }, [conversation]);

  useEffect(() => {
    setConversation([
      ...conversation,
      {
        role: "assistant",
        content: `Hello ${props.userName}, how can I help you?`,
        hidden: true,
      },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="chat-container">
      <div className="chat-header">
        <div className="close-button" onClick={handleCloseChat}>
          ✕
        </div>
        <div className="chat-title">Tree-Sequence Analysis</div>
        <div className="header-buttons">
          <div className="clear-button" onClick={handleClearChat}>
            New Chat
          </div>
        </div>
      </div>
      {!isConnected && (
        <div className="connection-status">
          Disconnected - Waiting for connection...
        </div>
      )}
      {/* Attach the ref to the chat content */}
      <div ref={chatContentRef} className="chat-content">
        {conversation.map((message, index) => (
          <div 
            key={index}
            className={`chat-bubble ${
              message.role === "user" ? "user-bubble" : "assistant-bubble"
            }`}
            style={{ opacity: message.hidden ? 0 : 1 , whiteSpace: "pre-wrap"}} 
          >
            {message.role === "user" && (
              <div className="message-label">User</div>
            )}
            {message.role === "assistant" && (
              <div
                className="message-label"
                ref={message.role === "assistant" ? lastAssistantMessageRef : null} // Set ref for the last assistant message
              >
                AI
              </div>
            )}
            {message.content}
          </div>
        ))}
        </div>
        <div ref={lastAssistantMessageRef}></div>
        <FileUploadInput config={props.config} setConfig={props.setConfig}/>

      <form onSubmit={handleSubmit} className="chat-input-container">
        <input
          type="text"
          value={userInput}
          onChange={handleUserInput}
          placeholder="Type your query..."
          className="chat-input"
        />
        <button type="submit" className="send-button">
          Send
        </button>
      </form>
    </div>
  );
}

export default Chatbot;