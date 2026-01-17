import React, { useMemo } from 'react';

/**
 * TreePolygonOverlay - SVG overlay component for rendering tree trapezoid polygons.
 * Positioned absolutely over the deck.gl canvas for cross-viewport geometry.
 *
 * @param {Object} props
 * @param {Array} props.polygons - Array of polygon objects with { key, vertices, treeIndex, isHovered }
 * @param {Array} props.fillColor - RGBA array [r, g, b, a] (0-255 each), default [145, 194, 244, 46]
 * @param {Array} props.hoverFillColor - RGBA for hover state (auto-computed if not provided)
 * @param {Array} props.strokeColor - RGBA for stroke (optional)
 * @param {number} props.strokeWidth - Stroke width in pixels (optional)
 * @param {boolean} props.enableTransitions - Enable CSS transitions for fill changes (default: true)
 * @param {Function} props.onHover - Called with polygon key on hover, null on leave
 * @param {Function} props.onClick - Called with polygon key on click
 * @param {Object} props.style - Additional styles for the SVG container
 */
const TreePolygonOverlay = React.memo(({
  polygons = [],
  fillColor = [145, 194, 244, 46],
  hoverFillColor,
  strokeColor,
  strokeWidth = 0,
  enableTransitions = true,
  onHover,
  onClick,
  style
}) => {
  // Convert RGBA arrays to CSS strings
  const colors = useMemo(() => {
    const normalFill = `rgba(${fillColor[0]}, ${fillColor[1]}, ${fillColor[2]}, ${fillColor[3] / 255})`;

    // Auto-compute hover color if not provided (2x alpha, capped at 255)
    const hoverRgba = hoverFillColor || [
      fillColor[0],
      fillColor[1],
      fillColor[2],
      Math.min(fillColor[3] * 2, 255)
    ];
    const hoverFill = `rgba(${hoverRgba[0]}, ${hoverRgba[1]}, ${hoverRgba[2]}, ${hoverRgba[3] / 255})`;

    const stroke = strokeColor
      ? `rgba(${strokeColor[0]}, ${strokeColor[1]}, ${strokeColor[2]}, ${strokeColor[3] / 255})`
      : 'none';

    return { normalFill, hoverFill, stroke };
  }, [fillColor, hoverFillColor, strokeColor]);

  if (!polygons || polygons.length === 0) {
    return null;
  }

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
        ...style
      }}
    >
      {polygons.map(({ key, vertices, treeIndex, isHovered }) => {
        if (!vertices || vertices.length === 0) return null;

        const pointsStr = vertices.map(([x, y]) => `${x},${y}`).join(' ');
        const currentFill = isHovered ? colors.hoverFill : colors.normalFill;

        return (
          <polygon
            key={key}
            points={pointsStr}
            fill={currentFill}
            stroke={colors.stroke}
            strokeWidth={strokeWidth}
            style={{
              cursor: 'pointer',
              pointerEvents: 'auto',
              transition: enableTransitions ? 'fill 0.15s ease-out' : 'none'
            }}
            onMouseEnter={(e) => {
              e.target.setAttribute('fill', colors.hoverFill);
              onHover?.(key);
            }}
            onMouseLeave={(e) => {
              e.target.setAttribute('fill', colors.normalFill);
              onHover?.(null);
            }}
            onClick={() => onClick?.(key)}
            data-tree-index={treeIndex}
          />
        );
      })}
    </svg>
  );
});

TreePolygonOverlay.displayName = 'TreePolygonOverlay';

export default TreePolygonOverlay;
