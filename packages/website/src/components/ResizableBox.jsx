import React, { useRef, useCallback, useState } from 'react';

/**
 * ResizableBox - Wrapper component that adds drag-to-resize functionality
 * Supports resizing from all 8 edges/corners (n, s, e, w, nw, ne, sw, se)
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child elements
 * @param {Object} props.dimensions - Current dimensions { top, left, width, height } as percentages
 * @param {Function} props.onResize - Callback when dimensions change
 * @param {number} props.minWidth - Minimum width in pixels (default: 50)
 * @param {number} props.minHeight - Minimum height in pixels (default: 50)
 * @param {Object} props.style - Additional styles
 * @param {string} props.className - Additional CSS classes
 * @param {boolean} props.disabled - Disable resizing
 * @param {boolean} props.showHandles - Show visual handles (default: false)
 */
export function ResizableBox({
  children,
  dimensions,
  onResize,
  minWidth = 50,
  minHeight = 50,
  style = {},
  className = '',
  disabled = false,
  showHandles = false
}) {
  const boxRef = useRef(null);
  const [isResizing, setIsResizing] = useState(false);

  const startResize = useCallback((e, handle) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);

    const startX = e.clientX;
    const startY = e.clientY;
    const parent = boxRef.current?.parentElement;
    if (!parent) return;

    const parentRect = parent.getBoundingClientRect();

    // Convert percentages to pixels for calculation
    const startDims = {
      top: parseFloat(dimensions.top) / 100 * parentRect.height,
      left: parseFloat(dimensions.left) / 100 * parentRect.width,
      width: parseFloat(dimensions.width) / 100 * parentRect.width,
      height: parseFloat(dimensions.height) / 100 * parentRect.height
    };

    const onMouseMove = (moveE) => {
      const deltaX = moveE.clientX - startX;
      const deltaY = moveE.clientY - startY;

      let newDims = { ...startDims };

      // Handle different resize directions
      if (handle.includes('n')) {
        const newTop = startDims.top + deltaY;
        const newHeight = startDims.height - deltaY;
        if (newHeight >= minHeight && newTop >= 0) {
          newDims.top = newTop;
          newDims.height = newHeight;
        }
      }
      if (handle.includes('s')) {
        const newHeight = startDims.height + deltaY;
        if (newHeight >= minHeight) {
          newDims.height = newHeight;
        }
      }
      if (handle.includes('w')) {
        const newLeft = startDims.left + deltaX;
        const newWidth = startDims.width - deltaX;
        if (newWidth >= minWidth && newLeft >= 0) {
          newDims.left = newLeft;
          newDims.width = newWidth;
        }
      }
      if (handle.includes('e')) {
        const newWidth = startDims.width + deltaX;
        if (newWidth >= minWidth) {
          newDims.width = newWidth;
        }
      }

      // Convert back to percentages and call onResize
      onResize({
        top: `${(newDims.top / parentRect.height) * 100}%`,
        left: `${(newDims.left / parentRect.width) * 100}%`,
        width: `${(newDims.width / parentRect.width) * 100}%`,
        height: `${(newDims.height / parentRect.height) * 100}%`
      });
    };

    const onMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    // Prevent text selection while dragging
    document.body.style.cursor = getCursorForHandle(handle);
    document.body.style.userSelect = 'none';

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [dimensions, onResize, minWidth, minHeight, disabled]);

  const getCursorForHandle = (handle) => {
    const cursors = {
      n: 'n-resize',
      s: 's-resize',
      e: 'e-resize',
      w: 'w-resize',
      nw: 'nw-resize',
      ne: 'ne-resize',
      sw: 'sw-resize',
      se: 'se-resize'
    };
    return cursors[handle] || 'default';
  };

  const handleBaseStyle = {
    position: 'absolute',
    zIndex: 100,
    pointerEvents: disabled ? 'none' : 'auto',
    background: showHandles ? 'rgba(59, 130, 246, 0.5)' : 'transparent',
    borderRadius: showHandles ? '2px' : '0'
  };

  const cornerSize = 12;
  const edgeSize = 8;

  return (
    <div
      ref={boxRef}
      className={className}
      style={{
        position: 'absolute',
        top: dimensions.top,
        left: dimensions.left,
        width: dimensions.width,
        height: dimensions.height,
        boxSizing: 'border-box',
        pointerEvents: 'none',
        ...style
      }}
    >
      {children}

      {/* Corner handles - larger click targets at corners */}
      {/* Top-left */}
      <div
        style={{
          ...handleBaseStyle,
          top: -cornerSize / 2,
          left: -cornerSize / 2,
          width: cornerSize,
          height: cornerSize,
          cursor: 'nw-resize'
        }}
        onMouseDown={(e) => startResize(e, 'nw')}
      />
      {/* Top-right */}
      <div
        style={{
          ...handleBaseStyle,
          top: -cornerSize / 2,
          right: -cornerSize / 2,
          width: cornerSize,
          height: cornerSize,
          cursor: 'ne-resize'
        }}
        onMouseDown={(e) => startResize(e, 'ne')}
      />
      {/* Bottom-left */}
      <div
        style={{
          ...handleBaseStyle,
          bottom: -cornerSize / 2,
          left: -cornerSize / 2,
          width: cornerSize,
          height: cornerSize,
          cursor: 'sw-resize'
        }}
        onMouseDown={(e) => startResize(e, 'sw')}
      />
      {/* Bottom-right */}
      <div
        style={{
          ...handleBaseStyle,
          bottom: -cornerSize / 2,
          right: -cornerSize / 2,
          width: cornerSize,
          height: cornerSize,
          cursor: 'se-resize'
        }}
        onMouseDown={(e) => startResize(e, 'se')}
      />

      {/* Edge handles - thinner strips along edges */}
      {/* Top edge */}
      <div
        style={{
          ...handleBaseStyle,
          top: -edgeSize / 2,
          left: cornerSize,
          right: cornerSize,
          height: edgeSize,
          cursor: 'n-resize'
        }}
        onMouseDown={(e) => startResize(e, 'n')}
      />
      {/* Bottom edge */}
      <div
        style={{
          ...handleBaseStyle,
          bottom: -edgeSize / 2,
          left: cornerSize,
          right: cornerSize,
          height: edgeSize,
          cursor: 's-resize'
        }}
        onMouseDown={(e) => startResize(e, 's')}
      />
      {/* Left edge */}
      <div
        style={{
          ...handleBaseStyle,
          left: -edgeSize / 2,
          top: cornerSize,
          bottom: cornerSize,
          width: edgeSize,
          cursor: 'w-resize'
        }}
        onMouseDown={(e) => startResize(e, 'w')}
      />
      {/* Right edge */}
      <div
        style={{
          ...handleBaseStyle,
          right: -edgeSize / 2,
          top: cornerSize,
          bottom: cornerSize,
          width: edgeSize,
          cursor: 'e-resize'
        }}
        onMouseDown={(e) => startResize(e, 'e')}
      />
    </div>
  );
}

/**
 * ResizableDivider - A horizontal or vertical divider that can be dragged to resize adjacent sections
 *
 * @param {Object} props
 * @param {'horizontal'|'vertical'} props.direction - Divider direction
 * @param {string} props.position - Position as percentage (e.g., '5.8%')
 * @param {Function} props.onPositionChange - Callback when position changes
 * @param {boolean} props.disabled - Disable dragging
 */
export function ResizableDivider({
  direction = 'horizontal',
  position,
  onPositionChange,
  disabled = false,
  style = {}
}) {
  const dividerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const startDrag = useCallback((e) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);

    const parent = dividerRef.current?.parentElement;
    if (!parent) return;

    const parentRect = parent.getBoundingClientRect();
    const startPos = direction === 'horizontal' ? e.clientY : e.clientX;
    const startPercent = parseFloat(position);

    const onMouseMove = (moveE) => {
      const currentPos = direction === 'horizontal' ? moveE.clientY : moveE.clientX;
      const delta = currentPos - startPos;
      const parentSize = direction === 'horizontal' ? parentRect.height : parentRect.width;
      const deltaPercent = (delta / parentSize) * 100;
      const newPercent = Math.max(1, Math.min(99, startPercent + deltaPercent));

      onPositionChange(`${newPercent}%`);
    };

    const onMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = direction === 'horizontal' ? 'row-resize' : 'col-resize';
    document.body.style.userSelect = 'none';

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [direction, position, onPositionChange, disabled]);

  const isHorizontal = direction === 'horizontal';

  return (
    <div
      ref={dividerRef}
      style={{
        position: 'absolute',
        [isHorizontal ? 'top' : 'left']: position,
        [isHorizontal ? 'left' : 'top']: 0,
        [isHorizontal ? 'right' : 'bottom']: 0,
        [isHorizontal ? 'height' : 'width']: '8px',
        [isHorizontal ? 'width' : 'height']: '100%',
        transform: isHorizontal ? 'translateY(-50%)' : 'translateX(-50%)',
        cursor: disabled ? 'default' : (isHorizontal ? 'row-resize' : 'col-resize'),
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: disabled ? 'none' : 'auto',
        ...style
      }}
      onMouseDown={startDrag}
    >
      {/* Visual indicator line */}
      <div
        style={{
          [isHorizontal ? 'width' : 'height']: '100%',
          [isHorizontal ? 'height' : 'width']: '1px',
          backgroundColor: isDragging ? '#3b82f6' : '#e2e8f0',
          transition: 'background-color 0.15s'
        }}
      />
    </div>
  );
}
