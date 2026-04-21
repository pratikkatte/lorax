/**
 * Type declarations for @lorax/core utility modules
 * These are pure JavaScript modules that we import for main-thread computation
 */

declare module '@lorax/core/src/utils/computations' {
  export function normalizeIntervals(intervals: any[] | null): number[];

  export function queryIntervalsSync(
    normalizedIntervals: number[],
    start: number,
    end: number
  ): {
    visibleIntervals: number[];
    lo: number;
    hi: number;
  };

  export function queryLocalDataSync(params: {
    intervals: number[];
    lo?: number;
    start: number;
    end: number;
    globalBpPerUnit: number;
    new_globalBp: number;
    genome_length: number;
    displayOptions?: { selectionStrategy?: string };
  }): {
    local_bins: Map<number, any>;
    displayArray: number[];
    showing_all_trees: boolean;
  };

  export function lowerBound(arr: number[], val: number): number;
  export function upperBound(arr: number[], val: number): number;
  export function nearestIndex(arr: number[], val: number): number;
  export const selectionStrategies: Record<string, unknown>;
  export function getSelectionStrategy(name?: string): unknown;
  export function new_complete_experiment_map(
    localBins: Map<any, any>,
    globalBpPerUnit: number,
    new_globalBp: number,
    options?: {
      selectionStrategy?: string;
      viewportStart?: number;
      viewportEnd?: number;
      prevLocalBins?: Map<any, any> | null;
    }
  ): {
    return_local_bins: Map<any, any>;
    displayArray: number[];
    showingAllTrees: boolean;
  };
  export function supportsWebWorkers(): boolean;
  export function resetLocalBinsCache(): void;
  export function serializeBinsForTransfer(bins: Map<any, any>): any[];
  export function deserializeBins(serialized: any[]): Map<any, any> | null;
}

declare module '@lorax/core/src/utils/renderUtils' {
  export interface RenderArraysResult {
    pathPositions: Float64Array;
    pathStartIndices: number[];
    tipPositions: Float64Array;
    tipColors: Uint8Array;
    tipData: any[];
    edgeCount: number;
    tipCount: number;
  }

  export function computeRenderArrays(data: {
    node_id: any[];
    parent_id: any[];
    is_tip: any[];
    tree_idx: any[];
    x: any[];
    y: any[];
    modelMatrices: Map<number, number[]> | any[];
    displayArray: number[];
    metadataArrays: any;
    metadataColors: any;
    populationFilter: any;
  }): RenderArraysResult;

  export function buildModelMatricesMap(localBins: Map<number, any>): Map<number, number[]>;

  export function serializeModelMatrices(bins: Map<any, any>): any[];

  export function groupNodesByTree(
    node_id: any[],
    parent_id: any[],
    is_tip: any[],
    tree_idx: any[],
    x: any[],
    y: any[],
    displayArray: number[]
  ): Map<number, any[]>;

  export function getTipColor(
    nodeId: any,
    metadataArrays: any,
    metadataColors: any,
    populationFilter: any,
    defaultColor: number[]
  ): number[];
}

declare module '@lorax/core/src/rpc/methods' {
  export const rpcMethods: Record<string, (args: any) => any>;
  export function executeRpcMethod(methodName: string, args: any): any;
  export function getAvailableRpcMethods(): string[];
}

declare module '@lorax/core' {
  export const LoraxProvider: any;
  export function useLorax(): any;
  export const LoraxDeckGL: any;
  export function normalizeIntervals(intervals: any[] | null): number[];
  export function queryIntervalsSync(
    normalizedIntervals: number[],
    start: number,
    end: number
  ): {
    visibleIntervals: number[];
    lo: number;
    hi: number;
  };
  export function new_complete_experiment_map(
    localBins: Map<any, any>,
    globalBpPerUnit: number,
    new_globalBp: number,
    options?: {
      selectionStrategy?: string;
      viewportStart?: number;
      viewportEnd?: number;
      prevLocalBins?: Map<any, any> | null;
    }
  ): {
    return_local_bins: Map<any, any>;
    displayArray: number[];
    showingAllTrees: boolean;
  };
  export function serializeBinsForTransfer(bins: Map<any, any>): any[];
  export function computeRenderArrays(data: {
    node_id: any[];
    parent_id: any[];
    is_tip: any[];
    tree_idx: any[];
    x: any[];
    y: any[];
    modelMatrices: Map<number, number[]> | any[];
    displayArray: number[];
    metadataArrays: any;
    metadataColors: any;
    populationFilter: any;
  }): RenderArraysResult;
  export function createRpcWorker(args: {
    rpcManager: any;
    sessionId: string;
    rpcDriverName?: string;
    methodMap?: Record<string, string>;
  }): { isReady: boolean; request: (type: string, data?: any) => Promise<any> };
}
