import React, { useState, useEffect, useRef, useCallback } from "react";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperclip, faSpinner } from '@fortawesome/free-solid-svg-icons';
import "./Chatbot.css"; 
import FileUploadInput from './components/FileUploadInput';
import websocketEvents from './webworkers/websocketEvents';


const API_BASE_URL = "http://localhost:8000";

// Utility function to format chat messages
const formatChatMessage = (message) => {
  console.log("Raw message received:", message, typeof message);
  
  if (typeof message !== 'string') {
    console.log("Converting non-string message to string");
    return String(message);
  }
  
  // Try to parse as JSON first (in case it's a JSON string)
  try {
    const parsed = JSON.parse(message);
    console.log("Successfully parsed as JSON:", parsed);
    if (typeof parsed === 'string') {
      return parsed;
    }
    // If it's an object, try to extract the content
    if (parsed && typeof parsed === 'object') {
      const content = parsed.content || parsed.data || parsed.message || JSON.stringify(parsed);
      console.log("Extracted content from JSON object:", content);
      return content;
    }
  } catch (e) {
    console.log("Not JSON, treating as plain string");
  }
  
  // Handle common escape sequences and formatting
  const formatted = message
    .replace(/\\n/g, '\n')  // Convert \n to actual newlines
    .replace(/\\t/g, '\t')  // Convert \t to actual tabs
    .replace(/\\"/g, '"')   // Convert \" to actual quotes
    .replace(/\\'/g, "'")   // Convert \' to actual single quotes
    .trim();                // Remove leading/trailing whitespace
  
  console.log("Final formatted message:", formatted);
  return formatted;
};

function Chatbot(props) {

  const {backend, userName, chatbotEnabled, setChatbotEnabled, selectedFileName, setSelectedFileName} = props;

  const {socketRef, isConnected} = backend;

  const [userInput, setUserInput] = useState("");
  const [conversation, setConversation] = useState([]);
  const [waitingForResponse, setWaitingForResponse] = useState(false);

  const chatContentRef = useRef(null);
  const lastAssistantMessageRef = useRef(null);

  const handleUserInput = (event) => {
    setUserInput(event.target.value);
  };
  
  const handleChat = useCallback((data) => {
    const assistantResponse = formatChatMessage(data.data);
    console.log("Formatted chat response:", assistantResponse);
    setConversation((prevConversation) => [
      ...prevConversation,
      { role: "assistant", content: assistantResponse, hidden: true },
    ]);
    setWaitingForResponse(false);
    
    lastAssistantMessageRef.current.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { 
    if (chatbotEnabled) {
    console.log("useEffect chat handle twice")
    websocketEvents.on("chat", handleChat);
    
    // Cleanup function to remove the event listener
    return () => {
      websocketEvents.off("chat", handleChat);
    };
  }
  }, [chatbotEnabled, handleChat]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const sentMessage = { role: "user", content: userInput, hidden: false };
    // sent text to the conversation immediately
    setConversation((prevConversation) => [...prevConversation, sentMessage]);
    // Clear the input field
    setUserInput("");
    
    if (isConnected) {
      socketRef.current.send(JSON.stringify({ type: "chat", message: userInput, role: "user"}));
      setWaitingForResponse(true);
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
    if (chatbotEnabled) {
    setConversation([
      ...conversation,
      {
        role: "assistant",
        content: `Hello ${props.userName}, how can I help you?`,
        hidden: true,
      },
    ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatbotEnabled]);

  return (
    <div className="chat-container">
      {!chatbotEnabled ? (
        <div style={{ textAlign: 'center', marginTop: '10%'}}>
          <button 
            onClick={() => setChatbotEnabled(true)}
            style={{
              padding: '10px 20px',
              borderRadius: '5px',
              backgroundColor: '#0a3d62',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
            }}
          >
            Enable Chat
          </button>
        </div>
      ) : (
        <>
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
            style={{ opacity: message.hidden ? 0 : 1 }} 
          >
            {message.role === "user" && (
              <div className="message-label user-icon">
                <svg 
                  width="20" 
                  height="20" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path 
                    d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" 
                    fill="currentColor"
                  />
                </svg>
                <span>You</span>
              </div>
            )}
            {message.role === "assistant" && (
              <div
                className="message-label ai-icon"
                ref={message.role === "assistant" ? lastAssistantMessageRef : null}
              >
                <svg 
                  width="20" 
                  height="20" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path 
                    d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1H5C3.9 1 3 1.9 3 3V21C3 22.1 3.9 23 5 23H19C20.1 23 21 22.1 21 21V9ZM19 21H5V3H13V9H19V21Z" 
                    fill="currentColor"
                  />
                  <path 
                    d="M8 12C8 13.1 7.1 14 6 14C4.9 14 4 13.1 4 12C4 10.9 4.9 10 6 10C7.1 10 8 10.9 8 12Z" 
                    fill="currentColor"
                  />
                  <path 
                    d="M20 12C20 13.1 19.1 14 18 14C16.9 14 16 13.1 16 12C16 10.9 16.9 10 18 10C19.1 10 20 10.9 20 12Z" 
                    fill="currentColor"
                  />
                  <path 
                    d="M14 16C14 17.1 13.1 18 12 18C10.9 18 10 17.1 10 16C10 14.9 10.9 14 12 14C13.1 14 14 14.9 14 16Z" 
                    fill="currentColor"
                  />
                </svg>
                <span>AI Assistant</span>
              </div>
            )}
            <div 
              className="message-content"
              style={{ 
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                lineHeight: "1.5"
              }}
            >
              {message.content}
            </div>
          </div>
        ))}
        
        {/* Thinking indicator */}
        {waitingForResponse && (
          <div className="chat-bubble assistant-bubble thinking-bubble">
            <div className="message-label ai-icon">
              <svg 
                width="20" 
                height="20" 
                viewBox="0 0 24 24" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path 
                  d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1H5C3.9 1 3 1.9 3 3V21C3 22.1 3.9 23 5 23H19C20.1 23 21 22.1 21 21V9ZM19 21H5V3H13V9H19V21Z" 
                  fill="currentColor"
                />
                <path 
                  d="M8 12C8 13.1 7.1 14 6 14C4.9 14 4 13.1 4 12C4 10.9 4.9 10 6 10C7.1 10 8 10.9 8 12Z" 
                  fill="currentColor"
                />
                <path 
                  d="M20 12C20 13.1 19.1 14 18 14C16.9 14 16 13.1 16 12C16 10.9 16.9 10 18 10C19.1 10 20 10.9 20 12Z" 
                  fill="currentColor"
                />
                <path 
                  d="M14 16C14 17.1 13.1 18 12 18C10.9 18 10 17.1 10 16C10 14.9 10.9 14 12 14C13.1 14 14 14.9 14 16Z" 
                  fill="currentColor"
                />
              </svg>
              <span>AI Assistant</span>
            </div>
            <div className="message-content thinking-content">
              <span>AI is thinking</span>
              <span className="thinking-dots">
                <span className="dot">.</span>
                <span className="dot">.</span>
                <span className="dot">.</span>
              </span>
            </div>
          </div>
        )}
        </div>
        <div ref={lastAssistantMessageRef}></div>
        <FileUploadInput config={props.config} setConfig={props.setConfig} selectedFileName={selectedFileName} setSelectedFileName={setSelectedFileName}/>

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
        </>
      )}
    </div>
  );
}

export default Chatbot;