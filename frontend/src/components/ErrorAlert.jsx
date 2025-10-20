import React from "react";

/**
 * ErrorAlert component
 * Renders a dismissible alert for a message.
 *
 * Props:
 * - message: string | Error - Message to display; falsy disables rendering.
 * - onDismiss: function - Callback to dismiss/clear the alert. Required.
 */
const ErrorAlert = ({ message, onDismiss }) => {
    console.log("message", message);
  if (!message) return null;
  return (
    <div className="fixed top-5 left-1/2 z-50 -translate-x-1/2 w-[95vw] max-w-xl">
      <div className="flex items-center justify-between px-4 py-2 rounded-xl shadow-xl border border-rose-200 bg-rose-50 text-rose-900 transition-all animate-fade-in">
        <span className="truncate text-sm font-medium" title={String(message)}>
          {message instanceof Error ? message.message : String(message)}
        </span>
        {typeof onDismiss === "function" && (
          <button
            onClick={onDismiss}
            className="ml-4 p-1 rounded hover:bg-rose-100 text-rose-500"
            aria-label="Dismiss error"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="5" y1="5" x2="13" y2="13" />
              <line x1="13" y1="5" x2="5" y2="13" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default ErrorAlert;
