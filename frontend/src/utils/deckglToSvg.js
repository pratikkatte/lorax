/**
 * Export DeckGL canvas to SVG, respecting viewport positions.
 * 
 * @param {object} deck - The DeckGL instance (deck.current.deck)
 * @param {Array} additionalPolygons - Optional pixel-space polygons to render
 * @param {Array} polygonColor - Optional RGBA color array [R, G, B, A] (0-255 range)
 * @returns {string} SVG content
 */
export const getSVG = (deck, additionalPolygons = [], polygonColor = [145, 194, 244, 46]) => {
    const layerManager = deck.layerManager;
    const layers = layerManager.getLayers();
    const viewports = deck.getViewports();

    // Get the canvas dimensions from the deck instance
    const { width: canvasWidth, height: canvasHeight } = deck;

    let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}">`;

    // Build a map of viewportId -> viewport for quick lookup
    const viewportMap = {};
    let clipPathDefs = '<defs>';
    for (const vp of viewports) {
        viewportMap[vp.id] = vp;
        // Create a clipPath for each viewport
        clipPathDefs += `<clipPath id="clip-${vp.id}"><rect x="${vp.x}" y="${vp.y}" width="${vp.width}" height="${vp.height}"/></clipPath>`;
    }
    clipPathDefs += '</defs>';
    svgContent += clipPathDefs;

    // Convert polygon color to CSS rgba
    const fillColor = `rgba(${polygonColor[0]}, ${polygonColor[1]}, ${polygonColor[2]}, ${polygonColor[3] / 255})`;

    // Render additional polygons (Background layer) - clipped to ortho viewport
    if (additionalPolygons && additionalPolygons.length > 0 && viewportMap['ortho']) {
        const orthoVP = viewportMap['ortho'];
        svgContent += `<g clip-path="url(#clip-ortho)">`;
        for (const polyPoints of additionalPolygons) {
            if (!Array.isArray(polyPoints) || polyPoints.length === 0) continue;
            // Add ortho viewport offset to polygon coordinates
            const pointsStr = polyPoints.map(p => `${p[0] + orthoVP.x},${p[1] + orthoVP.y}`).join(' ');
            svgContent += `<polygon points="${pointsStr}" fill="${fillColor}" stroke="none"/>`;
        }
        svgContent += '</g>';
    }

    // Track current viewport for group management
    let currentViewportId = null;

    console.log(`Processing ${layers.length} layers for SVG export, ${viewports.length} viewports`);

    // Common accessors helper (defined once, used in loop)
    const getAccessor = (layer, accessorKey, object, dflt) => {
        const funcOrValue = layer.props[accessorKey];
        if (typeof funcOrValue === 'function') {
            return funcOrValue(object);
        }
        if (Array.isArray(funcOrValue) || Number.isFinite(funcOrValue) || typeof funcOrValue === 'string') {
            return funcOrValue;
        }
        return dflt;
    };

    const normalizeColor = (c) => {
        if (!c) return 'none';
        if (c.length >= 3) {
            const a = c.length > 3 ? c[3] / 255 : 1;
            return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
        }
        return 'none';
    };

    for (const layer of layers) {
        // Skip composite layers (we want their sublayers)
        // if (layer.isComposite) continue;

        // Skip invisible layers
        // if (!layer.props.visible) continue;

        const layerViewId = layer.props.viewId;
        const viewport = viewportMap[layerViewId];

        if (!viewport) {
            // console.warn(`No viewport found for layer ${layer.id} with viewId ${layerViewId}`);
            continue;
        }

        // Viewport offset in pixels (where this viewport starts on the canvas)
        const vpX = viewport.x;
        const vpY = viewport.y;

        const { id } = layer;

        // Close previous viewport group if switching to a different viewport
        if (currentViewportId && currentViewportId !== layerViewId) {
            svgContent += '</g>';
        }

        // Open a new group for this viewport if not already open
        if (currentViewportId !== layerViewId) {
            svgContent += `<g clip-path="url(#clip-${layerViewId})">`;
            currentViewportId = layerViewId;
        }

        try {
            switch (layer.constructor.layerName) {
                case 'ScatterplotLayer': {
                    const { data } = layer.props;
                    let count = 0;

                    for (const d of data) {
                        const pos = getAccessor(layer, 'getPosition', d);
                        if (!pos) continue;

                        let worldPos = pos;
                        if (layer.props.modelMatrix) {
                            const m = layer.props.modelMatrix;
                            const x = pos[0], y = pos[1], z = pos[2] || 0;
                            worldPos = [
                                x * m[0] + y * m[4] + z * m[8] + m[12],
                                x * m[1] + y * m[5] + z * m[9] + m[13],
                            ];
                        }

                        if (!Number.isFinite(worldPos[0]) || !Number.isFinite(worldPos[1])) continue;

                        // Project to viewport-local pixels
                        const [localPx, localPy] = viewport.project(worldPos);
                        // Offset by viewport position to get canvas pixels
                        const px = localPx + vpX;
                        const py = localPy + vpY;

                        const radius = getAccessor(layer, 'getRadius', d, 1);
                        const fill = normalizeColor(getAccessor(layer, 'getFillColor', d, [0, 0, 0, 255]));
                        const stroke = normalizeColor(getAccessor(layer, 'getLineColor', d, [0, 0, 0, 0]));
                        const strokeWidth = getAccessor(layer, 'getLineWidth', d, 1);

                        svgContent += `<circle cx="${px}" cy="${py}" r="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
                        count++;
                    }
                    console.log(`Exported ${count}/${data.length} points from ${id}`);
                    break;
                }

                case 'PathLayer': {
                    const { data } = layer.props;
                    let count = 0;

                    // Debug: Log viewport offset for first path layer
                    if (id.includes('main-layer-') && count === 0) {
                        console.log(`PathLayer '${id}' using viewport '${layerViewId}' with offset x=${vpX}, y=${vpY}`);
                    }

                    for (const d of data) {
                        let path = getAccessor(layer, 'getPath', d);
                        if (!path || path.length < 2) continue;

                        // Handle flat arrays
                        if (Number.isFinite(path[0])) {
                            const newPath = [];
                            for (let i = 0; i < path.length; i += 2) {
                                newPath.push([path[i], path[i + 1]]);
                            }
                            path = newPath;
                        }

                        const m = layer.props.modelMatrix;

                        const pixelPoints = path.map(p => {
                            let worldPos = p;
                            if (m) {
                                const x = Number.isFinite(p[0]) ? p[0] : 0;
                                const y = Number.isFinite(p[1]) ? p[1] : 0;
                                const z = Number.isFinite(p[2]) ? p[2] : 0;
                                worldPos = [
                                    x * m[0] + y * m[4] + z * m[8] + m[12],
                                    x * m[1] + y * m[5] + z * m[9] + m[13],
                                ];
                            }

                            if (!Number.isFinite(worldPos[0]) || !Number.isFinite(worldPos[1])) return null;

                            try {
                                const [localPx, localPy] = viewport.project(worldPos);
                                return [localPx + vpX, localPy + vpY];
                            } catch (e) {
                                return null;
                            }
                        }).filter(p => p !== null);

                        if (pixelPoints.length < 2) continue;

                        const dStr = pixelPoints.map((p, i) => (i === 0 ? 'M' : 'L') + `${p[0]},${p[1]}`).join(' ');
                        const color = normalizeColor(getAccessor(layer, 'getColor', d, [0, 0, 0, 255]));
                        const width = getAccessor(layer, 'getWidth', d, 1);

                        // Debug: Log first path's start coordinate
                        if (count === 0 && id.includes('main-layer-')) {
                            console.log(`First path of ${id}: starts at x=${pixelPoints[0][0].toFixed(1)}, y=${pixelPoints[0][1].toFixed(1)}`);
                        }

                        svgContent += `<path d="${dStr}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
                        count++;
                    }
                    console.log(`Exported ${count}/${data.length} paths from ${id}`);
                    break;
                }

                case 'LineLayer': {
                    const { data } = layer.props;
                    let count = 0;

                    for (const d of data) {
                        const sourcePos = getAccessor(layer, 'getSourcePosition', d);
                        const targetPos = getAccessor(layer, 'getTargetPosition', d);
                        if (!sourcePos || !targetPos) continue;

                        const m = layer.props.modelMatrix;

                        // Transform source position
                        let worldSource = sourcePos;
                        if (m) {
                            const x = sourcePos[0], y = sourcePos[1], z = sourcePos[2] || 0;
                            worldSource = [
                                x * m[0] + y * m[4] + z * m[8] + m[12],
                                x * m[1] + y * m[5] + z * m[9] + m[13],
                            ];
                        }

                        // Transform target position
                        let worldTarget = targetPos;
                        if (m) {
                            const x = targetPos[0], y = targetPos[1], z = targetPos[2] || 0;
                            worldTarget = [
                                x * m[0] + y * m[4] + z * m[8] + m[12],
                                x * m[1] + y * m[5] + z * m[9] + m[13],
                            ];
                        }

                        if (!Number.isFinite(worldSource[0]) || !Number.isFinite(worldSource[1])) continue;
                        if (!Number.isFinite(worldTarget[0]) || !Number.isFinite(worldTarget[1])) continue;

                        const [srcPx, srcPy] = viewport.project(worldSource);
                        const [tgtPx, tgtPy] = viewport.project(worldTarget);

                        const x1 = srcPx + vpX;
                        const y1 = srcPy + vpY;
                        const x2 = tgtPx + vpX;
                        const y2 = tgtPy + vpY;

                        const color = normalizeColor(getAccessor(layer, 'getColor', d, [0, 0, 0, 255]));
                        const width = getAccessor(layer, 'getWidth', d, 1);

                        svgContent += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}"/>`;
                        count++;
                    }
                    console.log(`Exported ${count}/${data.length} lines from ${id}`);
                    break;
                }

                case 'SolidPolygonLayer': {
                    const { data } = layer.props;
                    let count = 0;

                    for (const d of data) {
                        const polygon = getAccessor(layer, 'getPolygon', d);
                        if (!polygon) continue;

                        const m = layer.props.modelMatrix;

                        let rings = [];
                        if (Array.isArray(polygon[0]) && Number.isFinite(polygon[0][0])) {
                            rings = [polygon];
                        } else {
                            rings = polygon;
                        }

                        let fullPathD = "";

                        rings.forEach(ring => {
                            const pixelPoints = ring.map(p => {
                                let worldPos = p;
                                if (m) {
                                    const x = p[0], y = p[1], z = p[2] || 0;
                                    worldPos = [
                                        x * m[0] + y * m[4] + z * m[8] + m[12],
                                        x * m[1] + y * m[5] + z * m[9] + m[13],
                                    ];
                                }
                                if (!Number.isFinite(worldPos[0]) || !Number.isFinite(worldPos[1])) return null;
                                const [localPx, localPy] = viewport.project(worldPos);
                                return [localPx + vpX, localPy + vpY];
                            }).filter(p => p !== null);

                            if (pixelPoints.length > 0) {
                                fullPathD += pixelPoints.map((p, i) => (i === 0 ? 'M' : 'L') + `${p[0]},${p[1]}`).join(' ') + " Z ";
                            }
                        });

                        if (!fullPathD) continue;

                        const fillColor = normalizeColor(getAccessor(layer, 'getFillColor', d, [0, 0, 0, 255]));

                        if (layer.props.filled) {
                            svgContent += `<path d="${fullPathD}" fill="${fillColor}" stroke="none" />`;
                        }
                        count++;
                    }
                    console.log(`Exported ${count}/${data.length} polygons from ${id}`);
                    break;
                }

                case 'TextLayer': {
                    const { data } = layer.props;
                    let count = 0;

                    for (const d of data) {
                        const pos = getAccessor(layer, 'getPosition', d);
                        if (!pos) continue;

                        const m = layer.props.modelMatrix;
                        let worldPos = pos;
                        if (m) {
                            const x = pos[0], y = pos[1], z = pos[2] || 0;
                            worldPos = [
                                x * m[0] + y * m[4] + z * m[8] + m[12],
                                x * m[1] + y * m[5] + z * m[9] + m[13],
                            ];
                        }

                        if (!Number.isFinite(worldPos[0]) || !Number.isFinite(worldPos[1])) continue;

                        const [localPx, localPy] = viewport.project(worldPos);
                        const px = localPx + vpX;
                        const py = localPy + vpY;


                        const text = getAccessor(layer, 'getText', d);
                        const color = normalizeColor(getAccessor(layer, 'getColor', d, [0, 0, 0, 255]));
                        const size = getAccessor(layer, 'getSize', d, 12);
                        const anchor = getAccessor(layer, 'getTextAnchor', d, 'middle');
                        const baseline = getAccessor(layer, 'getAlignmentBaseline', d, 'center');
                        const angle = getAccessor(layer, 'getAngle', d, 0);

                        let textAnchor = 'middle';
                        if (anchor === 'start') textAnchor = 'start';
                        if (anchor === 'end') textAnchor = 'end';

                        let dominantBaseline = 'middle';
                        if (baseline === 'top') dominantBaseline = 'hanging';
                        if (baseline === 'bottom') dominantBaseline = 'auto';

                        let transform = '';
                        if (angle) {
                            transform = `transform="rotate(${-angle}, ${px}, ${py})"`;
                        }

                        svgContent += `<text x="${px}" y="${py}" fill="${color}" font-family="Sans-serif" font-size="${size}" text-anchor="${textAnchor}" dominant-baseline="${dominantBaseline}" ${transform}>${text}</text>`;

                        // Debug: Log first text position per layer
                        if (count === 0) {
                            console.log(`TextLayer '${id}' first text at x=${px.toFixed(1)}, y=${py.toFixed(1)}, viewport '${layerViewId}' offset x=${vpX}, y=${vpY}`);
                        }
                        count++;
                    }
                    console.log(`Exported ${count}/${data.length} texts from ${id}`);
                    break;
                }

                case 'IconLayer': {
                    const { data } = layer.props;
                    let count = 0;

                    for (const d of data) {
                        const pos = getAccessor(layer, 'getPosition', d);
                        if (!pos) continue;

                        const m = layer.props.modelMatrix;
                        let worldPos = pos;
                        if (m) {
                            const x = pos[0], y = pos[1], z = pos[2] || 0;
                            worldPos = [
                                x * m[0] + y * m[4] + z * m[8] + m[12],
                                x * m[1] + y * m[5] + z * m[9] + m[13],
                            ];
                        }

                        if (!Number.isFinite(worldPos[0]) || !Number.isFinite(worldPos[1])) continue;

                        const [localPx, localPy] = viewport.project(worldPos);
                        const px = localPx + vpX;
                        const py = localPy + vpY;

                        const color = normalizeColor(getAccessor(layer, 'getColor', d, [255, 0, 0, 255]));
                        const size = getAccessor(layer, 'getSize', d, 12);

                        // Render icon as an X marker (matching the /X.png icon atlas used for mutations)
                        // The X is drawn as two crossed lines within a bounding box of 'size' pixels
                        const halfSize = size / 2;
                        const strokeWidth = Math.max(1, size / 6);

                        svgContent += `<g transform="translate(${px}, ${py})">`;
                        svgContent += `<line x1="${-halfSize}" y1="${-halfSize}" x2="${halfSize}" y2="${halfSize}" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round"/>`;
                        svgContent += `<line x1="${halfSize}" y1="${-halfSize}" x2="${-halfSize}" y2="${halfSize}" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round"/>`;
                        svgContent += `</g>`;

                        count++;
                    }
                    console.log(`Exported ${count}/${data.length} icons from ${id}`);
                    break;
                }

                default:
                // Unsupported layer type
            }
        } catch (err) {
            console.error(`Error processing layer ${id}:`, err);
        }
    }

    // Close the last viewport group if one is open
    if (currentViewportId) {
        svgContent += '</g>';
    }

    svgContent += `</svg>`;
    return svgContent;
};
