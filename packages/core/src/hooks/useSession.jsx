import { useRef, useState, useCallback } from "react";
import { initSession } from "../services/api.js";

const SESSION_KEY = 'lorax_sid';

export function useSession({ apiBase }) {
  const sidRef = useRef(null);
  const initSessionPromiseRef = useRef(null);
  const [loraxSid, setLoraxSid] = useState(null);

  const initializeSession = useCallback(() => {
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
  }, [apiBase]);

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
