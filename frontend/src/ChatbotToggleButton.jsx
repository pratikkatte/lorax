import React from 'react';

export const ChatbotCloseButton = ({ onClick }) => (
  <button
    onClick={onClick}
    className="absolute top-2 right-2 border border-gray-400 bg-white hover:bg-gray-100 rounded p-2 shadow flex items-center justify-center w-8 h-8"
    aria-label="Closed Chatbot"
  >
    
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  </button>
);

export const ChatbotOpenButton = ({ onClick }) => (
    <button
      onClick={onClick}
      className="absolute top-2 right-2 border border-gray-400 bg-white hover:bg-gray-100 rounded p-2 shadow flex items-center justify-center w-8 h-8"
      aria-label="Opened Chatbot"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
    </button>
  );
