import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import {
  normalizeIntervals,
  queryIntervalsSync,
  new_complete_experiment_map,
  serializeBinsForTransfer,
  computeRenderArrays,
} from '@lorax/core'

type SessionState = {
  tsconfig: Record<string, unknown> | null
  normalizedIntervals: number[]
  prevLocalBins: Map<number, unknown> | null
}

const sessionState = new Map<string, SessionState>()

function getSessionState(sessionId: string): SessionState {
  if (!sessionState.has(sessionId)) {
    sessionState.set(sessionId, {
      tsconfig: null,
      normalizedIntervals: [],
      prevLocalBins: null,
    })
  }
  return sessionState.get(sessionId)!
}

type RpcArgs = {
  sessionId: string
  data?: any
  rpcDriverName?: string
}

export class LoraxConfigRpcMethod extends RpcMethodType {
  name = 'LoraxConfig'

  async execute(args: RpcArgs) {
    const { sessionId, data } = args
    console.log('[LoraxRPC] config', {
      sessionId,
      intervalsCount: Array.isArray(data?.intervals) ? data.intervals.length : 0,
    })
    const state = getSessionState(sessionId)
    state.tsconfig = data ?? null
    const intervals = data?.intervals ?? []
    state.normalizedIntervals = normalizeIntervals(intervals)
    state.prevLocalBins = null
    return { ok: true }
  }
}

export class LoraxIntervalsRpcMethod extends RpcMethodType {
  name = 'LoraxIntervals'

  async execute(args: RpcArgs) {
    const { sessionId, data } = args
    const state = getSessionState(sessionId)
    const start = Number(data?.start ?? 0)
    const end = Number(data?.end ?? 0)
    const { visibleIntervals, lo, hi } = queryIntervalsSync(
      state.normalizedIntervals,
      start,
      end,
    )
    console.log('[LoraxRPC] intervals', {
      sessionId,
      start,
      end,
      visibleCount: visibleIntervals.length,
      lo,
      hi,
    })
    return { visibleIntervals, lo, hi }
  }
}

export class LoraxLocalDataRpcMethod extends RpcMethodType {
  name = 'LoraxLocalData'

  async execute(args: RpcArgs) {
    const { sessionId, data } = args
    const state = getSessionState(sessionId)
    const {
      intervals,
      lo = 0,
      hi,
      start,
      end,
      globalBpPerUnit,
      new_globalBp,
      displayOptions = {},
    } = data || {}

    // Prefer per-request `intervals` (jbrowse-fork shape); fall back to the
    // session-cached normalized intervals (lorax_main shape that only sends
    // [lo, hi) slice bounds).
    const cached = state.normalizedIntervals
    const hasRequestIntervals = Array.isArray(intervals) && intervals.length > 0
    const effectiveHi =
      typeof hi === 'number' && Number.isFinite(hi)
        ? hi
        : hasRequestIntervals
          ? lo + intervals.length
          : lo

    if (!hasRequestIntervals && (!cached || cached.length === 0 || effectiveHi <= lo)) {
      console.log('[LoraxRPC] local-data', { sessionId, intervalsCount: 0 })
      return {
        local_bins: [],
        displayArray: [],
        showing_all_trees: false,
      }
    }

    const localBins = new Map()
    if (hasRequestIntervals) {
      for (let i = 0; i < intervals.length - 1; i++) {
        const globalIndex = lo + i
        const s = intervals[i]
        const e = intervals[i + 1]
        localBins.set(globalIndex, {
          s,
          e,
          path: null,
          global_index: globalIndex,
          precision: null,
        })
      }
    } else if (cached) {
      for (let i = lo; i < effectiveHi - 1; i++) {
        const s = cached[i]!
        const e = cached[i + 1]!
        localBins.set(i, {
          s,
          e,
          span: e - s,
          midpoint: (s + e) / 2,
          path: null,
          global_index: i,
          precision: null,
        })
      }
    }

    const selectionStrategy = displayOptions.selectionStrategy || 'largestSpan'
    const mapOptions: Record<string, unknown> = {
      selectionStrategy,
      viewportStart: start,
      viewportEnd: end,
      prevLocalBins: state.prevLocalBins,
    }
    if (!hasRequestIntervals && cached) {
      mapOptions.minStart = cached[lo]
      mapOptions.maxEnd = cached[Math.min(effectiveHi, cached.length - 1)]
    }

    const { return_local_bins, displayArray, showingAllTrees } =
      new_complete_experiment_map(localBins, globalBpPerUnit, new_globalBp, mapOptions)

    state.prevLocalBins = return_local_bins

    console.log('[LoraxRPC] local-data', {
      sessionId,
      intervalsCount: localBins.size,
      displayCount: displayArray?.length ?? 0,
      showingAllTrees,
    })

    return {
      local_bins: serializeBinsForTransfer(return_local_bins),
      displayArray,
      showing_all_trees: showingAllTrees,
    }
  }
}

export class LoraxComputeRenderDataRpcMethod extends RpcMethodType {
  name = 'LoraxComputeRenderData'

  async execute(args: RpcArgs) {
    const { data } = args
    console.log('[LoraxRPC] compute-render-data', {
      nodeCount: data?.node_id?.length ?? 0,
      treeCount: data?.displayArray?.length ?? 0,
    })
    return computeRenderArrays(data || {})
  }
}

export class LoraxClearRenderBuffersRpcMethod extends RpcMethodType {
  name = 'LoraxClearRenderBuffers'

  async execute(_args: RpcArgs) {
    return { ok: true }
  }
}

/**
 * Main-branch `useRenderData` opportunistically calls `apply-transform` when
 * only modelMatrices changed, falling back to `compute-render-data` on
 * `{ cacheMiss: true }`. This plugin does not port the stateful buffer cache,
 * so always report a cache miss to force a full recompute.
 */
export class LoraxApplyTransformRpcMethod extends RpcMethodType {
  name = 'LoraxApplyTransform'

  async execute(_args: RpcArgs) {
    return { cacheMiss: true }
  }
}
