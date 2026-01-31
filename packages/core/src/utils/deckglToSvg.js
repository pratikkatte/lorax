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
 * Extract all layers (including sublayers) from deck.gl
 * @param {Object} deck - deck.gl Deck instance
 * @returns {Array<Object>} Flattened layer list
 */
function getAllLayers(deck) {
  const layers = (
    deck?.layerManager?.getLayers?.() ||
    deck?.getLayers?.() ||
    deck?.props?.layers ||
    []
  );
  return layers;
}

function normalizeColor(color, fallback = [0, 0, 0, 255]) {
  if (Array.isArray(color) && color.length >= 3) return color;
  return fallback;
}

function resolveViewportId(layer) {
  const viewId = layer?.props?.viewId;
  if (viewId) return viewId;
  const lid = layer?.id || '';
  if (lid.startsWith('genome-positions')) return 'genome-positions';
  if (lid.startsWith('genome-info')) return 'genome-info';
  if (lid.startsWith('tree-time')) return 'tree-time';
  if (lid.startsWith('main') || lid.startsWith('postorder')) return 'ortho';
  return 'ortho';
}

function applyModelMatrix(position, modelMatrix) {
  if (!modelMatrix || !Array.isArray(position)) return position;
  const x = position[0] ?? 0;
  const y = position[1] ?? 0;
  const z = position[2] ?? 0;
  return [
    x * modelMatrix[0] + y * modelMatrix[4] + z * modelMatrix[8] + modelMatrix[12],
    x * modelMatrix[1] + y * modelMatrix[5] + z * modelMatrix[9] + modelMatrix[13],
    x * modelMatrix[2] + y * modelMatrix[6] + z * modelMatrix[10] + modelMatrix[14]
  ];
}

function projectToCanvas(viewport, position, modelMatrix) {
  if (!viewport) return null;
  const worldPos = applyModelMatrix(position, modelMatrix);
  const projected = projectToScreen(viewport, worldPos);
  if (!projected) return null;
  const x = (projected[0] ?? 0) + (viewport.x ?? 0);
  const y = (projected[1] ?? 0) + (viewport.y ?? 0);
  return [x, y];
}

/**
 * Extract line data from deck.gl layers for SVG conversion
 * @param {Array<Object>} layers - deck.gl layers
 * @returns {Array<Object>} Array of line objects with positions and colors
 */
function extractLineData(layers) {
  const lines = [];

  for (const layer of layers) {
    if (!layer?.props?.data) continue;
    const viewportId = resolveViewportId(layer);
    const modelMatrix = layer.props.modelMatrix || null;
    const data = layer.props.data;

    // Handle LineLayer or similar layers with getSourcePosition/getTargetPosition
    if (layer.props.getSourcePosition && layer.props.getTargetPosition) {
      const list = Array.isArray(data) ? data : [];
      for (const d of list) {
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
            const width = typeof layer.props.getWidth === 'function'
              ? layer.props.getWidth(d)
              : (typeof layer.props.getWidth === 'number'
                ? layer.props.getWidth
                : (typeof layer.props.width === 'number' ? layer.props.width : 1));
            lines.push({
              source,
              target,
              color,
              width,
              viewportId,
              modelMatrix,
              layerId: layer?.id
            });
          }
        } catch (e) {
          // Skip invalid data points
        }
      }
    }

    // Handle PathLayer with array data
    if (layer.props.getPath) {
      const list = Array.isArray(data) ? data : [];
      for (const d of list) {
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
                width: layer.props.getWidth?.(d) || 1,
                viewportId,
                modelMatrix
              });
            }
          }
        } catch (e) {
          // Skip invalid data points
        }
      }
    }

    // Handle PathLayer with binary data
    const pathAttr = data?.attributes?.getPath?.value;
    const startIndices = data?.startIndices;
    if (pathAttr && startIndices && startIndices.length > 1) {
      const size = data?.attributes?.getPath?.size || 2;
      const color = normalizeColor(layer.props.getColor, [0, 0, 0, 255]);
      const width = typeof layer.props.getWidth === 'number' ? layer.props.getWidth : 1;
      for (let i = 0; i < startIndices.length - 1; i++) {
        const start = startIndices[i] * size;
        const end = startIndices[i + 1] * size;
        for (let j = start; j + size < end; j += size) {
          const source = [pathAttr[j], pathAttr[j + 1]];
          const target = [pathAttr[j + size], pathAttr[j + size + 1]];
          lines.push({ source, target, color, width, viewportId, modelMatrix });
        }
      }
    }
  }

  return lines;
}

/**
 * Extract scatterplot points from deck.gl layers
 * @param {Array<Object>} layers - deck.gl layers
 * @returns {Array<Object>} Array of points
 */
function extractScatterData(layers) {
  const points = [];

  for (const layer of layers) {
    const data = layer?.props?.data;
    if (!data || !layer?.props?.getPosition) {
      // binary scatterplot data may not have getPosition accessor
      if (!data?.attributes?.getPosition?.value) continue;
    }
    const viewportId = resolveViewportId(layer);
    const modelMatrix = layer.props.modelMatrix || null;
    // Array data
    if (Array.isArray(data)) {
      for (const d of data) {
        try {
          const position = typeof layer.props.getPosition === 'function'
            ? layer.props.getPosition(d)
            : d.position;
          if (!position) continue;
          const fillColor = typeof layer.props.getFillColor === 'function'
            ? layer.props.getFillColor(d)
            : layer.props.getFillColor || [0, 0, 0, 255];
          const lineColor = typeof layer.props.getLineColor === 'function'
            ? layer.props.getLineColor(d)
            : layer.props.getLineColor || null;
          const radius = typeof layer.props.getRadius === 'function'
            ? layer.props.getRadius(d)
            : layer.props.getRadius || 1;
          points.push({
            position,
            fillColor,
            lineColor,
            radius,
            stroked: layer.props.stroked || false,
            filled: layer.props.filled !== false,
            viewportId,
            modelMatrix,
            layerId: layer?.id,
            lineWidth: typeof layer.props.getLineWidth === 'function'
              ? layer.props.getLineWidth(d)
              : layer.props.getLineWidth || 1
          });
        } catch (e) {
          // Skip invalid data points
        }
      }
    }

    // Binary data
    if (data?.attributes?.getPosition?.value) {
      const positions = data.attributes.getPosition.value;
      const size = data.attributes.getPosition.size || 2;
      const length = data.length || Math.floor(positions.length / size);
      const fillColors = data.attributes.getFillColor?.value;
      const lineColors = data.attributes.getLineColor?.value;
      const defaultFill = normalizeColor(layer.props.getFillColor, [0, 0, 0, 255]);
      const defaultLine = layer.props.getLineColor ? normalizeColor(layer.props.getLineColor) : null;
      const radius = typeof layer.props.getRadius === 'number' ? layer.props.getRadius : 1;
      const lineWidth = typeof layer.props.getLineWidth === 'number'
        ? layer.props.getLineWidth
        : (typeof layer.props.lineWidth === 'number' ? layer.props.lineWidth : 1);
      for (let i = 0; i < length; i++) {
        const idx = i * size;
        const position = [positions[idx], positions[idx + 1]];
        const fillColor = fillColors
          ? [
              fillColors[i * 4],
              fillColors[i * 4 + 1],
              fillColors[i * 4 + 2],
              fillColors[i * 4 + 3]
            ]
          : defaultFill;
        const lineColor = lineColors
          ? [
              lineColors[i * 4],
              lineColors[i * 4 + 1],
              lineColors[i * 4 + 2],
              lineColors[i * 4 + 3]
            ]
          : defaultLine;
        points.push({
          position,
          fillColor,
          lineColor,
          radius,
          stroked: layer.props.stroked || false,
          filled: layer.props.filled !== false,
          viewportId,
          modelMatrix,
          layerId: layer?.id,
          lineWidth
        });
      }
    }
  }

  return points;
}

/**
 * Extract text labels from deck.gl layers
 * @param {Array<Object>} layers - deck.gl layers
 * @returns {Array<Object>} Array of text labels
 */
function extractTextData(layers) {
  const labels = [];

  for (const layer of layers) {
    const data = layer?.props?.data;
    if (!Array.isArray(data) || !layer?.props?.getText) continue;
    const viewportId = resolveViewportId(layer);
    const modelMatrix = layer.props.modelMatrix || null;

    for (const d of data) {
      try {
        const position = typeof layer.props.getPosition === 'function'
          ? layer.props.getPosition(d)
          : d.position;
        const text = typeof layer.props.getText === 'function'
          ? layer.props.getText(d)
          : d.text;
        if (!position || !text) continue;
        const color = typeof layer.props.getColor === 'function'
          ? layer.props.getColor(d)
          : layer.props.getColor || [0, 0, 0, 255];
        const size = typeof layer.props.getSize === 'function'
          ? layer.props.getSize(d)
          : layer.props.getSize || 12;
        const offset = typeof layer.props.getPixelOffset === 'function'
          ? layer.props.getPixelOffset(d)
          : layer.props.getPixelOffset || [0, 0];
        labels.push({
          position,
          text,
          color,
          size,
          offset,
          fontFamily: layer.props.fontFamily || 'sans-serif',
          textAnchor: layer.props.getTextAnchor || 'start',
          alignmentBaseline: layer.props.getAlignmentBaseline || 'central',
          viewportId,
          modelMatrix
        });
      } catch (e) {
        // Skip invalid data points
      }
    }
  }

  return labels;
}

/**
 * Extract icon positions (used for mutation markers)
 * @param {Array<Object>} layers - deck.gl layers
 * @returns {Array<Object>} Array of icons
 */
function extractIconData(layers) {
  const icons = [];
  for (const layer of layers) {
    const layerName = layer?.constructor?.layerName;
    const isMultiIconLayer = layerName === 'MultiIconLayer' || layer?.id?.includes('labels-characters');
    const isIconLayer = (layerName === 'IconLayer'
      || typeof layer?.props?.getIcon === 'function'
      || !!layer?.props?.iconAtlas
      || !!layer?.props?.iconMapping)
      && !isMultiIconLayer;
    if (!isIconLayer) continue;
    const data = layer?.props?.data;
    if (!Array.isArray(data) || !layer?.props?.getPosition) continue;
    const viewportId = resolveViewportId(layer);
    const modelMatrix = layer.props.modelMatrix || null;
    for (const d of data) {
      try {
        const position = typeof layer.props.getPosition === 'function'
          ? layer.props.getPosition(d)
          : d.position;
        if (!position) continue;
        const color = typeof layer.props.getColor === 'function'
          ? layer.props.getColor(d)
          : layer.props.getColor || [0, 0, 0, 255];
        const size = typeof layer.props.getSize === 'function'
          ? layer.props.getSize(d)
          : layer.props.getSize || 8;
        icons.push({ position, color, size, viewportId, modelMatrix, layerId: layer?.id });
      } catch (e) {
        // Skip invalid data points
      }
    }
  }
  return icons;
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
  const viewportMap = new Map(viewports.map((vp) => [vp.id, vp]));
  const getViewport = (viewportId) => (
    viewportMap.get(viewportId) ||
    viewports.find((vp) => vp.id === viewportId) ||
    viewports[0]
  );
  const layers = getAllLayers(deck);

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
  const lines = extractLineData(layers);
  const points = extractScatterData(layers);
  const labels = extractTextData(layers);
  const icons = extractIconData(layers);

  if (lines.length > 0) {
    for (const line of lines) {
      const viewport = getViewport(line.viewportId) || orthoViewport;
      if (!viewport) continue;
      const clipId = `clip-${viewport.id || 'default'}`;
      const screenSource = projectToCanvas(viewport, line.source, line.modelMatrix);
      const screenTarget = projectToCanvas(viewport, line.target, line.modelMatrix);
      if (!screenSource || !screenTarget) continue;
      const colorCSS = rgbaToCSS(line.color);
      svgParts.push(
        `<g clip-path="url(#${clipId})"><line x1="${screenSource[0]}" y1="${screenSource[1]}" x2="${screenTarget[0]}" y2="${screenTarget[1]}" stroke="${colorCSS}" stroke-width="${line.width}"/></g>`
      );
    }
  }

  if (points.length > 0) {
    for (const point of points) {
      const viewport = getViewport(point.viewportId) || orthoViewport;
      if (!viewport) continue;
      const clipId = `clip-${viewport.id || 'default'}`;
      const screenPos = projectToCanvas(viewport, point.position, point.modelMatrix);
      if (!screenPos) continue;
      const fillAlphaZero = Array.isArray(point.fillColor) && point.fillColor.length >= 4 && point.fillColor[3] === 0;
      const strokeAlphaZero = Array.isArray(point.lineColor) && point.lineColor.length >= 4 && point.lineColor[3] === 0;
      const fill = point.filled && !fillAlphaZero ? rgbaToCSS(point.fillColor) : 'none';
      const stroke = point.stroked && point.lineColor && !strokeAlphaZero ? rgbaToCSS(point.lineColor) : 'none';
      svgParts.push(
        `<g clip-path="url(#${clipId})"><circle cx="${screenPos[0]}" cy="${screenPos[1]}" r="${point.radius}" fill="${fill}" stroke="${stroke}" stroke-width="${point.lineWidth || 1}"/></g>`
      );
    }
  }

  if (labels.length > 0) {
    for (const label of labels) {
      const viewport = getViewport(label.viewportId) || orthoViewport;
      if (!viewport) continue;
      const clipId = `clip-${viewport.id || 'default'}`;
      const screenPos = projectToCanvas(viewport, label.position, label.modelMatrix);
      if (!screenPos) continue;
      const x = screenPos[0] + (label.offset?.[0] || 0);
      const y = screenPos[1] + (label.offset?.[1] || 0);
      const color = rgbaToCSS(label.color);
      svgParts.push(
        `<g clip-path="url(#${clipId})"><text x="${x}" y="${y}" fill="${color}" font-size="${label.size}" font-family="${label.fontFamily}" text-anchor="${label.textAnchor}" dominant-baseline="${label.alignmentBaseline}">${label.text}</text></g>`
      );
    }
  }

  if (icons.length > 0) {
    for (const icon of icons) {
      const viewport = getViewport(icon.viewportId) || orthoViewport;
      if (!viewport) continue;
      const clipId = `clip-${viewport.id || 'default'}`;
      const screenPos = projectToCanvas(viewport, icon.position, icon.modelMatrix);
      if (!screenPos) continue;
      const size = Math.max(2, icon.size / 2);
      const color = rgbaToCSS(icon.color);
      const x = screenPos[0];
      const y = screenPos[1];
      svgParts.push(
        `<g clip-path="url(#${clipId})"><line x1="${x - size}" y1="${y - size}" x2="${x + size}" y2="${y + size}" stroke="${color}" stroke-width="1"/></g>`
      );
      svgParts.push(
        `<g clip-path="url(#${clipId})"><line x1="${x - size}" y1="${y + size}" x2="${x + size}" y2="${y - size}" stroke="${color}" stroke-width="1"/></g>`
      );
    }
  }

  // Render polygon overlays
  if (polygonVertices && polygonVertices.length > 0) {
    const fillColor = rgbaToCSS(polygonColor);
    const ortho = orthoViewport || viewports[0];
    const offsetX = ortho?.x ?? 0;
    const offsetY = ortho?.y ?? 0;
    const clipId = `clip-${ortho?.id || 'default'}`;
    svgParts.push(`<g id="polygon-overlays" clip-path="url(#${clipId})">`);
    for (let i = 0; i < polygonVertices.length; i++) {
      const vertices = polygonVertices[i];
      if (!vertices || vertices.length < 3) continue;

      const pointsStr = vertices.map(([x, y]) => `${x + offsetX},${y + offsetY}`).join(' ');
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
