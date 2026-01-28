import React from 'react';
import { ResizableBox, ResizableDivider } from './ResizableBox';

/**
 * ViewportOverlay - Resizable container box for tree visualization
 * Based on frontend's ViewportOverlay with added resize functionality
 *
 * @param {Object} props
 * @param {Object} props.statusMessage - Loading status message
 * @param {string} props.filename - Current filename
 * @param {Object} props.viewport - Viewport dimensions { top, left, width, height }
 * @param {Function} props.onViewportChange - Callback when viewport is resized
 * @param {Object} props.views - View dimensions for each section
 * @param {Function} props.onViewChange - Callback when a view section is resized
 * @param {boolean} props.resizable - Enable resize functionality (default: true)
 */
const ViewportOverlay = React.memo(({
  statusMessage,
  filename,
  viewport = { top: '1%', left: '5%', width: '95%', height: '85%' },
  onViewportChange,
  views,
  onViewChange,
  resizable = true,
  treeIsLoading = false,
  timelineLabel,
}) => {
  // Calculate divider positions based on view dimensions
  // genome-positions is at the top (y: 1%, height: 3%)
  // genome-info is below that (y: 4%, height: 2%)
  // ortho starts at y: 6%
  const genomePositionsDividerPos = views?.genomePositions
    ? `${parseFloat(views.genomePositions.y) + parseFloat(views.genomePositions.height)}%`
    : '4%';

  const genomeInfoDividerPos = views?.genomeInfo
    ? `${parseFloat(views.genomeInfo.y) + parseFloat(views.genomeInfo.height)}%`
    : '6%';

  // Handle divider position changes - update adjacent views
  const handleGenomePositionsDividerChange = (newPos) => {
    if (!onViewChange) return;
    const newPercent = parseFloat(newPos);

    // Update genome-positions height
    const gpY = parseFloat(views?.genomePositions?.y || '0');
    onViewChange('genomePositions', { height: `${newPercent - gpY}%` });

    // Update genome-info: y position AND recalculate height to maintain bottom boundary
    const giOldY = parseFloat(views?.genomeInfo?.y || '3');
    const giOldHeight = parseFloat(views?.genomeInfo?.height || '2');
    const giBottom = giOldY + giOldHeight; // preserve bottom boundary
    const newGiHeight = giBottom - newPercent;
    onViewChange('genomeInfo', { y: `${newPercent}%`, height: `${newGiHeight}%` });

    // Update treeTime: y matches genomeInfo, height spans to bottom (100%)
    const treeTimeHeight = 100 - newPercent;
    onViewChange('treeTime', { y: `${newPercent}%`, height: `${treeTimeHeight}%` });
  };

  const handleGenomeInfoDividerChange = (newPos) => {
    if (!onViewChange) return;
    const newPercent = parseFloat(newPos);

    // Update genome-info height
    const giY = parseFloat(views?.genomeInfo?.y || '4');
    onViewChange('genomeInfo', { height: `${newPercent - giY}%` });

    // Update ortho: y position AND recalculate height to maintain bottom boundary
    const orthoOldY = parseFloat(views?.ortho?.y || '6');
    const orthoOldHeight = parseFloat(views?.ortho?.height || '80');
    const orthoBottom = orthoOldY + orthoOldHeight; // preserve bottom boundary
    const newOrthoHeight = orthoBottom - newPercent;
    onViewChange('ortho', { y: `${newPercent}%`, height: `${newOrthoHeight}%` });
  };

  const content = (
    <>
      {/* Resizable Divider for Genome Positions / Genome Info boundary */}
      {resizable && views && (
        <ResizableDivider
          direction="horizontal"
          position={genomePositionsDividerPos}
          onPositionChange={handleGenomePositionsDividerChange}
        />
      )}

      {/* Resizable Divider for Genome Info / Ortho boundary */}
      {resizable && views && (
        <ResizableDivider
          direction="horizontal"
          position={genomeInfoDividerPos}
          onPositionChange={handleGenomeInfoDividerChange}
        />
      )}

      {/* Static divider lines (visual only when not resizable) */}
      {!resizable && (
        <>
          <div
            style={{
              position: 'absolute',
              top: '3.5%',
              left: 0,
              right: 0,
              height: '1px',
              backgroundColor: '#e2e8f0',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '5.8%',
              left: 0,
              right: 0,
              height: '1px',
              backgroundColor: '#e2e8f0',
            }}
          />
        </>
      )}

      {/* Border styling */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          border: '1px solid #cbd5e1',
          borderRadius: '8px',
          pointerEvents: 'none',
        }}
      />
    </>
  );

  return (
    <>
      {/* Main Genome Container Box - Resizable */}
      {resizable && onViewportChange ? (
        <ResizableBox
          dimensions={viewport}
          onResize={onViewportChange}
          minWidth={200}
          minHeight={100}
          style={{
            zIndex: 1,
            backgroundColor: 'transparent',
          }}
        >
          {content}
        </ResizableBox>
      ) : (
        <div
          style={{
            position: 'absolute',
            top: viewport.top,
            left: viewport.left,
            height: viewport.height,
            width: viewport.width,
            zIndex: 1,
            pointerEvents: 'none',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            backgroundColor: 'transparent',
          }}
        >
          {content}
        </div>
      )}

      {/* Timeline Label (Rotated, on left side) */}
      <div
        style={{
          position: 'absolute',
          top: views?.treeTime?.y || '6%',
          left: '0%',
          height: views?.treeTime?.height || '80%',
          width: '2%',
          zIndex: 11,
          pointerEvents: 'none',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            transform: 'rotate(-90deg)',
            whiteSpace: 'nowrap',
            fontSize: '10px',
            color: '#64748b',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
            opacity: 0.8,
          }}
        >
          {timelineLabel || 'Timeline'}
        </div>
      </div>

      {/* Loading Overlay - shown when loading */}
      {(statusMessage?.status === 'processing-file' ||
        statusMessage?.status === 'file-load' ||
        statusMessage?.status === 'loading') && (
          <div
            style={{
              position: 'absolute',
              top: views?.ortho?.y || '6%',
              left: viewport.left,
              height: views?.ortho?.height || '80%',
              width: viewport.width,
              zIndex: 20,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.7)',
              borderRadius: '0 0 8px 8px',
            }}
          >
            <div className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-white border border-slate-200 shadow-lg">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
              <div className="text-center">
                <h3 className="text-lg font-semibold text-slate-800">
                  {statusMessage?.message || 'Loading...'}
                </h3>
                {filename && (
                  <p className="text-sm text-slate-500">{filename}</p>
                )}
              </div>
            </div>
          </div>
        )}

      {/* Tree Fetching Overlay - semi-transparent, non-blocking */}
      {treeIsLoading && !statusMessage?.status && (
        <div
          style={{
            position: 'absolute',
            top: views?.ortho?.y || '6%',
            left: viewport.left,
            height: views?.ortho?.height || '80%',
            width: viewport.width,
            zIndex: 15,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.5)',
            borderRadius: '0 0 8px 8px',
            pointerEvents: 'none',
          }}
        >
          <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white/90 border border-slate-200 shadow-md">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
            <span className="text-sm font-medium text-slate-600">
              Fetching trees from backend...
            </span>
          </div>
        </div>
      )}
    </>
  );
});

ViewportOverlay.displayName = 'ViewportOverlay';

export default ViewportOverlay;
