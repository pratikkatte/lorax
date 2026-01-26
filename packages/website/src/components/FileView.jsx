import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useLorax, LoraxDeckGL } from '@lorax/core';
import PositionSlider from './PositionSlider';
import ViewportOverlay from './ViewportOverlay';
import Info from './Info';
import Settings from './Settings';
import { useViewportDimensions } from '../hooks/useViewportDimensions';

/**
 * FileView component - displays loaded file with viewport and position controls.
 * Handles both navigation from LandingPage and direct URL access.
 */
function FileView() {
  const { file } = useParams();
  const [searchParams] = useSearchParams();
  const deckRef = useRef(null);

  const {
    queryFile,
    handleConfigUpdate,
    tsconfig,
    filename,
    genomeLength,
    isConnected,
    queryDetails,
    // For tip hover tooltip value computation
    selectedColorBy,
    metadataArrays
  } = useLorax();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [genomicPosition, setGenomicPosition] = useState(null); // [start, end] - synced with deck
  const [statusMessage, setStatusMessage] = useState(null);
  const [showInfo, setShowInfo] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [treeIsLoading, setTreeIsLoading] = useState(false);

  // Navigation state for mutation tab
  const [clickedGenomeInfo, setClickedGenomeInfo] = useState(null);
  const [highlightedMutationNode, setHighlightedMutationNode] = useState(null);

  // Right-panel details (populated by queryDetails)
  const [treeDetails, setTreeDetails] = useState(null);
  const [nodeDetails, setNodeDetails] = useState(null);
  const [individualDetails, setIndividualDetails] = useState(null);
  const [populationDetails, setPopulationDetails] = useState(null);
  const [nodeMutations, setNodeMutations] = useState(null);
  const [nodeEdges, setNodeEdges] = useState(null);

  // Extra: selected metadata key/value for a clicked tip
  const [selectedTipMetadata, setSelectedTipMetadata] = useState(null); // { key, value } | null

  // Visible trees state (array of tree indices visible in viewport)
  const [visibleTrees, setVisibleTrees] = useState([]);
  // Per-tree color customization { [treeIndex]: '#hexcolor' }
  const [treeColors, setTreeColors] = useState({});
  // Hovered tree index (for list-to-polygon hover sync)
  const [hoveredTreeIndex, setHoveredTreeIndex] = useState(null);
  // Polygon fill color [r, g, b, a]
  const [polygonFillColor, setPolygonFillColor] = useState([145, 194, 244, 46]);

  // Hover tooltip state (rendered in website, not in core)
  const [hoverTooltip, setHoverTooltip] = useState(null); // { kind, x, y, title, rows[] }

  const clearHoverTooltip = useCallback(() => setHoverTooltip(null), []);

  const getSelectedMetadataValueForNode = useCallback((nodeId) => {
    const key = selectedColorBy;
    if (!key) return null;
    const arr = metadataArrays?.[key];
    if (!arr) return null;
    const idx = arr.nodeIdToIdx?.get?.(nodeId);
    if (idx === undefined) return null;
    const valueIdx = arr.indices?.[idx];
    return arr.uniqueValues?.[valueIdx] ?? null;
  }, [selectedColorBy, metadataArrays]);

  const setTooltipFromEvent = useCallback((base, info, event) => {
    // Prefer DOM coordinates when available, fall back to deck.gl's canvas-relative coords.
    const src = event?.srcEvent;
    const clientX = src?.clientX;
    const clientY = src?.clientY;
    const x = Number.isFinite(clientX) ? clientX : info?.x;
    const y = Number.isFinite(clientY) ? clientY : info?.y;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    setHoverTooltip({ ...base, x, y });
  }, []);

  const resetDetails = useCallback(() => {
    setTreeDetails(null);
    setNodeDetails(null);
    setIndividualDetails(null);
    setPopulationDetails(null);
    setNodeMutations(null);
    setNodeEdges(null);
    setSelectedTipMetadata(null);
  }, []);

  // Convenience: populate right-panel from queryDetails response
  const applyDetailsResponse = useCallback((data) => {
    setTreeDetails(data?.tree ?? null);
    setNodeDetails(data?.node ?? null);
    setIndividualDetails(data?.individual ?? null);
    setPopulationDetails(data?.population ?? null);
    setNodeMutations(data?.mutations ?? null);
    setNodeEdges(data?.edges ?? null);
  }, []);

  // Keep tooltip label stable for current selection
  const selectedColorByLabel = useMemo(() => selectedColorBy || null, [selectedColorBy]);

  // Viewport and view dimensions with localStorage persistence
  const {
    viewport,
    views,
    updateViewport,
    updateView
  } = useViewportDimensions();

  // Get project and genomic coordinates from URL params
  const project = searchParams.get('project');
  const sid = searchParams.get('sid');
  const genomiccoordstart = searchParams.get('genomiccoordstart');
  const genomiccoordend = searchParams.get('genomiccoordend');

  // Load file config from URL params if not already loaded
  useEffect(() => {
    // Only load if we have required params and config isn't loaded for this file
    if (file && project && isConnected && !tsconfig?.filename) {
      setLoading(true);
      setError(null);
      setStatusMessage({ status: 'loading', message: 'Loading config...' });

      // Build payload with genomic coords if present
      const payload = {
        file,
        project,
        share_sid: sid
      };

      if (genomiccoordstart && genomiccoordend) {
        payload.genomiccoordstart = parseInt(genomiccoordstart, 10);
        payload.genomiccoordend = parseInt(genomiccoordend, 10);
      }

      queryFile(payload)
        .then(result => {
          if (result && result.config) {
            // Pass null for value - backend initial_position takes precedence
            handleConfigUpdate(result.config, null, project, sid);
          }
        })
        .catch(err => {
          console.error('FileView: Error loading config:', err);
          setError(err.message || 'Failed to load file');
        })
        .finally(() => {
          setLoading(false);
          setStatusMessage(null);
        });
    }
  }, [file, project, sid, genomiccoordstart, genomiccoordend, isConnected, tsconfig?.filename, queryFile, handleConfigUpdate]);

  // Initialize position when config loads (only if deck hasn't set it yet)
  useEffect(() => {
    if (tsconfig && genomeLength && !genomicPosition) {
      // Use value from config if available, otherwise full genome range
      const initialValue = tsconfig.value || [0, genomeLength];
      setGenomicPosition(initialValue);
    }
  }, [tsconfig, genomeLength, genomicPosition]);

  // Handle navigation from mutation click - zoom to tree
  useEffect(() => {
    if (clickedGenomeInfo && deckRef.current?.setGenomicCoords) {
      const newPosition = [clickedGenomeInfo.s, clickedGenomeInfo.e];
      deckRef.current.setGenomicCoords(newPosition);
      // Clear after navigation to allow clicking same mutation again
      setClickedGenomeInfo(null);
    }
  }, [clickedGenomeInfo]);

  // Callback when deck.gl view changes (pan/zoom) - syncs deck → slider
  const handleGenomicCoordsChange = useCallback((coords) => {
    if (coords) {
      setGenomicPosition(coords);
    }
  }, []);

  // Handle slider position change - syncs slider → deck
  const handlePositionChange = useCallback((newPosition) => {
    setGenomicPosition(newPosition);
    // Update deck view via ref
    if (deckRef.current?.setGenomicCoords) {
      deckRef.current.setGenomicCoords(newPosition);
    }
  }, []);

  // Handle tree loading state changes from LoraxDeckGL
  const handleTreeLoadingChange = useCallback((loading) => {
    setTreeIsLoading(loading);
  }, []);

  // Handle visible trees change from LoraxDeckGL
  const handleVisibleTreesChange = useCallback((trees) => {
    setVisibleTrees(trees || []);
  }, []);

  const handlePolygonClick = useCallback(async (payload) => {
    const treeIndex = payload?.treeIndex;
    if (treeIndex == null) return;

    try {
      const intervals = tsconfig?.intervals;
      if (!Array.isArray(intervals)) return;

      const start = intervals[treeIndex];
      const end = intervals[treeIndex + 1];
      if (!Number.isFinite(start) || !Number.isFinite(end)) return;

      // Zoom to the clicked tree interval
      setGenomicPosition([start, end]);
      deckRef.current?.setGenomicCoords?.([start, end]);
    } catch (err) {
      console.error('[FileView] Failed to zoom to polygon interval:', err);
    }
  }, [tsconfig?.intervals]);

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Position Slider - Header bar */}
      <PositionSlider
        filename={filename || file}
        genomeLength={genomeLength}
        value={genomicPosition}
        onChange={handlePositionChange}
        project={project}
        tsconfig={tsconfig}
      />

      {/* Main viewport area */}
      <div className="flex-1 relative bg-white">
        {/* ViewportOverlay - Container box with loading state */}
        <ViewportOverlay
          statusMessage={loading ? { status: 'loading', message: 'Loading config...' } : statusMessage}
          filename={filename || file}
          viewport={viewport}
          onViewportChange={updateViewport}
          views={views}
          onViewChange={updateView}
          resizable={!loading && !error && tsconfig}
          treeIsLoading={treeIsLoading}
        />

        {/* Error display */}
        {error && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
              <h3 className="text-lg font-semibold text-red-800">Error</h3>
              <p className="text-red-600 mt-2">{error}</p>
              <a
                href="/"
                className="inline-block mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Back to Projects
              </a>
            </div>
          </div>
        )}

        {/* LoraxDeckGL canvas - renders when config is loaded */}
        {!loading && !error && tsconfig && (
          <div
            style={{
              position: 'absolute',
              top: viewport.top,
              left: viewport.left,
              width: viewport.width,
              height: viewport.height
            }}
          >
            <LoraxDeckGL
              ref={deckRef}
              viewConfig={{
                ortho: { enabled: true, ...views?.ortho },
                genomeInfo: { enabled: true, ...views?.genomeInfo },
                genomePositions: { enabled: true, ...views?.genomePositions },
                treeTime: { enabled: true, ...views?.treeTime }
              }}
              onGenomicCoordsChange={handleGenomicCoordsChange}
              onTreeLoadingChange={handleTreeLoadingChange}
              onVisibleTreesChange={handleVisibleTreesChange}
              hoveredTreeIndex={hoveredTreeIndex}
              polygonOptions={{ treeColors, fillColor: polygonFillColor }}
              onPolygonClick={handlePolygonClick}
              onTipHover={(tip, info, event) => {
                if (!tip) {
                  clearHoverTooltip();
                  return;
                }
                const value = getSelectedMetadataValueForNode(tip.node_id);
                setTooltipFromEvent({
                  kind: 'tip',
                  title: 'Tip',
                  rows: [
                    { k: 'Tree', v: tip.tree_idx },
                    { k: 'Name', v: tip.name || tip.node_id },
                    ...(selectedColorByLabel ? [{ k: selectedColorByLabel, v: value ?? '-' }] : [])
                  ]
                }, info, event);
              }}
              onTipClick={async (tip) => {
                if (tip?.tree_idx == null || tip?.node_id == null) return;
                try {
                  setShowInfo(true);
                  resetDetails();
                  const details = await queryDetails({
                    treeIndex: tip.tree_idx,
                    node: tip.node_id,
                    comprehensive: true
                  });
                  applyDetailsResponse(details);
                  if (selectedColorByLabel) {
                    const value = getSelectedMetadataValueForNode(tip.node_id);
                    setSelectedTipMetadata({ key: selectedColorByLabel, value: value ?? '-' });
                  }
                } catch (e) {
                  console.error('[FileView] tip click queryDetails failed:', e);
                }
              }}
              onEdgeHover={(edge, info, event) => {
                if (!edge) {
                  clearHoverTooltip();
                  return;
                }
                setTooltipFromEvent({
                  kind: 'edge',
                  title: 'Edge',
                  rows: [
                    { k: 'Tree', v: edge.tree_idx },
                    { k: 'Parent', v: edge.parent_id },
                    { k: 'Child', v: edge.child_id }
                  ]
                }, info, event);
              }}
              onEdgeClick={async (edge) => {
                if (!edge?.tree_idx && edge?.tree_idx !== 0) return;
                try {
                  setShowInfo(true);
                  resetDetails();
                  const details = await queryDetails({ treeIndex: edge.tree_idx });
                  applyDetailsResponse(details);
                } catch (e) {
                  console.error('[FileView] edge click queryDetails failed:', e);
                }
              }}
            />

            {/* Hover tooltip (website-owned UI) */}
            {hoverTooltip && Number.isFinite(hoverTooltip.x) && Number.isFinite(hoverTooltip.y) && (
              <div
                style={{
                  position: 'fixed',
                  left: hoverTooltip.x + 16,
                  top: hoverTooltip.y - 8,
                  zIndex: 99999,
                  pointerEvents: 'none',
                  backgroundColor: '#fff',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)',
                  borderRadius: 10,
                  minWidth: 180,
                  maxWidth: 320,
                  border: '1px solid rgba(0,0,0,0.08)',
                  overflow: 'hidden',
                  fontFamily: '-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif',
                }}
              >
                <div style={{ padding: '10px 12px', fontSize: '13px', color: '#374151' }}>
                  {hoverTooltip.title && (
                    <div style={{ fontWeight: 700, color: '#111827', marginBottom: 6 }}>
                      {hoverTooltip.title}
                    </div>
                  )}
                  {Array.isArray(hoverTooltip.rows) && hoverTooltip.rows.map((row) => (
                    <div key={row.k} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #f3f4f6' }}>
                      <span style={{ color: '#6b7280', fontWeight: 500 }}>{row.k}</span>
                      <span style={{ fontWeight: 600, color: '#111827', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {String(row.v)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Right icon bar */}
        <div className="fixed top-0 right-0 h-full w-8 hover:w-12 bg-slate-900 border-l border-slate-800 text-slate-400 z-[101] flex flex-col items-center py-4 space-y-4 shadow-2xl transition-all duration-200">
          {/* Info button */}
          <button
            onClick={() => {
              setShowSettings(false);
              setShowInfo(!showInfo);
            }}
            className={`group relative p-2 rounded-lg transition-colors ${
              showInfo
                ? 'bg-emerald-600 text-white'
                : 'hover:bg-slate-800 hover:text-white'
            }`}
            title="Info & Filters"
          >
            {/* Kanban/list icon */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
            </svg>
            {/* Tooltip */}
            <span className="absolute left-full ml-2 px-2 py-1 text-xs text-white bg-slate-800 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              Info & Filters
            </span>
          </button>

          {/* Settings button */}
          <button
            onClick={() => {
              setShowInfo(false);
              setShowSettings(!showSettings);
            }}
            className={`group relative p-2 rounded-lg transition-colors ${
              showSettings
                ? 'bg-emerald-600 text-white'
                : 'hover:bg-slate-800 hover:text-white'
            }`}
            title="Settings"
          >
            {/* Gear icon */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {/* Tooltip */}
            <span className="absolute left-full ml-2 px-2 py-1 text-xs text-white bg-slate-800 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              Settings
            </span>
          </button>

          {/* Screenshot button - hidden for now
          <button
            onClick={() => deckRef.current?.captureSVG?.(polygonFillColor)}
            className="group relative p-2 rounded-lg transition-colors hover:bg-slate-800 hover:text-white"
            title="Export SVG"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="absolute left-full ml-2 px-2 py-1 text-xs text-white bg-slate-800 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              Export SVG
            </span>
          </button>
          */}
        </div>

        {/* Info Panel - Right sidebar (offset for icon bar) */}
        <div
          className={`fixed top-0 right-8 w-[25%] min-w-[320px] h-full z-50 shadow-xl transition-transform duration-300 ease-in-out ${showInfo ? 'translate-x-0' : 'translate-x-full'
            }`}
        >
          <Info
            setShowInfo={setShowInfo}
            genomicCoords={genomicPosition}
            setClickedGenomeInfo={setClickedGenomeInfo}
            setHighlightedMutationNode={setHighlightedMutationNode}
            treeDetails={treeDetails}
            nodeDetails={nodeDetails}
            individualDetails={individualDetails}
            populationDetails={populationDetails}
            nodeMutations={nodeMutations}
            nodeEdges={nodeEdges}
            selectedTipMetadata={selectedTipMetadata}
            visibleTrees={visibleTrees}
            treeColors={treeColors}
            setTreeColors={setTreeColors}
            hoveredTreeIndex={hoveredTreeIndex}
            setHoveredTreeIndex={setHoveredTreeIndex}
          />
        </div>

        {/* Settings Panel - Right sidebar (offset for icon bar) */}
        <div
          className={`fixed top-0 right-8 w-[25%] min-w-[320px] h-full z-50 shadow-xl transition-transform duration-300 ease-in-out ${showSettings ? 'translate-x-0' : 'translate-x-full'
            }`}
        >
          <Settings
            setShowSettings={setShowSettings}
            polygonFillColor={polygonFillColor}
            setPolygonFillColor={setPolygonFillColor}
          />
        </div>
      </div>
    </div>
  );
}

export default FileView;
