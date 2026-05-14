import { describe, expect, it } from 'vitest';

import { getSVG } from './deckglToSvg.js';

function makeDeck(layers) {
  const canvas = {
    width: 100,
    height: 80,
    clientWidth: 100,
    clientHeight: 80,
    toDataURL: () => 'data:image/png;base64,AAAA'
  };
  const viewport = {
    id: 'ortho',
    x: 0,
    y: 0,
    width: 100,
    height: 80,
    project: ([x, y]) => [x, y]
  };

  return {
    canvas,
    layerManager: {
      getLayers: () => layers
    },
    viewManager: {
      getViewports: () => [viewport]
    }
  };
}

describe('getSVG', () => {
  it('exports composite sublayers with binary paths, scatter points, and icons', () => {
    const pathLayer = {
      id: 'main-trees-edges',
      props: {
        data: {
          startIndices: new Uint32Array([0, 2]),
          attributes: {
            getPath: { value: new Float64Array([1, 2, 10, 20]), size: 2 }
          }
        },
        getColor: [10, 20, 30, 255],
        getWidth: 2
      }
    };
    const scatterLayer = {
      id: 'main-trees-tips',
      props: {
        data: {
          length: 1,
          attributes: {
            getPosition: { value: new Float64Array([4, 5]), size: 2 },
            getFillColor: { value: new Uint8Array([40, 50, 60, 255]), size: 4 }
          }
        },
        getRadius: 3,
        filled: true
      }
    };
    const iconLayer = {
      id: 'main-trees-mutations',
      constructor: { layerName: 'IconLayer' },
      props: {
        iconMapping: { 0: { x: 0, y: 0, width: 10, height: 10 } },
        data: {
          length: 1,
          attributes: {
            getPosition: { value: new Float64Array([7, 8]), size: 2 }
          }
        },
        getColor: [200, 0, 0, 255],
        getSize: 12
      }
    };
    const compositeLayer = {
      id: 'main-trees',
      props: {},
      internalState: {
        subLayers: [pathLayer, scatterLayer, iconLayer]
      }
    };

    const svg = getSVG(makeDeck([compositeLayer]));

    expect(svg).toContain('x1="1" y1="2" x2="10" y2="20"');
    expect(svg).toContain('cx="4" cy="5" r="3"');
    expect(svg).toContain('x1="1" y1="2" x2="13" y2="14"');
    expect(svg).not.toContain('<image href="data:image/png;base64,AAAA"');
  });

  it('escapes text and SVG attributes', () => {
    const textLayer = {
      id: 'tree-time-labels',
      props: {
        data: [{ position: [1, 2], label: '<bad & "label">' }],
        getPosition: d => d.position,
        getText: d => d.label,
        getColor: [0, 0, 0, 255],
        getSize: 12,
        fontFamily: 'A&B "Font"'
      }
    };

    const svg = getSVG(makeDeck([textLayer]));

    expect(svg).toContain('&lt;bad &amp; &quot;label&quot;&gt;');
    expect(svg).toContain('font-family="A&amp;B &quot;Font&quot;"');
    expect(svg).not.toContain('<bad & "label">');
  });

  it('paints polygon overlays behind exported tree vectors', () => {
    const pathLayer = {
      id: 'main-trees-edges',
      props: {
        data: {
          startIndices: new Uint32Array([0, 2]),
          attributes: {
            getPath: { value: new Float64Array([1, 2, 10, 20]), size: 2 }
          }
        },
        getColor: [10, 20, 30, 255],
        getWidth: 2
      }
    };

    const svg = getSVG(
      makeDeck([pathLayer]),
      [[[0, 0], [20, 0], [20, 20], [0, 20]]],
      [145, 194, 244, 46]
    );

    expect(svg.indexOf('polygon-overlays')).toBeGreaterThan(-1);
    expect(svg.indexOf('<line x1="1" y1="2"')).toBeGreaterThan(-1);
    expect(svg.indexOf('polygon-overlays')).toBeLessThan(
      svg.indexOf('<line x1="1" y1="2"')
    );
  });

  it('uses raster fallback only when no vector content was exported', () => {
    const unsupportedLayer = {
      id: 'unsupported-custom-layer',
      props: {
        data: [{ value: 1 }]
      }
    };

    const svg = getSVG(makeDeck([unsupportedLayer]));

    expect(svg).toContain('<image href="data:image/png;base64,AAAA"');
  });

  it('exports genome interval markers once without raster duplication', () => {
    const intervalLayer = {
      id: 'genome-info-grid-lines',
      props: {
        data: [10, 20],
        getSourcePosition: d => [d, 0],
        getTargetPosition: d => [d, 2],
        getColor: [100, 100, 100, 100],
        getWidth: 1,
        viewId: 'ortho'
      }
    };

    const svg = getSVG(makeDeck([intervalLayer]));

    expect(svg).not.toContain('<image href="data:image/png;base64,AAAA"');
    expect(svg.match(/<line /g)).toHaveLength(2);
    expect(svg).toContain('stroke="rgb(100, 100, 100)"');
    expect(svg).toContain('stroke-opacity="0.39215686274509803"');
  });

  it('matches live polygon fill rules for default, hover, and per-tree colors', () => {
    const svg = getSVG(
      makeDeck([]),
      [
        { key: 'a', treeIndex: 1, isHovered: false, vertices: [[0, 0], [10, 0], [10, 10]] },
        { key: 'b', treeIndex: 2, isHovered: true, vertices: [[20, 0], [30, 0], [30, 10]] },
        { key: 'c', treeIndex: 3, isHovered: false, vertices: [[40, 0], [50, 0], [50, 10]] },
        { key: 'd', treeIndex: 4, isHovered: true, vertices: [[60, 0], [70, 0], [70, 10]] }
      ],
      {
        fillColor: [145, 194, 244, 46],
        treeColors: {
          3: '#112233',
          4: '#445566'
        }
      }
    );

    expect(svg).toContain('fill="rgb(145, 194, 244)" fill-opacity="0.1803921568627451"');
    expect(svg).toContain('fill="rgb(145, 194, 244)" fill-opacity="0.3607843137254902"');
    expect(svg).toContain('fill="rgb(17, 34, 51)" fill-opacity="0.18"');
    expect(svg).toContain('fill="rgb(68, 85, 102)" fill-opacity="0.36"');
    expect(svg).not.toContain('<image href="data:image/png;base64,AAAA"');
  });

  it('uses explicit opacity attributes instead of rgba paint strings', () => {
    const textLayer = {
      id: 'tree-time-labels',
      props: {
        data: [{ position: [1, 2], label: 'semi' }],
        getPosition: d => d.position,
        getText: d => d.label,
        getColor: [20, 30, 40, 128]
      }
    };

    const svg = getSVG(makeDeck([textLayer]));

    expect(svg).toContain('fill="rgb(20, 30, 40)"');
    expect(svg).toContain('fill-opacity="0.5019607843137255"');
    expect(svg).not.toContain('rgba(');
  });
});
