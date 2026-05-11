import React from 'react';

const DEFAULT_OFFSET_X = 16;
const DEFAULT_OFFSET_Y = -8;
const DEFAULT_VIEWPORT_PADDING = 12;
const DEFAULT_MAX_WIDTH = 320;
const DEFAULT_MAX_HEIGHT = 360;
const DEFAULT_MIN_HEIGHT = 120;
const DEFAULT_ROW_HEIGHT = 30;
const DEFAULT_BASE_HEIGHT = 28;
const DEFAULT_TITLE_HEIGHT = 28;

const tooltipContainerStyle = {
  position: 'fixed',
  zIndex: 99999,
  pointerEvents: 'none',
  backgroundColor: '#fff',
  boxShadow: '0 4px 20px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)',
  borderRadius: 10,
  minWidth: 180,
  maxWidth: DEFAULT_MAX_WIDTH,
  border: '1px solid rgba(0,0,0,0.08)',
  overflowY: 'auto',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
};

const tooltipContentStyle = {
  padding: '10px 12px',
  fontSize: 13,
  color: '#374151'
};

const tooltipTitleStyle = {
  fontWeight: 700,
  color: '#111827',
  marginBottom: 6
};

const tooltipRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  padding: '3px 0',
  borderBottom: '1px solid #f3f4f6'
};

const tooltipLabelStyle = {
  color: '#6b7280',
  fontWeight: 500
};

const tooltipValueStyle = {
  fontWeight: 600,
  color: '#111827',
  maxWidth: 180,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  textAlign: 'right'
};

export function formatTooltipTime(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs < 0.001 || abs >= 1000000) return n.toExponential(3);
  return Number(n.toPrecision(6)).toString();
}

export function formatTooltipValue(value) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function getTooltipClientCoords(info, event) {
  const src = event?.srcEvent;
  const clientX = src?.clientX;
  const clientY = src?.clientY;
  const x = Number.isFinite(clientX) ? clientX : info?.x;
  const y = Number.isFinite(clientY) ? clientY : info?.y;

  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

export function getHoverTooltipPositionStyle(tooltip, options = {}) {
  const {
    offsetX = DEFAULT_OFFSET_X,
    offsetY = DEFAULT_OFFSET_Y,
    viewportPadding = DEFAULT_VIEWPORT_PADDING,
    maxWidth = DEFAULT_MAX_WIDTH,
    maxHeight = DEFAULT_MAX_HEIGHT,
    minHeight = DEFAULT_MIN_HEIGHT,
    rowHeight = DEFAULT_ROW_HEIGHT,
    baseHeight = DEFAULT_BASE_HEIGHT,
    titleHeight = DEFAULT_TITLE_HEIGHT
  } = options;

  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 0;
  const boundedMaxHeight = viewportHeight > 0
    ? Math.min(maxHeight, Math.max(minHeight, viewportHeight - viewportPadding * 2))
    : maxHeight;
  const rowCount = Array.isArray(tooltip?.rows) ? tooltip.rows.length : 0;
  const estimatedHeight = Math.min(
    boundedMaxHeight,
    baseHeight + (tooltip?.title ? titleHeight : 0) + rowCount * rowHeight
  );

  let left = tooltip.x + offsetX;
  if (viewportWidth > 0 && left + maxWidth > viewportWidth - viewportPadding) {
    left = tooltip.x - maxWidth - offsetX;
  }
  if (viewportWidth > 0) {
    left = Math.min(
      Math.max(viewportPadding, left),
      Math.max(viewportPadding, viewportWidth - maxWidth - viewportPadding)
    );
  }

  let top = tooltip.y + offsetY;
  if (viewportHeight > 0) {
    top = Math.min(
      Math.max(viewportPadding, top),
      Math.max(viewportPadding, viewportHeight - estimatedHeight - viewportPadding)
    );
  }

  return { left, top, maxHeight: boundedMaxHeight };
}

function renderTooltipValue(value) {
  if (React.isValidElement(value)) return value;
  return formatTooltipValue(value);
}

const HoverTooltip = React.memo(({
  tooltip,
  x,
  y,
  title,
  rows,
  positionOptions,
  style,
  contentStyle,
  titleStyle,
  rowStyle,
  labelStyle,
  valueStyle
}) => {
  const data = tooltip || { x, y, title, rows };

  if (!data || !Number.isFinite(data.x) || !Number.isFinite(data.y)) {
    return null;
  }

  const positionStyle = getHoverTooltipPositionStyle(data, positionOptions);

  return (
    <div
      role="tooltip"
      style={{
        ...tooltipContainerStyle,
        ...positionStyle,
        ...style
      }}
    >
      <div style={{ ...tooltipContentStyle, ...contentStyle }}>
        {data.title && (
          <div style={{ ...tooltipTitleStyle, ...titleStyle }}>
            {data.title}
          </div>
        )}
        {Array.isArray(data.rows) && data.rows.map((row, idx) => (
          <div
            key={`${row.k ?? row.label ?? 'row'}-${idx}`}
            style={{ ...tooltipRowStyle, ...rowStyle }}
          >
            <span style={{ ...tooltipLabelStyle, ...labelStyle }}>
              {row.k ?? row.label}
            </span>
            <span style={{ ...tooltipValueStyle, ...valueStyle }}>
              {renderTooltipValue(row.v ?? row.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
});

HoverTooltip.displayName = 'HoverTooltip';

export default HoverTooltip;
