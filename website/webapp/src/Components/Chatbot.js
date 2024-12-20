import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperclip } from '@fortawesome/free-solid-svg-icons';
import "./Chatbot.css"; 

const API_BASE_URL = "http://127.0.0.1:5001";


function Chatbot(props) {
  const [userInput, setUserInput] = useState("");
  const [conversation, setConversation] = useState([]);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);



  const chatContentRef = useRef(null);

  const lastAssistantMessageRef = useRef(null);

  const handleUserInput = (event) => {
    setUserInput(event.target.value);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const sentMessage = { role: "user", content: userInput, hidden: false };

    // sent text to the conversation immediately
    setConversation((prevConversation) => [...prevConversation, sentMessage]);

    // Clear the input field
    setUserInput("");

    const response = await axios.post(`${API_BASE_URL}/api/chat`, {
      message: userInput,
    },
    {
      headers: {
          'Content-Type': 'application/json'
      }
  });

    const assistantResponse = response.data.response;

    // Update the conversation with the sent message and assistant's response
    setConversation((prevConversation) => [
      ...prevConversation,
      { role: "assistant", content: assistantResponse, hidden: true },
    ]);

    // Scroll to the last assistant message

    lastAssistantMessageRef.current.scrollIntoView({ behavior: "smooth" });
  };

  const handleClearChat = async () => {

    try {
      await axios.post(`${API_BASE_URL}/clear_chat`);
      console.log("Chat cleared");
      setConversation([
        {
          role: "assistant",
          content: `Hello ${props.userName}, how can I help you?`,
          hidden: true,
        },
      ]);
    } catch (error) {
      console.error("Error clearing chat:", error);
    }
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

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (file) {
        setSelectedFile(file);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await axios.post(`${API_BASE_URL}/upload`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            console.log('File uploaded successfully:', response.data);
        } catch (error) {
            console.error('Error uploading file:', error);
        }

        setSelectedFileName(file.name);
        console.log('Selected file:', file.name);

        // You can add further logic to handle the file upload here
    }
  };
  const handleFileRemove = (event) => {
    console.log("remove file")
    setSelectedFileName("");
  }

  return (
    <div className="chat-container">
      <div className="chat-header">
        <div className="chat-title">Tree-Sequence Analysis</div>
        <div className="clear-button" onClick={handleClearChat}>
          New Chat
        </div>
      </div>
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
        <div className="attachment">
            {
            selectedFileName ? (
                <div className="file-display">
                    <span className="file-name">{selectedFileName}</span>
                    <button className="remove-file" onClick={handleFileRemove}>
                        <span>x</span>
                    </button>
                </div>
            ) : (
                <button className="upload-file" type="button" onClick={() => document.getElementById('fileInput').click()}>
                    <FontAwesomeIcon icon={faPaperclip} /> 
                    Attach File
                </button>
            )}
            <input
                id="fileInput"
                type="file"
                style={{ display: 'none' }}
                onChange={handleFileChange}
            />
        </div>

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
