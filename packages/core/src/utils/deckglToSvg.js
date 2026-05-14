/**
 * deckglToSvg.js
 * Export deck.gl visualization to SVG format, including tree geometry and polygon overlays.
 */

let nextSvgExportId = 0;

function rgbaToSvgPaint(color) {
  if (!color || color.length < 3) {
    return { color: 'rgb(0, 0, 0)', opacity: 1 };
  }
  const [r, g, b, a = 255] = color;
  return {
    color: `rgb(${r}, ${g}, ${b})`,
    opacity: Math.max(0, Math.min(1, a / 255))
  };
}

function rgbaToSvgPaintWithAlpha(color, alpha) {
  if (!color || color.length < 3) {
    return { color: 'rgb(0, 0, 0)', opacity: 1 };
  }
  const [r, g, b] = color;
  return {
    color: `rgb(${r}, ${g}, ${b})`,
    opacity: Math.max(0, Math.min(1, alpha))
  };
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function sanitizeId(value, fallback = 'default') {
  const raw = String(value || fallback);
  const safe = raw.replace(/[^A-Za-z0-9_-]/g, '_');
  return safe || fallback;
}

function numberAttr(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
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
  const roots = (
    deck?.layerManager?.getLayers?.() ||
    deck?.getLayers?.() ||
    deck?.props?.layers ||
    []
  );
  const result = [];
  const seen = new Set();
  const visit = (layer) => {
    if (!layer || seen.has(layer)) return;
    seen.add(layer);
    result.push(layer);

    const sublayers = (
      layer?.internalState?.subLayers ||
      layer?.state?.subLayers ||
      layer?.props?.layers ||
      []
    );
    if (Array.isArray(sublayers)) {
      sublayers.forEach(visit);
    }
  };

  (Array.isArray(roots) ? roots : [roots]).forEach(visit);
  return result;
}

function normalizeColor(color, fallback = [0, 0, 0, 255]) {
  if (Array.isArray(color) && color.length >= 3) return color;
  return fallback;
}

function hexToRgb(hex) {
  if (typeof hex !== 'string') return null;
  const normalized = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  return [
    parseInt(normalized.substring(0, 2), 16),
    parseInt(normalized.substring(2, 4), 16),
    parseInt(normalized.substring(4, 6), 16)
  ];
}

function getLayerId(layer) {
  return String(layer?.id || '');
}

function isInvisiblePickLayer(layer) {
  const id = getLayerId(layer);
  return id.includes('tips-pickable');
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
  if (!modelMatrix || !position || typeof position.length !== 'number') return position;
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
    if (isInvisiblePickLayer(layer)) continue;
    if (!layer?.props?.data) continue;
    const viewportId = resolveViewportId(layer);
    const modelMatrix = layer.props.modelMatrix || null;
    const data = layer.props.data;
    const layerId = layer?.id;

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
      let segmentsAdded = 0;
      let invalidPathCount = 0;
      const isLineageLayer = (layerId || '').includes('lineages');
      let lineageSample = null;
      for (const d of list) {
        try {
          const path = typeof layer.props.getPath === 'function'
            ? layer.props.getPath(d)
            : d.path;
          if (isLineageLayer && !lineageSample) {
            const first = path ? path[0] : null;
            lineageSample = {
              pathType: path?.constructor?.name || null,
              pathIsArray: Array.isArray(path),
              pathLength: path?.length ?? null,
              firstType: first == null ? null : typeof first,
              firstIsArray: Array.isArray(first),
              firstValue: Array.isArray(first) ? first.slice(0, 2) : (typeof first === 'number' ? first : null)
            };
          }
          const color = typeof layer.props.getColor === 'function'
            ? layer.props.getColor(d)
            : layer.props.getColor || [0, 0, 0, 255];

          if (path && path.length >= 2) {
            // Convert path to line segments
            const width = typeof layer.props.getWidth === 'function'
              ? layer.props.getWidth(d)
              : (typeof layer.props.getWidth === 'number'
                ? layer.props.getWidth
                : (typeof layer.props.width === 'number' ? layer.props.width : 1));
            for (let i = 0; i < path.length - 1; i++) {
              lines.push({
                source: path[i],
                target: path[i + 1],
                color,
                width,
                viewportId,
                modelMatrix,
                layerId
              });
              segmentsAdded += 1;
            }
          } else {
            invalidPathCount += 1;
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
    if (isInvisiblePickLayer(layer)) continue;
    const layerName = layer?.constructor?.layerName;
    const isLabelLayer = layerName === 'TextLayer'
      || (layerName === 'MultiIconLayer' && layer?.id?.includes('labels'));
    if (isLabelLayer) {
      continue;
    }
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
    if (isInvisiblePickLayer(layer)) continue;
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
          textAnchor: typeof layer.props.getTextAnchor === 'function'
            ? layer.props.getTextAnchor(d)
            : layer.props.getTextAnchor || 'start',
          alignmentBaseline: typeof layer.props.getAlignmentBaseline === 'function'
            ? layer.props.getAlignmentBaseline(d)
            : layer.props.getAlignmentBaseline || 'central',
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
    if (isInvisiblePickLayer(layer)) continue;
    const layerName = layer?.constructor?.layerName;
    const isMultiIconLayer = layerName === 'MultiIconLayer' || layer?.id?.includes('labels-characters');
    const isIconLayer = (layerName === 'IconLayer'
      || typeof layer?.props?.getIcon === 'function'
      || !!layer?.props?.iconAtlas
      || !!layer?.props?.iconMapping)
      && !isMultiIconLayer;
    if (!isIconLayer) continue;
    const data = layer?.props?.data;
    if (!Array.isArray(data) && !data?.attributes?.getPosition?.value) continue;
    const viewportId = resolveViewportId(layer);
    const modelMatrix = layer.props.modelMatrix || null;

    if (Array.isArray(data)) {
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

    if (data?.attributes?.getPosition?.value) {
      const positions = data.attributes.getPosition.value;
      const size = data.attributes.getPosition.size || 2;
      const length = data.length || Math.floor(positions.length / size);
      const colors = data.attributes.getColor?.value;
      const defaultColor = normalizeColor(layer.props.getColor, [0, 0, 0, 255]);
      const defaultSize = typeof layer.props.getSize === 'number' ? layer.props.getSize : 8;
      for (let i = 0; i < length; i++) {
        const idx = i * size;
        const color = colors
          ? [
              colors[i * 4],
              colors[i * 4 + 1],
              colors[i * 4 + 2],
              colors[i * 4 + 3]
            ]
          : defaultColor;
        icons.push({
          position: [positions[idx], positions[idx + 1]],
          color,
          size: defaultSize,
          viewportId,
          modelMatrix,
          layerId: layer?.id
        });
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

function appendPolygonOverlays({
  svgParts,
  polygons,
  polygonOptions,
  orthoViewport,
  viewports,
  clipIdForViewport,
  exportId
}) {
  if (!polygons || polygons.length === 0) return false;

  const ortho = orthoViewport || viewports[0];
  const offsetX = ortho?.x ?? 0;
  const offsetY = ortho?.y ?? 0;
  const clipId = clipIdForViewport(ortho);
  let rendered = false;

  svgParts.push(`<g id="lorax-${exportId}-polygon-overlays" clip-path="url(#${escapeXml(clipId)})">`);
  for (let i = 0; i < polygons.length; i++) {
    const polygon = polygons[i];
    const vertices = polygon?.vertices;
    if (!vertices || vertices.length < 3) continue;

    const fillPaint = getPolygonFillPaint(polygon, polygonOptions);
    const pointsStr = vertices.map(([x, y]) => `${numberAttr(x + offsetX)},${numberAttr(y + offsetY)}`).join(' ');
    svgParts.push(
      `<polygon points="${escapeXml(pointsStr)}" fill="${escapeXml(fillPaint.color)}" fill-opacity="${numberAttr(fillPaint.opacity, 1)}" stroke="none"/>`
    );
    rendered = true;
  }
  svgParts.push('</g>');
  return rendered;
}

function normalizePolygons(polygonData) {
  if (!Array.isArray(polygonData)) return [];
  return polygonData
    .map((item, index) => {
      if (Array.isArray(item)) {
        return { key: index, vertices: item, treeIndex: null, isHovered: false };
      }
      if (item && Array.isArray(item.vertices)) {
        return item;
      }
      return null;
    })
    .filter(Boolean);
}

function normalizePolygonOptions(optionsOrColor) {
  if (Array.isArray(optionsOrColor)) {
    return { fillColor: optionsOrColor };
  }
  return optionsOrColor && typeof optionsOrColor === 'object'
    ? optionsOrColor
    : {};
}

function getPolygonFillPaint(polygon, options = {}) {
  const fillColor = normalizeColor(options.fillColor, [145, 194, 244, 46]);
  const hoverFillColor = Array.isArray(options.hoverFillColor)
    ? options.hoverFillColor
    : [fillColor[0], fillColor[1], fillColor[2], Math.min(fillColor[3] * 2, 255)];
  const treeColors = options.treeColors || {};
  const customColor = treeColors[polygon?.treeIndex] ?? treeColors[String(polygon?.treeIndex)];

  if (customColor) {
    const rgb = hexToRgb(customColor);
    if (rgb) {
      return rgbaToSvgPaintWithAlpha(rgb, polygon?.isHovered ? 0.36 : 0.18);
    }
  }

  return rgbaToSvgPaint(polygon?.isHovered ? hoverFillColor : fillColor);
}

/**
 * Generate SVG content from deck.gl state
 * @param {Object} deck - deck.gl Deck instance
 * @param {Array<Object>|Array<Array<[number, number]>>} polygonData - Polygon records or vertex arrays
 * @param {Object|Array<number>} polygonOptionsOrColor - Polygon export options or legacy RGBA fill
 * @returns {string|null} SVG string or null if export fails
 */
export function getSVG(deck, polygonData = [], polygonOptionsOrColor = [145, 194, 244, 46]) {
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
  const exportId = nextSvgExportId++;
  const defaultClipId = `lorax-${exportId}-clip-default`;
  const viewportMap = new Map(viewports.map((vp) => [vp.id, vp]));
  const viewportClipIds = new Map(
    viewports.map((vp, index) => [vp, `lorax-${exportId}-clip-${sanitizeId(vp.id, `viewport_${index}`)}-${index}`])
  );
  const clipIdForViewport = (viewport) => viewportClipIds.get(viewport) || defaultClipId;
  const polygons = normalizePolygons(polygonData);
  const polygonOptions = normalizePolygonOptions(polygonOptionsOrColor);
  const getViewport = (viewportId) => (
    viewportMap.get(viewportId) ||
    viewports.find((vp) => vp.id === viewportId) ||
    viewports[0]
  );
  const layers = getAllLayers(deck);

  // Find the main ortho viewport
  const orthoViewport = viewports.find(vp => vp.id === 'ortho') || viewports[0];

  const viewportBounds = viewports.reduce((acc, vp) => {
    if (!vp || !Number.isFinite(vp.width) || !Number.isFinite(vp.height)) return acc;
    if (vp.width <= 0 || vp.height <= 0) return acc;
    const x = Number.isFinite(vp.x) ? vp.x : 0;
    const y = Number.isFinite(vp.y) ? vp.y : 0;
    const maxX = x + vp.width;
    const maxY = y + vp.height;
    return {
      minX: Math.min(acc.minX, x),
      minY: Math.min(acc.minY, y),
      maxX: Math.max(acc.maxX, maxX),
      maxY: Math.max(acc.maxY, maxY)
    };
  }, { minX: Number.POSITIVE_INFINITY, minY: Number.POSITIVE_INFINITY, maxX: 0, maxY: 0 });

  const hasViewportBounds = Number.isFinite(viewportBounds.minX)
    && Number.isFinite(viewportBounds.minY)
    && viewportBounds.maxX > viewportBounds.minX
    && viewportBounds.maxY > viewportBounds.minY;

  const svgMinX = hasViewportBounds ? viewportBounds.minX : 0;
  const svgMinY = hasViewportBounds ? viewportBounds.minY : 0;
  const svgWidth = hasViewportBounds ? (viewportBounds.maxX - viewportBounds.minX) : width;
  const svgHeight = hasViewportBounds ? (viewportBounds.maxY - viewportBounds.minY) : height;

  // Start building SVG
  const svgParts = [];
  svgParts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${numberAttr(svgWidth)}" height="${numberAttr(svgHeight)}" viewBox="${numberAttr(svgMinX)} ${numberAttr(svgMinY)} ${numberAttr(svgWidth)} ${numberAttr(svgHeight)}">`);

  // Add background
  svgParts.push(`<rect x="${numberAttr(svgMinX)}" y="${numberAttr(svgMinY)}" width="${numberAttr(svgWidth)}" height="${numberAttr(svgHeight)}" fill="white"/>`);

  // Create clip paths for each viewport
  svgParts.push('<defs>');
  if (viewports.length === 0) {
    svgParts.push(`<clipPath id="${escapeXml(defaultClipId)}">`);
    svgParts.push(`<rect x="0" y="0" width="${numberAttr(width)}" height="${numberAttr(height)}"/>`);
    svgParts.push('</clipPath>');
  }
  for (let index = 0; index < viewports.length; index++) {
    const vp = viewports[index];
    const clipId = clipIdForViewport(vp);
    svgParts.push(`<clipPath id="${escapeXml(clipId)}">`);
    svgParts.push(`<rect x="${numberAttr(vp.x)}" y="${numberAttr(vp.y)}" width="${numberAttr(vp.width, width)}" height="${numberAttr(vp.height, height)}"/>`);
    svgParts.push('</clipPath>');
  }
  svgParts.push('</defs>');

  // Extract and render line data from layers
  const lines = extractLineData(layers);
  const points = extractScatterData(layers);
  const labels = extractTextData(layers);
  const icons = extractIconData(layers);
  let vectorContentRendered = false;

  // Polygon spans are a background aid for tree intervals; paint them before
  // tree/axis vectors so edges, tips, ticks, and labels remain visible.
  vectorContentRendered = appendPolygonOverlays({
    svgParts,
    polygons,
    polygonOptions,
    orthoViewport,
    viewports,
    clipIdForViewport,
    exportId
  }) || vectorContentRendered;

  if (lines.length > 0) {
    for (const line of lines) {
      const viewport = getViewport(line.viewportId) || orthoViewport;
      if (!viewport) continue;
      const clipId = clipIdForViewport(viewport);
      const screenSource = projectToCanvas(viewport, line.source, line.modelMatrix);
      const screenTarget = projectToCanvas(viewport, line.target, line.modelMatrix);
      if (!screenSource || !screenTarget) continue;
      const paint = rgbaToSvgPaint(line.color);
      svgParts.push(
        `<g clip-path="url(#${escapeXml(clipId)})"><line x1="${numberAttr(screenSource[0])}" y1="${numberAttr(screenSource[1])}" x2="${numberAttr(screenTarget[0])}" y2="${numberAttr(screenTarget[1])}" stroke="${escapeXml(paint.color)}" stroke-opacity="${numberAttr(paint.opacity, 1)}" stroke-width="${numberAttr(line.width, 1)}"/></g>`
      );
      vectorContentRendered = true;
    }
  }

  if (points.length > 0) {
    for (const point of points) {
      const viewport = getViewport(point.viewportId) || orthoViewport;
      if (!viewport) continue;
      const clipId = clipIdForViewport(viewport);
      const screenPos = projectToCanvas(viewport, point.position, point.modelMatrix);
      if (!screenPos) continue;
      const fillAlphaZero = Array.isArray(point.fillColor) && point.fillColor.length >= 4 && point.fillColor[3] === 0;
      const strokeAlphaZero = Array.isArray(point.lineColor) && point.lineColor.length >= 4 && point.lineColor[3] === 0;
      const fillPaint = point.filled && !fillAlphaZero ? rgbaToSvgPaint(point.fillColor) : null;
      const strokePaint = point.stroked && point.lineColor && !strokeAlphaZero ? rgbaToSvgPaint(point.lineColor) : null;
      const fill = fillPaint ? fillPaint.color : 'none';
      const stroke = strokePaint ? strokePaint.color : 'none';
      if (fill === 'none' && stroke === 'none') continue;
      svgParts.push(
        `<g clip-path="url(#${escapeXml(clipId)})"><circle cx="${numberAttr(screenPos[0])}" cy="${numberAttr(screenPos[1])}" r="${numberAttr(point.radius, 1)}" fill="${escapeXml(fill)}" fill-opacity="${numberAttr(fillPaint?.opacity ?? 1, 1)}" stroke="${escapeXml(stroke)}" stroke-opacity="${numberAttr(strokePaint?.opacity ?? 1, 1)}" stroke-width="${numberAttr(point.lineWidth, 1)}"/></g>`
      );
      vectorContentRendered = true;
    }
  }

  if (labels.length > 0) {
    for (const label of labels) {
      const viewport = getViewport(label.viewportId) || orthoViewport;
      if (!viewport) continue;
      const clipId = clipIdForViewport(viewport);
      const screenPos = projectToCanvas(viewport, label.position, label.modelMatrix);
      if (!screenPos) continue;
      const x = screenPos[0] + (label.offset?.[0] || 0);
      const y = screenPos[1] + (label.offset?.[1] || 0);
      const paint = rgbaToSvgPaint(label.color);
      svgParts.push(
        `<g clip-path="url(#${escapeXml(clipId)})"><text x="${numberAttr(x)}" y="${numberAttr(y)}" fill="${escapeXml(paint.color)}" fill-opacity="${numberAttr(paint.opacity, 1)}" font-size="${numberAttr(label.size, 12)}" font-family="${escapeXml(label.fontFamily)}" text-anchor="${escapeXml(label.textAnchor)}" dominant-baseline="${escapeXml(label.alignmentBaseline)}">${escapeXml(label.text)}</text></g>`
      );
      vectorContentRendered = true;
    }
  }

  if (icons.length > 0) {
    for (const icon of icons) {
      const viewport = getViewport(icon.viewportId) || orthoViewport;
      if (!viewport) continue;
      const clipId = clipIdForViewport(viewport);
      const screenPos = projectToCanvas(viewport, icon.position, icon.modelMatrix);
      if (!screenPos) continue;
      const size = Math.max(2, icon.size / 2);
      const paint = rgbaToSvgPaint(icon.color);
      const x = screenPos[0];
      const y = screenPos[1];
      svgParts.push(
        `<g clip-path="url(#${escapeXml(clipId)})"><line x1="${numberAttr(x - size)}" y1="${numberAttr(y - size)}" x2="${numberAttr(x + size)}" y2="${numberAttr(y + size)}" stroke="${escapeXml(paint.color)}" stroke-opacity="${numberAttr(paint.opacity, 1)}" stroke-width="1"/></g>`
      );
      svgParts.push(
        `<g clip-path="url(#${escapeXml(clipId)})"><line x1="${numberAttr(x - size)}" y1="${numberAttr(y + size)}" x2="${numberAttr(x + size)}" y2="${numberAttr(y - size)}" stroke="${escapeXml(paint.color)}" stroke-opacity="${numberAttr(paint.opacity, 1)}" stroke-width="1"/></g>`
      );
      vectorContentRendered = true;
    }
  }

  if (!vectorContentRendered) {
    try {
      const dataURL = canvas.toDataURL('image/png');
      svgParts.splice(2, 0,
        `<image href="${escapeXml(dataURL)}" x="0" y="0" width="${numberAttr(width)}" height="${numberAttr(height)}" preserveAspectRatio="none"/>`
      );
    } catch (e) {
      console.warn('[getSVG] Could not convert canvas to data URL:', e.message);
    }
  }

  svgParts.push('</svg>');

  return svgParts.join('\n');
}

export default getSVG;
