import { useMemo } from 'react';
import { useInterval } from './useInterval.jsx';
import { useLocalData } from './useLocalData.jsx';
import { useTreeData } from './useTreeData.jsx';
import { useRenderData } from './useRenderData.jsx';

/**
 * useTreeViewportPipeline
 * Orchestrates viewport-driven tree data flow:
 * interval query -> local bins -> backend tree fetch -> render arrays.
 */
export function useTreeViewportPipeline({
  worker,
  workerConfigReady,
  genomicCoords,
  viewState,
  tsconfig,
  queryTreeLayout,
  isConnected,
  lockModelMatrix = false,
  lockViewPayload = null,
  metadataArrays = null,
  metadataColors = null,
  populationFilter = null
}) {
  const intervalState = useInterval({
    worker,
    workerConfigReady,
    genomicCoords
  });

  const localDataState = useLocalData({
    worker,
    workerConfigReady,
    allIntervalsInView: intervalState.allIntervalsInView,
    intervalBounds: intervalState.intervalBounds,
    intervalsCoords: intervalState.intervalsCoords,
    genomicCoords,
    viewState,
    tsconfig,
    displayOptions: { selectionStrategy: 'largestSpan', lockModelMatrix }
  });

  const visibleTreeIndices = useMemo(() => {
    if (!localDataState.localBins) return [];
    return Array.from(localDataState.localBins.keys());
  }, [localDataState.localBins]);

  const treesInWindowCount = useMemo(() => {
    if (!Array.isArray(intervalState.allIntervalsInView) || intervalState.allIntervalsInView.length < 2) {
      return 0;
    }
    return intervalState.allIntervalsInView.length - 1;
  }, [intervalState.allIntervalsInView]);

  const treeDataState = useTreeData({
    displayArray: localDataState.displayArray,
    queryTreeLayout,
    isConnected,
    lockView: lockModelMatrix ? lockViewPayload : null,
    tsconfig,
    genomicCoords
  });

  const renderState = useRenderData({
    localBins: localDataState.localBins,
    treeData: treeDataState.treeData,
    displayArray: localDataState.displayArray,
    metadataArrays,
    metadataColors,
    populationFilter
  });

  return useMemo(() => ({
    interval: intervalState,
    local: localDataState,
    tree: treeDataState,
    render: renderState,
    visibleTreeIndices,
    treesInWindowCount
  }), [
    intervalState,
    localDataState,
    treeDataState,
    renderState,
    visibleTreeIndices,
    treesInWindowCount
  ]);
}

export default useTreeViewportPipeline;
