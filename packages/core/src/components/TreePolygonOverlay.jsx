import React, { useMemo, useCallback } from 'react';

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
 * @param {Object} props.treeColors - Per-tree color overrides { [treeIndex]: '#hexcolor' }
 * @param {Function} props.onHover - Called with polygon key on hover, null on leave
 * @param {Function} props.onClick - Called on click with payload: { key, treeIndex, polygon }
 * @param {Object} props.style - Additional styles for the SVG container
 */
const TreePolygonOverlay = React.memo(({
  polygons = [],
  fillColor = [145, 194, 244, 46],
  hoverFillColor,
  strokeColor,
  strokeWidth = 0,
  enableTransitions = true,
  treeColors = {},
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

  // Helper to get per-tree fill color (custom or default)
  const getTreeFillColor = useCallback((treeIndex, isHovered) => {
    const customColor = treeColors[treeIndex];
    if (customColor) {
      // Convert hex to rgba
      const hex = customColor.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      const alpha = isHovered ? 0.36 : 0.18;
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return isHovered ? colors.hoverFill : colors.normalFill;
  }, [treeColors, colors]);

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
        const currentFill = getTreeFillColor(treeIndex, isHovered);
        const polygon = { key, vertices, treeIndex, isHovered };

        return (
          <polygon
            key={key}
            points={pointsStr}
            fill={currentFill}
            stroke={colors.stroke}
            strokeWidth={strokeWidth}
            style={{
              cursor: 'pointer',
              // Important: do NOT intercept pointer events; tip/edge interactions happen in deck.gl
              pointerEvents: 'none',
              transition: enableTransitions ? 'fill 0.15s ease-out' : 'none'
            }}
            data-tree-index={treeIndex}
          />
        );
      })}
    </svg>
  );
});

TreePolygonOverlay.displayName = 'TreePolygonOverlay';

export default TreePolygonOverlay;
