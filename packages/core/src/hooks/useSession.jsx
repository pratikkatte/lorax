import { useRef, useState, useCallback, useEffect } from "react";
import { initSession } from "../services/api.js";

const SESSION_KEY = 'lorax_sid';

export function useSession({ apiBase, sessionOverride = null }) {
  const sidRef = useRef(null);
  const initSessionPromiseRef = useRef(null);
  const [loraxSid, setLoraxSid] = useState(null);

  // When sessionOverride is provided (e.g. from JBrowse LoraxAdapter.loadFile),
  // adopt it directly so the rest of the app shares the adapter's Lorax sid.
  useEffect(() => {
    if (!sessionOverride) return;
    sidRef.current = sessionOverride;
    setLoraxSid(sessionOverride);
  }, [sessionOverride]);

  const initializeSession = useCallback(() => {
    // If the adapter already handed us a sid, don't reinitialize.
    if (sessionOverride) {
      sidRef.current = sessionOverride;
      setLoraxSid(sessionOverride);
      return Promise.resolve(sessionOverride);
    }

    if (initSessionPromiseRef.current) {
      return initSessionPromiseRef.current;
    }

    initSessionPromiseRef.current = (async () => {
      try {
        // Check localStorage for existing session
        const storedSid = localStorage.getItem(SESSION_KEY);
        if (storedSid) {
          sidRef.current = storedSid;
          setLoraxSid(storedSid);
        }

        const sid = await initSession(apiBase);
        if (sid) {
          sidRef.current = sid;
          setLoraxSid(sid);
          localStorage.setItem(SESSION_KEY, sid);
          return sid;
        } else {
          console.warn("No SID received during session init");
          return null;
        }
      } catch (error) {
        console.error("Error initializing session:", error);
        throw error;
      } finally {
        initSessionPromiseRef.current = null;
      }
    })();

    return initSessionPromiseRef.current;
  }, [apiBase, sessionOverride]);

  const clearSession = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    sidRef.current = null;
    setLoraxSid(null);
    initSessionPromiseRef.current = null;
  }, []);

  const getSid = useCallback(() => sidRef.current, []);

  return {
    loraxSid,
    sidRef,
    initializeSession,
    clearSession,
    getSid,
    isSessionValid: !!loraxSid
  };
}
