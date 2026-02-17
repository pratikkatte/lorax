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
  intervalWorker = null,
  localDataWorker = null,
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
  populationFilter = null,
  defaultTipColor = null,
  isInteracting = false
}) {
  const resolvedIntervalWorker = intervalWorker || worker;
  const resolvedLocalDataWorker = localDataWorker || worker;

  const intervalState = useInterval({
    worker: resolvedIntervalWorker,
    workerConfigReady,
    genomicCoords,
    isInteracting
  });

  const localDataState = useLocalData({
    worker: resolvedLocalDataWorker,
    workerConfigReady,
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
    // intervalCount is the pre-decimation count of intervals (N breakpoints = N-1 trees)
    return intervalState.intervalCount > 1 ? intervalState.intervalCount - 1 : 0;
  }, [intervalState.intervalCount]);

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
    populationFilter,
    defaultTipColor
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
