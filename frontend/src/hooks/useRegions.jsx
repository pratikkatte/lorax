import { useMemo, useEffect, useState, useRef } from "react";
import debounce from "lodash.debounce";

function lowerBound(arr, x) {
  let lo = 0, hi = arr.length - 1, ans = arr.length;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] >= x) { ans = mid; hi = mid - 1; } else { lo = mid + 1; }
  }
  return ans;
}
function nearestIndex(arr, x) {
  if (arr.length === 0) return -1;
  if (x <= arr[0]) return 0;
  if (x >= arr[arr.length - 1]) return arr.length - 1;

  const i = lowerBound(arr, x);
  // i is first >= x, so candidate neighbors are i-1 and i
  const prev = i - 1;
  return (x - arr[prev] <= arr[i] - x) ? prev : i;
}
function getXArray(globalBins) {
  return globalBins.map(b => b.acc);
}

function sampleTrees(globalBins, lo, hi, nTrees, globalBpPerUnit) {
  
  var sampled_trees = [];
  var lowest_step = Math.floor(lo/globalBpPerUnit);
  var highest_step = Math.ceil(hi/globalBpPerUnit);

  for (let i = lowest_step; i < highest_step; i++) {
    
    var genomic_val = i*globalBpPerUnit;
    var tree_index = nearestIndex(globalBins, genomic_val);

    if (tree_index !== sampled_trees[sampled_trees.length-1]?.global_index) {
      sampled_trees.push({index: i, global_index: tree_index, position: genomic_val});
  }
}
  return sampled_trees;
}

const useRegions = ({ backend, globalBins, value, viewState, saveViewports, globalBpPerUnit}) => {
  const { queryLocalBins, queryNodes } = backend;

  const [localBins, setLocalBins] = useState([]);
  const [localTrees, setLocalTrees] = useState([]);
  const [localNodes, setLocalNodes] = useState([]);
  const sampleTreesRef = useRef([]);

  
  // create a stable debounced function
  const debouncedQuery = useMemo(
    () =>
      debounce((val, sample_trees) => {
        queryLocalBins(val, setLocalBins);
        queryNodes(val, sample_trees, (result) => {
          setLocalNodes((prevData) => {
            const new_result = {
              ...prevData,
              status: "loaded",
              data: result
            };
            return new_result;
          });
        });
      }, 100), // delay in ms; tweak as needed
    [queryLocalBins]
  );

  useEffect(() => {
    if (globalBins && value) {
      debouncedQuery(value, sampleTreesRef.current);
    }
  }, [globalBins, value, debouncedQuery, sampleTreesRef]);

  // cleanup on unmount (important!)
  useEffect(() => {
    return () => {
      debouncedQuery.cancel();
    };
  }, [debouncedQuery]);

  useEffect(() => {

    let zoom = viewState['ortho']?.zoom?.[0];
    let width = saveViewports['ortho']?.width;
    if (zoom && width && globalBpPerUnit, globalBins) {
      const localBpPerUnit = Math.ceil(width / Math.pow(2, zoom));
      const sampledTrees = sampleTrees(getXArray(globalBins), value[0], value[1], localBpPerUnit, globalBpPerUnit);
      console.log("sampledTrees", sampledTrees)
      sampleTreesRef.current = sampledTrees;
      setLocalTrees(sampledTrees);
    }
  }, [localBins, globalBpPerUnit])

  const output = useMemo(() => ({ bins: localBins, trees: localTrees, data: localNodes }), [localBins, localTrees, localNodes]);

  return output;
};

export default useRegions;