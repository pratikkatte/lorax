import React, { useRef } from "react";
import { createPortal } from "react-dom";

const STYLES = {
    error: "border-rose-200 bg-rose-50 text-rose-900 hover:bg-rose-100 text-rose-500",
    info: "border-slate-200 bg-slate-50 text-slate-900 hover:bg-slate-100 text-slate-500",
};

/**
 * ErrorAlert component
 * Renders a dismissible alert for a message.
 * @param {string} [variant="error"] - "error" (rose) or "info" (slate)
 * @param {boolean} [fullText=false] - if true, show full message (wrap) instead of truncating with ellipsis
 */
const ErrorAlert = ({ message, onDismiss, variant = "error", fullText = false }) => {
    const rootRef = useRef(null);
    if (!message) return null;
    const [border, bg, text, btnHover, btnText] = STYLES[variant]?.split(" ") ?? STYLES.error.split(" ");
    const msgStr = message instanceof Error ? message.message : String(message);
    const content = (
        <div ref={rootRef} className="fixed top-16 left-1/2 z-[9999] -translate-x-1/2 w-[95vw] max-w-xl pointer-events-auto">
            <div className={`flex items-center justify-between px-4 py-2 rounded-xl shadow-xl border ${border} ${bg} ${text} transition-all animate-fade-in gap-2`}>
                <span className={`text-sm font-medium flex-1 min-w-0 ${fullText ? "break-words" : "truncate"}`} title={fullText ? undefined : msgStr}>
                    {msgStr}
                </span>
                {typeof onDismiss === "function" && (
                    <button
                        onClick={onDismiss}
                        className={`ml-4 p-1 rounded transition-colors ${btnHover} ${btnText}`}
                        aria-label="Dismiss"
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
