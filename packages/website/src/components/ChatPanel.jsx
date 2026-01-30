import React, { useEffect, useRef, useState } from "react";
import { streamChat } from "../lib/chatClient";
import {
  getChatApiKey,
  getChatHistory,
  getChatModel,
  clearChatHistory,
  setChatHistory
} from "../lib/chatStorage";

const EMPTY_HINT = "Ask about the current view, filters, mutations, or visible trees.";

function formatTimestamp(date) {
  if (!date) return "";
  return new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
    createdAt: msg.createdAt || Date.now()
  }));
}

const ChatPanel = ({ onClose, context }) => {
  const [messages, setMessages] = useState(() => normalizeMessages(getChatHistory()));
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const listRef = useRef(null);

  const [model, setModel] = useState(getChatModel());

  useEffect(() => {
    setChatHistory(messages);
  }, [messages]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, isStreaming]);

  const appendAssistantDelta = (delta) => {
    if (!delta) return;
    setMessages((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const last = next[next.length - 1];
      if (last?.role !== "assistant") return prev;
      next[next.length - 1] = {
        ...last,
        content: `${last.content || ""}${delta}`
      };
      return next;
    });
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    const apiKey = getChatApiKey();
    const nextModel = getChatModel();
    setModel(nextModel);
    if (!apiKey) {
      setError("Add your OpenAI API key in Settings to enable chat.");
      return;
    }

    setError(null);
    setIsStreaming(true);
    setInput("");

    const userMessage = { role: "user", content: trimmed, createdAt: Date.now() };
    const assistantMessage = { role: "assistant", content: "", createdAt: Date.now() };

    const outbound = [...messages, userMessage];
    setMessages([...outbound, assistantMessage]);

    try {
      await streamChat({
        apiKey,
        model: nextModel,
        messages: outbound.map(({ role, content }) => ({ role, content })),
        context,
        onDelta: appendAssistantDelta,
        onError: (err) => {
          setError(err);
          setIsStreaming(false);
        },
        onDone: () => setIsStreaming(false)
      });
    } catch (err) {
      setIsStreaming(false);
      setError(err.message || "Chat request failed.");
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    setMessages([]);
    setError(null);
    clearChatHistory();
  };

  return (
    <div className="w-full h-full bg-slate-50 flex flex-col font-sans">
      <div className="w-full p-4 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Chat</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500">Streaming answers using your OpenAI key.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar" ref={listRef}>
        {messages.length === 0 ? (
          <div className="text-sm text-slate-400 text-center py-8">
            {EMPTY_HINT}
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, idx) => (
              <div key={`${msg.role}-${idx}-${msg.createdAt || idx}`} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow-sm ${msg.role === "user" ? "bg-emerald-600 text-white" : "bg-white text-slate-700 border border-slate-200"}`}>
                  <div className="whitespace-pre-wrap leading-relaxed">{msg.content || (msg.role === "assistant" && isStreaming ? "…" : "")}</div>
                  <div className={`mt-1 text-[10px] ${msg.role === "user" ? "text-emerald-100" : "text-slate-400"}`}>
                    {formatTimestamp(msg.createdAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 bg-white p-4">
        {error && (
          <div className="mb-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-2 py-1">
            {error}
          </div>
        )}

        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={handleClear}
            className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-md px-2 py-1"
            type="button"
          >
            Clear chat
          </button>
          <div className="text-[10px] text-slate-400">
            Model: {model || "gpt-4o-mini"}
          </div>
        </div>

        <div className="flex items-end gap-2">
          <textarea
            className="flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400"
            rows={3}
            placeholder="Ask about the current view..."
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
          />
          <button
            onClick={handleSend}
            disabled={isStreaming || !input.trim()}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${isStreaming || !input.trim() ? "bg-slate-200 text-slate-400" : "bg-emerald-600 text-white hover:bg-emerald-700"}`}
            type="button"
          >
            {isStreaming ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
