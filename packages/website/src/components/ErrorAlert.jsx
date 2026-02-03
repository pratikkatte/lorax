import React, { useRef } from "react";
import { createPortal } from "react-dom";

/**
 * ErrorAlert component
 * Renders a dismissible alert for a message.
 */
const ErrorAlert = ({ message, onDismiss }) => {
    const rootRef = useRef(null);
    if (!message) return null;
    const content = (
        <div ref={rootRef} className="fixed top-16 left-1/2 z-[9999] -translate-x-1/2 w-[95vw] max-w-xl pointer-events-auto">
            <div className="flex items-center justify-between px-4 py-2 rounded-xl shadow-xl border border-rose-200 bg-rose-50 text-rose-900 transition-all animate-fade-in">
                <span className="truncate text-sm font-medium" title={String(message)}>
                    {message instanceof Error ? message.message : String(message)}
                </span>
                {typeof onDismiss === "function" && (
                    <button
                        onClick={onDismiss}
                        className="ml-4 p-1 rounded hover:bg-rose-100 text-rose-500 transition-colors"
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

    if (typeof document === "undefined") return content;
    return createPortal(content, document.body);
};

export default ErrorAlert;
