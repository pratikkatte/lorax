import { useEffect, useRef, useState } from "react";
import websocketEvents from "../webworkers/websocketEvents";

const DEBOUNCE_TIME = 100;

function useGetDynamicData({ backend, value, setValue }) {
  const { queryNodes, socketRef, isConnected } = backend;

  const [dynamicData, setDynamicData] = useState({
    status: "not_started",
    data: [],
  });

  let [boundsForQueries, setBoundsForQueries] = useState(null);

  // Debounce timer ref
  const debounceTimer = useRef(null);

  useEffect(() => {
    // Clear any previous debounce timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    
    if (value) {
      return;

      setDynamicData((prev) => ({ ...prev, status: "loading" }));

      debounceTimer.current = setTimeout(() => {
        queryNodes(
          boundsForQueries,
          (result) => {
            setDynamicData((prevData) => {
              const new_result = {
                ...prevData,
                status: "loaded",
                // data: addNodeLookup(result),
                data: result,
                lastBounds: boundsForQueries,
              };
              return new_result;
            });
          },
          value
        );
      }, DEBOUNCE_TIME);
    }

    // Cleanup on unmount or value change
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, boundsForQueries]);

  return { data: dynamicData };
}

export default useGetDynamicData;
