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
function useGetDynamicData(backend, viewState, xType, value) {


  const { queryNodes, socketRef } = backend;

  const [dynamicData, setDynamicData] = useState({
    status: "not_started",
    data: [],
  });

  let [boundsForQueries, setBoundsForQueries] = useState(null);

  const [config, setConfig] = useState({
    title: "loaded",
    source: "",
    num_nodes: 0,
  });

  useEffect(() => {
    // if (!boundsForQueries){
    //   return
    // // }
    // if (dynamicData.status === "loading") {
    //   console.log("not trying to get as we are still loading");
    //   return;
    // }

    // setDynamicData({ ...dynamicData, status: "loading" });
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
  }, [value])


  // useEffect(() => {
  //   if (config.title !== "loading") {
  //     clearTimeout(timeoutRef);
  //     setTimeoutRef(
  //       setTimeout(() => {
  //         if (!boundsForQueries) return;

  //         if (dynamicData.status === "loading") {
  //           console.log("not trying to get as we are still loading");
  //           clearTimeout(timeoutRef);
  //           setTimeoutRef(
  //             setTimeout(() => {
  //               setTriggerRefresh({});
  //             }, CHECK_AGAIN_TIME)
  //           );
  //           return;
  //         }
  //         console.log("attempting get");
  //         // Make call to backend to get data

  //         setDynamicData({ ...dynamicData, status: "loading" });

  //         queryNodes(
  //           boundsForQueries,

  //           (result) => {
  //             console.log(
  //               "got result, bounds were",
  //               boundsForQueries,
  //               " result is "
  //             );

  //             setDynamicData((prevData) => {
  //               const new_result = {
  //                 ...prevData,
  //                 status: "loaded",
  //                 data: addNodeLookup(result),
  //                 lastBounds: boundsForQueries,
  //               };
  //               if (!boundsForQueries || isNaN(boundsForQueries.min_x)) {
  //                 new_result.base_data = addNodeLookup(result);
  //               } else {
  //                 if (!prevData.base_data || prevData.base_data_is_invalid) {
  //                   console.log("query for minimap");
  //                   queryNodes(
  //                     null,
  //                     (base_result) => {
  //                       setDynamicData((prevData) => {
  //                         const new_result = {
  //                           ...prevData,
  //                           status: "loaded",
  //                           base_data: addNodeLookup(base_result),
  //                           base_data_is_invalid: false,
  //                         };
  //                         return new_result;
  //                       });
  //                     },
  //                     undefined,
  //                     config
  //                   );
  //                 }
  //               }
  //               return new_result;
  //             });
  //           },
  //           setTriggerRefresh,
  //           config
  //         );
  //       }, DEBOUNCE_TIME)
  //     );
  //   }
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [boundsForQueries, queryNodes, triggerRefresh, config]);

  return { data: dynamicData };
}

export default useGetDynamicData;
