import { useEffect, useMemo, useState } from "react";

const DEBOUNCE_TIME = 100;
const CHECK_AGAIN_TIME = 100;

function addNodeLookup(data) {
console.log('useGetDynamicData data', data)
  const output = {
    ...data,
    nodeLookup: Object.fromEntries(data.nodes.map((n) => [n.node_id, n])),
    tree_po: calculateTreePositions(data.nodes, data.trees_position)
  };
  return output;
}

function calculateTreePositions(data, trees_position){
  return data.reduce((acc, item) => {
    const {tree, x_dist , y } = item
    if (!acc[tree]) {
      acc[tree] = {
        x_dist: 0,
        min_y: y, 
        max_y: y,
        min_text: JSON.stringify(trees_position[tree].min),
        max_text: JSON.stringify(trees_position[tree].max)
      };
    } else {
      acc[tree].min_y = Math.min(acc[tree].min_y, y);
      acc[tree].max_y = Math.max(acc[tree].max_y, y);
    }
    return acc;
  }, {})
}
function useGetDynamicData(backend, colorBy, viewState, config, xType, treeposition) {

  const { queryNodes } = backend;
  // backend.setStatusMessage({message: null});

  const [dynamicData, setDynamicData] = useState({
    status: "not_started",
    data: [],
  });

  let [boundsForQueries, setBoundsForQueries] = useState(null);
  let [triggerRefresh, setTriggerRefresh] = useState({});
  let [timeoutRef, setTimeoutRef] = useState(null);

  useEffect(() => {

    if (
      !boundsForQueries ||
      xType !== boundsForQueries.xType ||
      (true &&
        (viewState.min_x < boundsForQueries.min_x + viewState.real_width / 2 ||
          viewState.max_x > boundsForQueries.max_x - viewState.real_width / 2 ||
          viewState.min_y <
            boundsForQueries.min_y + viewState.real_height / 2 ||
          viewState.max_y >
            boundsForQueries.max_y - viewState.real_height / 2 ||
          Math.abs(viewState.zoom - boundsForQueries.zoom) > 0.5))
    ) {
      if (window.log) {
        console.log("updating bounds view", [viewState.min_x, boundsForQueries.min_x]);
      }

      const newBoundForQuery = {
        min_x: viewState.min_x - viewState.real_width,
        max_x: viewState.max_x + viewState.real_width,
        min_y: viewState.min_y - viewState.real_height,
        max_y: viewState.max_y + viewState.real_height,
        zoom: viewState.zoom,
        xType: xType,
      };

      setBoundsForQueries(newBoundForQuery);
      console.log("updating bounds", newBoundForQuery);
    }
  }, [viewState, boundsForQueries, triggerRefresh, xType, queryNodes]);

  const isCurrentlyOutsideBounds = useMemo(
    () =>
      viewState.min_x &&
      dynamicData &&
      dynamicData.lastBounds &&
      dynamicData.lastBounds.min_x &&
      (viewState.min_x < dynamicData.lastBounds.min_x ||
        viewState.max_x > dynamicData.lastBounds.max_x ||
        viewState.min_y < dynamicData.lastBounds.min_y ||
        viewState.max_y > dynamicData.lastBounds.max_y),
    [viewState, dynamicData]
  );

  useEffect(() => {
    if (config.title !== "loading") {
      clearTimeout(timeoutRef);
      setTimeoutRef(
        setTimeout(() => {
          if (!boundsForQueries) return;

          if (dynamicData.status === "loading") {
            console.log("not trying to get as we are still loading");
            clearTimeout(timeoutRef);
            setTimeoutRef(
              setTimeout(() => {
                setTriggerRefresh({});
              }, CHECK_AGAIN_TIME)
            );
            return;
          }

          // Make call to backend to get data
          setDynamicData({ ...dynamicData, status: "loading" });

          queryNodes(
            boundsForQueries,
            (result) => {
             
              setDynamicData((prevData) => {
                const new_result = {
                  ...prevData,
                  status: "loaded",
                  data: addNodeLookup(result),
                  lastBounds: boundsForQueries,
                };
                console.log("dynamicData prevdata result", prevData, new_result)

                if (!boundsForQueries || isNaN(boundsForQueries.min_x)) {
                  new_result.base_data = addNodeLookup(result);
                } else {
                  if (!prevData.base_data || prevData.base_data_is_invalid) {
                    queryNodes(
                      null,
                      (base_result) => {
                        setDynamicData((prevData) => {
                          const new_result = {
                            ...prevData,
                            status: "loaded",
                            base_data: addNodeLookup(base_result),
                            base_data_is_invalid: false,
                          };
                          return new_result;
                        });
                      },
                      undefined,
                      config,
                      treeposition
                    );
                  }
                }
                return new_result;
              });
            },
            setTriggerRefresh,
            config,
            treeposition
          );
        }, DEBOUNCE_TIME)
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundsForQueries, queryNodes, triggerRefresh, config, treeposition]);

  console.log("dynamicData", dynamicData)

  return { data: dynamicData, boundsForQueries, isCurrentlyOutsideBounds };
}

export default useGetDynamicData;
