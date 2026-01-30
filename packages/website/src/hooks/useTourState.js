import { useCallback, useState } from 'react';

const STORAGE_PREFIX = 'lorax_tour';

const safeGet = (key) => {
  try {
    return window.localStorage.getItem(key);
  } catch (_) {
    return null;
  }
};

const safeSet = (key, value) => {
  try {
    window.localStorage.setItem(key, value);
  } catch (_) {
    // Ignore storage failures (private mode, disabled, etc.)
  }
};

export default function useTourState(id) {
  const storageKey = `${STORAGE_PREFIX}:${id}`;
  const [hasSeen, setHasSeen] = useState(() => safeGet(storageKey) === 'done');

  const markSeen = useCallback(() => {
    setHasSeen(true);
    safeSet(storageKey, 'done');
  }, [storageKey]);

  const reset = useCallback(() => {
    setHasSeen(false);
    safeSet(storageKey, 'pending');
  }, [storageKey]);

  return { hasSeen, markSeen, reset, storageKey };
}
