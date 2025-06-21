import { useEffect, useMemo, useState } from "react";
import websocketEvents from "../webworkers/websocketEvents";

const DEBOUNCE_TIME = 100;
const CHECK_AGAIN_TIME = 100;
function addNodeLookup(data) {
  const output = {
    ...data,
    nodeLookup: Object.fromEntries(data.nodes.map((n) => [n.node_id, n])),
  };
  return output;
}
function useGetDynamicData(backend, viewState, xType, value, config) {

  const { queryNodes, socketRef, isConnected } = backend;

  const [dynamicData, setDynamicData] = useState({
    status: "not_started",
    data: [],
  });

  let [boundsForQueries, setBoundsForQueries] = useState(null);

  useEffect(() => {
    if (value) {
    setDynamicData({ ...dynamicData, status: "loading" });
    queryNodes(
      boundsForQueries,
      (result) => {
        setDynamicData((prevData)=> {
          const new_result = {
            ...prevData,
            status: "loaded",
            // data: addNodeLookup(result),
            data: result,
            lastBounds: boundsForQueries,
          };
          return new_result;
        })
      },
          value,
      )
    }
  }, [value, config])

  return { data: dynamicData };
}

export default useGetDynamicData;
