/**
 * deckglToSvg.js
 * Export deck.gl visualization to SVG format, including tree geometry and polygon overlays.
 */

/**
 * Convert RGBA color array to CSS color string
 * @param {Array<number>} color - [r, g, b, a] with values 0-255
 * @returns {string} CSS color string
 */
function rgbaToCSS(color) {
  if (!color || color.length < 3) return 'rgba(0,0,0,1)';
  const [r, g, b, a = 255] = color;
  return `rgba(${r}, ${g}, ${b}, ${a / 255})`;
}

/**
 * Get the WebGL canvas from a deck.gl instance
 * @param {Object} deck - deck.gl Deck instance
 * @returns {HTMLCanvasElement|null}
 */
function getCanvas(deck) {
  return deck?.canvas || deck?.getCanvas?.() || null;
}

/**
 * Extract line data from deck.gl layers for SVG conversion
 * @param {Object} deck - deck.gl Deck instance
 * @returns {Array<Object>} Array of line objects with positions and colors
 */
function extractLineData(deck) {
  const lines = [];
  const layers = deck?.props?.layers || [];

  for (const layer of layers) {
    if (!layer?.props?.data) continue;

    // Handle LineLayer or similar layers with getSourcePosition/getTargetPosition
    if (layer.props.getSourcePosition && layer.props.getTargetPosition) {
      const data = Array.isArray(layer.props.data) ? layer.props.data : [];
      for (const d of data) {
        try {
          const source = typeof layer.props.getSourcePosition === 'function'
            ? layer.props.getSourcePosition(d)
            : d.sourcePosition;
          const target = typeof layer.props.getTargetPosition === 'function'
            ? layer.props.getTargetPosition(d)
            : d.targetPosition;
          const color = typeof layer.props.getColor === 'function'
            ? layer.props.getColor(d)
            : layer.props.getColor || [0, 0, 0, 255];

          if (source && target) {
            lines.push({ source, target, color, width: layer.props.getWidth?.(d) || 1 });
          }
        } catch (e) {
          // Skip invalid data points
        }
      }
    }

    // Handle PathLayer
    if (layer.props.getPath) {
      const data = Array.isArray(layer.props.data) ? layer.props.data : [];
      for (const d of data) {
        try {
          const path = typeof layer.props.getPath === 'function'
            ? layer.props.getPath(d)
            : d.path;
          const color = typeof layer.props.getColor === 'function'
            ? layer.props.getColor(d)
            : layer.props.getColor || [0, 0, 0, 255];

          if (path && path.length >= 2) {
            // Convert path to line segments
            for (let i = 0; i < path.length - 1; i++) {
              lines.push({
                source: path[i],
                target: path[i + 1],
                color,
                width: layer.props.getWidth?.(d) || 1
              });
            }
          }
        } catch (e) {
          // Skip invalid data points
        }
      }
    }
  }

  return lines;
}

/**
 * Project world coordinates to screen coordinates using deck.gl viewport
 * @param {Object} viewport - deck.gl Viewport instance
 * @param {Array<number>} position - [x, y] or [x, y, z] world coordinates
 * @returns {Array<number>} [x, y] screen coordinates
 */
function projectToScreen(viewport, position) {
  if (!viewport?.project) return null;
  try {
    return viewport.project(position);
  } catch (e) {
    return null;
  }
}

/**
 * Generate SVG content from deck.gl state
 * @param {Object} deck - deck.gl Deck instance
 * @param {Array<Array<[number, number]>>} polygonVertices - Array of polygon vertex arrays (already in screen coordinates)
 * @param {Array<number>} polygonColor - RGBA color for polygons [r, g, b, a]
 * @returns {string|null} SVG string or null if export fails
 */
export function getSVG(deck, polygonVertices = [], polygonColor = [145, 194, 244, 46]) {
  if (!deck) {
    console.warn('[getSVG] No deck instance provided');
    return null;
  }

  const canvas = getCanvas(deck);
  if (!canvas) {
    console.warn('[getSVG] Could not get canvas from deck');
    return null;
  }

  const width = canvas.width || canvas.clientWidth || 1920;
  const height = canvas.height || canvas.clientHeight || 1080;

  // Get viewports from deck
  const viewManager = deck.viewManager || deck._viewManager;
  const viewports = viewManager?.getViewports?.() || [];

  // Find the main ortho viewport
  const orthoViewport = viewports.find(vp => vp.id === 'ortho') || viewports[0];

  // Start building SVG
  const svgParts = [];
  svgParts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`);

  // Add background
  svgParts.push(`<rect width="${width}" height="${height}" fill="white"/>`);

  // Create clip paths for each viewport
  svgParts.push('<defs>');
  for (const vp of viewports) {
    const clipId = `clip-${vp.id || 'default'}`;
    svgParts.push(`<clipPath id="${clipId}">`);
    svgParts.push(`<rect x="${vp.x || 0}" y="${vp.y || 0}" width="${vp.width || width}" height="${vp.height || height}"/>`);
    svgParts.push('</clipPath>');
  }
  svgParts.push('</defs>');

  // Extract and render line data from layers
  const lines = extractLineData(deck);

  if (orthoViewport && lines.length > 0) {
    const clipId = `clip-${orthoViewport.id || 'default'}`;
    svgParts.push(`<g clip-path="url(#${clipId})">`);

    for (const line of lines) {
      const screenSource = projectToScreen(orthoViewport, line.source);
      const screenTarget = projectToScreen(orthoViewport, line.target);

      if (screenSource && screenTarget) {
        const colorCSS = rgbaToCSS(line.color);
        svgParts.push(
          `<line x1="${screenSource[0]}" y1="${screenSource[1]}" x2="${screenTarget[0]}" y2="${screenTarget[1]}" stroke="${colorCSS}" stroke-width="${line.width}"/>`
        );
      }
    }

    svgParts.push('</g>');
  }

  // Render polygon overlays
  if (polygonVertices && polygonVertices.length > 0) {
    const fillColor = rgbaToCSS(polygonColor);

    svgParts.push('<g id="polygon-overlays">');
    for (let i = 0; i < polygonVertices.length; i++) {
      const vertices = polygonVertices[i];
      if (!vertices || vertices.length < 3) continue;

      const pointsStr = vertices.map(([x, y]) => `${x},${y}`).join(' ');
      svgParts.push(
        `<polygon points="${pointsStr}" fill="${fillColor}" stroke="none"/>`
      );
    }
    svgParts.push('</g>');
  }

  // Try to include canvas content as base64 image (fallback for complex rendering)
  try {
    const dataURL = canvas.toDataURL('image/png');
    // Insert image behind vector elements
    const insertIndex = svgParts.indexOf('<rect width=') > -1 ? 2 : 1;
    svgParts.splice(insertIndex, 0,
      `<image href="${dataURL}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="none"/>`
    );
  } catch (e) {
    console.warn('[getSVG] Could not convert canvas to data URL:', e.message);
  }

  svgParts.push('</svg>');

  return svgParts.join('\n');
}

export default getSVG;
