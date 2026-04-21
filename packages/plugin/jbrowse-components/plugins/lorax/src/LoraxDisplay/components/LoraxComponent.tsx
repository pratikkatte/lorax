/// <reference path="../../lorax-core.d.ts" />
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { getContainingView, getEnv, getSession } from '@jbrowse/core/util'
import { readConfObject } from '@jbrowse/core/configuration'
import { observer } from 'mobx-react'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { LoraxDeckGL, LoraxProvider, useLorax } from '@lorax/core'

import type { LoraxDisplayModel } from '../model'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// Import WebGL backend for deck.gl
import '@luma.gl/webgl'

function hasLoadFile(
  adapter: unknown,
): adapter is { loadFile: () => Promise<unknown> } {
  return Boolean(adapter && typeof (adapter as { loadFile?: unknown }).loadFile === 'function')
}

type LoadFileResult = {
  config?: {
    initial_position?: [number, number]
    project?: string
    sid?: string
  }
  /** Lorax session ID from adapter - used for session unification with LoraxProvider */
  loraxSid?: string
}

type OffsetPercent = {
  leftOffsetPercent: number
  rightOffsetPercent: number
  widthPercent: number
  isOffFlowLeft: boolean
  isOffFlowRight: boolean
  isOffFlow: boolean
}

function LoraxDeckContainer({
  loadResult,
  height,
  viewConfig,
  intervalCoords,
  offsetPercent,
}: {
  loadResult: LoadFileResult | null
  height: number
  viewConfig: Record<string, any>
  intervalCoords: [number, number] | null
  offsetPercent: OffsetPercent
}) {
  const { handleConfigUpdate } = useLorax()

  useEffect(() => {
    const config = loadResult?.config
    if (!config) {
      return
    }
    handleConfigUpdate(config, config.initial_position ?? null, config.project ?? null, config.sid ?? null)
  }, [loadResult, handleConfigUpdate])
  return (
    <div
      style={{
        height,
        // width: '100%',
        left: `${offsetPercent.leftOffsetPercent}%`,
        // right: `${offsetPercent.rightOffsetPercent}%`,
        marginRight: `${offsetPercent.rightOffsetPercent}%`,
        position: 'relative',
      }}
    >
      <LoraxDeckGL
        viewConfig={viewConfig}
        showPolygons
        treeLayersEnabled={true}
        externalGenomicCoords={intervalCoords}
        externalGenomicCoordsRequired
        externalGenomicCoordsSync
      />
    </div>
  )
}

const LoraxComponent = observer(function LoraxComponent({ model }: { model: LoraxDisplayModel }) {
  const view = getContainingView(model) as LinearGenomeViewModel
  const { height } = model
  const adapterConfig = model.adapterConfig
  const session = getSession(model)
  const trackContainerRef = useRef<HTMLDivElement>(null)

  const [loadResult, setLoadResult] = useState<LoadFileResult | null>(null)
  const [loadError, setLoadError] = useState<Error | null>(null)
  const [trackHeight, setTrackHeight] = useState(height)

  const { offsetPx, width } = view as unknown as { offsetPx: number, width: number }


  const bpToPx = useMemo(() => {
    const blocks = view?.dynamicBlocks?.contentBlocks
    return view?.bpToPx?.({
      refName: blocks?.[0]?.refName ?? '',
      coord: blocks?.[0]?.start ?? 0
    })
  }, [view, offsetPx, width])
  

  const lastbpToPx = useMemo(() => {
    const blocks = view?.dynamicBlocks?.contentBlocks
    return view?.bpToPx?.({
      refName: blocks?.[blocks.length - 1]?.refName ?? '',
      coord: blocks?.[blocks.length - 1]?.end ?? 0
    })
  }, [view, offsetPx, width])

  const offsetPercent = useMemo(() => {
    const bpToPxOffset = bpToPx?.offsetPx
    const lastbpToPxOffset = lastbpToPx?.offsetPx
    const screenPos = bpToPxOffset ? bpToPxOffset - offsetPx : 0
    const screenPosLeft = bpToPxOffset ? bpToPxOffset - offsetPx : 0
    const screenPosRight = lastbpToPxOffset ? lastbpToPxOffset - offsetPx : 0

    let leftOffsetPercent = 0
    let rightOffsetPercent = 0
    let widthPercent = 0
    let isOffFlowLeft = false
    let isOffFlowRight = false

    if (typeof offsetPx === 'number' && typeof width === 'number' && width > 0) {
      isOffFlowLeft = screenPosLeft < 0
      isOffFlowRight = screenPosRight > 0

      if (offsetPx < 0) {
        leftOffsetPercent = (Math.abs(offsetPx) / width) * 100
      }
      if (isOffFlowRight) {
        const overflowPx = width - screenPosRight
        rightOffsetPercent = (overflowPx / width) * 100
      }
    }

    const isOffFlow = isOffFlowLeft || isOffFlowRight

    return { leftOffsetPercent, rightOffsetPercent, widthPercent, isOffFlowLeft, isOffFlowRight, isOffFlow }
  }, [offsetPx, width, bpToPx])

  useEffect(() => {
    if (!adapterConfig) {
      console.log('[LoraxPlugin] adapter config not available')
      return
    }

    let cancelled = false

    const run = async () => {
      try {
        const { pluginManager } = getEnv(model)
        const { dataAdapter } = await getAdapter(
          pluginManager,
          session?.id || 'default',
          adapterConfig,
        )

        if (!hasLoadFile(dataAdapter)) {
          console.warn('[LoraxPlugin] adapter does not implement loadFile')
          return
        }

        const result = (await dataAdapter.loadFile()) as LoadFileResult
        if (cancelled) {
          return
        }
        setLoadResult(result)
        setLoadError(null)
        console.log('[LoraxPlugin] load_file result', { hasConfig: !!result?.config, loraxSid: result?.loraxSid, intervalsCount: (result?.config as { intervals?: unknown[] })?.intervals?.length })
      } catch (error) {
        if (cancelled) {
          return
        }
        const err = error instanceof Error ? error : new Error(String(error))
        setLoadError(err)
        console.error('[LoraxPlugin] load_file error', err)
      }
    }

    run()

    return () => {
      cancelled = true
    }
  }, [adapterConfig, model])

  const apiBase = useMemo(() => {
    if (!adapterConfig) return window.location.origin
    return (readConfObject(adapterConfig, 'apiBase') as string) || window.location.origin
  }, [adapterConfig])

  const isProd = useMemo(() => {
    if (!adapterConfig) return false
    return Boolean(readConfObject(adapterConfig, 'isProd'))
  }, [adapterConfig])

  const viewConfig = useMemo(
    () => ({
      ortho: { enabled: true, x: '0%',
        y: '5%',
        width: '100%',
        height: '95%' },
      genomeInfo: { enabled: true, x: '0%',
        y: '3%',
        width: '100%',
        height: '2%' },
      genomePositions: { enabled: false },

      treeTime: { enabled: false , x: '0%',
        y: '0%',
        width: '0%',
        height: '0%'},
    }),[])

  const intervalCoords = useMemo(() => {
    const blocks = view?.dynamicBlocks?.contentBlocks
    if (!blocks || blocks.length === 0) return null
    let minStart = Infinity
    let maxEnd = -Infinity
    for (const block of blocks) {
      const start = Math.floor(block.start ?? 0)
      const end = Math.ceil(block.end ?? 0)
      if (start < minStart) minStart = start
      if (end > maxEnd) maxEnd = end
    }
    if (!Number.isFinite(minStart) || !Number.isFinite(maxEnd) || minStart >= maxEnd) {
      return null
    }
    return [minStart, maxEnd] as [number, number]
  }, [view?.dynamicBlocks?.contentBlocks])

  useEffect(() => {
    if (!view?.dynamicBlocks?.contentBlocks) return
    console.log('[LoraxPlugin] dynamic blocks', {
      blocks: view.dynamicBlocks.contentBlocks.map(block => ({
        refName: block.refName,
        start: block.start,
        end: block.end,
      })),
      intervalCoords,
    })
  }, [view?.dynamicBlocks?.contentBlocks, intervalCoords])

  useEffect(() => {
    const element = trackContainerRef.current
    if (!element) {
      setTrackHeight(height)
      return
    }

    const updateTrackHeight = (nextHeight: number) => {
      setTrackHeight(nextHeight > 0 ? nextHeight : height)
    }

    updateTrackHeight(element.getBoundingClientRect().height)

    if (typeof ResizeObserver === 'undefined') {
      return
    }

    const resizeObserver = new ResizeObserver(entries => {
      updateTrackHeight(entries[0]?.contentRect.height ?? 0)
    })
    resizeObserver.observe(element)

    return () => {
      resizeObserver.disconnect()
    }
  }, [height])

  if (!view) {
    return null
  }

  if (loadError) {
    console.error('[LoraxPlugin] load_file error', loadError)
  }

  return (
    <div ref={trackContainerRef} style={{ height: '100%' }}>
      <LoraxProvider
        apiBase={apiBase}
        isProd={isProd}
        enableConfig
        rpcManager={session?.rpcManager}
        rpcSessionId={session?.id || 'default'}
        urlSyncEnabled={false}
        disableInlineWorkers
        sessionOverride={loadResult?.loraxSid}
      >
        <LoraxDeckContainer
          loadResult={loadResult}
          height={trackHeight}
          viewConfig={viewConfig}
          intervalCoords={intervalCoords}
          offsetPercent={offsetPercent}
        />
      </LoraxProvider>
    </div>
  )
})

export default LoraxComponent
