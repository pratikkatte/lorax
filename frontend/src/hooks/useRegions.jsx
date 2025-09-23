import { useMemo, useEffect, useState } from "react";
import debounce from "lodash.debounce";

// function sampleTrees(globalBins, lo, hi, nTrees) {
//   if (nTrees <= 1) return [Math.floor((lo + hi) / 2)];
  
//   const step = (hi - lo) / (nTrees - 1);
//   const targets = Array.from({ length: nTrees }, (_, k) => lo + k * step);

//   const indices = targets.map(pos => {
//     // binary search in globalBins
//     let loIdx = 0, hiIdx = globalBins.length - 1, ans = hiIdx;
//     while (loIdx <= hiIdx) {
//       const mid = (loIdx + hiIdx) >> 1;
//       if (globalBins[mid].end >= pos) {
//         ans = mid;
//         hiIdx = mid - 1;
//       } else {
//         loIdx = mid + 1;
//       }
//     }
//     return ans;
//   });

//   return Array.from(new Set(indices)); // dedup if targets land in same bin
// }
// const genome_length = globalBins[globalBins.length - 1].end;
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

function sampleTrees(globalBins, localBins, lo, hi, nTrees, globalBpPerUnit) {
  
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

const useRegions = ({ globalBins, value, backend, viewState, saveViewports, globalBpPerUnit}) => {
  const { queryLocalBins } = backend;
  const [localBins, setLocalBins] = useState([]);
  const [localTrees, setLocalTrees] = useState([]);


  
  // create a stable debounced function
  const debouncedQuery = useMemo(
    () =>
      debounce((val) => {
        queryLocalBins(val, setLocalBins);
      }, 100), // delay in ms; tweak as needed
    [queryLocalBins]
  );

  useEffect(() => {
    if (globalBins && value) {
      debouncedQuery(value);
    }
  }, [globalBins, value, debouncedQuery]);

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
      console.log("localBpPerUnit",localBpPerUnit, value[0], value[1], globalBpPerUnit)
      const sampledTrees = sampleTrees(getXArray(globalBins),localBins, value[0], value[1], localBpPerUnit, globalBpPerUnit);
      // console.log("sampledTrees", sampledTrees, sampledTrees[0].position, sampledTrees[sampledTrees.length-1].position)
      setLocalTrees(sampledTrees);
    }
  }, [localBins, globalBpPerUnit])

  const output = useMemo(() => ({ bins: localBins, trees: localTrees }), [localBins, localTrees]);

  return output;
};

export default useRegions;